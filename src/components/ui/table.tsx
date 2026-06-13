import { cn } from '@/lib/utils'

function TableShell({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="table-shell"
      className={cn('overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]', className)}
      {...props}
    />
  )
}

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('min-w-full text-sm', className)} {...props} />
}

function THead({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-muted/60', className)} {...props} />
}

function TBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

function TR({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('transition-colors hover:bg-muted/40', className)} {...props} />
}

function TH({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

function TD({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 text-foreground', className)} {...props} />
}

export { TableShell, Table, THead, TBody, TR, TH, TD }
