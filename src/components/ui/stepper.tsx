import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Step = { id: string; label: string; description?: string }
export type StepState = 'complete' | 'current' | 'upcoming'

function Stepper({
  steps,
  current,
  states,
  className,
  onStepClick,
}: {
  steps: Step[]
  /** Index of the current step (used when `states` not provided). */
  current?: number
  /** Explicit per-step state; overrides `current`. */
  states?: StepState[]
  className?: string
  onStepClick?: (index: number) => void
}) {
  const stateAt = (i: number): StepState => {
    if (states) return states[i]
    if (current == null) return 'upcoming'
    if (i < current) return 'complete'
    if (i === current) return 'current'
    return 'upcoming'
  }

  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {steps.map((step, i) => {
        const state = stateAt(i)
        const clickable = onStepClick && state !== 'upcoming'
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-1 py-1 text-left outline-none',
                clickable && 'cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50',
                !clickable && 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors',
                  state === 'complete' && 'border-primary bg-primary text-primary-foreground',
                  state === 'current' && 'border-primary bg-accent text-primary',
                  state === 'upcoming' && 'border-border bg-muted text-muted-foreground'
                )}
              >
                {state === 'complete' ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="hidden min-w-0 flex-col sm:flex">
                <span
                  className={cn(
                    'truncate text-sm font-medium',
                    state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span className="truncate text-xs text-muted-foreground">{step.description}</span>
                )}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'h-px flex-1 transition-colors',
                  stateAt(i) === 'complete' ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export { Stepper }
