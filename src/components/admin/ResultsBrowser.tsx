'use client'

import { useMemo, useState } from 'react'
import { Award, Download, Medal, TriangleAlert } from 'lucide-react'
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
import { cn } from '@/lib/utils'

type JurorScore = { juror_id: string; juror_name: string; total_score: number }

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
}

function RankChip({ rank, tied }: { rank: number | null; tied: boolean }) {
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
  )
}

function divergence(scores: JurorScore[]): number | null {
  if (scores.length < 2) return null
  return Math.abs(scores[0].total_score - scores[1].total_score)
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Score distribution
      </p>
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
              r.rank === 1
                ? 'text-[oklch(0.75_0.14_85)]'
                : r.rank === 2
                  ? 'text-[oklch(0.7_0_0)]'
                  : 'text-[oklch(0.62_0.1_50)]'
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{r.nominee_name}</p>
            <p className="truncate text-xs text-muted-foreground">{r.company}</p>
          </div>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {r.final_score?.toFixed(1)}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function ResultsBrowser({
  categoryResults,
}: {
  categoryResults: Record<string, ResultRow[]>
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
        cell: ({ row }) => <RankChip rank={row.original.rank} tied={row.original.tied} />,
        size: 64,
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
        id: 'final',
        header: 'Final',
        accessorFn: (r) => r.final_score ?? -1,
        cell: ({ row }) =>
          row.original.final_score != null ? (
            <span className="font-semibold tabular-nums text-foreground">
              {row.original.final_score.toFixed(1)}
            </span>
          ) : (
            <Badge variant="warning">Incomplete</Badge>
          ),
      },
      {
        id: 'jurors',
        header: 'Juror scores',
        enableSorting: false,
        cell: ({ row }) => {
          const js = row.original.juror_scores
          const div = divergence(js)
          return (
            <div className="flex items-center gap-2 text-sm tabular-nums">
              <span className="text-muted-foreground">{js[0]?.total_score ?? '—'}</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-muted-foreground">{js[1]?.total_score ?? '—'}</span>
              {div != null && div >= 15 && (
                <Badge variant="warning" className="ml-1">
                  Δ{div.toFixed(0)}
                </Badge>
              )}
            </div>
          )
        },
      },
    ],
    []
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
        const tieCount = catRows.filter((r) => r.tied).length
        const subCategories = [...new Set(catRows.map((r) => r.category_key))].sort()
        const tiedRows = catRows.filter((r) => r.tied)

        return (
          <div key={cat} className="mb-12">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Award className="size-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">{cat}</h2>
              <Badge variant="info">
                {completeCount} of {catRows.length} scored
              </Badge>
              {tieCount > 0 && (
                <Badge variant="warning" dot>
                  {tieCount} tied
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
                      render={
                        <a href={`/api/admin/results/export?scope=master&master=${encodeURIComponent(cat)}`} />
                      }
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
                      <RankChip rank={r.rank} tied={r.tied} />
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

      {/* Score-breakdown drawer */}
      <Drawer open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DrawerContent size="md">
            <DrawerHeader>
              <div className="flex items-center gap-2">
                <RankChip rank={selected.rank} tied={selected.tied} />
                <DrawerTitle>{selected.nominee_name}</DrawerTitle>
              </div>
              <DrawerDescription>
                {selected.company} · {categoryLabel(selected.category_key)}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums text-foreground">
                  {selected.final_score != null ? selected.final_score.toFixed(1) : '—'}
                </span>
                <span className="text-sm text-muted-foreground">final score</span>
                {!selected.complete && <Badge variant="warning">Incomplete</Badge>}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Juror breakdown
                </p>
                <div className="space-y-2">
                  {selected.juror_scores.length === 0 && (
                    <p className="text-sm text-muted-foreground">No scores submitted yet.</p>
                  )}
                  {selected.juror_scores.map((js) => (
                    <div
                      key={js.juror_id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-foreground">{js.juror_name}</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {js.total_score}
                      </span>
                    </div>
                  ))}
                </div>
                {(() => {
                  const div = divergence(selected.juror_scores)
                  if (div == null) return null
                  const high = div >= 15
                  return (
                    <p className={cn('mt-2 flex items-center gap-1.5 text-xs', high ? 'text-warning' : 'text-muted-foreground')}>
                      {high && <TriangleAlert className="size-3.5" />}
                      Juror divergence: {div.toFixed(0)} point{div === 1 ? '' : 's'}
                      {high && ' — consider review'}
                    </p>
                  )
                })()}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const r = selected
                  setSelected(null)
                  openReview(rowIdsFor(categoryResults, r), r.id)
                }}
              >
                Open full review
              </Button>
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
