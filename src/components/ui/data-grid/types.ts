import type { ColumnDef, SortingState } from '@tanstack/react-table'

export type FilterOption = { value: string; label: string }

export type FilterDef = {
  /** Column id this filter targets (must match a column's id/accessorKey). */
  id: string
  label: string
  options: FilterOption[]
  /** Placeholder for the "all" option. Defaults to `All {label}`. */
  allLabel?: string
}

export type Density = 'comfortable' | 'compact'

export type DataGridProps<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  getRowId: (row: T) => string
  /** Search box placeholder. Omit to hide the search box. */
  searchPlaceholder?: string
  /** Faceted single-select filters rendered in the toolbar. */
  filters?: FilterDef[]
  enableSelection?: boolean
  /** Render per-row actions (appears in a trailing actions column). */
  rowActions?: (row: T) => React.ReactNode
  density?: Density
  enableDensityToggle?: boolean
  pageSize?: number
  /** Persist sorting/visibility/filters/density to localStorage under this key. */
  savedViewsKey?: string
  initialSorting?: SortingState
  /** Called on row click; receives the row and the current ordered row ids (for modal prev/next). */
  onRowClick?: (row: T, orderedIds: string[]) => void
  /** Extra controls on the left of the toolbar (e.g. saved-view tabs). */
  toolbarStart?: React.ReactNode
  /** Action bar contents shown when rows are selected. Receives selected rows. */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode
  emptyState?: React.ReactNode
  className?: string
}

export type { ColumnDef }
