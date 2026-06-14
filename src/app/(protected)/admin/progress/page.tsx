import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { RefreshButton } from '@/components/ui/refresh-button'
import ProgressDashboard, { type DivergentItem } from '@/components/admin/ProgressDashboard'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { DIVERGENCE_THRESHOLD } from '@/lib/scoring-config'
import type { LifecycleStatus } from '@/lib/status'

type ResultRow = {
  nomination_id: string
  nominee_name: string
  master_category: string
  category_key: string
  assigned_count: number
  scored_count: number
  complete: boolean
  is_finalized: boolean
  lifecycle_status: LifecycleStatus
}
type DivergenceRow = { nomination_id: string; divergence: number }

export default async function AdminProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()

  const [jurorsRes, assignments, scores, results, divergences] = await Promise.all([
    service.from('jury_users').select('id, name').eq('role', 'juror').order('name'),
    fetchAll<{ juror_id: string; nomination_id: string }>(service, 'assignments', 'juror_id, nomination_id'),
    fetchAll<{ juror_id: string; nomination_id: string }>(service, 'latest_scores', 'juror_id, nomination_id'),
    fetchAll<ResultRow>(
      service, 'nomination_results',
      'nomination_id, nominee_name, master_category, category_key, assigned_count, scored_count, complete, is_finalized, lifecycle_status'
    ),
    fetchAll<DivergenceRow>(service, 'score_divergence', 'nomination_id, divergence'),
  ])

  // Per-juror: scored = assignments with a latest_scores row.
  const scoredKeys = new Set(scores.map((s) => `${s.juror_id}:${s.nomination_id}`))
  const jurorStats = (jurorsRes.data ?? []).map((j) => {
    const ja = assignments.filter((a) => a.juror_id === j.id)
    const scored = ja.filter((a) => scoredKeys.has(`${j.id}:${a.nomination_id}`)).length
    return { id: j.id, name: j.name, assigned: ja.length, scored, pending: ja.length - scored }
  })

  // Group completion stats off the canonical lifecycle (one source of truth).
  function buildGroupStats(keyOf: (r: ResultRow) => string) {
    const keys = [...new Set(results.map(keyOf))].sort()
    return keys.map((key) => {
      const rows = results.filter((r) => keyOf(r) === key)
      const fullyAssigned = rows.filter((r) => r.assigned_count >= 2).length
      const complete = rows.filter((r) => r.complete).length
      const finalized = rows.filter((r) => r.is_finalized).length
      return {
        key,
        total: rows.length,
        fullyAssigned,
        complete,
        finalized,
        pending: fullyAssigned - complete,
        unassigned: rows.length - fullyAssigned,
      }
    })
  }

  const categoryStats = buildGroupStats((r) => r.master_category)
  const subCategoryStats = buildGroupStats((r) => r.category_key)

  // High-divergence nominations for the attention list.
  const resultById = new Map(results.map((r) => [r.nomination_id, r]))
  const divergentItems: DivergentItem[] = divergences
    .filter((d) => Number(d.divergence) >= DIVERGENCE_THRESHOLD)
    .map((d) => {
      const r = resultById.get(d.nomination_id)
      return {
        id: d.nomination_id,
        nominee_name: r?.nominee_name ?? 'Unknown',
        category_key: r?.category_key ?? '',
        divergence: Math.round(Number(d.divergence)),
      }
    })
    .sort((a, b) => b.divergence - a.divergence)

  const totalNoms = results.length
  const totalFullyAssigned = categoryStats.reduce((n, c) => n + c.fullyAssigned, 0)
  const totalComplete = categoryStats.reduce((n, c) => n + c.complete, 0)
  const totalFinalized = categoryStats.reduce((n, c) => n + c.finalized, 0)
  const totalUnassigned = categoryStats.reduce((n, c) => n + c.unassigned, 0)
  const totalPending = categoryStats.reduce((n, c) => n + c.pending, 0)

  return (
    <div className="mx-auto max-w-[80rem]">
      <PageHeader
        title="Progress"
        description="Assignment and scoring completion across the panel"
        actions={<RefreshButton />}
      />

      <ProgressDashboard
        totals={{
          total: totalNoms,
          fullyAssigned: totalFullyAssigned,
          complete: totalComplete,
          finalized: totalFinalized,
          unassigned: totalUnassigned,
          pending: totalPending,
        }}
        categoryStats={categoryStats}
        subCategoryStats={subCategoryStats}
        jurorStats={jurorStats}
        divergentItems={divergentItems}
        divergenceThreshold={DIVERGENCE_THRESHOLD}
      />
    </div>
  )
}
