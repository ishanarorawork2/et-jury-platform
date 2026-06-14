'use client'

import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { toastManager, type ToastVariant } from '@/lib/toast'
import { cn } from '@/lib/utils'

const icons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
}

const iconColor: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((t) => {
    const variant = (t.type as ToastVariant) ?? 'info'
    const Icon = icons[variant] ?? Info
    return (
      <ToastPrimitive.Root
        key={t.id}
        toast={t}
        swipeDirection={['right', 'up']}
        className={cn(
          'absolute right-0 bottom-0 left-auto z-50 w-[360px] max-w-[calc(100vw-2rem)]',
          'select-none rounded-lg border border-border bg-popover p-3.5 shadow-[var(--shadow-lg)]',
          '[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-index)*-12px+var(--toast-swipe-movement-y)))_scale(calc(max(0,1-(var(--toast-index)*0.06))))]',
          'transition-all duration-(--duration-base) ease-(--ease-out)',
          'data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-offset-y)*-1-var(--toast-index)*0px+var(--toast-swipe-movement-y)))]',
          'data-[starting-style]:[transform:translateY(150%)] data-[ending-style]:opacity-0',
          'data-[ending-style]:[&[data-swipe-direction=right]]:[transform:translateX(150%)]',
          'after:absolute after:bottom-full after:left-0 after:h-3 after:w-full after:content-[""]'
        )}
        style={{ zIndex: 'calc(1000 - var(--toast-index))' } as React.CSSProperties}
      >
        <div className="flex items-start gap-2.5">
          <Icon className={cn('mt-px size-4 shrink-0', iconColor[variant])} />
          <div className="min-w-0 flex-1">
            <ToastPrimitive.Title className="text-sm font-semibold text-foreground" />
            <ToastPrimitive.Description className="mt-0.5 text-sm text-muted-foreground" />
          </div>
          <ToastPrimitive.Close className="-mr-1 -mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="size-3.5" />
          </ToastPrimitive.Close>
        </div>
      </ToastPrimitive.Root>
    )
  })
}

function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 mx-auto flex w-[360px] max-w-[calc(100vw-2rem)] sm:bottom-6 sm:right-6">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

export { Toaster }
