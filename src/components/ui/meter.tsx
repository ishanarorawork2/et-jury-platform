import { cn } from '@/lib/utils'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const toneBg: Record<Tone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
}

/** Single-value progress meter (a styled bar). */
function Meter({
  value,
  max = 100,
  tone = 'primary',
  className,
  trackClassName,
}: {
  value: number
  max?: number
  tone?: Tone
  className?: string
  trackClassName?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', trackClassName, className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-(--duration-slow) ease-(--ease-out)', toneBg[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Meter }
export type { Tone }
