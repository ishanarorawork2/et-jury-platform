'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { cn } from '@/lib/utils'
import { actionsColumn } from './columns'
import type { DataGridProps } from './types'

const DENSITY_STORAGE = (key: string) => `dg:${key}`

export function DataGrid<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder,
  filters = [],
  rowActions,
  density: densityProp = 'comfortable',
  enableDensityToggle = true,
  pageSize = 25,
  savedViewsKey,
  initialSorting = [],
  onRowClick,
  toolbarStart,
  bulkActions,
  emptyState,
  className,
}: DataGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [density, setDensity] = useState(densityProp)
  const [hydrated, setHydrated] = useState(false)

  // Restore saved view.
  useEffect(() => {
    if (!savedViewsKey) return
    try {
      const raw = localStorage.getItem(DENSITY_STORAGE(savedViewsKey))
      if (raw) {
        const v = JSON.parse(raw)
        if (v.sorting) setSorting(v.sorting)
        if (v.columnFilters) setColumnFilters(v.columnFilters)
        if (v.columnVisibility) setColumnVisibility(v.columnVisibility)
        if (v.density) setDensity(v.density)
      }
    } catch {}
    setHydrated(true)
  }, [savedViewsKey])

  // Persist saved view.
  useEffect(() => {
    if (!savedViewsKey || !hydrated) return
    try {
      localStorage.setItem(
        DENSITY_STORAGE(savedViewsKey),
        JSON.stringify({ sorting, columnFilters, columnVisibility, density })
      )
    } catch {}
  }, [savedViewsKey, hydrated, sorting, columnFilters, columnVisibility, density])

  const resolvedColumns = useMemo(
    () => (rowActions ? [...columns, actionsColumn(rowActions)] : columns),
    [columns, rowActions]
  )

  const table = useReactTable({
    data,
    columns: resolvedColumns,
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection },
    getRowId: (row) => getRowId(row),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
    initialState: { pagination: { pageSize } },
  })

  const orderedIds = useMemo(
    () => table.getRowModel().rows.map((r) => getRowId(r.original)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getRowModel().rows]
  )

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide() && !c.id.startsWith('__'))

  const activeFilterCount = columnFilters.length + (globalFilter ? 1 : 0)
  const totalRows = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {toolbarStart}
        {searchPlaceholder && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-56 rounded-lg border border-border bg-background pl-8 pr-7 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {filters.map((f) => {
          const col = table.getColumn(f.id)
          const value = (col?.getFilterValue() as string) ?? ''
          return (
            <Select
              key={f.id}
              aria-label={f.label}
              value={value}
              onValueChange={(v) => col?.setFilterValue(v || undefined)}
              placeholder={f.allLabel ?? `All ${f.label.toLowerCase()}`}
              options={[{ value: '', label: f.allLabel ?? `All ${f.label.toLowerCase()}` }, ...f.options]}
              className="h-8"
            />
          )
        })}

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setColumnFilters([])
              setGlobalFilter('')
            }}
          >
            Clear
            <X className="size-3.5" />
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {enableDensityToggle && (
            <SegmentedControl
              size="sm"
              value={density}
              onValueChange={(v) => setDensity(v)}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          )}
          {hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Settings2 className="size-3.5" />
                    Columns
                  </Button>
                }
              />
              <DropdownMenuContent>
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                {hideableColumns.map((col) => {
                  const label =
                    typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                  return (
                    <MenuPrimitive.CheckboxItem
                      key={col.id}
                      checked={col.getIsVisible()}
                      onCheckedChange={(checked) => col.toggleVisibility(checked)}
                      closeOnClick={false}
                      className="flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm capitalize outline-none data-[highlighted]:bg-muted"
                    >
                      <span className="flex size-3.5 items-center justify-center rounded border border-border data-[checked]:border-primary">
                        <MenuPrimitive.CheckboxItemIndicator>
                          <span className="size-2 rounded-[2px] bg-primary" />
                        </MenuPrimitive.CheckboxItemIndicator>
                      </span>
                      {label}
                    </MenuPrimitive.CheckboxItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkActions && selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm">
          <span className="font-medium text-accent-foreground">
            {selectedRows.length} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions(selectedRows, () => setRowSelection({}))}
          </div>
          <button
            onClick={() => setRowSelection({})}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Table */}
      {totalRows === 0 ? (
        emptyState ?? (
          <div className="card-surface border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">No rows match the current filters.</p>
          </div>
        )
      ) : (
        <div
          data-density={density}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border">
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort()
                      const sorted = header.column.getIsSorted()
                      return (
                        <th
                          key={header.id}
                          className={cn(
                            'whitespace-nowrap px-(--cell-px,1rem) py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
                            canSort && 'cursor-pointer select-none hover:text-foreground'
                          )}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort &&
                              (sorted === 'asc' ? (
                                <ArrowUp className="size-3" />
                              ) : sorted === 'desc' ? (
                                <ArrowDown className="size-3" />
                              ) : (
                                <ChevronsUpDown className="size-3 opacity-40" />
                              ))}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original, orderedIds) : undefined}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer',
                      row.getIsSelected() ? 'bg-accent/50' : 'hover:bg-muted/40'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-(--cell-px,1rem) py-(--cell-py,0.625rem) align-middle text-foreground"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalRows > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing{' '}
            <span className="font-medium text-foreground tabular-nums">
              {pageIndex * table.getState().pagination.pageSize + 1}–
              {Math.min((pageIndex + 1) * table.getState().pagination.pageSize, totalRows)}
            </span>{' '}
            of <span className="font-medium text-foreground tabular-nums">{totalRows}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft className="size-3.5" />
              Prev
            </Button>
            <span className="tabular-nums">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
