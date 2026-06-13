'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { TableShell, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { categoryLabel } from '@/lib/categories'
import { useReviewModal } from '@/components/nomination/ReviewModalProvider'

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
  const [actionError, setActionError] = useState('')

  // Auto-assign state
  const [autoCategory, setAutoCategory] = useState('')
  const [autoJurors, setAutoJurors] = useState<string[]>([])
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoResult, setAutoResult] = useState<{ assigned: number; skipped: number } | null>(null)

  const loadStaticData = useCallback(async () => {
    const [j, c] = await Promise.all([
      fetch('/api/admin/jurors').then(r => r.json()),
      fetch('/api/admin/conflicts').then(r => r.json()),
    ])
    setJurors(Array.isArray(j) ? j.filter((u: Juror) => u.role === 'juror') : [])
    setConflicts(Array.isArray(c) ? c : [])
  }, [])

  useEffect(() => { loadStaticData() }, [loadStaticData])

  const loadNominations = useCallback(async (cat: string) => {
    if (!cat) return
    setLoadingNoms(true)
    setActionError('')
    const res = await fetch(`/api/admin/assignments?category=${encodeURIComponent(cat)}`)
    const data = await res.json()
    setNominations(Array.isArray(data) ? data : [])
    setLoadingNoms(false)
  }, [])

  useEffect(() => { loadNominations(category); setSubCategory('') }, [category, loadNominations])

  function isConflicted(jurorId: string, company: string) {
    return conflicts.some(
      c => c.juror_id === jurorId && c.company.toLowerCase() === company.toLowerCase()
    )
  }

  function eligibleJurors(nom: Nomination) {
    const assignedIds = new Set(nom.assignments.map(a => a.juror_id))
    return jurors.filter(j => !assignedIds.has(j.id) && !isConflicted(j.id, nom.company))
  }

  async function handleAssign(nominationId: string, jurorId: string) {
    setActionError('')
    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomination_id: nominationId, juror_id: jurorId }),
    })
    const data = await res.json()
    if (!res.ok) { setActionError(data.error); return }
    await loadNominations(category)
  }

  async function handleUnassign(assignmentId: string) {
    setActionError('')
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setActionError(d.error); return }
    await loadNominations(category)
  }

  async function handleAutoAssign() {
    if (!autoCategory || autoJurors.length < 2) return
    setAutoRunning(true)
    setAutoResult(null)
    const res = await fetch('/api/admin/assignments/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master_category: autoCategory, juror_ids: autoJurors }),
    })
    const data = await res.json()
    setAutoRunning(false)
    if (res.ok) {
      setAutoResult(data)
      if (autoCategory === category) await loadNominations(category)
    } else {
      setActionError(data.error)
    }
  }

  // Sub-categories actually present in the loaded master category, sorted by label.
  const subCategories = Array.from(new Set(nominations.map(n => n.category_key)))
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))

  // Apply the optional single-category filter for display and stats.
  const visibleNominations = subCategory
    ? nominations.filter(n => n.category_key === subCategory)
    : nominations

  const totalSlots = visibleNominations.length * 2
  const filledSlots = visibleNominations.reduce((n, nom) => n + nom.assignments.length, 0)
  const complete = visibleNominations.filter(n => n.assignments.length >= 2).length

  return (
    <>
      <PageHeader title="Assignments" description="Assign exactly two jurors per nomination (conflict-aware)" />

      {/* Auto-assign */}
      <div className="card-surface mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Auto-assign a category</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Distributes all unassigned slots in the chosen category across the selected jurors (load-balanced, conflict-aware).
        </p>
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Category</label>
            <select
              value={autoCategory}
              onChange={e => setAutoCategory(e.target.value)}
              className="rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="min-w-48 flex-1">
            <p className="mb-1 text-xs text-muted-foreground">Jurors to include ({autoJurors.length} selected)</p>
            <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {jurors.length === 0 && <p className="text-xs text-muted-foreground">No jurors yet</p>}
              {jurors.map(j => (
                <label key={j.id} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoJurors.includes(j.id)}
                    onChange={e => setAutoJurors(prev =>
                      e.target.checked ? [...prev, j.id] : prev.filter(id => id !== j.id)
                    )}
                    className="rounded accent-primary"
                  />
                  <span>{j.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <Button
              onClick={handleAutoAssign}
              disabled={autoRunning || !autoCategory || autoJurors.length < 2}
            >
              {autoRunning ? 'Running…' : 'Auto-assign'}
            </Button>
            {autoResult && (
              <p className="mt-1.5 text-xs text-emerald-700">
                Assigned {autoResult.assigned} slots
                {autoResult.skipped > 0 ? `, skipped ${autoResult.skipped} (conflicts/exhausted)` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Manual assignment table */}
      <div className="mb-4 flex items-center gap-4">
        <div>
          <label className="mr-2 text-xs text-muted-foreground">Filter by category:</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Select a category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {category && !loadingNoms && subCategories.length > 0 && (
          <div>
            <label className="mr-2 text-xs text-muted-foreground">Sub-category:</label>
            <select
              value={subCategory}
              onChange={e => setSubCategory(e.target.value)}
              className="rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">All sub-categories</option>
              {subCategories.map(k => <option key={k} value={k}>{categoryLabel(k)}</option>)}
            </select>
          </div>
        )}
        {category && !loadingNoms && (
          <span className="text-xs text-muted-foreground">
            {visibleNominations.length} nominations · {complete} fully assigned · {filledSlots}/{totalSlots} slots filled
          </span>
        )}
      </div>

      {actionError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {!category && (
        <div className="card-surface border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Select a category above to view and manage assignments.</p>
        </div>
      )}

      {category && loadingNoms && (
        <p className="text-sm text-muted-foreground">Loading nominations…</p>
      )}

      {category && !loadingNoms && visibleNominations.length === 0 && (
        <p className="text-sm text-muted-foreground">No nominations found for this category.</p>
      )}

      {category && !loadingNoms && visibleNominations.length > 0 && (
        <TableShell>
          <Table>
            <THead>
              <tr>
                <TH>Nominee</TH>
                <TH>Company</TH>
                <TH>Juror 1</TH>
                <TH>Juror 2</TH>
              </tr>
            </THead>
            <TBody>
              {visibleNominations.map(nom => {
                const slots = [nom.assignments[0] ?? null, nom.assignments[1] ?? null]
                const eligible = eligibleJurors(nom)
                return (
                  <TR key={nom.id}>
                    <TD>
                      <button
                        onClick={() => openReview(visibleNominations.map(n => n.id), nom.id)}
                        className="font-medium text-primary hover:underline"
                      >
                        {nom.nominee_name}
                      </button>
                      <span className="ml-2 text-xs text-muted-foreground">{categoryLabel(nom.category_key)}</span>
                    </TD>
                    <TD className="text-muted-foreground">{nom.company}</TD>
                    {slots.map((slot, i) => (
                      <TD key={i}>
                        {slot ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`text-sm ${slot.status === 'scored' ? 'font-medium text-emerald-700' : 'text-foreground'}`}>
                              {slot.jury_users?.name ?? slot.juror_id}
                              {slot.status === 'scored' && <span className="ml-1 text-xs text-emerald-600">✓</span>}
                            </span>
                            <button
                              onClick={() => handleUnassign(slot.id)}
                              className="text-xs leading-none text-muted-foreground hover:text-red-500"
                              title="Remove assignment"
                            >
                              ×
                            </button>
                          </span>
                        ) : (
                          <select
                            defaultValue=""
                            onChange={e => { if (e.target.value) handleAssign(nom.id, e.target.value) }}
                            className="rounded-md border border-input bg-card px-1.5 py-1 text-xs text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                          >
                            <option value="">Assign juror…</option>
                            {eligible.map(j => (
                              <option key={j.id} value={j.id}>{j.name}</option>
                            ))}
                            {eligible.length === 0 && (
                              <option disabled>No eligible jurors</option>
                            )}
                          </select>
                        )}
                      </TD>
                    ))}
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </TableShell>
      )}
    </>
  )
}
