import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-muted text-muted-foreground',
        success: 'border-success-border bg-success-subtle text-success',
        warning: 'border-warning-border bg-warning-subtle text-warning',
        danger: 'border-danger-border bg-danger-subtle text-danger',
        info: 'border-info-border bg-info-subtle text-info',
        accent: 'border-transparent bg-accent text-accent-foreground',
        outline: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

const dotColors: Record<string, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent-foreground',
  outline: 'bg-muted-foreground',
}

function Badge({
  className,
  variant,
  dot,
  children,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', dotColors[variant ?? 'neutral'])}
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
