import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Download, FileSpreadsheet } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import ResultsBrowser, { type ResultRow, type FinalizedMeta } from '@/components/admin/ResultsBrowser'
import { RefreshButton } from '@/components/ui/refresh-button'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { DIVERGENCE_THRESHOLD } from '@/lib/scoring-config'
import type { LifecycleStatus } from '@/lib/status'

// View row shapes (read via service role for correct, RLS-bypassing aggregates).
type RankingRow = {
  nomination_id: string
  display_id: string
  nominee_name: string
  company: string
  master_category: string
  category_key: string
  assigned_count: number
  scored_count: number
  final_score: number | null
  complete: boolean
  is_finalized: boolean
  lifecycle_status: LifecycleStatus
  rank: number | null
  tied: boolean
}
type LatestScoreRow = {
  nomination_id: string
  juror_id: string
  total_score: number
  version: number
  criteria_scores_json: Record<string, number> | null
  comment: string | null
  submitted_at: string
}
type DivergenceRow = { nomination_id: string; divergence: number }
type FinalizedRow = {
  category_key: string
  nomination_id: string
  rank: number | null
  final_score: number | null
  finalized_by: string | null
  finalized_at: string
}

export default async function AdminResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()

  const [rankings, latestScores, divergences, finalized, jurorsRes] = await Promise.all([
    fetchAll<RankingRow>(
      service,
      'category_rankings',
      'nomination_id, display_id, nominee_name, company, master_category, category_key, assigned_count, scored_count, final_score, complete, is_finalized, lifecycle_status, rank, tied'
    ),
    fetchAll<LatestScoreRow>(
      service,
      'latest_scores',
      'nomination_id, juror_id, total_score, version, criteria_scores_json, comment, submitted_at'
    ),
    fetchAll<DivergenceRow>(service, 'score_divergence', 'nomination_id, divergence'),
    fetchAll<FinalizedRow>(service, 'finalized_rankings', 'category_key, nomination_id, rank, final_score, finalized_by, finalized_at'),
    service.from('jury_users').select('id, name'),
  ])

  const jurorMap = new Map((jurorsRes.data ?? []).map((j) => [j.id, j.name]))
  const divergenceMap = new Map(divergences.map((d) => [d.nomination_id, Number(d.divergence)]))
  const finalizedMap = new Map(finalized.map((f) => [f.nomination_id, f]))

  // Latest scores grouped per nomination, enriched with juror name.
  const scoresByNom = new Map<string, ResultRow['juror_scores']>()
  for (const s of latestScores) {
    const list = scoresByNom.get(s.nomination_id) ?? []
    list.push({
      juror_id: s.juror_id,
      juror_name: jurorMap.get(s.juror_id) ?? 'Unknown',
      total_score: Number(s.total_score),
      version: s.version,
      criteria_scores_json: s.criteria_scores_json,
      comment: s.comment,
      submitted_at: s.submitted_at,
    })
    scoresByNom.set(s.nomination_id, list)
  }
  for (const list of scoresByNom.values()) list.sort((a, b) => a.juror_name.localeCompare(b.juror_name))

  const rows: ResultRow[] = rankings.map((r) => {
    const snap = finalizedMap.get(r.nomination_id)
    return {
      id: r.nomination_id,
      nomination_id: r.display_id,
      nominee_name: r.nominee_name,
      company: r.company,
      master_category: r.master_category,
      category_key: r.category_key,
      complete: r.complete,
      final_score: r.final_score != null ? Number(r.final_score) : null,
      juror_scores: scoresByNom.get(r.nomination_id) ?? [],
      rank: r.rank,
      tied: r.tied,
      lifecycle_status: r.lifecycle_status,
      assigned_count: r.assigned_count,
      scored_count: r.scored_count,
      divergence: divergenceMap.get(r.nomination_id) ?? null,
      finalized: r.is_finalized,
      snapshot: snap
        ? {
            rank: snap.rank,
            final_score: snap.final_score != null ? Number(snap.final_score) : null,
            finalized_at: snap.finalized_at,
            finalized_by_name: snap.finalized_by ? jurorMap.get(snap.finalized_by) ?? null : null,
          }
        : null,
    }
  })

  // Group by master category for display; ranking itself is per category_key.
  const categoryResults: Record<string, ResultRow[]> = {}
  for (const r of rows) {
    ;(categoryResults[r.master_category] ??= []).push(r)
  }
  for (const list of Object.values(categoryResults)) {
    list.sort((a, b) => {
      // Complete (ranked) rows first, ordered by category then rank; rest after.
      if (a.complete !== b.complete) return a.complete ? -1 : 1
      const cat = a.category_key.localeCompare(b.category_key)
      if (cat !== 0) return cat
      return (a.rank ?? 9999) - (b.rank ?? 9999)
    })
  }

  // Per-category finalize state for the category headers.
  const finalizedByCategory: Record<string, FinalizedMeta> = {}
  for (const f of finalized) {
    const existing = finalizedByCategory[f.category_key]
    if (!existing) {
      finalizedByCategory[f.category_key] = {
        count: 1,
        finalized_at: f.finalized_at,
        finalized_by_name: f.finalized_by ? jurorMap.get(f.finalized_by) ?? null : null,
      }
    } else {
      existing.count += 1
    }
  }

  const allRows = rows
  const totalComplete = allRows.filter((r) => r.complete).length
  const totalTied = allRows.filter((r) => r.tied).length

  return (
    <div className="mx-auto max-w-[80rem]">
      <PageHeader
        title="Results & Rankings"
        description={
          <>
            {totalComplete} complete · {allRows.length - totalComplete} incomplete
            {totalTied > 0 && <span className="ml-2 text-warning">· {totalTied} tied nominations</span>}
          </>
        }
        actions={
          <div className="flex gap-2">
            <RefreshButton />
            <Button variant="outline" render={<a href="/api/admin/results/export?scope=scorecard" />}>
              <FileSpreadsheet className="size-4" />
              Jury Scorecard
            </Button>
            <Button render={<a href="/api/admin/results/export?scope=all" />}>
              <Download className="size-4" />
              Final Awards
            </Button>
          </div>
        }
      />

      <ResultsBrowser
        categoryResults={categoryResults}
        finalizedByCategory={finalizedByCategory}
        divergenceThreshold={DIVERGENCE_THRESHOLD}
      />
    </div>
  )
}
