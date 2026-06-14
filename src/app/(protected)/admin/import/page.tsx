'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, Sparkles, Lock, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Stepper } from '@/components/ui/stepper'
import { Meter } from '@/components/ui/meter'
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid'
import { useConfirm } from '@/components/ui/confirm'
import { toast } from '@/lib/toast'
import { CATEGORY_LABELS, categoryLabel } from '@/lib/categories'
import type { RawSheetSummary, CandidateNomination, ImportBatch, CoverageSummary } from '@/lib/import/types'

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS)

function FileInput({ name, inputRef, multiple }: { name: string; inputRef: React.RefObject<HTMLInputElement | null>; multiple?: boolean }) {
  return (
    <input
      ref={inputRef}
      type="file"
      name={name}
      multiple={multiple}
      accept=".xlsx"
      className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
    />
  )
}

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div className="rounded-lg border border-danger-border bg-danger-subtle p-3 text-sm text-danger">
      {msg}
    </div>
  )
}

// ── Step 1: raw nominations + mapping ───────────────────────────────────────────

type ParseResp = {
  sheets: RawSheetSummary[]
  total_rows: number
  category_keys: string[]
  key_master: Record<string, string>
}
type CommitResp = { inserted: number; per_category: Record<string, number>; skipped_sheets: string[]; errors: string[] }

function RawStep({ onDone }: { onDone: () => void }) {
  const confirm = useConfirm()
  const rawRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResp | null>(null)
  const [map, setMap] = useState<Record<string, string>>({})
  const [committed, setCommitted] = useState<CommitResp | null>(null)

  async function analyze() {
    const file = rawRef.current?.files?.[0]
    if (!file) { setError('Select the raw nominations .xlsx file first.'); return }
    setLoading(true); setError(null); setCommitted(null)
    try {
      const fd = new FormData()
      fd.append('raw', file)
      fd.append('mode', 'parse')
      const res = await fetch('/api/admin/import/raw', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Parse failed')
      setParsed(json)
      setMap(Object.fromEntries(json.sheets.map((s: RawSheetSummary) => [s.sheet_name, s.guessed_key ?? ''])))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }

  async function commit() {
    const file = rawRef.current?.files?.[0]
    if (!file) return
    const mapped = Object.values(map).filter(Boolean).length
    const ok = await confirm({
      title: `Import ${mapped} mapped sheets?`,
      description: 'Existing rows with the same Nomination Id will be updated.',
      confirmLabel: 'Import',
    })
    if (!ok) return
    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('raw', file)
      fd.append('mode', 'commit')
      fd.append('sheet_map', JSON.stringify(map))
      const res = await fetch('/api/admin/import/raw', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Commit failed')
      setCommitted(json)
      toast.success('Nominations imported', { description: `${json.inserted} rows written.` })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      toast.error('Import failed', { description: e instanceof Error ? e.message : String(e) })
    } finally { setLoading(false) }
  }

  const mappedCount = Object.values(map).filter(Boolean).length
  const unmappedCount = parsed ? parsed.sheets.length - mappedCount : 0

  return (
    <div className="card-surface space-y-5 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <FileSpreadsheet className="size-4 text-primary" />
          Raw nominations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the raw workbook, confirm how each sheet maps to a category, then import. All rows are
          stored; a nomination becomes assignable once it has a matched editorial summary.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <FileInput name="raw" inputRef={rawRef} />
        <Button onClick={analyze} disabled={loading}>
          {loading && !parsed ? 'Analyzing…' : 'Analyze sheets'}
        </Button>
      </div>

      <ErrorBox msg={error} />

      {parsed && !committed && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {parsed.sheets.length} sheets · {parsed.total_rows} rows
            </span>
            {unmappedCount > 0 && (
              <Badge variant="warning" dot>
                {unmappedCount} unmapped — will be skipped
              </Badge>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60 text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Sheet</th>
                  <th className="px-4 py-2.5 text-right">Rows</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Master category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.sheets.map((s) => {
                  const key = map[s.sheet_name] ?? ''
                  return (
                    <tr key={s.sheet_name} className={key ? '' : 'bg-warning-subtle/40'}>
                      <td className="px-4 py-2 font-mono text-xs text-foreground">{s.sheet_name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{s.row_count}</td>
                      <td className="px-4 py-2">
                        <Select
                          size="sm"
                          aria-label={`Category for ${s.sheet_name}`}
                          value={key}
                          onValueChange={(v) => setMap((m) => ({ ...m, [s.sheet_name]: v }))}
                          placeholder="— skip this sheet —"
                          options={[
                            { value: '', label: '— skip this sheet —' },
                            ...CATEGORY_OPTIONS.map((k) => ({ value: k, label: categoryLabel(k) })),
                          ]}
                          className="w-56"
                        />
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {key ? (parsed.key_master[key] ?? '—') : <span className="text-warning">will be skipped</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Button onClick={commit} disabled={loading || mappedCount === 0}>
            {loading ? 'Importing…' : `Import ${mappedCount} mapped sheets`}
          </Button>
        </div>
      )}

      {committed && (
        <div className="flex items-start gap-2.5 rounded-lg border border-success-border bg-success-subtle p-4 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>{committed.inserted} nominations imported.</strong>
            {committed.skipped_sheets.length > 0 && (
              <span className="ml-1 text-muted-foreground">Skipped: {committed.skipped_sheets.join(', ')}.</span>
            )}
            {committed.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-danger">
                {committed.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 2: editorial summaries + reconciliation ─────────────────────────────────

type StageResp = {
  batch_id: string
  total_audited: number
  matched: number
  duplicates: number
  unmatched: number
  total_nominations: number
  nominations_without_summary: number
}
type Counts = { matched: number; unmatched: number; skipped: number; duplicate: number; total: number }
type UnmatchedRow = {
  id: string
  normalized_key: string
  master_category: string
  nominee_name: string
  company: string
  candidates: CandidateNomination[]
}
type DuplicateRow = {
  id: string
  normalized_key: string
  master_category: string
  nominee_name: string
  company: string
  total_score: number | null
  matched_nomination_id: string | null
  locked: boolean
}

function AuditedStep({ onFinalized }: { onFinalized: () => void }) {
  const confirm = useConfirm()
  const filesRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<StageResp | null>(null)
  const [rows, setRows] = useState<UnmatchedRow[]>([])
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [duplicates, setDuplicates] = useState<DuplicateRow[]>([])
  const [counts, setCounts] = useState<Counts | null>(null)
  const [finalized, setFinalized] = useState<{ committed: number; locked_dropped: number } | null>(null)
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null)
  const [batches, setBatches] = useState<ImportBatch[]>([])

  const refreshSidecars = useCallback(async () => {
    const [cov, bat] = await Promise.all([
      fetch('/api/admin/import/coverage').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/admin/import/audited/batches').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
    if (cov) setCoverage(cov)
    if (bat) setBatches(bat.batches)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refreshSidecars() }, [refreshSidecars])

  async function loadReconcile(batchId: string) {
    const res = await fetch(`/api/admin/import/audited/reconcile?batch_id=${batchId}`)
    const json = await res.json()
    if (res.ok) {
      setRows(json.rows)
      setPicks(Object.fromEntries((json.rows as UnmatchedRow[]).map((r) => [r.id, r.candidates[0]?.id ?? ''])))
      setDuplicates(json.duplicates ?? [])
      setCounts(json.counts)
    }
  }

  async function runStage() {
    const files = filesRef.current?.files
    if (!files || files.length === 0) { setError('Select at least one audited file.'); return }
    setLoading(true); setError(null); setFinalized(null)
    try {
      const fd = new FormData()
      for (const f of Array.from(files)) fd.append('files', f)
      const res = await fetch('/api/admin/import/audited', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Staging failed')
      setStage(json)
      await loadReconcile(json.batch_id)
      await refreshSidecars()
      toast.success('Staged & matched', {
        description: `${json.matched} matched · ${json.unmatched} unmatched · ${json.duplicates} duplicates.`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      toast.error('Staging failed', { description: e instanceof Error ? e.message : String(e) })
    } finally { setLoading(false) }
  }

  async function resolve(id: string, action: 'match' | 'skip' | 'replace', nomination_id?: string) {
    if (!stage) return
    const res = await fetch('/api/admin/import/audited/reconcile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, nomination_id, batch_id: stage.batch_id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Update failed'); return }
    setError(null)
    setCounts(json.counts)
    setRows((rs) => rs.filter((r) => r.id !== id))
    setDuplicates((ds) => ds.filter((d) => d.id !== id))
  }

  async function matchAll() {
    if (!stage) return
    const matches = rows
      .map((r) => ({ id: r.id, nomination_id: picks[r.id] }))
      .filter((m) => m.nomination_id)
    if (matches.length === 0) { setError('No unmatched rows have a candidate to match.'); return }
    const ok = await confirm({
      title: `Match ${matches.length} rows?`,
      description: 'Each row is matched to its selected nomination. Rows whose pick collides with another stay unmatched.',
      confirmLabel: 'Match all',
    })
    if (!ok) return
    const res = await fetch('/api/admin/import/audited/reconcile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'match_all', matches, batch_id: stage.batch_id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Update failed'); return }
    setError(null)
    setCounts(json.counts)
    const matched = new Set<string>(json.matched_ids ?? [])
    setRows((rs) => rs.filter((r) => !matched.has(r.id)))
    toast.success(`${matched.size} rows matched`)
  }

  async function skipAll() {
    if (!stage) return
    const ok = await confirm({
      title: `Skip all ${rows.length} unmatched rows?`,
      description: "They'll be excluded from this import.",
      confirmLabel: 'Skip all',
      variant: 'destructive',
    })
    if (!ok) return
    const res = await fetch('/api/admin/import/audited/reconcile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip_all', batch_id: stage.batch_id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Update failed'); return }
    setError(null)
    setCounts(json.counts)
    setRows([])
  }

  async function replaceAll() {
    if (!stage) return
    const ok = await confirm({
      title: 'Replace all unlocked duplicates?',
      description: 'Existing summaries will be overwritten at finalize.',
      confirmLabel: 'Replace all',
    })
    if (!ok) return
    const res = await fetch('/api/admin/import/audited/reconcile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'replace_all', batch_id: stage.batch_id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Update failed'); return }
    setError(null)
    setCounts(json.counts)
    setDuplicates((ds) => ds.filter((d) => d.locked))
  }

  async function finalize() {
    if (!stage) return
    const ok = await confirm({
      title: 'Commit editorial summaries?',
      description: 'This writes matched summaries to the live platform. Matched nominations become assignable.',
      confirmLabel: 'Finalize',
    })
    if (!ok) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/import/audited/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: stage.batch_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Finalize failed')
      setFinalized({ committed: json.committed, locked_dropped: json.locked_dropped ?? 0 })
      await refreshSidecars()
      onFinalized()
      toast.success('Editorial summaries committed', { description: `${json.committed} summaries are now live.` })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      toast.error('Finalize failed', { description: e instanceof Error ? e.message : String(e) })
    } finally { setLoading(false) }
  }

  const canFinalize = counts != null && counts.unmatched === 0
  const lockedDupes = duplicates.filter((d) => d.locked).length

  return (
    <div className="space-y-6">
      <CoverageDashboard coverage={coverage} />

      <div className="card-surface space-y-5 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" />
            Editorial summaries
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload any number of audited files — each row&apos;s category is auto-detected and matched to a
            stored nomination by name, company and category. Rows that already have a summary are flagged as
            duplicates and excluded; only unmatched rows block finalize.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FileInput name="files" inputRef={filesRef} multiple />
          <Button onClick={runStage} disabled={loading}>
            {loading && !stage ? 'Matching…' : 'Stage & auto-match'}
          </Button>
        </div>

        <ErrorBox msg={error} />

        {stage && counts && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Audited rows" value={stage.total_audited} tone="neutral" />
            <StatCard label="Matched" value={counts.matched} tone="success" emphasis />
            <StatCard label="Duplicates" value={counts.duplicate} tone={counts.duplicate > 0 ? 'warning' : 'neutral'} />
            <StatCard label="Unmatched" value={counts.unmatched} tone={counts.unmatched > 0 ? 'danger' : 'success'} emphasis={counts.unmatched > 0} />
            <StatCard label="Skipped" value={counts.skipped} tone="neutral" />
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Resolve unmatched rows ({rows.length})</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={matchAll}>Match all to top candidate</Button>
                <Button size="sm" variant="outline" onClick={skipAll}>Skip all</Button>
              </div>
            </div>
            {rows.map((r) => (
              <ReconcileRow
                key={r.id}
                row={r}
                pick={picks[r.id] ?? ''}
                onPick={(value) => setPicks((p) => ({ ...p, [r.id]: value }))}
                onResolve={resolve}
              />
            ))}
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Duplicates excluded ({duplicates.length})</h3>
              {duplicates.length - lockedDupes > 0 && (
                <Button size="sm" variant="outline" onClick={replaceAll}>
                  <RotateCcw className="size-3.5" />
                  Replace {duplicates.length - lockedDupes} unlocked
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              These nominations already have an imported summary, so they&apos;re excluded by default. Replace
              one only if the new data is corrected — rows already scored by a juror are locked.
            </p>
            {duplicates.map((d) => (
              <DuplicateRowItem key={d.id} row={d} onReplace={(id) => resolve(id, 'replace')} />
            ))}
          </div>
        )}

        {stage && !finalized && (
          <Button onClick={finalize} disabled={loading || !canFinalize}>
            {loading
              ? 'Finalizing…'
              : canFinalize
                ? `Finalize ${counts?.matched ?? 0} editorial summaries`
                : `${counts?.unmatched ?? 0} unmatched — resolve to finalize`}
          </Button>
        )}

        {finalized && (
          <div className="flex items-start gap-2.5 rounded-lg border border-success-border bg-success-subtle p-4 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div>
              <strong>{finalized.committed} editorial summaries committed.</strong> Matched nominations are now assignable.
              {finalized.locked_dropped > 0 && (
                <span className="ml-1 text-warning">{finalized.locked_dropped} already-scored rows left unchanged.</span>
              )}
            </div>
          </div>
        )}
      </div>

      <UploadHistory batches={batches} />
    </div>
  )
}

function CoverageDashboard({ coverage }: { coverage: CoverageSummary | null }) {
  if (!coverage) return null
  const overallPct = coverage.total ? Math.round((coverage.with_summary / coverage.total) * 100) : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total nominations" value={coverage.total} tone="neutral" />
        <StatCard label="With summary" value={coverage.with_summary} hint={`${overallPct}%`} tone="success" emphasis />
        <StatCard label="Pending" value={coverage.pending} tone={coverage.pending > 0 ? 'warning' : 'neutral'} />
      </div>
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">Coverage by category</h2>
        <div className="mt-4 space-y-3">
          {coverage.by_master.map((m) => {
            const pct = m.total ? Math.round((m.with_summary / m.total) * 100) : 0
            return (
              <div key={m.master_category}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-foreground">{m.master_category}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {m.with_summary}/{m.total} · {pct}%
                  </span>
                </div>
                <Meter value={pct} tone={pct === 100 ? 'success' : 'primary'} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function UploadHistory({ batches }: { batches: ImportBatch[] }) {
  const columns = useMemo<ColumnDef<ImportBatch>[]>(
    () => [
      {
        accessorKey: 'file_names',
        header: 'Files',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-foreground">{row.original.file_names.join(', ') || '—'}</span>
        ),
      },
      { accessorKey: 'uploaded_by_name', header: 'Uploaded by', cell: ({ row }) => <span className="text-muted-foreground">{row.original.uploaded_by_name ?? '—'}</span> },
      {
        accessorKey: 'created_at',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{new Date(row.original.created_at).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'imported_count',
        header: 'Imported',
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.status === 'finalized' ? row.original.imported_count : '—'}
          </span>
        ),
      },
      { accessorKey: 'duplicate_count', header: 'Duplicates', cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.duplicate_count}</span> },
      { accessorKey: 'unmatched_count', header: 'Unmatched', cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.unmatched_count}</span> },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          return (
            <Badge variant={s === 'finalized' ? 'success' : s === 'staged' ? 'warning' : 'neutral'}>
              {s}
            </Badge>
          )
        },
      },
    ],
    []
  )

  if (batches.length === 0) return null
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Upload history</h2>
      <DataGrid
        data={batches}
        columns={columns}
        getRowId={(r) => r.id}
        enableDensityToggle={false}
        pageSize={10}
      />
    </div>
  )
}

function ReconcileRow({
  row,
  pick,
  onPick,
  onResolve,
}: {
  row: UnmatchedRow
  pick: string
  onPick: (value: string) => void
  onResolve: (id: string, action: 'match' | 'skip', nominationId?: string) => void
}) {
  return (
    <div className="rounded-xl border border-danger-border bg-danger-subtle/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-foreground">{row.nominee_name}</span>
          <span className="text-muted-foreground"> · {row.company} · {categoryLabel(row.normalized_key)}</span>
        </div>
        <div className="flex items-center gap-2">
          {row.candidates.length === 0 ? (
            <span className="text-xs text-muted-foreground">No candidates in this category</span>
          ) : (
            <Select
              size="sm"
              aria-label="Candidate nomination"
              value={pick}
              onValueChange={onPick}
              options={row.candidates.map((c) => ({ value: c.id, label: `${c.nominee_name} — ${c.company}` }))}
              className="max-w-xs"
            />
          )}
          <Button size="sm" onClick={() => pick && onResolve(row.id, 'match', pick)} disabled={!pick}>
            Match
          </Button>
          <Button size="sm" variant="outline" onClick={() => onResolve(row.id, 'skip')}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  )
}

function DuplicateRowItem({ row, onReplace }: { row: DuplicateRow; onReplace: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-warning-border bg-warning-subtle/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-foreground">{row.nominee_name}</span>
          <span className="text-muted-foreground"> · {row.company} · {categoryLabel(row.normalized_key)} · already imported</span>
        </div>
        {row.locked ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3" />
            Locked — scoring started
          </span>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onReplace(row.id)}>
            <RotateCcw className="size-3.5" />
            Replace existing
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'raw', label: 'Raw nominations', description: 'Upload & map sheets' },
  { id: 'editorial', label: 'Editorial summaries', description: 'Match & finalize' },
]

export default function ImportPage() {
  const [rawDone, setRawDone] = useState(false)
  const [editorialDone, setEditorialDone] = useState(false)

  const states = useMemo<('complete' | 'current' | 'upcoming')[]>(() => {
    return [rawDone ? 'complete' : 'current', editorialDone ? 'complete' : rawDone ? 'current' : 'current']
  }, [rawDone, editorialDone])

  return (
    <div className="mx-auto max-w-[72rem] space-y-6">
      <PageHeader
        title="Import"
        description="Import raw nominations and map their categories, then upload editorial summaries and match them."
      />
      <div className="card-surface px-6 py-4">
        <Stepper steps={STEPS} states={states} />
      </div>
      <RawStep onDone={() => setRawDone(true)} />
      <AuditedStep onFinalized={() => setEditorialDone(true)} />
    </div>
  )
}
