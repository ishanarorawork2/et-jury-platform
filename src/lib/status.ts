import type { Tone } from '@/components/ui/meter'
import { DIVERGENCE_THRESHOLD, SCORE_MAX, SCORE_MIN } from '@/lib/scoring-config'

/** Variants understood by the Badge component. */
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'outline'

export type StatusMeta = { label: string; variant: BadgeVariant; tone: Tone; pulse?: boolean }

/** Per-juror scoring status on a single assignment. */
export function scoreStatus(scored: boolean): StatusMeta {
  return scored
    ? { label: 'Scored', variant: 'success', tone: 'success' }
    : { label: 'Pending', variant: 'warning', tone: 'warning' }
}

export type Coverage = 'unassigned' | 'partial' | 'assigned' | 'complete'

/**
 * Composite coverage state for a nomination, from assignment + score counts.
 * Shared by Progress, Assignments, and Nominations so labels never drift.
 */
export function coverageStatus(assignedCount: number, scoredCount: number): {
  state: Coverage
  meta: StatusMeta
} {
  if (assignedCount === 0) {
    return { state: 'unassigned', meta: { label: 'Unassigned', variant: 'danger', tone: 'danger' } }
  }
  if (assignedCount < 2) {
    return { state: 'partial', meta: { label: '1 of 2 assigned', variant: 'warning', tone: 'warning' } }
  }
  if (scoredCount >= 2) {
    return { state: 'complete', meta: { label: 'Complete', variant: 'success', tone: 'success' } }
  }
  return {
    state: 'assigned',
    meta: { label: `${scoredCount} of 2 scored`, variant: 'info', tone: 'info' },
  }
}

/** Juror activity state from their assignment load. */
export function jurorActivity(assigned: number, scored: number): StatusMeta {
  if (assigned === 0) return { label: 'Idle', variant: 'neutral', tone: 'neutral' }
  if (scored === 0) return { label: 'Not started', variant: 'danger', tone: 'danger' }
  if (scored >= assigned) return { label: 'Done', variant: 'success', tone: 'success' }
  return { label: 'In progress', variant: 'info', tone: 'info' }
}

// ── Lifecycle model ──────────────────────────────────────────────────────────
// One canonical status per nomination, computed in the `nomination_results` view
// (Postgres) and mirrored here so every screen labels and stages it identically.

export type LifecycleStatus =
  | 'unassigned'
  | 'partially_assigned'
  | 'awaiting_scores'
  | 'partially_scored'
  | 'scored'
  | 'finalized'

/**
 * The 7-stage evaluation pipeline (stable ids, never reorder). Stages 4–6 all
 * correspond to a `scored` nomination — they are differentiated by validation
 * flags and the finalized bit, not by lifecycle_status alone.
 */
export const PIPELINE_STAGES = [
  { id: 'assignment', label: 'Assignment', description: 'Two jurors assigned' },
  { id: 'jury_review', label: 'Jury Review', description: 'Jurors reading the nomination' },
  { id: 'score_submission', label: 'Score Submission', description: 'Both jurors submit scores' },
  { id: 'score_validation', label: 'Score Validation', description: 'Range & completeness checks' },
  { id: 'score_aggregation', label: 'Score Aggregation', description: 'Mean of the two totals' },
  { id: 'final_ranking', label: 'Final Ranking', description: 'Ranked within its category' },
  { id: 'admin_results', label: 'Admin Results', description: 'Finalized & locked' },
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]
export const STAGE_COUNT = PIPELINE_STAGES.length

/** Badge meta for a lifecycle status. Reuses existing variants/tones. */
export function lifecycleStatus(status: LifecycleStatus): StatusMeta {
  switch (status) {
    case 'unassigned':
      return { label: 'Unassigned', variant: 'danger', tone: 'danger' }
    case 'partially_assigned':
      return { label: '1 of 2 assigned', variant: 'warning', tone: 'warning' }
    case 'awaiting_scores':
      return { label: 'Awaiting scores', variant: 'info', tone: 'info' }
    case 'partially_scored':
      return { label: '1 of 2 scored', variant: 'info', tone: 'info', pulse: true }
    case 'scored':
      return { label: 'Scored', variant: 'success', tone: 'success' }
    case 'finalized':
      return { label: 'Finalized', variant: 'accent', tone: 'primary' }
  }
}

/** Per-juror submission chip meta. */
export function jurorSubmissionState(submitted: boolean): StatusMeta {
  return submitted
    ? { label: 'Submitted', variant: 'success', tone: 'success' }
    : { label: 'Pending', variant: 'warning', tone: 'warning' }
}

// ── Validation ───────────────────────────────────────────────────────────────

export type NominationLike = {
  lifecycle_status: LifecycleStatus
  assigned_count: number
  scored_count: number
  complete: boolean
  is_finalized: boolean
  final_score: number | null
  divergence?: number | null
  juror_scores?: { total_score: number; criteria_scores_json?: Record<string, number> | null }[]
}

export type ValidationIssue = { code: string; label: string; detail: string }
export type ValidationResult = {
  ok: boolean
  blocking: ValidationIssue[]
  advisory: ValidationIssue[]
  summary: string
}

/**
 * Validate a nomination against scoring rules.
 * Blocking: `incomplete` (< 2 scored), `out_of_range` (a stored score outside
 * [SCORE_MIN, SCORE_MAX]). Advisory: `divergence` (jurors differ by ≥ threshold).
 */
export function validateNomination(
  n: NominationLike,
  opts: { divergenceThreshold?: number } = {}
): ValidationResult {
  const threshold = opts.divergenceThreshold ?? DIVERGENCE_THRESHOLD
  const blocking: ValidationIssue[] = []
  const advisory: ValidationIssue[] = []

  if (!n.complete) {
    blocking.push({
      code: 'incomplete',
      label: 'Incomplete',
      detail: `${n.scored_count} of 2 jurors have scored`,
    })
  }

  const outOfRange = (n.juror_scores ?? []).filter((j) => {
    if (j.total_score < SCORE_MIN || j.total_score > SCORE_MAX) return true
    return Object.values(j.criteria_scores_json ?? {}).some(
      (v) => Number(v) < SCORE_MIN || Number(v) > SCORE_MAX
    )
  })
  if (outOfRange.length > 0) {
    blocking.push({
      code: 'out_of_range',
      label: 'Out of range',
      detail: `${outOfRange.length} score(s) outside ${SCORE_MIN}–${SCORE_MAX}`,
    })
  }

  if (n.divergence != null && n.divergence >= threshold) {
    advisory.push({
      code: 'divergence',
      label: 'High divergence',
      detail: `Jurors differ by ${Math.round(n.divergence)} points (≥ ${threshold})`,
    })
  }

  const ok = blocking.length === 0
  const summary = !ok
    ? blocking.map((b) => b.label).join(' · ')
    : advisory.length > 0
      ? advisory.map((a) => a.label).join(' · ')
      : 'All checks passed'

  return { ok, blocking, advisory, summary }
}

// ── Stage resolution ─────────────────────────────────────────────────────────

export type StepState = 'complete' | 'current' | 'upcoming'
export type StageResolution = {
  stageIndex: number
  states: StepState[]
  blocked: boolean
  validation: ValidationResult
}

/**
 * Map a nomination onto the 7-node pipeline rail. Stages 0–2 follow the
 * assignment/scoring lifecycle; stages 3–6 (validation → aggregation → ranking →
 * results) all apply once `scored`, gated by validation and the finalized bit.
 */
export function resolveStage(
  n: NominationLike,
  opts: { divergenceThreshold?: number } = {}
): StageResolution {
  const validation = validateNomination(n, opts)

  // `reached` = index of the stage currently in progress (the rest before it are
  // complete, the rest after are upcoming). When the whole pipeline is done we
  // mark the final stage complete rather than current.
  let reached: number
  let allDone = false

  switch (n.lifecycle_status) {
    case 'unassigned':
    case 'partially_assigned':
      reached = 0
      break
    case 'awaiting_scores':
      reached = 1
      break
    case 'partially_scored':
      reached = 2
      break
    case 'scored':
      // Validation must pass before aggregation/ranking. A failed validation
      // (e.g. an out-of-range score slipped in) parks the row at stage 3.
      reached = validation.ok ? 5 : 3
      break
    case 'finalized':
      reached = STAGE_COUNT - 1
      allDone = true
      break
  }

  const states: StepState[] = PIPELINE_STAGES.map((_, i) => {
    if (allDone) return 'complete'
    if (i < reached) return 'complete'
    if (i === reached) return 'current'
    return 'upcoming'
  })

  // "Blocked" = needs attention to advance: validation has a blocking issue, or
  // the row is stalled at assignment/partial-scoring waiting on human input.
  const blocked =
    validation.blocking.length > 0 &&
    n.lifecycle_status !== 'finalized'

  return { stageIndex: reached, states, blocked, validation }
}

// Thin back-compat wrappers re-expressed off the lifecycle status, so existing
// callers keep working while screens migrate to the model above.
export function lifecycleToCoverage(status: LifecycleStatus): Coverage {
  switch (status) {
    case 'unassigned':
      return 'unassigned'
    case 'partially_assigned':
      return 'partial'
    case 'awaiting_scores':
    case 'partially_scored':
      return 'assigned'
    case 'scored':
    case 'finalized':
      return 'complete'
  }
}
