'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { CATEGORY_LABELS, categoryLabel } from '@/lib/categories'
import type { RawSheetSummary, CandidateNomination, ImportBatch, CoverageSummary } from '@/lib/import/types'

// ── Shared bits ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS)

function FileInput({ name, inputRef, multiple }: { name: string; inputRef: React.RefObject<HTMLInputElement | null>; multiple?: boolean }) {
  return (
    <input
      ref={inputRef}
      type="file"
      name={name}
      multiple={multiple}
      accept=".xlsx"
      className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
    />
  )
}

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div>
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
    if (!confirm(`Import nominations from ${mapped} mapped sheets? Existing rows with the same Nomination Id are updated.`)) return
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
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }

  const mappedCount = Object.values(map).filter(Boolean).length

  return (
    <div className="card-surface space-y-5 p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Step 1 — Raw nominations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the raw workbook, confirm how each sheet maps to a category, then import. All rows are
          stored; a nomination becomes assignable once it has a matched editorial summary (Step 2).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <FileInput name="raw" inputRef={rawRef} />
        <Button onClick={analyze} disabled={loading}>{loading && !parsed ? 'Analyzing…' : 'Analyze sheets'}</Button>
      </div>

      <ErrorBox msg={error} />

      {parsed && !committed && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {parsed.sheets.length} sheets · {parsed.total_rows} rows. Confirm each mapping (master category is derived):
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60 text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Sheet</th>
                  <th className="px-4 py-2 text-right">Rows</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Master category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.sheets.map((s) => {
                  const key = map[s.sheet_name] ?? ''
                  return (
                    <tr key={s.sheet_name} className={key ? '' : 'bg-amber-50/50'}>
                      <td className="px-4 py-2 font-mono text-xs text-foreground">{s.sheet_name}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{s.row_count}</td>
                      <td className="px-4 py-2">
                        <select
                          value={key}
                          onChange={(e) => setMap((m) => ({ ...m, [s.sheet_name]: e.target.value }))}
                          className="rounded-md border border-input bg-card px-2 py-1 text-sm"
                        >
                          <option value="">— skip this sheet —</option>
                          {CATEGORY_OPTIONS.map((k) => (
                            <option key={k} value={k}>{categoryLabel(k)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {key ? parsed.key_master[key] ?? '—' : <span className="text-amber-600">will be skipped</span>}
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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <strong>{committed.inserted} nominations imported.</strong>
          {committed.skipped_sheets.length > 0 && (
            <span className="ml-1 text-muted-foreground">Skipped sheets: {committed.skipped_sheets.join(', ')}.</span>
          )}
          {committed.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-600">{committed.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
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

function AuditedStep() {
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
      fetch('/api/admin/import/coverage').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/admin/import/audited/batches').then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
    if (cov) setCoverage(cov)
    if (bat) setBatches(bat.batches)
  }, [])

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
    if (!confirm(`Match ${matches.length} rows to their selected nomination? Rows whose pick collides with another stay unmatched.`)) return
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
  }

  async function skipAll() {
    if (!stage) return
    if (!confirm(`Skip all ${rows.length} unmatched rows? They'll be excluded from this import.`)) return
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
    if (!confirm('Replace all unlocked duplicates? Existing summaries will be overwritten at finalize.')) return
    const res = await fetch('/api/admin/import/audited/reconcile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'replace_all', batch_id: stage.batch_id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Update failed'); return }
    setError(null)
    setCounts(json.counts)
    setDuplicates((ds) => ds.filter((d) => d.locked)) // unlocked ones are now matched
  }

  async function finalize() {
    if (!stage) return
    if (!confirm('Commit all matched editorial summaries? This writes to the live platform.')) return
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }

  const canFinalize = counts != null && counts.unmatched === 0
  const lockedDupes = duplicates.filter((d) => d.locked).length

  return (
    <div className="space-y-6">
      <CoverageDashboard coverage={coverage} />

      <div className="card-surface space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Step 2 — Editorial summaries</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload any number of audited files — one now, more later. Each row&apos;s category and master
            category are auto-detected, and each is matched to a stored nomination by name, company and
            category. Rows that already have a summary are flagged as duplicates and excluded; only
            unmatched rows block finalize. No existing summary is ever overwritten automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FileInput name="files" inputRef={filesRef} multiple />
          <Button onClick={runStage} disabled={loading}>{loading && !stage ? 'Matching…' : 'Stage & auto-match'}</Button>
        </div>

        <ErrorBox msg={error} />

        {stage && counts && (
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
            {[
              { label: 'Audited rows', value: stage.total_audited },
              { label: 'Matched', value: counts.matched, cls: 'text-emerald-700' },
              { label: 'Duplicates', value: counts.duplicate, cls: counts.duplicate > 0 ? 'text-amber-600' : 'text-muted-foreground' },
              { label: 'Unmatched', value: counts.unmatched, cls: counts.unmatched > 0 ? 'text-orange-600' : 'text-emerald-700' },
              { label: 'Skipped', value: counts.skipped, cls: 'text-muted-foreground' },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-border bg-muted/40 p-3">
                <div className={`text-2xl font-bold ${c.cls ?? 'text-foreground'}`}>{c.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Resolve unmatched rows ({rows.length})</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={matchAll}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                >Match all to top candidate</button>
                <button
                  onClick={skipAll}
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                >Skip all</button>
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
              <h3 className="text-sm font-semibold text-foreground">Duplicates (excluded) ({duplicates.length})</h3>
              {duplicates.length - lockedDupes > 0 && (
                <button
                  onClick={replaceAll}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >Replace all {duplicates.length - lockedDupes} unlocked in this batch</button>
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
            {loading ? 'Finalizing…' : canFinalize ? `Finalize ${counts?.matched ?? 0} editorial summaries` : `${counts?.unmatched ?? 0} unmatched — resolve to finalize`}
          </Button>
        )}

        {finalized && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <strong>{finalized.committed} editorial summaries committed.</strong> Matched nominations are now assignable.
            {finalized.locked_dropped > 0 && (
              <span className="ml-1 text-amber-700">{finalized.locked_dropped} already-scored rows were left unchanged.</span>
            )}
          </div>
        )}
      </div>

      <UploadHistory batches={batches} />
    </div>
  )
}

function CoverageDashboard({ coverage }: { coverage: CoverageSummary | null }) {
  if (!coverage) return null
  return (
    <div className="card-surface space-y-3 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Editorial summary coverage</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{coverage.with_summary}</strong> / {coverage.total} nominations have summaries
          · <span className="text-orange-600">{coverage.pending} pending</span>
        </p>
      </div>
      <div className="space-y-2">
        {coverage.by_master.map((m) => {
          const pct = m.total ? Math.round((m.with_summary / m.total) * 100) : 0
          return (
            <div key={m.master_category} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">{m.master_category}</span>
                <span className="text-muted-foreground">{m.with_summary}/{m.total} · {pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UploadHistory({ batches }: { batches: ImportBatch[] }) {
  if (batches.length === 0) return null
  const statusCls: Record<string, string> = {
    finalized: 'text-emerald-700',
    staged: 'text-amber-600',
    discarded: 'text-muted-foreground line-through',
  }
  return (
    <div className="card-surface space-y-3 p-6">
      <h2 className="text-base font-semibold text-foreground">Upload history</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/60 text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Files</th>
              <th className="px-3 py-2 text-left">Uploaded by</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Imported</th>
              <th className="px-3 py-2 text-right">Duplicates</th>
              <th className="px-3 py-2 text-right">Unmatched</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2 text-xs text-foreground">{b.file_names.join(', ') || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{b.uploaded_by_name ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(b.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{b.status === 'finalized' ? b.imported_count : '—'}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{b.duplicate_count}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{b.unmatched_count}</td>
                <td className={`px-3 py-2 text-xs font-medium ${statusCls[b.status] ?? 'text-foreground'}`}>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReconcileRow({ row, pick, onPick, onResolve }: { row: UnmatchedRow; pick: string; onPick: (value: string) => void; onResolve: (id: string, action: 'match' | 'skip', nominationId?: string) => void }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-foreground">{row.nominee_name}</span>
          <span className="text-muted-foreground"> · {row.company} · {categoryLabel(row.normalized_key)}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={pick} onChange={(e) => onPick(e.target.value)} className="max-w-xs rounded-md border border-input bg-card px-2 py-1 text-xs">
            {row.candidates.length === 0 && <option value="">No candidates in this category</option>}
            {row.candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.nominee_name} — {c.company}</option>
            ))}
          </select>
          <button
            onClick={() => pick && onResolve(row.id, 'match', pick)}
            disabled={!pick}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >Match</button>
          <button
            onClick={() => onResolve(row.id, 'skip')}
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >Skip</button>
        </div>
      </div>
    </div>
  )
}

function DuplicateRowItem({ row, onReplace }: { row: DuplicateRow; onReplace: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-foreground">{row.nominee_name}</span>
          <span className="text-muted-foreground"> · {row.company} · {categoryLabel(row.normalized_key)} · already imported</span>
        </div>
        {row.locked ? (
          <span className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            🔒 Locked — scoring started
          </span>
        ) : (
          <button
            onClick={() => onReplace(row.id)}
            className="rounded-md border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
          >Replace existing</button>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [, setRawDone] = useState(false)
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Import Data"
        description="Two steps: import raw nominations and map their categories, then upload editorial summaries incrementally and match them."
      />
      <RawStep onDone={() => setRawDone(true)} />
      <AuditedStep />
    </div>
  )
}
