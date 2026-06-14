'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Lock, TriangleAlert, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { Skeleton } from '@/components/ui/skeleton'
import { JurorSubmissionDots } from '@/components/pipeline/JurorSubmissionDots'
import { PipelineStepper } from '@/components/pipeline/PipelineStepper'
import { categoryLabel } from '@/lib/categories'
import { resolveStage, lifecycleStatus, type LifecycleStatus, type NominationLike } from '@/lib/status'
import { cn } from '@/lib/utils'

type Criterion = { key: string; label: string; min: number; max: number }
type ScoreVersion = {
  version: number
  total_score: number
  criteria_scores_json: Record<string, number> | null
  comment: string | null
  submitted_at: string
}
type AuditJuror = {
  juror_id: string
  juror_name: string
  submitted: boolean
  latest: ScoreVersion | null
  history: ScoreVersion[]
}
export type AuditData = {
  nomination: { id: string; display_id: string; nominee_name: string; company: string; master_category: string; category_key: string }
  lifecycle_status: LifecycleStatus
  assigned_count: number
  scored_count: number
  complete: boolean
  final_score: number | null
  rank: number | null
  tied: boolean
  divergence: number | null
  is_finalized: boolean
  finalized: { rank: number | null; final_score: number | null; finalized_at: string; finalized_by_name: string | null } | null
  rubric: Criterion[]
  jurors: AuditJuror[]
}

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

export function ScoreAuditPanel({
  nominationId,
  divergenceThreshold,
  onOpenReview,
}: {
  nominationId: string
  divergenceThreshold: number
  onOpenReview: () => void
}) {
  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect */
    setData(null)
    setError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/admin/nominations/${nominationId}/audit`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed to load audit')
        return json as AuditData
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [nominationId])

  if (error) {
    return <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-sm text-danger">{error}</div>
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const nomLike: NominationLike = {
    lifecycle_status: data.lifecycle_status,
    assigned_count: data.assigned_count,
    scored_count: data.scored_count,
    complete: data.complete,
    is_finalized: data.is_finalized,
    final_score: data.final_score,
    divergence: data.divergence,
    juror_scores: data.jurors
      .filter((j) => j.latest)
      .map((j) => ({ total_score: j.latest!.total_score, criteria_scores_json: j.latest!.criteria_scores_json })),
  }
  const { states, validation } = resolveStage(nomLike, { divergenceThreshold })
  const meta = lifecycleStatus(data.lifecycle_status)

  const submitted = data.jurors.filter((j) => j.latest)
  // Per-criterion divergence (when both jurors have scored) to highlight the
  // criteria driving the gap.
  const critDiff: Record<string, number> = {}
  let maxCritDiff = 0
  if (submitted.length === 2) {
    for (const c of data.rubric) {
      const a = submitted[0].latest!.criteria_scores_json?.[c.key]
      const b = submitted[1].latest!.criteria_scores_json?.[c.key]
      if (typeof a === 'number' && typeof b === 'number') {
        const d = Math.abs(a - b)
        critDiff[c.key] = d
        maxCritDiff = Math.max(maxCritDiff, d)
      }
    }
  }

  const divHigh = data.divergence != null && data.divergence >= divergenceThreshold

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {data.rank != null && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums">
              {data.rank}{data.tied ? '=' : ''}
            </span>
          )}
          <span className="text-base font-semibold text-foreground">{data.nomination.nominee_name}</span>
          <Badge variant={meta.variant} dot className={meta.pulse ? 'animate-pulse' : undefined}>
            {meta.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.nomination.company} · {categoryLabel(data.nomination.category_key)}
        </p>
        <JurorSubmissionDots
          jurors={data.jurors.map((j) => ({
            juror_id: j.juror_id,
            juror_name: j.juror_name,
            submitted: j.submitted,
            submitted_at: j.latest?.submitted_at,
          }))}
        />
      </div>

      {/* Pipeline */}
      <div className="card-surface p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline</p>
        <PipelineStepper states={states} variant="full" />
      </div>

      {/* Final-score derivation */}
      <div className="card-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Final score</p>
        {data.complete && submitted.length === 2 ? (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-foreground">{data.final_score?.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">
              = ({submitted[0].latest!.total_score} + {submitted[1].latest!.total_score}) / 2
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-3xl font-semibold tabular-nums text-muted-foreground">—</span>
            <Badge variant="warning">Incomplete · {data.scored_count} of 2 scored</Badge>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {data.rank != null && (
            <span className="text-muted-foreground">
              Rank <strong className="text-foreground">{data.rank}</strong> in {categoryLabel(data.nomination.category_key)}
            </span>
          )}
          {data.tied && <Badge variant="warning" dot>Tied</Badge>}
          {data.divergence != null && (
            <span className={cn(divHigh ? 'text-warning' : 'text-muted-foreground')}>
              {divHigh && <TriangleAlert className="mr-1 inline size-3" />}
              Divergence {Math.round(data.divergence)} (threshold {divergenceThreshold})
            </span>
          )}
        </div>
        <div className="mt-3 border-t border-border pt-3 text-xs">
          {data.is_finalized && data.finalized ? (
            <span className="flex items-center gap-1.5 text-primary">
              <Lock className="size-3.5" />
              Finalized
              {data.finalized.finalized_by_name ? ` by ${data.finalized.finalized_by_name}` : ''} on{' '}
              {fmt(data.finalized.finalized_at)}
              {(data.finalized.final_score ?? null) !== (data.final_score ?? null) && (
                <Badge variant="warning" className="ml-1">
                  Locked {data.finalized.final_score?.toFixed(1) ?? '—'} · live {data.final_score?.toFixed(1) ?? '—'}
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Not finalized</span>
          )}
        </div>
      </div>

      {/* Per-juror breakdown */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Juror breakdown</p>
        <div className="space-y-3">
          {data.jurors.length === 0 && <p className="text-sm text-muted-foreground">No jurors assigned.</p>}
          {data.jurors.map((j) => (
            <div key={j.juror_id} className="card-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{j.juror_name}</span>
                {j.latest ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">v{j.latest.version}</Badge>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{j.latest.total_score}</span>
                  </span>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </div>

              {j.latest && (
                <div className="mt-3 space-y-1.5">
                  {data.rubric.map((c) => {
                    const v = j.latest!.criteria_scores_json?.[c.key]
                    const isDriver = maxCritDiff > 0 && critDiff[c.key] === maxCritDiff
                    return (
                      <div key={c.key} className="flex items-center gap-2">
                        <span className={cn('w-40 shrink-0 truncate text-xs', isDriver ? 'font-medium text-warning' : 'text-muted-foreground')}>
                          {c.label}
                          {isDriver && <TriangleAlert className="ml-1 inline size-3" />}
                        </span>
                        <Meter className="flex-1" value={typeof v === 'number' ? v : 0} tone={isDriver ? 'warning' : 'primary'} />
                        <span className="w-8 text-right text-xs tabular-nums text-foreground">{v ?? '—'}</span>
                      </div>
                    )
                  })}
                  {j.latest.comment && (
                    <p className="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                      “{j.latest.comment}”
                    </p>
                  )}
                </div>
              )}

              {j.history.length > 1 && (
                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                    Version history ({j.history.length})
                  </summary>
                  <ol className="mt-2 space-y-1.5 border-l border-border pl-3">
                    {j.history.map((h) => (
                      <li key={h.version} className="text-xs">
                        <span className="font-medium text-foreground">v{h.version}</span>
                        <span className="ml-1.5 tabular-nums text-foreground">{h.total_score}</span>
                        <span className="ml-1.5 text-muted-foreground">· {fmt(h.submitted_at)}</span>
                        {h.comment && <span className="ml-1.5 text-muted-foreground">— “{h.comment}”</span>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Validation checklist */}
      <div className="card-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Validation</p>
        <ul className="space-y-1.5 text-sm">
          {validation.blocking.length === 0 && validation.advisory.length === 0 && (
            <li className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-4" /> All checks passed
            </li>
          )}
          {validation.blocking.map((b) => (
            <li key={b.code} className="flex items-center gap-2 text-danger">
              <XCircle className="size-4 shrink-0" />
              <span><strong>{b.label}:</strong> {b.detail}</span>
            </li>
          ))}
          {validation.advisory.map((a) => (
            <li key={a.code} className="flex items-center gap-2 text-warning">
              <TriangleAlert className="size-4 shrink-0" />
              <span><strong>{a.label}:</strong> {a.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button variant="outline" className="w-full" onClick={onOpenReview}>
        Open full review
      </Button>
    </div>
  )
}
