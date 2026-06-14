'use client'

import { CheckCircle2, CircleDashed, Scale, GitFork } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Compact validation chip-row for a set of nominations (a category or the whole
 * panel): complete / incomplete / high-divergence / ties. Shown on results
 * category headers and progress.
 */
export function ValidationSummary({
  complete,
  incomplete,
  divergent,
  tied,
  divergenceThreshold,
  className,
}: {
  complete: number
  incomplete: number
  divergent: number
  tied: number
  divergenceThreshold: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="size-3" />
        {complete} complete
      </Badge>
      {incomplete > 0 && (
        <Badge variant="neutral" className="gap-1">
          <CircleDashed className="size-3" />
          {incomplete} incomplete
        </Badge>
      )}
      {divergent > 0 && (
        <Badge variant="warning" className="gap-1" title={`Jurors differ by ≥ ${divergenceThreshold} points`}>
          <Scale className="size-3" />
          {divergent} divergent
        </Badge>
      )}
      {tied > 0 && (
        <Badge variant="warning" dot className="gap-1">
          <GitFork className="size-3" />
          {tied} tied
        </Badge>
      )}
    </div>
  )
}
