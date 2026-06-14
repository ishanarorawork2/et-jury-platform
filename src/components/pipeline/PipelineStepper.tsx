'use client'

import { Stepper } from '@/components/ui/stepper'
import { Tooltip } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import {
  PIPELINE_STAGES,
  lifecycleStatus,
  type StepState,
  type LifecycleStatus,
} from '@/lib/status'
import { cn } from '@/lib/utils'

type Variant = 'full' | 'compact' | 'inline'

function stateLabel(state: StepState): string {
  return state === 'complete' ? 'done' : state === 'current' ? 'in progress' : 'pending'
}

function segClass(state: StepState): string {
  return state === 'complete'
    ? 'bg-primary'
    : state === 'current'
      ? 'bg-info'
      : 'bg-border'
}

/**
 * Renders a nomination's position on the 7-stage pipeline.
 * - `full`    — labelled Stepper (drawers / page headers only; never a table cell)
 * - `compact` — a 7-segment rail with per-stage tooltips
 * - `inline`  — lifecycle badge + a micro-rail, dense enough for table rows
 */
export function PipelineStepper({
  states,
  variant = 'compact',
  lifecycle,
  className,
}: {
  states: StepState[]
  variant?: Variant
  lifecycle?: LifecycleStatus
  className?: string
}) {
  if (variant === 'full') {
    return (
      <Stepper
        steps={PIPELINE_STAGES.map((s) => ({ id: s.id, label: s.label, description: s.description }))}
        states={states}
        orientation="vertical"
        className={className}
      />
    )
  }

  if (variant === 'compact') {
    return (
      <ol className={cn('flex items-center gap-1', className)}>
        {PIPELINE_STAGES.map((s, i) => (
          <Tooltip key={s.id} content={`${i + 1}. ${s.label} — ${stateLabel(states[i])}`}>
            <li
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                segClass(states[i]),
                states[i] === 'current' && 'animate-pulse'
              )}
            />
          </Tooltip>
        ))}
      </ol>
    )
  }

  // inline
  const meta = lifecycle ? lifecycleStatus(lifecycle) : null
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {meta && (
        <Badge variant={meta.variant} dot className={meta.pulse ? 'animate-pulse' : undefined}>
          {meta.label}
        </Badge>
      )}
      <span aria-hidden className="flex items-center gap-0.5">
        {PIPELINE_STAGES.map((s, i) => (
          <span key={s.id} className={cn('h-1 w-2 rounded-full', segClass(states[i]))} />
        ))}
      </span>
    </div>
  )
}
