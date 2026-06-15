'use client'

import { useMemo, useState, useCallback } from 'react'
import { FileX, Check, X, Gauge } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DataGrid, type ColumnDef, type FilterDef } from '@/components/ui/data-grid'
import { Select } from '@/components/ui/select'
import { Meter } from '@/components/ui/meter'
import { StatCard } from '@/components/ui/stat-card'
import { categoryLabel } from '@/lib/categories'
import { lifecycleStatus, type LifecycleStatus } from '@/lib/status'
import { useReviewModal } from '@/components/nomination/ReviewModalProvider'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type Assignment = {
  id: string
  juror_id: string
  status: 'pending' | 'scored'
  jury_users: { id: string; name: string } | null
}

export type BrowserNomination = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  designation: string | null
  master_category: string
  category_key: string
  has_summary: boolean
  lifecycle_status: LifecycleStatus
  assignments: Assignment[]
}

type Juror = { id: string; name: string }
type Conflict = { juror_id: string; company: string }

// Lifecycle filter options, in pipeline order.
const LIFECYCLE_FILTER: { value: LifecycleStatus; label: string }[] = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'partially_assigned', label: '1 of 2 assigned' },
  { value: 'awaiting_scores', label: 'Awaiting scores' },
  { value: 'partially_scored', label: '1 of 2 scored' },
  { value: 'scored', label: 'Scored' },
  { value: 'finalized', label: 'Finalized' },
]

export default function NominationsBrowser({
  nominations,
  jurors,
  conflicts,
}: {
  nominations: BrowserNomination[]
  jurors: Juror[]
  conflicts: Conflict[]
}) {
  const open = useReviewModal()

  // Client-side assignment state — seeded from SSR, updated after mutations
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, Assignment[]>>(
    () => new Map(nominations.map((n) => [n.id, n.assignments]))
  )

  const isConflicted = useCallback(
    (jurorId: string, company: string) =>
      conflicts.some(
        (c) => c.juror_id === jurorId && c.company.toLowerCase() === company.toLowerCase()
      ),
    [conflicts]
  )

  const eligibleJurors = useCallback(
    (nominationId: string, company: string) => {
      const assigned = new Set((assignmentsMap.get(nominationId) ?? []).map((a) => a.juror_id))
      return jurors.filter((j) => !assigned.has(j.id) && !isConflicted(j.id, company))
    },
    [assignmentsMap, jurors, isConflicted]
  )

  async function refreshAssignments() {
    const res = await fetch('/api/admin/assignments')
    if (!res.ok) return
    type ApiNom = { id: string; assignments: Assignment[] }
    const data: ApiNom[] = await res.json()
    setAssignmentsMap(new Map(data.map((n) => [n.id, n.assignments])))
  }

  async function handleAssign(nominationId: string, jurorId: string) {
    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomination_id: nominationId, juror_id: jurorId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error('Could not assign', { description: data.error })
      return
    }
    await refreshAssignments()
  }

  async function handleUnassign(assignmentId: string) {
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      toast.error('Could not unassign', { description: d.error })
      return
    }
    await refreshAssignments()
  }

  async function handleReassign(assignmentId: string, jurorId: string) {
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ juror_id: jurorId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error('Could not reassign', { description: data.error })
      return
    }
    await refreshAssignments()
  }

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
        id: 'lifecycle_status',
        label: 'Lifecycle',
        options: LIFECYCLE_FILTER.filter((o) =>
          nominations.some((n) => n.lifecycle_status === o.value)
        ),
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

  // Rows enriched with live assignment state + derived fields
  const rows = useMemo(
    () =>
      nominations.map((n) => ({
        ...n,
        summary_state: n.has_summary ? 'ready' : 'awaiting',
        assignments: assignmentsMap.get(n.id) ?? n.assignments,
      })),
    [nominations, assignmentsMap]
  )

  type RowT = (typeof rows)[number]

  // Coverage KPIs (across all shortlisted nominations)
  const shortlisted = useMemo(() => rows.filter((r) => r.has_summary), [rows])
  const fullyAssigned = shortlisted.filter((r) => r.assignments.length >= 2).length
  const uncovered = shortlisted.filter((r) => r.assignments.length < 2).length
  const totalSlots = shortlisted.length * 2
  const filledSlots = shortlisted.reduce((sum, r) => sum + r.assignments.length, 0)

  // Per-juror load across all visible shortlisted rows
  const jurorLoad = useMemo(() => {
    const m = new Map<string, number>()
    shortlisted.forEach((r) =>
      r.assignments.forEach((a) => m.set(a.juror_id, (m.get(a.juror_id) ?? 0) + 1))
    )
    return jurors
      .map((j) => ({ id: j.id, name: j.name, count: m.get(j.id) ?? 0 }))
      .filter((j) => j.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [shortlisted, jurors])
  const maxLoad = Math.max(1, ...jurorLoad.map((j) => j.count))

  function renderSlot(row: RowT, slotIdx: number) {
    if (!row.has_summary) return <span className="text-xs text-muted-foreground">—</span>

    const slot = row.assignments[slotIdx] ?? null
    if (slot) {
      if (slot.status === 'scored') {
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-sm font-medium text-success">
              {slot.jury_users?.name ?? slot.juror_id}
            </span>
            <Check className="size-3.5 text-success" />
            <button
              onClick={() => handleUnassign(slot.id)}
              className="text-muted-foreground hover:text-danger"
              title="Remove assignment"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )
      }
      const swapOptions = [
        { value: slot.juror_id, label: slot.jury_users?.name ?? slot.juror_id },
        ...eligibleJurors(row.id, row.company).map((j) => ({ value: j.id, label: j.name })),
      ]
      return (
        <div className="flex items-center gap-1.5">
          <Select
            size="sm"
            aria-label="Reassign juror"
            value={slot.juror_id}
            onValueChange={(v) => v && v !== slot.juror_id && handleReassign(slot.id, v)}
            options={swapOptions}
            className="w-36"
          />
          <button
            onClick={() => handleUnassign(slot.id)}
            className="text-muted-foreground hover:text-danger"
            title="Remove assignment"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )
    }

    const eligible = eligibleJurors(row.id, row.company)
    const hidden = jurors.length - eligible.length - row.assignments.length
    if (eligible.length === 0) {
      return <span className="text-xs text-muted-foreground">No eligible jurors</span>
    }
    return (
      <div className="flex items-center gap-1.5">
        <Select
          size="sm"
          aria-label="Assign juror"
          value=""
          onValueChange={(v) => v && handleAssign(row.id, v)}
          placeholder="Assign…"
          options={eligible.map((j) => ({ value: j.id, label: j.name }))}
          className="w-36"
        />
        {hidden > 0 && (
          <span
            className="text-[0.65rem] text-muted-foreground"
            title={`${hidden} juror(s) hidden — conflict with ${row.company}`}
          >
            {hidden} hidden
          </span>
        )}
      </div>
    )
  }

  const columns = useMemo<ColumnDef<RowT>[]>(
    () => [
      {
        accessorKey: 'nominee_name',
        header: 'Nominee',
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-foreground">{row.original.nominee_name}</span>
            {row.original.designation && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {row.original.designation}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'company',
        header: 'Company',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.company}</span>
        ),
      },
      {
        accessorKey: 'master_category',
        header: 'Category',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.master_category}</span>
        ),
      },
      {
        accessorKey: 'category_key',
        header: 'Sub-category',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {categoryLabel(row.original.category_key)}
          </span>
        ),
      },
      {
        accessorKey: 'lifecycle_status',
        header: 'Status',
        cell: ({ row }) => {
          const meta = lifecycleStatus(row.original.lifecycle_status)
          return (
            <Badge variant={meta.variant} dot className={meta.pulse ? 'animate-pulse' : undefined}>
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
      {
        id: 'coverage',
        header: 'Coverage',
        enableSorting: false,
        accessorFn: (r) => r.assignments.length,
        cell: ({ row }) => {
          if (!row.original.has_summary)
            return <span className="text-xs text-muted-foreground">—</span>
          const count = row.original.assignments.length
          return (
            <Badge
              variant={count >= 2 ? 'success' : count === 1 ? 'warning' : 'danger'}
              dot
            >
              {count}/2
            </Badge>
          )
        },
      },
      ...[0, 1].map(
        (slotIdx): ColumnDef<RowT> => ({
          id: `slot-${slotIdx}`,
          header: `Juror ${slotIdx + 1}`,
          enableSorting: false,
          cell: ({ row }) => renderSlot(row.original, slotIdx),
        })
      ),
    ],
    // renderSlot closes over assignmentsMap via eligibleJurors — re-memoize when those change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignmentsMap, eligibleJurors, jurors]
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
    <div className="space-y-6">
      {/* Coverage KPIs */}
      {shortlisted.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Shortlisted" value={shortlisted.length} tone="neutral" />
          <StatCard
            label="Fully assigned"
            value={fullyAssigned}
            tone="success"
            hint={`${Math.round((fullyAssigned / shortlisted.length) * 100)}%`}
          />
          <StatCard
            label="Uncovered"
            value={uncovered}
            tone={uncovered > 0 ? 'danger' : 'success'}
            emphasis={uncovered > 0}
            hint="< 2 jurors"
          />
          <StatCard
            label="Slots filled"
            value={`${filledSlots}/${totalSlots}`}
            tone="info"
          />
        </div>
      )}

      <div className={cn('grid gap-6', jurorLoad.length > 0 && 'lg:grid-cols-[1fr_16rem]')}>
        <DataGrid
          data={rows}
          columns={columns}
          getRowId={(r) => r.id}
          searchPlaceholder="Search nominees or companies…"
          filters={filters}
          pageSize={50}
          savedViewsKey="admin-nominations"
          onRowClick={(row, orderedIds) => open(orderedIds, row.id)}
          enableDensityToggle={false}
          enableColumnVisibility={false}
        />

        {/* Juror load sidebar */}
        {jurorLoad.length > 0 && (
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="card-surface p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Gauge className="size-4 text-muted-foreground" />
                Juror load
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Shortlisted nominations</p>
              <div className="mt-4 space-y-3">
                {jurorLoad.map((j) => (
                  <div key={j.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-foreground">{j.name}</span>
                      <span className="tabular-nums text-muted-foreground">{j.count}</span>
                    </div>
                    <Meter value={j.count} max={maxLoad} tone="info" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
