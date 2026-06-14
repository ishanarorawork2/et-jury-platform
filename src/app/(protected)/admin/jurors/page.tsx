'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserPlus, Users, ShieldAlert, X, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { StatCard } from '@/components/ui/stat-card'
import { Meter } from '@/components/ui/meter'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { useConfirm } from '@/components/ui/confirm'
import { toast } from '@/lib/toast'
import { jurorActivity } from '@/lib/status'

type Juror = { id: string; name: string; email: string; role: string }
type Conflict = { id: string; juror_id: string; company: string }
type JurorStat = { id: string; name: string; assigned: number; scored: number; pending: number }

export default function AdminJurorsPage() {
  const confirm = useConfirm()
  const [jurors, setJurors] = useState<Juror[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [stats, setStats] = useState<JurorStat[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conflictInput, setConflictInput] = useState('')
  const [addingConflict, setAddingConflict] = useState(false)

  const load = useCallback(async () => {
    const [j, c, p] = await Promise.all([
      fetch('/api/admin/jurors').then((r) => r.json()),
      fetch('/api/admin/conflicts').then((r) => r.json()),
      fetch('/api/admin/progress').then((r) => r.json()).catch(() => ({ jurorStats: [] })),
    ])
    setJurors(Array.isArray(j) ? j : [])
    setConflicts(Array.isArray(c) ? c : [])
    setStats(Array.isArray(p?.jurorStats) ? p.jurorStats : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const jurorList = useMemo(() => jurors.filter((j) => j.role === 'juror'), [jurors])
  const statMap = useMemo(() => new Map(stats.map((s) => [s.id, s])), [stats])
  const conflictCount = useMemo(() => {
    const m = new Map<string, number>()
    conflicts.forEach((c) => m.set(c.juror_id, (m.get(c.juror_id) ?? 0) + 1))
    return m
  }, [conflicts])

  const maxAssigned = useMemo(
    () => Math.max(1, ...stats.map((s) => s.assigned)),
    [stats]
  )

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
    setCreating(false)
    if (!res.ok) {
      setCreateError(data.error)
      return
    }
    toast.success('Juror created', { description: `${form.name} can now sign in.` })
    setForm({ name: '', email: '', password: '' })
    setShowCreate(false)
    await load()
  }

  async function handleDelete(juror: Juror) {
    const ok = await confirm({
      title: `Delete ${juror.name}?`,
      description: 'This removes their account and all of their assignments. This cannot be undone.',
      confirmLabel: 'Delete juror',
      variant: 'destructive',
    })
    if (!ok) return
    await fetch(`/api/admin/jurors/${juror.id}`, { method: 'DELETE' })
    toast.success('Juror deleted', { description: `${juror.name} was removed.` })
    setSelectedId(null)
    await load()
  }

  async function handleAddConflict(jurorId: string) {
    const company = conflictInput.trim()
    if (!company) return
    setAddingConflict(true)
    await fetch('/api/admin/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ juror_id: jurorId, company }),
    })
    setConflictInput('')
    setAddingConflict(false)
    toast.success('Conflict added', { description: `${company} blocked for this juror.` })
    await load()
  }

  async function handleRemoveConflict(id: string) {
    await fetch(`/api/admin/conflicts/${id}`, { method: 'DELETE' })
    await load()
  }

  const columns = useMemo<ColumnDef<Juror>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Juror',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.original.name || row.original.email} size="sm" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'load',
        header: 'Load',
        accessorFn: (j) => statMap.get(j.id)?.assigned ?? 0,
        cell: ({ row }) => {
          const s = statMap.get(row.original.id)
          const assigned = s?.assigned ?? 0
          return (
            <div className="flex items-center gap-2.5">
              <Meter className="w-24" value={assigned} max={maxAssigned} tone="info" />
              <span className="text-xs tabular-nums text-muted-foreground">{assigned}</span>
            </div>
          )
        },
      },
      {
        id: 'activity',
        header: 'Activity',
        accessorFn: (j) => statMap.get(j.id)?.scored ?? 0,
        cell: ({ row }) => {
          const s = statMap.get(row.original.id)
          const meta = jurorActivity(s?.assigned ?? 0, s?.scored ?? 0)
          return (
            <Badge variant={meta.variant} dot>
              {meta.label}
              {s && s.assigned > 0 ? ` · ${s.scored}/${s.assigned}` : ''}
            </Badge>
          )
        },
      },
      {
        id: 'conflicts',
        header: 'Conflicts',
        accessorFn: (j) => conflictCount.get(j.id) ?? 0,
        cell: ({ row }) => {
          const n = conflictCount.get(row.original.id) ?? 0
          return n > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
              <ShieldAlert className="size-3.5 text-warning" />
              {n}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )
        },
      },
    ],
    [statMap, maxAssigned, conflictCount]
  )

  const selected = selectedId ? jurorList.find((j) => j.id === selectedId) : null
  const selectedStat = selected ? statMap.get(selected.id) : null
  const selectedConflicts = selected ? conflicts.filter((c) => c.juror_id === selected.id) : []

  const totalConflicts = conflicts.length
  const activeJurors = stats.filter((s) => s.assigned > 0).length

  return (
    <div className="mx-auto max-w-[72rem]">
      <PageHeader
        title="Jurors"
        description={`${jurorList.length} juror${jurorList.length !== 1 ? 's' : ''} on the panel`}
        actions={
          <Button onClick={() => { setShowCreate(true); setCreateError('') }}>
            <UserPlus className="size-4" />
            New juror
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : jurorList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No jurors yet"
          description="Create the first juror account to begin assigning nominations."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <UserPlus className="size-4" />
              New juror
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Jurors" value={jurorList.length} icon={Users} tone="neutral" />
            <StatCard label="Active" value={activeJurors} hint="with assignments" tone="info" />
            <StatCard label="Conflicts declared" value={totalConflicts} icon={ShieldAlert} tone={totalConflicts > 0 ? 'warning' : 'neutral'} />
          </div>

          <DataGrid
            data={jurorList}
            columns={columns}
            getRowId={(r) => r.id}
            searchPlaceholder="Search jurors…"
            enableDensityToggle={false}
            pageSize={50}
            onRowClick={(row) => setSelectedId(row.id)}
          />
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New juror account</DialogTitle>
            <DialogDescription>Create login credentials for a panel member.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="juror@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Min 8 characters"
              />
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create juror'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail drawer */}
      <Drawer open={selected != null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <DrawerContent size="md">
            <DrawerHeader>
              <div className="flex items-center gap-3">
                <Avatar name={selected.name || selected.email} size="lg" />
                <div className="min-w-0">
                  <DrawerTitle>{selected.name}</DrawerTitle>
                  <DrawerDescription>{selected.email}</DrawerDescription>
                </div>
              </div>
            </DrawerHeader>
            <DrawerBody className="space-y-6">
              {selectedStat && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-2xl font-semibold tabular-nums text-foreground">{selectedStat.assigned}</p>
                    <p className="text-xs text-muted-foreground">Assigned</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-2xl font-semibold tabular-nums text-success">{selectedStat.scored}</p>
                    <p className="text-xs text-muted-foreground">Scored</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-2xl font-semibold tabular-nums text-warning">{selectedStat.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Conflicts of interest
                </p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {selectedConflicts.length === 0 && (
                    <span className="text-sm text-muted-foreground">None declared</span>
                  )}
                  {selectedConflicts.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-subtle px-2.5 py-1 text-xs text-warning"
                    >
                      {c.company}
                      <button
                        onClick={() => handleRemoveConflict(c.id)}
                        className="leading-none hover:opacity-70"
                        title="Remove conflict"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={conflictInput}
                    onChange={(e) => setConflictInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddConflict(selected.id)}
                    placeholder="Company name"
                    className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddConflict(selected.id)}
                    disabled={addingConflict}
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="destructive" onClick={() => handleDelete(selected)}>
                <Trash2 className="size-4" />
                Delete juror
              </Button>
            </DrawerFooter>
          </DrawerContent>
        )}
      </Drawer>
    </div>
  )
}
