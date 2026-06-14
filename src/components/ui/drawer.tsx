'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerClose = DialogPrimitive.Close

const drawerVariants = cva(
  'fixed z-50 flex flex-col bg-card shadow-[var(--shadow-xl)] outline-none transition-transform duration-(--duration-base) ease-(--ease-out)',
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 h-full border-l border-border data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full',
        left: 'inset-y-0 left-0 h-full border-r border-border data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full',
        bottom:
          'inset-x-0 bottom-0 w-full border-t border-border data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full',
      },
      size: {
        sm: '',
        md: '',
        lg: '',
        xl: '',
      },
    },
    compoundVariants: [
      { side: ['right', 'left'], size: 'sm', class: 'w-full max-w-sm' },
      { side: ['right', 'left'], size: 'md', class: 'w-full max-w-md' },
      { side: ['right', 'left'], size: 'lg', class: 'w-full max-w-2xl' },
      { side: ['right', 'left'], size: 'xl', class: 'w-full max-w-4xl' },
      { side: 'bottom', size: 'sm', class: 'max-h-[40vh]' },
      { side: 'bottom', size: 'md', class: 'max-h-[60vh]' },
      { side: 'bottom', size: 'lg', class: 'max-h-[80vh]' },
      { side: 'bottom', size: 'xl', class: 'max-h-[90vh]' },
    ],
    defaultVariants: { side: 'right', size: 'md' },
  }
)

function DrawerContent({
  className,
  children,
  side = 'right',
  size = 'md',
  showClose = true,
  ...props
}: DialogPrimitive.Popup.Props &
  VariantProps<typeof drawerVariants> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-(--duration-base) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Popup className={cn(drawerVariants({ side, size }), className)} {...props}>
        {showClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-1 border-b border-border px-6 py-4 pr-12', className)}
      {...props}
    />
  )
}

function DrawerBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border px-6 py-4',
        className
      )}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function DrawerDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
