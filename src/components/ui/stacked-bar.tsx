import { cn } from '@/lib/utils'
import type { Tone } from './meter'

const toneBg: Record<Tone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted-foreground/40',
}

export type Segment = { label: string; value: number; tone: Tone }

/** Horizontal stacked bar — segments sum to a track. Zero-value segments are skipped. */
function StackedBar({
  segments,
  className,
  height = 'h-2',
  rounded = true,
}: {
  segments: Segment[]
  className?: string
  height?: string
  rounded?: boolean
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div
      className={cn(
        'flex w-full overflow-hidden bg-muted',
        rounded && 'rounded-full',
        height,
        className
      )}
    >
      {total === 0
        ? null
        : segments
            .filter((s) => s.value > 0)
            .map((s, i) => (
              <div
                key={`${s.label}-${i}`}
                className={cn('h-full transition-[width] duration-(--duration-slow) ease-(--ease-out)', toneBg[s.tone])}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value}`}
              />
            ))}
    </div>
  )
}

export { StackedBar }
