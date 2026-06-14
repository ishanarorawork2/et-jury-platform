'use client'

import { useMemo } from 'react'
import { Inbox, ListChecks, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { DataGrid, type ColumnDef, type FilterDef } from '@/components/ui/data-grid'
import { categoryLabel } from '@/lib/categories'
import { scoreStatus } from '@/lib/status'
import { useReviewModal } from '@/components/nomination/ReviewModalProvider'

type Row = {
  id: string
  status: string
  nomination_id: string
  nomination_display_id: string
  nominee_name: string
  company: string
  master_category: string
  category_key: string
  score: number | null
}

export default function AssignmentsTable({ rows }: { rows: Row[] }) {
  const open = useReviewModal()

  const scored = rows.filter((r) => r.status === 'scored').length
  const pending = rows.length - scored
  const pct = rows.length > 0 ? Math.round((scored / rows.length) * 100) : 0

  const masterFilter = useMemo<FilterDef>(
    () => ({
      id: 'master_category',
      label: 'Category',
      options: Array.from(new Set(rows.map((r) => r.master_category)))
        .sort()
        .map((m) => ({ value: m, label: m })),
    }),
    [rows]
  )

  const subFilter = useMemo<FilterDef>(
    () => ({
      id: 'category_key',
      label: 'Sub-category',
      options: Array.from(new Set(rows.map((r) => r.category_key)))
        .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
        .map((k) => ({ value: k, label: categoryLabel(k) })),
    }),
    [rows]
  )

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'nominee_name',
        header: 'Nominee',
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.nominee_name}</span>,
      },
      { accessorKey: 'company', header: 'Company', cell: ({ row }) => <span className="text-muted-foreground">{row.original.company}</span> },
      { accessorKey: 'master_category', header: 'Category', cell: ({ row }) => <span className="text-muted-foreground">{row.original.master_category}</span> },
      {
        accessorKey: 'category_key',
        header: 'Sub-category',
        cell: ({ row }) => <span className="text-muted-foreground">{categoryLabel(row.original.category_key)}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = scoreStatus(row.original.status === 'scored')
          return (
            <Badge variant={s.variant} dot>
              {s.label}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'score',
        header: 'Score',
        cell: ({ row }) =>
          row.original.score !== null ? (
            <span className="font-semibold tabular-nums text-foreground">{row.original.score}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'action',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            {row.original.status === 'scored' ? 'Review' : 'Evaluate'}
            <ArrowRight className="size-3.5" />
          </span>
        ),
      },
    ],
    []
  )

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No nominations assigned yet"
        description="An administrator will assign nominations to you shortly. They'll appear here when ready to evaluate."
      />
    )
  }

  const firstPending = rows.find((r) => r.status !== 'scored')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned" value={rows.length} icon={ListChecks} tone="neutral" />
        <StatCard label="Scored" value={scored} icon={CheckCircle2} tone="success" />
        <StatCard label="Pending" value={pending} icon={Clock} tone={pending > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Completion" value={`${pct}%`} tone="primary" emphasis hint={`${scored}/${rows.length}`} />
      </div>

      {firstPending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-accent-foreground">Up next</p>
            <p className="truncate text-sm text-muted-foreground">
              {firstPending.nominee_name} · {firstPending.company}
            </p>
          </div>
          <Button
            onClick={() =>
              open(
                rows.map((r) => r.nomination_id),
                firstPending.nomination_id
              )
            }
          >
            Evaluate now
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}

      <DataGrid
        data={rows}
        columns={columns}
        getRowId={(r) => r.nomination_id}
        searchPlaceholder="Search nominees…"
        filters={[masterFilter, subFilter]}
        pageSize={25}
        savedViewsKey="juror-assignments"
        onRowClick={(row, orderedIds) => open(orderedIds, row.nomination_id)}
      />
    </div>
  )
}
