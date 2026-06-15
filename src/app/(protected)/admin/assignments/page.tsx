'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Wand2, RefreshCw, X, Check, Layers, GitMerge, AlertCircle, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Meter } from '@/components/ui/meter'
import { EmptyState } from '@/components/ui/empty-state'
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid'
import { categoryLabel } from '@/lib/categories'
import { toast } from '@/lib/toast'
import { useReviewModal } from '@/components/nomination/ReviewModalProvider'
import { cn } from '@/lib/utils'

type Juror = { id: string; name: string; email: string; role: string }
type Conflict = { id: string; juror_id: string; company: string }
type Assignment = { id: string; juror_id: string; status: string; jury_users: { id: string; name: string } | null }
type Nomination = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  master_category: string
  category_key: string
  assignments: Assignment[]
}

const CATEGORIES = [
  'Individual Leadership',
  'Organisational Excellence',
  'Project & Technology Excellence',
]

export default function AdminAssignmentsPage() {
  const openReview = useReviewModal()
  const [jurors, setJurors] = useState<Juror[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [loadingNoms, setLoadingNoms] = useState(false)

  const [autoCategory, setAutoCategory] = useState('')
  const [autoSubCategory, setAutoSubCategory] = useState('')
  const [autoSubCategories, setAutoSubCategories] = useState<string[]>([])
  const [autoNominations, setAutoNominations] = useState<Nomination[]>([])
  const [autoJurors, setAutoJurors] = useState<string[]>([])
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoResult, setAutoResult] = useState<{ assigned: number; skipped: number } | null>(null)

  const loadStaticData = useCallback(async () => {
    const [j, c] = await Promise.all([
      fetch('/api/admin/jurors').then((r) => r.json()),
      fetch('/api/admin/conflicts').then((r) => r.json()),
    ])
    setJurors(Array.isArray(j) ? j.filter((u: Juror) => u.role === 'juror') : [])
    setConflicts(Array.isArray(c) ? c : [])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStaticData()
  }, [loadStaticData])

  const loadNominations = useCallback(async (cat: string) => {
    if (!cat) return
    setLoadingNoms(true)
    const res = await fetch(`/api/admin/assignments?category=${encodeURIComponent(cat)}`)
    const data = await res.json()
    setNominations(Array.isArray(data) ? data : [])
    setLoadingNoms(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNominations(category)
  }, [category, loadNominations])

  useEffect(() => {
    setAutoSubCategory('')
    if (!autoCategory) { setAutoSubCategories([]); setAutoNominations([]); return }
    fetch(`/api/admin/assignments?category=${encodeURIComponent(autoCategory)}`)
      .then((r) => r.json())
      .then((data: Nomination[]) => {
        const rows = Array.isArray(data) ? data : []
        setAutoNominations(rows)
        const keys = Array.from(new Set(rows.map((n) => n.category_key))).sort((a, b) =>
          categoryLabel(a).localeCompare(categoryLabel(b))
        )
        setAutoSubCategories(keys)
      })
      .catch(() => { setAutoSubCategories([]); setAutoNominations([]) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCategory])

  const isConflicted = useCallback(
    (jurorId: string, company: string) =>
      conflicts.some((c) => c.juror_id === jurorId && c.company.toLowerCase() === company.toLowerCase()),
    [conflicts]
  )

  const eligibleJurors = useCallback(
    (nom: Nomination) => {
      const assignedIds = new Set(nom.assignments.map((a) => a.juror_id))
      return jurors.filter((j) => !assignedIds.has(j.id) && !isConflicted(j.id, nom.company))
    },
    [jurors, isConflicted]
  )

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
    await loadNominations(category)
  }

  async function handleUnassign(assignmentId: string) {
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      toast.error('Could not unassign', { description: d.error })
      return
    }
    await loadNominations(category)
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
    await loadNominations(category)
  }

  async function handleAutoAssign() {
    if (!autoCategory || autoJurors.length < 2) return
    setAutoRunning(true)
    setAutoResult(null)
    const res = await fetch('/api/admin/assignments/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master_category: autoCategory, category_key: autoSubCategory || undefined, juror_ids: autoJurors }),
    })
    const data = await res.json()
    setAutoRunning(false)
    if (res.ok) {
      setAutoResult(data)
      toast.success('Auto-assign complete', {
        description: `${data.assigned} slots assigned${data.skipped > 0 ? `, ${data.skipped} skipped` : ''}.`,
      })
      if (autoCategory === category) await loadNominations(category)
    } else {
      toast.error('Auto-assign failed', { description: data.error })
    }
  }

  const autoPendingCount = useMemo(() => {
    const pool = autoSubCategory
      ? autoNominations.filter((n) => n.category_key === autoSubCategory)
      : autoNominations
    return pool.filter((n) => n.assignments.length < 2).length
  }, [autoNominations, autoSubCategory])

  const autoOpenSlots = useMemo(() => {
    const pool = autoSubCategory
      ? autoNominations.filter((n) => n.category_key === autoSubCategory)
      : autoNominations
    return pool.reduce((acc, n) => acc + (2 - n.assignments.length), 0)
  }, [autoNominations, autoSubCategory])

  const subCategories = useMemo(
    () =>
      Array.from(new Set(nominations.map((n) => n.category_key))).sort((a, b) =>
        categoryLabel(a).localeCompare(categoryLabel(b))
      ),
    [nominations]
  )

  const visibleNominations = useMemo(
    () => (subCategory ? nominations.filter((n) => n.category_key === subCategory) : nominations),
    [nominations, subCategory]
  )

  const totalSlots = visibleNominations.length * 2
  const filledSlots = visibleNominations.reduce((n, nom) => n + nom.assignments.length, 0)
  const fullyAssigned = visibleNominations.filter((n) => n.assignments.length >= 2).length
  const uncovered = visibleNominations.filter((n) => n.assignments.length < 2).length

  // Per-juror load within the current view.
  const jurorLoad = useMemo(() => {
    const m = new Map<string, number>()
    visibleNominations.forEach((nom) =>
      nom.assignments.forEach((a) => m.set(a.juror_id, (m.get(a.juror_id) ?? 0) + 1))
    )
    return jurors
      .map((j) => ({ id: j.id, name: j.name, count: m.get(j.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
  }, [visibleNominations, jurors])
  const maxLoad = Math.max(1, ...jurorLoad.map((j) => j.count))

  const columns = useMemo<ColumnDef<Nomination>[]>(
    () => [
      {
        accessorKey: 'nominee_name',
        header: 'Nominee',
        cell: ({ row }) => (
          <div>
            <button
              onClick={() => openReview(visibleNominations.map((n) => n.id), row.original.id)}
              className="font-medium text-primary hover:underline"
            >
              {row.original.nominee_name}
            </button>
            <span className="ml-2 text-xs text-muted-foreground">
              {categoryLabel(row.original.category_key)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'company',
        header: 'Company',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.company}</span>,
      },
      {
        id: 'coverage',
        header: 'Coverage',
        accessorFn: (n) => n.assignments.length,
        cell: ({ row }) => {
          const count = row.original.assignments.length
          return (
            <Badge variant={count >= 2 ? 'success' : count === 1 ? 'warning' : 'danger'} dot>
              {count}/2
            </Badge>
          )
        },
      },
      ...[0, 1].map(
        (slotIdx): ColumnDef<Nomination> => ({
          id: `slot-${slotIdx}`,
          header: `Juror ${slotIdx + 1}`,
          enableSorting: false,
          cell: ({ row }) => {
            const nom = row.original
            const slot = nom.assignments[slotIdx] ?? null
            if (slot) {
              // A juror who has already scored is locked — only removable, not swappable.
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
              // Pending: render a dropdown so the juror can be changed in place.
              // eligibleJurors excludes both assigned slots + conflicts; add the
              // current juror back so it stays selectable.
              const swapOptions = [
                { value: slot.juror_id, label: slot.jury_users?.name ?? slot.juror_id },
                ...eligibleJurors(nom).map((j) => ({ value: j.id, label: j.name })),
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
            const eligible = eligibleJurors(nom)
            const hidden = jurors.length - eligible.length - nom.assignments.length
            if (eligible.length === 0) {
              return <span className="text-xs text-muted-foreground">No eligible jurors</span>
            }
            return (
              <div className="flex items-center gap-1.5">
                <Select
                  size="sm"
                  aria-label="Assign juror"
                  value=""
                  onValueChange={(v) => v && handleAssign(nom.id, v)}
                  placeholder="Assign…"
                  options={eligible.map((j) => ({ value: j.id, label: j.name }))}
                  className="w-36"
                />
                {hidden > 0 && (
                  <span className="text-[0.65rem] text-muted-foreground" title={`${hidden} juror(s) hidden — conflict with ${nom.company}`}>
                    {hidden} hidden
                  </span>
                )}
              </div>
            )
          },
        })
      ),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleNominations, eligibleJurors, jurors, openReview]
  )

  return (
    <div className="mx-auto max-w-[80rem]">
      <PageHeader
        title="Assignments"
        description="Assign exactly two jurors per nomination — conflict-aware workload orchestration"
      />

      {/* Auto-assign */}
      <div className="card-surface mb-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wand2 className="size-4 text-primary" />
          Auto-assign a category
        </h2>
        <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
          Distributes all unassigned slots in the chosen category (or sub-category) across the
          selected jurors (load-balanced, conflict-aware).
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Category</label>
            <Select
              aria-label="Auto-assign category"
              value={autoCategory}
              onValueChange={setAutoCategory}
              placeholder="Select…"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              className="w-64"
            />
          </div>
          {autoCategory && autoSubCategories.length > 0 && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Sub-category</label>
              <Select
                aria-label="Auto-assign sub-category"
                value={autoSubCategory}
                onValueChange={setAutoSubCategory}
                placeholder="All sub-categories"
                options={[
                  { value: '', label: 'All sub-categories' },
                  ...autoSubCategories.map((k) => ({ value: k, label: categoryLabel(k) })),
                ]}
                className="w-56"
              />
            </div>
          )}
          <div className="min-w-56 flex-1">
            <p className="mb-1 text-xs text-muted-foreground">
              Jurors to include ({autoJurors.length} selected)
            </p>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
              {jurors.length === 0 && <p className="text-xs text-muted-foreground">No jurors yet</p>}
              {jurors.map((j) => {
                const on = autoJurors.includes(j.id)
                return (
                  <button
                    key={j.id}
                    onClick={() =>
                      setAutoJurors((prev) =>
                        on ? prev.filter((id) => id !== j.id) : [...prev, j.id]
                      )
                    }
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      on
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {j.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            {autoCategory && autoNominations.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{autoPendingCount}</span> nomination{autoPendingCount !== 1 ? 's' : ''} need{autoPendingCount === 1 ? 's' : ''} filling
                {' · '}<span className="font-semibold text-foreground">{autoOpenSlots}</span> open slot{autoOpenSlots !== 1 ? 's' : ''}
              </p>
            )}
            <Button onClick={handleAutoAssign} disabled={autoRunning || !autoCategory || autoJurors.length < 2 || autoPendingCount === 0}>
              {autoRunning ? 'Running…' : 'Auto-assign'}
            </Button>
          </div>
        </div>
        {autoResult && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-info-border bg-info-subtle px-3 py-2 text-xs text-info">
            <AlertCircle className="size-3.5" />
            Assigned {autoResult.assigned} slots
            {autoResult.skipped > 0
              ? ` · skipped ${autoResult.skipped} (conflicts or juror pool exhausted)`
              : ''}
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by category"
          value={category}
          onValueChange={(v) => { setCategory(v); setSubCategory('') }}
          placeholder="Select a category…"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          className="w-64"
        />
        {category && !loadingNoms && subCategories.length > 0 && (
          <Select
            aria-label="Sub-category"
            value={subCategory}
            onValueChange={setSubCategory}
            placeholder="All sub-categories"
            options={[
              { value: '', label: 'All sub-categories' },
              ...subCategories.map((k) => ({ value: k, label: categoryLabel(k) })),
            ]}
            className="w-56"
          />
        )}
        {category && (
          <Button variant="ghost" size="sm" onClick={() => loadNominations(category)}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        )}
      </div>

      {!category ? (
        <EmptyState
          icon={GitMerge}
          title="Select a category to orchestrate"
          description="Choose one of the three master categories above to view coverage and manage juror assignments."
        />
      ) : loadingNoms ? (
        <EmptyState icon={Layers} title="Loading nominations…" />
      ) : visibleNominations.length === 0 ? (
        <EmptyState icon={Layers} title="No nominations found for this category." />
      ) : (
        <div className="space-y-6">
          {/* Coverage KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Nominations" value={visibleNominations.length} icon={Layers} tone="neutral" />
            <StatCard label="Fully assigned" value={fullyAssigned} tone="success" hint={`${Math.round((fullyAssigned / visibleNominations.length) * 100)}%`} />
            <StatCard
              label="Uncovered"
              value={uncovered}
              icon={AlertCircle}
              tone={uncovered > 0 ? 'danger' : 'success'}
              emphasis={uncovered > 0}
              hint="< 2 jurors"
            />
            <StatCard label="Slots filled" value={`${filledSlots}/${totalSlots}`} icon={Gauge} tone="info" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <DataGrid
              data={visibleNominations}
              columns={columns}
              getRowId={(r) => r.id}
              searchPlaceholder="Search nominees…"
              enableDensityToggle={false}
              pageSize={50}
            />

            {/* Juror capacity rail */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="card-surface p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Gauge className="size-4 text-muted-foreground" />
                  Juror load
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">In this view</p>
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
                  {jurorLoad.length === 0 && (
                    <p className="text-xs text-muted-foreground">No jurors.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}
