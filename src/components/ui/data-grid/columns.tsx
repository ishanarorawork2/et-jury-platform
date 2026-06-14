'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'

/** A checkbox column for bulk selection. Spread into your columns array. */
export function selectionColumn<T>(): ColumnDef<T> {
  return {
    id: '__select',
    size: 36,
    enableSorting: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label="Select all rows"
        className="size-3.5 cursor-pointer accent-primary"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label="Select row"
        className="size-3.5 cursor-pointer accent-primary"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
    ),
  }
}

/** A trailing actions column. */
export function actionsColumn<T>(render: (row: T) => React.ReactNode): ColumnDef<T> {
  return {
    id: '__actions',
    size: 48,
    enableSorting: false,
    header: () => null,
    cell: ({ row }) => (
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        {render(row.original)}
      </div>
    ),
  }
}

export const numericCell = (className?: string) =>
  cn('text-right tabular-nums', className)
