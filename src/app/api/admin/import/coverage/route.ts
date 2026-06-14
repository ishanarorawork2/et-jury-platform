import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { CoverageSummary } from '@/lib/import/types'

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

// Editorial-summary coverage: how many nominations per master category have a
// summary vs the total, plus overall totals. Powers the import coverage dashboard.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: noms, error: nomErr } = await service.from('nominations').select('master_category')
  if (nomErr) return NextResponse.json({ error: nomErr.message }, { status: 500 })

  const { data: summaries, error: sumErr } = await service
    .from('editorial_summary')
    .select('nominations(master_category)')
  if (sumErr) return NextResponse.json({ error: sumErr.message }, { status: 500 })

  const totalByMaster = new Map<string, number>()
  for (const n of noms ?? []) {
    const m = n.master_category || 'unknown'
    totalByMaster.set(m, (totalByMaster.get(m) ?? 0) + 1)
  }

  const withByMaster = new Map<string, number>()
  for (const s of summaries ?? []) {
    // PostgREST embeds a to-one relation as an object (or array depending on inference).
    const rel = (s as { nominations: { master_category?: string } | { master_category?: string }[] | null }).nominations
    const m = (Array.isArray(rel) ? rel[0]?.master_category : rel?.master_category) || 'unknown'
    withByMaster.set(m, (withByMaster.get(m) ?? 0) + 1)
  }

  const masters = [...new Set([...totalByMaster.keys(), ...withByMaster.keys()])].sort()
  const by_master = masters.map((master_category) => ({
    master_category,
    total: totalByMaster.get(master_category) ?? 0,
    with_summary: withByMaster.get(master_category) ?? 0,
  }))

  const total = noms?.length ?? 0
  const with_summary = summaries?.length ?? 0
  const result: CoverageSummary = { by_master, total, with_summary, pending: total - with_summary }

  return NextResponse.json(result)
}
