import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// PostgREST caps a single select at 1000 rows by default. The assignments and
// nominations tables exceed that, so page through with .range() and concatenate
// — otherwise per-juror and per-category totals are silently truncated.
async function fetchAll<T>(
  service: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await service
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...(data as T[]))
    if (data.length < pageSize) break
  }
  return rows
}

type AssignmentRow = { id: string; juror_id: string; nomination_id: string; status: string }
type NominationRow = { id: string; master_category: string }

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  let jurors: { id: string; name: string }[] | null
  let assignments: AssignmentRow[]
  let nominations: NominationRow[]
  try {
    const [jurorsRes, assignmentRows, nominationRows] = await Promise.all([
      service.from('jury_users').select('id, name').eq('role', 'juror').order('name'),
      fetchAll<AssignmentRow>(service, 'assignments', 'id, juror_id, nomination_id, status'),
      fetchAll<NominationRow>(service, 'nominations', 'id, master_category'),
    ])
    jurors = jurorsRes.data
    assignments = assignmentRows
    nominations = nominationRows
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // Per-juror stats
  const jurorStats = (jurors ?? []).map(j => {
    const ja = (assignments ?? []).filter(a => a.juror_id === j.id)
    const scored = ja.filter(a => a.status === 'scored').length
    return { id: j.id, name: j.name, assigned: ja.length, scored, pending: ja.length - scored }
  })

  // Per-category stats
  const categories = [...new Set((nominations ?? []).map(n => n.master_category))].sort()
  const categoryStats = categories.map(cat => {
    const catNomIds = new Set(
      (nominations ?? []).filter(n => n.master_category === cat).map(n => n.id)
    )
    const catAssignments = (assignments ?? []).filter(a => catNomIds.has(a.nomination_id))

    const byNom = new Map<string, typeof catAssignments>()
    for (const a of catAssignments) {
      if (!byNom.has(a.nomination_id)) byNom.set(a.nomination_id, [])
      byNom.get(a.nomination_id)!.push(a)
    }

    let fullyAssigned = 0
    let complete = 0
    for (const aList of byNom.values()) {
      if (aList.length >= 2) {
        fullyAssigned++
        if (aList.every(a => a.status === 'scored')) complete++
      }
    }

    return {
      category: cat,
      total: catNomIds.size,
      fullyAssigned,
      complete,
      pending: fullyAssigned - complete,
      unassigned: catNomIds.size - fullyAssigned,
    }
  })

  return NextResponse.json({ jurorStats, categoryStats })
}
