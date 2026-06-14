'use client'

import { Check, Clock } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type JurorChip = {
  juror_id: string
  juror_name: string
  submitted: boolean
  submitted_at?: string | null
}

function fmt(ts?: string | null): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ''
  }
}

/**
 * Per-juror avatar chips: success (submitted) vs warning (pending), with a
 * tooltip showing the juror's name and submission time. Used in the nominations
 * browser, progress drill-down, results juror column and the audit header.
 */
export function JurorSubmissionDots({
  jurors,
  size = 'sm',
  className,
}: {
  jurors: JurorChip[]
  size?: 'sm' | 'md'
  className?: string
}) {
  if (jurors.length === 0) {
    return <span className={cn('text-xs text-muted-foreground/60', className)}>—</span>
  }
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {jurors.map((j) => (
        <Tooltip
          key={j.juror_id}
          content={
            <span>
              {j.juror_name} — {j.submitted ? `submitted ${fmt(j.submitted_at)}` : 'pending'}
            </span>
          }
        >
          <span className="relative inline-flex">
            <Avatar name={j.juror_name} size={size} />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 inline-flex size-3.5 items-center justify-center rounded-full border-2 border-card text-white',
                j.submitted ? 'bg-success' : 'bg-warning'
              )}
            >
              {j.submitted ? <Check className="size-2" /> : <Clock className="size-2" />}
            </span>
          </span>
        </Tooltip>
      ))}
    </div>
  )
}
