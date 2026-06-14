import type { Tone } from '@/components/ui/meter'

/** Variants understood by the Badge component. */
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'outline'

export type StatusMeta = { label: string; variant: BadgeVariant; tone: Tone }

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
