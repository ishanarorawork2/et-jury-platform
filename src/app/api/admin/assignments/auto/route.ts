import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

type AssignmentRow = {
  nomination_id: string
  juror_id: string
  assigned_by: string
  status: 'pending'
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { master_category, category_keys, juror_ids } = await req.json()
  if (!master_category || !Array.isArray(juror_ids) || juror_ids.length < 1) {
    return NextResponse.json(
      { error: 'master_category and at least 1 juror_id are required' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  let nomQuery = service
    .from('nominations')
    // Only nominations with a matched editorial summary are eligible for assignment.
    .select('id, company, editorial_summary!inner(id), assignments(juror_id)')
    .eq('master_category', master_category)
  if (Array.isArray(category_keys) && category_keys.length > 0) {
    nomQuery = nomQuery.in('category_key', category_keys)
  }

  const [{ data: nominations }, { data: allConflicts }] = await Promise.all([
    nomQuery,
    service
      .from('conflicts')
      .select('juror_id, company')
      .in('juror_id', juror_ids),
  ])

  if (!nominations?.length) {
    return NextResponse.json({ error: 'No nominations found for the selected category/sub-category' }, { status: 404 })
  }

  // Build conflict map: juror_id → Set<company_lower>
  const conflictMap = new Map<string, Set<string>>()
  for (const c of (allConflicts ?? [])) {
    if (!conflictMap.has(c.juror_id)) conflictMap.set(c.juror_id, new Set())
    conflictMap.get(c.juror_id)!.add(c.company.toLowerCase())
  }

  // Load balance: track how many nominations each juror is getting this run
  const loadMap = new Map<string, number>(juror_ids.map((id: string) => [id, 0]))

  const toInsert: AssignmentRow[] = []
  let skipped = 0

  for (const nom of nominations) {
    const alreadyAssigned = new Set(
      ((nom.assignments ?? []) as { juror_id: string }[]).map(a => a.juror_id)
    )
    const slotsNeeded = 2 - alreadyAssigned.size
    if (slotsNeeded <= 0) continue

    const eligible = (juror_ids as string[]).filter(jid => {
      if (alreadyAssigned.has(jid)) return false
      const conflicts = conflictMap.get(jid)
      if (conflicts?.has(nom.company.toLowerCase())) return false
      return true
    })

    if (eligible.length === 0) {
      skipped++
      continue
    }

    // Fill as many slots as the eligible pool allows (may be fewer than slotsNeeded when pool is small)
    const fillCount = Math.min(eligible.length, slotsNeeded)

    // Pick the least-loaded eligible jurors
    const picks = [...eligible]
      .sort((a, b) => (loadMap.get(a) ?? 0) - (loadMap.get(b) ?? 0))
      .slice(0, fillCount)

    for (const jid of picks) {
      toInsert.push({ nomination_id: nom.id, juror_id: jid, assigned_by: admin.id, status: 'pending' })
      loadMap.set(jid, (loadMap.get(jid) ?? 0) + 1)
    }
  }

  if (toInsert.length > 0) {
    const { error } = await service.from('assignments').upsert(toInsert, {
      onConflict: 'juror_id,nomination_id',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ assigned: toInsert.length, skipped })
}
