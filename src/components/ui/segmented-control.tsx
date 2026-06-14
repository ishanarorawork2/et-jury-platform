'use client'

import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Toggle } from '@base-ui/react/toggle'
import { cn } from '@/lib/utils'

export type SegmentedOption<T extends string> = {
  value: T
  label?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  'aria-label'?: string
}

/** Single-select segmented control built on Base UI ToggleGroup. */
function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  size = 'md',
}: {
  options: SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(groupValue) => {
        const next = groupValue[groupValue.length - 1] as T | undefined
        if (next) onValueChange(next)
      }}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5',
        className
      )}
    >
      {options.map((opt) => (
        <Toggle
          key={opt.value}
          value={opt.value}
          aria-label={opt['aria-label']}
          className={cn(
            'inline-flex select-none items-center justify-center gap-1.5 rounded-md font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[pressed]:bg-card data-[pressed]:text-foreground data-[pressed]:shadow-[var(--shadow-xs)]',
            size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
            '[&_svg]:size-4'
          )}
        >
          {opt.icon && <opt.icon className="" />}
          {opt.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}

export { SegmentedControl }
