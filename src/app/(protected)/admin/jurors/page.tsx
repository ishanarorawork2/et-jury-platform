'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

type Juror = { id: string; name: string; email: string; role: string }
type Conflict = { id: string; juror_id: string; company: string }

export default function AdminJurorsPage() {
  const [jurors, setJurors] = useState<Juror[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [conflictInput, setConflictInput] = useState<Record<string, string>>({})
  const [addingConflict, setAddingConflict] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    const [j, c] = await Promise.all([
      fetch('/api/admin/jurors').then(r => r.json()),
      fetch('/api/admin/conflicts').then(r => r.json()),
    ])
    setJurors(Array.isArray(j) ? j : [])
    setConflicts(Array.isArray(c) ? c : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/admin/jurors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setCreateError(data.error)
      setCreating(false)
      return
    }
    setForm({ name: '', email: '', password: '' })
    setShowCreate(false)
    setCreating(false)
    await load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete juror "${name}"? This removes their account and all assignments.`)) return
    await fetch(`/api/admin/jurors/${id}`, { method: 'DELETE' })
    await load()
  }

  async function handleAddConflict(jurorId: string) {
    const company = conflictInput[jurorId]?.trim()
    if (!company) return
    setAddingConflict(prev => ({ ...prev, [jurorId]: true }))
    await fetch('/api/admin/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ juror_id: jurorId, company }),
    })
    setConflictInput(prev => ({ ...prev, [jurorId]: '' }))
    setAddingConflict(prev => ({ ...prev, [jurorId]: false }))
    await load()
  }

  async function handleRemoveConflict(id: string) {
    await fetch(`/api/admin/conflicts/${id}`, { method: 'DELETE' })
    await load()
  }

  const jurorList = jurors.filter(j => j.role === 'juror')

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Juror Management"
        description={`${jurorList.length} juror${jurorList.length !== 1 ? 's' : ''}`}
        actions={
          <Button
            variant={showCreate ? 'outline' : 'default'}
            onClick={() => { setShowCreate(!showCreate); setCreateError('') }}
          >
            {showCreate ? 'Cancel' : 'Create juror'}
          </Button>
        }
      />

      {showCreate && (
        <form onSubmit={handleCreate} className="card-surface mb-6 p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">New juror account</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="juror@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Min 8 characters"
              />
            </div>
          </div>
          {createError && <p className="mt-2 text-xs text-destructive">{createError}</p>}
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      )}

      {jurorList.length === 0 ? (
        <div className="card-surface border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No jurors yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jurorList.map(juror => {
            const jurorConflicts = conflicts.filter(c => c.juror_id === juror.id)
            return (
              <div key={juror.id} className="card-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{juror.name}</p>
                    <p className="text-sm text-muted-foreground">{juror.email}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(juror.id, juror.name)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Conflicts
                  </p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {jurorConflicts.length === 0 && (
                      <span className="text-xs text-muted-foreground">None declared</span>
                    )}
                    {jurorConflicts.map(c => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                      >
                        {c.company}
                        <button
                          onClick={() => handleRemoveConflict(c.id)}
                          className="ml-0.5 font-bold leading-none text-amber-500 hover:text-amber-700"
                          title="Remove conflict"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={conflictInput[juror.id] ?? ''}
                      onChange={e => setConflictInput(prev => ({ ...prev, [juror.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddConflict(juror.id)}
                      placeholder="Company name"
                      className="w-48 rounded-md border border-input bg-card px-2 py-1 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddConflict(juror.id)}
                      disabled={addingConflict[juror.id]}
                    >
                      + Add conflict
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
