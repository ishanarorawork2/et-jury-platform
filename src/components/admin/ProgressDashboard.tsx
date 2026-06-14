'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  LayoutList,
  Lock,
  TimerReset,
  ListChecks,
  ArrowRight,
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { StackedBar } from '@/components/ui/stacked-bar'
import { Meter } from '@/components/ui/meter'
import { Badge } from '@/components/ui/badge'
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid'
import { categoryLabel } from '@/lib/categories'
import { cn } from '@/lib/utils'

export type GroupStat = {
  key: string
  total: number
  fullyAssigned: number
  complete: number
  finalized: number
  pending: number
  unassigned: number
}

export type JurorStat = {
  id: string
  name: string
  assigned: number
  scored: number
  pending: number
}

export type DivergentItem = {
  id: string
  nominee_name: string
  category_key: string
  divergence: number
}

type Props = {
  totals: { total: number; fullyAssigned: number; complete: number; finalized: number; unassigned: number; pending: number }
  categoryStats: GroupStat[]
  subCategoryStats: GroupStat[]
  jurorStats: JurorStat[]
  divergentItems: DivergentItem[]
  divergenceThreshold: number
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0
}

export default function ProgressDashboard({
  totals,
  categoryStats,
  subCategoryStats,
  jurorStats,
  divergentItems,
  divergenceThreshold,
}: Props) {
  const needsAttention = totals.unassigned + totals.pending

  // Build the "what needs attention now" action list from existing data.
  const attentionItems = useMemo(() => {
    const items: { id: string; severity: 'danger' | 'warning'; label: string; detail: string; href: string }[] = []
    subCategoryStats
      .filter((s) => s.unassigned > 0)
      .sort((a, b) => b.unassigned - a.unassigned)
      .slice(0, 5)
      .forEach((s) =>
        items.push({
          id: `unassigned-${s.key}`,
          severity: 'danger',
          label: categoryLabel(s.key),
          detail: `${s.unassigned} nomination${s.unassigned === 1 ? '' : 's'} not fully assigned`,
          href: '/admin/assignments',
        })
      )
    jurorStats
      .filter((j) => j.assigned > 0 && j.scored === 0)
      .slice(0, 4)
      .forEach((j) =>
        items.push({
          id: `stalled-${j.id}`,
          severity: 'warning',
          label: j.name,
          detail: `${j.assigned} assigned · not started`,
          href: '/admin/jurors',
        })
      )
    // Advisory: nominations where the two jurors diverge beyond the threshold.
    divergentItems.slice(0, 4).forEach((d) =>
      items.push({
        id: `divergence-${d.id}`,
        severity: 'warning',
        label: d.nominee_name,
        detail: `Jurors differ by ${d.divergence} points (≥ ${divergenceThreshold}) · ${categoryLabel(d.category_key)}`,
        href: '/admin/results',
      })
    )
    return items
  }, [subCategoryStats, jurorStats, divergentItems, divergenceThreshold])

  const subColumns = useMemo<ColumnDef<GroupStat>[]>(
    () => [
      {
        accessorKey: 'key',
        header: 'Sub-category',
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{categoryLabel(row.original.key)}</span>
        ),
        sortingFn: (a, b) =>
          categoryLabel(a.original.key).localeCompare(categoryLabel(b.original.key)),
      },
      { accessorKey: 'total', header: 'Total', cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.total}</span> },
      {
        id: 'progress',
        header: 'Completion',
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original
          return (
            <div className="flex items-center gap-3">
              <StackedBar
                className="w-40"
                segments={[
                  { label: 'Complete', value: s.complete, tone: 'success' },
                  { label: 'Pending', value: s.pending, tone: 'warning' },
                  { label: 'Unassigned', value: s.unassigned, tone: 'danger' },
                ]}
              />
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                {pct(s.complete, s.total)}%
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'complete',
        header: 'Complete',
        cell: ({ row }) => <span className="tabular-nums font-medium text-success">{row.original.complete}</span>,
      },
      {
        accessorKey: 'unassigned',
        header: 'Unassigned',
        cell: ({ row }) => (
          <span className={cn('tabular-nums', row.original.unassigned > 0 ? 'text-danger' : 'text-muted-foreground')}>
            {row.original.unassigned}
          </span>
        ),
      },
    ],
    []
  )

  const jurorColumns = useMemo<ColumnDef<JurorStat>[]>(
    () => [
      { accessorKey: 'name', header: 'Juror', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
      { accessorKey: 'assigned', header: 'Assigned', cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.assigned}</span> },
      { accessorKey: 'scored', header: 'Scored', cell: ({ row }) => <span className="tabular-nums text-success">{row.original.scored}</span> },
      {
        id: 'progress',
        header: '% done',
        accessorFn: (r) => pct(r.scored, r.assigned),
        cell: ({ row }) => {
          const j = row.original
          const p = pct(j.scored, j.assigned)
          const stalled = j.assigned > 0 && j.scored === 0
          return (
            <div className="flex items-center gap-2.5">
              <Meter className="w-28" value={p} tone={stalled ? 'danger' : p === 100 ? 'success' : 'primary'} />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{p}%</span>
              {stalled && <Badge variant="danger">Stalled</Badge>}
            </div>
          )
        },
      },
    ],
    []
  )

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total nominations" value={totals.total} icon={LayoutList} tone="neutral" />
        <StatCard
          label="Fully assigned"
          value={totals.fullyAssigned}
          hint={`${pct(totals.fullyAssigned, totals.total)}%`}
          icon={GitMerge}
          tone="info"
        />
        <StatCard
          label="Complete"
          value={totals.complete}
          hint={`${pct(totals.complete, totals.total)}%`}
          icon={CheckCircle2}
          tone="success"
          emphasis
        />
        <StatCard
          label="Needs attention"
          value={needsAttention}
          hint={`${totals.unassigned} unassigned · ${totals.pending} pending`}
          icon={AlertTriangle}
          tone={needsAttention > 0 ? 'warning' : 'neutral'}
          emphasis={needsAttention > 0}
        />
      </div>

      {/* Funnel + attention */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Evaluation funnel</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Progression from intake through a complete two-juror score to a finalized ranking.
          </p>
          <div className="mt-5 space-y-4">
            {[
              { label: 'Total nominations', value: totals.total, tone: 'neutral' as const },
              { label: 'Fully assigned', value: totals.fullyAssigned, tone: 'info' as const },
              { label: 'Complete (2 scores)', value: totals.complete, tone: 'success' as const },
              { label: 'Finalized', value: totals.finalized, tone: 'accent' as const },
            ].map((stage) => (
              <div key={stage.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{stage.label}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {stage.value}{' '}
                    <span className="text-xs text-muted-foreground">({pct(stage.value, totals.total)}%)</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-(--duration-slow) ease-(--ease-out)',
                      stage.tone === 'neutral' && 'bg-muted-foreground/40',
                      stage.tone === 'info' && 'bg-info',
                      stage.tone === 'success' && 'bg-success',
                      stage.tone === 'accent' && 'bg-primary'
                    )}
                    style={{ width: `${pct(stage.value, totals.total)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface flex flex-col p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TimerReset className="size-4 text-warning" />
            Needs attention now
          </h2>
          <div className="mt-4 flex-1 space-y-1">
            {attentionItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="size-7 text-success" />
                <p className="mt-2 text-sm font-medium text-foreground">All clear</p>
                <p className="text-xs text-muted-foreground">No blockers across categories or jurors.</p>
              </div>
            ) : (
              attentionItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                >
                  <span
                    className={cn(
                      'mt-0.5 size-2 shrink-0 rounded-full',
                      item.severity === 'danger' ? 'bg-danger' : 'bg-warning'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* By category */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="size-4 text-muted-foreground" />
          By category
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {categoryStats.map((c) => (
            <div key={c.key} className="card-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{c.key}</span>
                <span className="flex items-center gap-1.5">
                  {c.finalized > 0 && (
                    <Badge variant="accent" className="gap-1">
                      <Lock className="size-3" />
                      {c.finalized}
                    </Badge>
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">{c.total}</span>
                </span>
              </div>
              <div className="mt-3">
                <StackedBar
                  height="h-2.5"
                  segments={[
                    { label: 'Complete', value: c.complete, tone: 'success' },
                    { label: 'Pending', value: c.pending, tone: 'warning' },
                    { label: 'Unassigned', value: c.unassigned, tone: 'danger' },
                  ]}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-success" /> {c.complete} complete
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-warning" /> {c.pending} pending
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-danger" /> {c.unassigned} unassigned
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By sub-category */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">By sub-category</h2>
        <DataGrid
          data={subCategoryStats}
          columns={subColumns}
          getRowId={(r) => r.key}
          searchPlaceholder="Search sub-categories…"
          enableDensityToggle={false}
          pageSize={50}
          initialSorting={[{ id: 'unassigned', desc: true }]}
        />
      </div>

      {/* By juror */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">By juror</h2>
        <DataGrid
          data={jurorStats}
          columns={jurorColumns}
          getRowId={(r) => r.id}
          searchPlaceholder="Search jurors…"
          enableDensityToggle={false}
          pageSize={50}
          initialSorting={[{ id: 'progress', desc: false }]}
        />
      </div>
    </div>
  )
}
