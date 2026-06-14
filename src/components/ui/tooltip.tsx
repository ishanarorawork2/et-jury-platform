'use client'

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const TooltipRoot = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: TooltipPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset} className="z-50">
        <TooltipPrimitive.Popup
          className={cn(
            'z-50 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-[var(--shadow-md)] transition-all duration-(--duration-fast) data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/** Convenience wrapper: <Tooltip content="…"><button/></Tooltip>. Delay comes from TooltipProvider. */
function Tooltip({
  content,
  children,
}: {
  content: React.ReactNode
  children: React.ReactElement
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger render={children} />
      <TooltipContent>{content}</TooltipContent>
    </TooltipRoot>
  )
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, Tooltip }
