import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import type { LifecycleStatus } from '@/lib/status'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

type AssignmentRow = { juror_id: string; nomination_id: string }
type LatestScoreRow = { juror_id: string; nomination_id: string }
type ResultRow = { master_category: string; lifecycle_status: LifecycleStatus; assigned_count: number; complete: boolean; is_finalized: boolean }

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  let jurors: { id: string; name: string }[] | null
  let assignments: AssignmentRow[]
  let scores: LatestScoreRow[]
  let results: ResultRow[]
  try {
    const [jurorsRes, assignmentRows, scoreRows, resultRows] = await Promise.all([
      service.from('jury_users').select('id, name').eq('role', 'juror').order('name'),
      fetchAll<AssignmentRow>(service, 'assignments', 'juror_id, nomination_id'),
      fetchAll<LatestScoreRow>(service, 'latest_scores', 'juror_id, nomination_id'),
      fetchAll<ResultRow>(service, 'nomination_results', 'master_category, lifecycle_status, assigned_count, complete, is_finalized'),
    ])
    jurors = jurorsRes.data
    assignments = assignmentRows
    scores = scoreRows
    results = resultRows
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // Per-juror: scored = assignments that have a latest_scores row (completion
  // derives from the score's existence, never assignments.status).
  const scoredKeys = new Set(scores.map((s) => `${s.juror_id}:${s.nomination_id}`))
  const jurorStats = (jurors ?? []).map((j) => {
    const ja = assignments.filter((a) => a.juror_id === j.id)
    const scored = ja.filter((a) => scoredKeys.has(`${j.id}:${a.nomination_id}`)).length
    return { id: j.id, name: j.name, assigned: ja.length, scored, pending: ja.length - scored }
  })

  // Per-category: counts straight off the canonical lifecycle status.
  const categories = [...new Set(results.map((r) => r.master_category))].sort()
  const categoryStats = categories.map((cat) => {
    const rows = results.filter((r) => r.master_category === cat)
    const fullyAssigned = rows.filter((r) => r.assigned_count >= 2).length
    const complete = rows.filter((r) => r.complete).length
    const finalized = rows.filter((r) => r.is_finalized).length
    return {
      category: cat,
      total: rows.length,
      fullyAssigned,
      complete,
      finalized,
      pending: fullyAssigned - complete,
      unassigned: rows.length - fullyAssigned,
    }
  })

  return NextResponse.json({ jurorStats, categoryStats })
}
