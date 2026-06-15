'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SelectOption = { value: string; label: string }

const sizes = {
  sm: 'h-7 px-2 text-[0.8rem]',
  md: 'h-8 px-2.5 text-sm',
}

/** Options-based Select wrapper. Pass value/onValueChange for controlled use. */
function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  size = 'md',
  className,
  id,
  'aria-label': ariaLabel,
}: {
  options: SelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  size?: keyof typeof sizes
  className?: string
  id?: string
  'aria-label'?: string
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as string)}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background font-medium text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:bg-muted/50',
          sizes[size],
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="truncate">
          {value ? (options.find((o) => o.value === value)?.label ?? value) : undefined}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronsUpDown className="size-3.5" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} className="z-50" alignItemWithTrigger={false}>
          <SelectPrimitive.Popup className="z-50 max-h-[min(24rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-lg)] outline-none transition-all duration-(--duration-fast) data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="flex cursor-default select-none items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[selected]:font-medium"
              >
                <SelectPrimitive.ItemText className="truncate">{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check className="size-3.5 text-primary" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
