'use client'

import { useMemo, useState } from 'react'
import { Inbox, ListChecks, CheckCircle2, Clock, ArrowRight, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tooltip } from '@/components/ui/tooltip'
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
  designation: string
  company: string
  company_size: string | null
  master_category: string
  category_key: string
  score: number | null
  summary: string | null
}

export default function AssignmentsTable({ rows }: { rows: Row[] }) {
  const open = useReviewModal()

  const [categoryFilter, setCategoryFilter] = useState('')
  const [subCategoryFilter, setSubCategoryFilter] = useState('')

  const scored = rows.filter((r) => r.status === 'scored').length
  const pending = rows.length - scored
  const pct = rows.length > 0 ? Math.round((scored / rows.length) * 100) : 0

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.master_category))).sort().map((m) => ({ value: m, label: m })),
    [rows]
  )

  const subCategoryOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.category_key)))
        .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
        .map((k) => ({ value: k, label: categoryLabel(k) })),
    [rows]
  )

  const filteredRows = useMemo(
    () =>
      rows
        .filter((r) => !categoryFilter || r.master_category === categoryFilter)
        .filter((r) => !subCategoryFilter || r.category_key === subCategoryFilter),
    [rows, categoryFilter, subCategoryFilter]
  )

  const statusFilter = useMemo<FilterDef>(
    () => ({
      id: 'status',
      label: 'Status',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'scored', label: 'Scored' },
      ],
    }),
    []
  )

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'nominee_name',
        header: 'Nominee',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-snug truncate">
              {row.original.nominee_name}
            </p>
            {row.original.designation && (
              <p className="text-xs text-muted-foreground leading-snug truncate mt-0.5">
                {row.original.designation}
              </p>
            )}
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: 'company',
        header: 'Company',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.company}</span>
        ),
        size: 180,
      },
      ...(['et_ciso', 'et_rising_star'].includes(subCategoryFilter) ? [{
        accessorKey: 'company_size' as const,
        header: 'Company Size',
        cell: ({ row }: { row: { original: Row } }) => {
          const size = row.original.company_size
          if (!size || size === 'Not Defined') return <span className="text-muted-foreground text-sm">—</span>
          return <span className="text-sm text-muted-foreground">{size}</span>
        },
        size: 160,
      }] : []),
      {
        id: 'summary',
        header: 'Executive Summary',
        enableSorting: false,
        cell: ({ row }) => {
          const text = row.original.summary
          if (!text) return <span className="text-muted-foreground">—</span>
          return (
            <Tooltip content={<span className="block max-w-xs leading-relaxed">{text}</span>}>
              <p className="text-sm text-foreground line-clamp-2 leading-snug cursor-default">
                {text}
              </p>
            </Tooltip>
          )
        },
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
        size: 100,
      },
      {
        accessorKey: 'score',
        header: 'Score',
        cell: ({ row }) => (
          <button
            className="text-left outline-none"
            onClick={(e) => {
              e.stopPropagation()
              open(filteredRows.map((r) => r.nomination_id), row.original.nomination_id, 'evaluation')
            }}
          >
            {row.original.score !== null ? (
              <span className="font-semibold tabular-nums text-foreground hover:text-primary transition-colors">
                {row.original.score.toFixed(1)}{' '}
                <span className="font-normal text-muted-foreground text-xs">/ 10</span>
              </span>
            ) : (
              <span className="text-muted-foreground hover:text-primary transition-colors">—</span>
            )}
          </button>
        ),
        size: 96,
      },
      {
        id: 'action',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const isScored = row.original.status === 'scored'
          return (
            <Tooltip content={isScored ? 'Review' : 'Evaluate'}>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  open(filteredRows.map((r) => r.nomination_id), row.original.nomination_id)
                }}
                aria-label={isScored ? 'Review nomination' : 'Evaluate nomination'}
              >
                <Eye className="size-4" />
              </Button>
            </Tooltip>
          )
        },
        size: 48,
      },
    ],
    [filteredRows, open, subCategoryFilter]
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

  const categorySelects = (
    <>
      <Select
        aria-label="Category"
        value={categoryFilter}
        onValueChange={(v) => { setCategoryFilter(v); setSubCategoryFilter('') }}
        placeholder="All category"
        options={[{ value: '', label: 'All category' }, ...categoryOptions]}
        className="h-8"
      />
      <Select
        aria-label="Sub-category"
        value={subCategoryFilter}
        onValueChange={setSubCategoryFilter}
        placeholder="All sub-category"
        options={[{ value: '', label: 'All sub-category' }, ...subCategoryOptions]}
        className="h-8"
      />
    </>
  )

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
        data={filteredRows}
        columns={columns}
        getRowId={(r) => r.nomination_id}
        searchPlaceholder="Search nominees…"
        filters={[statusFilter]}
        toolbarStart={categorySelects}
        pageSize={25}
        savedViewsKey="juror-assignments-v5"
        enableDensityToggle={false}
        enableColumnVisibility={false}
        onRowClick={(row, orderedIds) => open(orderedIds, row.nomination_id)}
      />
    </div>
  )
}
