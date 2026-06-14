'use client'

import { useMemo } from 'react'
import { FileX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DataGrid, type ColumnDef, type FilterDef } from '@/components/ui/data-grid'
import { categoryLabel } from '@/lib/categories'
import { coverageStatus } from '@/lib/status'
import { useReviewModal } from '@/components/nomination/ReviewModalProvider'

export type BrowserNomination = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  designation: string | null
  master_category: string
  category_key: string
  editorial_summary: { id: string } | Array<{ id: string }> | null
  assignments?: Array<{ status: string }> | null
}

function hasSummary(rel: BrowserNomination['editorial_summary']): boolean {
  return Array.isArray(rel) ? rel.length > 0 : rel != null
}

export default function NominationsBrowser({ nominations }: { nominations: BrowserNomination[] }) {
  const open = useReviewModal()

  const filters = useMemo<FilterDef[]>(
    () => [
      {
        id: 'master_category',
        label: 'Category',
        options: Array.from(new Set(nominations.map((n) => n.master_category)))
          .sort()
          .map((m) => ({ value: m, label: m })),
      },
      {
        id: 'category_key',
        label: 'Sub-category',
        options: Array.from(new Set(nominations.map((n) => n.category_key)))
          .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
          .map((k) => ({ value: k, label: categoryLabel(k) })),
      },
      {
        id: 'summary_state',
        label: 'Summary',
        options: [
          { value: 'ready', label: 'Ready' },
          { value: 'awaiting', label: 'Awaiting' },
        ],
      },
    ],
    [nominations]
  )

  // Precompute derived fields so they're filterable/sortable.
  const rows = useMemo(
    () =>
      nominations.map((n) => {
        const assignedCount = n.assignments?.length ?? 0
        const scoredCount = n.assignments?.filter((a) => a.status === 'scored').length ?? 0
        return {
          ...n,
          summary_state: hasSummary(n.editorial_summary) ? 'ready' : 'awaiting',
          _assigned: assignedCount,
          _scored: scoredCount,
        }
      }),
    [nominations]
  )

  type RowT = (typeof rows)[number]

  const columns = useMemo<ColumnDef<RowT>[]>(
    () => [
      {
        accessorKey: 'nominee_name',
        header: 'Nominee',
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-foreground">{row.original.nominee_name}</span>
            {row.original.designation && (
              <span className="ml-1.5 text-xs text-muted-foreground">{row.original.designation}</span>
            )}
          </div>
        ),
      },
      { accessorKey: 'company', header: 'Company', cell: ({ row }) => <span className="text-muted-foreground">{row.original.company}</span> },
      { accessorKey: 'master_category', header: 'Category', cell: ({ row }) => <span className="text-muted-foreground">{row.original.master_category}</span> },
      {
        accessorKey: 'category_key',
        header: 'Sub-category',
        cell: ({ row }) => <span className="text-muted-foreground">{categoryLabel(row.original.category_key)}</span>,
      },
      {
        id: 'coverage',
        header: 'Assignment',
        enableSorting: false,
        cell: ({ row }) => {
          const { meta } = coverageStatus(row.original._assigned, row.original._scored)
          return (
            <Badge variant={meta.variant} dot>
              {meta.label}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'summary_state',
        header: 'Summary',
        cell: ({ row }) =>
          row.original.summary_state === 'ready' ? (
            <Badge variant="success">Ready</Badge>
          ) : (
            <Badge variant="warning">Awaiting</Badge>
          ),
      },
    ],
    []
  )

  if (nominations.length === 0) {
    return (
      <EmptyState
        icon={FileX}
        title="No nominations imported yet"
        description="Import raw nominations and editorial summaries from the Import workspace to populate this view."
      />
    )
  }

  return (
    <DataGrid
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      searchPlaceholder="Search nominees or companies…"
      filters={filters}
      pageSize={25}
      savedViewsKey="admin-nominations"
      onRowClick={(row, orderedIds) => open(orderedIds, row.id)}
    />
  )
}
