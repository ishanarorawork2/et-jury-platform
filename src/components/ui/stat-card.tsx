import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from './meter'

const accentTone: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-muted-foreground',
}

const iconTone: Record<Tone, string> = {
  primary: 'bg-accent text-accent-foreground',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  neutral: 'bg-muted text-muted-foreground',
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  emphasis,
  footer,
  className,
  onClick,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  /** Render the value in the tone color (use for the headline metric). */
  emphasis?: boolean
  footer?: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'card-surface flex flex-col gap-3 p-4 text-left',
        onClick && 'cursor-pointer transition-shadow hover:shadow-[var(--shadow-md)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span className={cn('flex size-7 items-center justify-center rounded-md', iconTone[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span
          className={cn(
            'text-3xl font-semibold leading-none tracking-tight tabular-nums',
            emphasis ? accentTone[tone] : 'text-foreground'
          )}
        >
          {value}
        </span>
        {hint && <span className="pb-0.5 text-xs text-muted-foreground">{hint}</span>}
      </div>
      {footer && <div className="text-xs text-muted-foreground">{footer}</div>}
    </Comp>
  )
}

export { StatCard }
