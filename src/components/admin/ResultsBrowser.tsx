'use client'

import { useMemo, useState } from 'react'
import { Award, Download, Lock, Medal, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { categoryLabel } from '@/lib/categories'
import { useReviewModal } from '@/components/nomination/ReviewModalProvider'
import { resolveStage, type LifecycleStatus, type NominationLike } from '@/lib/status'
import { cn } from '@/lib/utils'
import { ScoreAuditPanel } from '@/components/admin/ScoreAuditPanel'
import { CategoryFinalizeBar } from '@/components/admin/CategoryFinalizeBar'
import { ValidationSummary } from '@/components/admin/ValidationSummary'
import { JurorSubmissionDots } from '@/components/pipeline/JurorSubmissionDots'
import { PipelineStepper } from '@/components/pipeline/PipelineStepper'

export type JurorScore = {
  juror_id: string
  juror_name: string
  total_score: number
  version: number
  criteria_scores_json: Record<string, number> | null
  comment: string | null
  submitted_at: string
}

export type ResultRow = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  master_category: string
  category_key: string
  complete: boolean
  final_score: number | null
  juror_scores: JurorScore[]
  rank: number | null
  tied: boolean
  lifecycle_status: LifecycleStatus
  assigned_count: number
  scored_count: number
  divergence: number | null
  finalized: boolean
  snapshot: { rank: number | null; final_score: number | null; finalized_at: string; finalized_by_name: string | null } | null
}

export type FinalizedMeta = { count: number; finalized_at: string; finalized_by_name: string | null }

function toNominationLike(r: ResultRow): NominationLike {
  return {
    lifecycle_status: r.lifecycle_status,
    assigned_count: r.assigned_count,
    scored_count: r.scored_count,
    complete: r.complete,
    is_finalized: r.finalized,
    final_score: r.final_score,
    divergence: r.divergence,
    juror_scores: r.juror_scores.map((j) => ({ total_score: j.total_score, criteria_scores_json: j.criteria_scores_json })),
  }
}

function RankChip({ rank, tied, locked }: { rank: number | null; tied: boolean; locked?: boolean }) {
  if (rank == null) return <span className="text-muted-foreground/50">—</span>
  const medal =
    rank === 1
      ? 'bg-[oklch(0.85_0.13_85)] text-[oklch(0.3_0.08_85)]'
      : rank === 2
        ? 'bg-[oklch(0.85_0_0)] text-[oklch(0.35_0_0)]'
        : rank === 3
          ? 'bg-[oklch(0.78_0.08_50)] text-[oklch(0.32_0.06_50)]'
          : 'bg-muted text-muted-foreground'
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
          medal,
          tied && 'ring-1 ring-warning'
        )}
        title={tied ? 'Tied — manual review required' : undefined}
      >
        {rank}
        {tied ? '=' : ''}
      </span>
      {locked && <Lock className="size-3 text-primary" />}
    </span>
  )
}

function Histogram({ rows }: { rows: ResultRow[] }) {
  const scores = rows.filter((r) => r.final_score != null).map((r) => r.final_score as number)
  if (scores.length < 3) return null
  const bins = Array.from({ length: 10 }, () => 0)
  for (const s of scores) {
    const idx = Math.min(9, Math.floor(s / 10))
    bins[idx]++
  }
  const peak = Math.max(...bins, 1)
  return (
    <div className="card-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Score distribution</p>
      <div className="mt-3 flex h-20 items-end gap-1">
        {bins.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[0.6rem] tabular-nums text-muted-foreground">{count || ''}</span>
            <div
              className="w-full rounded-t bg-primary/70 transition-[height] duration-(--duration-slow)"
              style={{ height: `${(count / peak) * 100}%`, minHeight: count > 0 ? 3 : 0 }}
              title={`${i * 10}–${i * 10 + 10}: ${count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.6rem] text-muted-foreground">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  )
}

function Podium({ rows, onSelect }: { rows: ResultRow[]; onSelect: (r: ResultRow) => void }) {
  const top = rows.filter((r) => r.complete && r.rank != null && r.rank <= 3).slice(0, 3)
  if (top.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {top.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r)}
          className="card-surface flex items-center gap-3 p-3 text-left transition-shadow hover:shadow-[var(--shadow-md)]"
        >
          <Medal
            className={cn(
              'size-7 shrink-0',
              r.rank === 1 ? 'text-[oklch(0.75_0.14_85)]' : r.rank === 2 ? 'text-[oklch(0.7_0_0)]' : 'text-[oklch(0.62_0.1_50)]'
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{r.nominee_name}</p>
            <p className="truncate text-xs text-muted-foreground">{r.company}</p>
          </div>
          <span className="text-lg font-semibold tabular-nums text-foreground">{r.final_score?.toFixed(1)}</span>
        </button>
      ))}
    </div>
  )
}

export default function ResultsBrowser({
  categoryResults,
  finalizedByCategory,
  divergenceThreshold,
}: {
  categoryResults: Record<string, ResultRow[]>
  finalizedByCategory: Record<string, FinalizedMeta>
  divergenceThreshold: number
}) {
  const [master, setMaster] = useState('')
  const [sub, setSub] = useState('')
  const [selected, setSelected] = useState<ResultRow | null>(null)
  const openReview = useReviewModal()

  const masters = useMemo(() => Object.keys(categoryResults).sort(), [categoryResults])
  const subs = useMemo(() => {
    const rows = master ? (categoryResults[master] ?? []) : Object.values(categoryResults).flat()
    return Array.from(new Set(rows.map((r) => r.category_key))).sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b))
    )
  }, [categoryResults, master])

  const visibleMasters = master ? [master] : masters

  const columns = useMemo<ColumnDef<ResultRow>[]>(
    () => [
      {
        id: 'rank',
        header: 'Rank',
        accessorFn: (r) => r.rank ?? 999,
        cell: ({ row }) => <RankChip rank={row.original.rank} tied={row.original.tied} locked={row.original.finalized} />,
        size: 72,
      },
      {
        accessorKey: 'nominee_name',
        header: 'Nominee',
        cell: ({ row }) => (
          <span className={cn('font-medium', row.original.complete ? 'text-foreground' : 'text-muted-foreground')}>
            {row.original.nominee_name}
          </span>
        ),
      },
      { accessorKey: 'company', header: 'Company', cell: ({ row }) => <span className="text-muted-foreground">{row.original.company}</span> },
      {
        accessorKey: 'category_key',
        header: 'Sub-category',
        cell: ({ row }) => <span className="text-muted-foreground">{categoryLabel(row.original.category_key)}</span>,
      },
      {
        id: 'lifecycle',
        header: 'Lifecycle',
        enableSorting: false,
        cell: ({ row }) => {
          const { states } = resolveStage(toNominationLike(row.original), { divergenceThreshold })
          return <PipelineStepper variant="inline" states={states} lifecycle={row.original.lifecycle_status} />
        },
      },
      {
        id: 'final',
        header: 'Final',
        accessorFn: (r) => r.final_score ?? -1,
        cell: ({ row }) =>
          row.original.final_score != null ? (
            <span className="font-semibold tabular-nums text-foreground">{row.original.final_score.toFixed(1)}</span>
          ) : (
            <Badge variant="warning">Incomplete</Badge>
          ),
      },
      {
        id: 'jurors',
        header: 'Jurors',
        enableSorting: false,
        cell: ({ row }) => {
          const div = row.original.divergence
          return (
            <div className="flex items-center gap-2">
              <JurorSubmissionDots
                jurors={row.original.juror_scores.map((j) => ({
                  juror_id: j.juror_id,
                  juror_name: j.juror_name,
                  submitted: true,
                  submitted_at: j.submitted_at,
                }))}
              />
              {div != null && div >= divergenceThreshold && (
                <Badge variant="warning">Δ{Math.round(div)}</Badge>
              )}
            </div>
          )
        },
      },
    ],
    [divergenceThreshold]
  )

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Category"
          value={master}
          onValueChange={(v) => {
            setMaster(v)
            setSub('')
          }}
          options={[{ value: '', label: 'All categories' }, ...masters.map((m) => ({ value: m, label: m }))]}
        />
        {subs.length > 1 && (
          <Select
            aria-label="Sub-category"
            value={sub}
            onValueChange={setSub}
            options={[
              { value: '', label: 'All sub-categories' },
              ...subs.map((k) => ({ value: k, label: categoryLabel(k) })),
            ]}
          />
        )}
      </div>

      {visibleMasters.map((cat) => {
        const allRows = categoryResults[cat] ?? []
        const catRows = sub ? allRows.filter((r) => r.category_key === sub) : allRows
        if (catRows.length === 0) return null

        const completeCount = catRows.filter((r) => r.complete).length
        const incompleteCount = catRows.length - completeCount
        const tieCount = catRows.filter((r) => r.tied).length
        const divergentCount = catRows.filter((r) => r.divergence != null && r.divergence >= divergenceThreshold).length
        const subCategories = [...new Set(catRows.map((r) => r.category_key))].sort()
        const tiedRows = catRows.filter((r) => r.tied)

        // Finalize is per sub-category (category_key). Show the bar when a single
        // sub-category is in view; otherwise show a roll-up of how many of the
        // master's sub-categories are already finalized.
        const finalizedSubs = subCategories.filter((k) => finalizedByCategory[k])

        return (
          <div key={cat} className="mb-12">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Award className="size-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">{cat}</h2>
              <Badge variant="info">
                {completeCount} of {catRows.length} scored
              </Badge>
              {finalizedSubs.length > 0 && (
                <Badge variant="accent" className="gap-1">
                  <Lock className="size-3" />
                  {finalizedSubs.length} of {subCategories.length} categories finalized
                </Badge>
              )}
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="sm">
                        <Download className="size-3.5" />
                        Export
                      </Button>
                    }
                  />
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Export {cat}</DropdownMenuLabel>
                    <DropdownMenuItem
                      render={<a href={`/api/admin/results/export?scope=master&master=${encodeURIComponent(cat)}`} />}
                    >
                      <Download className="size-4" />
                      Full category (.xlsx)
                    </DropdownMenuItem>
                    {subCategories.length > 1 && <DropdownMenuSeparator />}
                    {subCategories.length > 1 &&
                      subCategories.map((sc) => (
                        <DropdownMenuItem
                          key={sc}
                          render={<a href={`/api/admin/results/export?scope=category&key=${encodeURIComponent(sc)}`} />}
                        >
                          {categoryLabel(sc)}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ValidationSummary
              className="mb-3"
              complete={completeCount}
              incomplete={incompleteCount}
              divergent={divergentCount}
              tied={tieCount}
              divergenceThreshold={divergenceThreshold}
            />

            {sub ? (
              <div className="mb-4">
                <CategoryFinalizeBar
                  categoryKey={sub}
                  label={categoryLabel(sub)}
                  completeCount={completeCount}
                  incompleteCount={incompleteCount}
                  tiedCount={tieCount}
                  divergentCount={divergentCount}
                  topThree={catRows
                    .filter((r) => r.complete && r.rank != null && r.rank <= 3)
                    .slice(0, 3)
                    .map((r) => ({ name: r.nominee_name, score: r.final_score }))}
                  finalized={finalizedByCategory[sub] ?? null}
                  divergenceThreshold={divergenceThreshold}
                />
              </div>
            ) : (
              subCategories.length > 1 && (
                <p className="mb-4 text-xs text-muted-foreground">
                  Pick a sub-category above to finalize &amp; lock its ranking.
                </p>
              )
            )}

            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Podium rows={catRows} onSelect={setSelected} />
              </div>
              <Histogram rows={catRows} />
            </div>

            {tiedRows.length > 0 && (
              <div className="mb-4 rounded-xl border border-warning-border bg-warning-subtle p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-warning">
                  <TriangleAlert className="size-4" />
                  Ties requiring manual review
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tiedRows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="inline-flex items-center gap-2 rounded-lg border border-warning-border bg-card px-2.5 py-1 text-xs"
                    >
                      <RankChip rank={r.rank} tied={r.tied} locked={r.finalized} />
                      <span className="font-medium text-foreground">{r.nominee_name}</span>
                      <span className="tabular-nums text-muted-foreground">{r.final_score?.toFixed(1)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <DataGrid
              data={catRows}
              columns={columns}
              getRowId={(r) => r.id}
              searchPlaceholder="Search nominees…"
              enableDensityToggle={false}
              pageSize={100}
              initialSorting={[{ id: 'rank', desc: false }]}
              onRowClick={(r) => setSelected(r)}
            />
          </div>
        )
      })}

      {/* Score-audit drawer */}
      <Drawer open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DrawerContent size="lg">
            <DrawerHeader>
              <div className="flex items-center gap-2">
                <RankChip rank={selected.rank} tied={selected.tied} locked={selected.finalized} />
                <DrawerTitle>{selected.nominee_name}</DrawerTitle>
              </div>
              <DrawerDescription>
                {selected.company} · {categoryLabel(selected.category_key)}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <ScoreAuditPanel
                nominationId={selected.id}
                divergenceThreshold={divergenceThreshold}
                onOpenReview={() => {
                  const r = selected
                  setSelected(null)
                  openReview(rowIdsFor(categoryResults, r), r.id)
                }}
              />
            </DrawerBody>
          </DrawerContent>
        )}
      </Drawer>
    </>
  )
}

function rowIdsFor(categoryResults: Record<string, ResultRow[]>, row: ResultRow): string[] {
  return (categoryResults[row.master_category] ?? []).map((r) => r.id)
}
