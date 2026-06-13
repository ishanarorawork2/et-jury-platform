import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { TableShell, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { categoryLabel } from '@/lib/categories'

export default async function AdminProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = await createServiceClient()

  const [{ data: jurors }, { data: assignments }, { data: nominations }] = await Promise.all([
    service.from('jury_users').select('id, name').eq('role', 'juror').order('name'),
    service.from('assignments').select('id, juror_id, nomination_id, status'),
    service.from('nominations').select('id, master_category, category_key'),
  ])

  // Per-juror stats
  const jurorStats = (jurors ?? []).map(j => {
    const ja = (assignments ?? []).filter(a => a.juror_id === j.id)
    const scored = ja.filter(a => a.status === 'scored').length
    return { id: j.id, name: j.name, assigned: ja.length, scored, pending: ja.length - scored }
  })

  // Build completion stats for an arbitrary grouping of nominations
  function buildGroupStats(keyOf: (n: { id: string; master_category: string; category_key: string }) => string) {
    const keys = [...new Set((nominations ?? []).map(keyOf))].sort()
    return keys.map(key => {
      const nomIds = new Set(
        (nominations ?? []).filter(n => keyOf(n) === key).map(n => n.id)
      )
      const groupAssignments = (assignments ?? []).filter(a => nomIds.has(a.nomination_id))

      const byNom = new Map<string, typeof groupAssignments>()
      for (const a of groupAssignments) {
        if (!byNom.has(a.nomination_id)) byNom.set(a.nomination_id, [])
        byNom.get(a.nomination_id)!.push(a)
      }

      let fullyAssigned = 0
      let complete = 0
      for (const aList of byNom.values()) {
        if (aList.length >= 2) {
          fullyAssigned++
          if (aList.every(a => a.status === 'scored')) complete++
        }
      }

      return {
        key,
        total: nomIds.size,
        fullyAssigned,
        complete,
        pending: fullyAssigned - complete,
        unassigned: nomIds.size - fullyAssigned,
      }
    })
  }

  // Per-master-category and per-sub-category stats
  const categoryStats = buildGroupStats(n => n.master_category)
  const subCategoryStats = buildGroupStats(n => n.category_key)

  const totalNoms = nominations?.length ?? 0
  const totalFullyAssigned = categoryStats.reduce((n, c) => n + c.fullyAssigned, 0)
  const totalComplete = categoryStats.reduce((n, c) => n + c.complete, 0)
  const totalUnassigned = categoryStats.reduce((n, c) => n + c.unassigned, 0)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Progress Dashboard" description="Assignment and scoring completion across the panel" />

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        {[
          { label: 'Total nominations', value: totalNoms },
          { label: 'Fully assigned', value: totalFullyAssigned },
          { label: 'Complete (both scored)', value: totalComplete },
          { label: 'Unassigned', value: totalUnassigned },
        ].map(card => (
          <div key={card.label} className="card-surface p-4">
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Per-category table */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">By category</h2>
        <TableShell>
          <Table>
            <THead>
              <tr>
                <TH>Category</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Fully assigned</TH>
                <TH className="text-right">Complete</TH>
                <TH className="text-right">Pending</TH>
                <TH className="text-right">Unassigned</TH>
              </tr>
            </THead>
            <TBody>
              {categoryStats.map(c => (
                <TR key={c.key}>
                  <TD className="font-medium text-foreground">{c.key}</TD>
                  <TD className="text-right text-muted-foreground">{c.total}</TD>
                  <TD className="text-right text-muted-foreground">{c.fullyAssigned}</TD>
                  <TD className="text-right">
                    <span className={c.complete > 0 ? 'font-medium text-emerald-700' : 'text-muted-foreground'}>
                      {c.complete}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <span className={c.pending > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                      {c.pending}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <span className={c.unassigned > 0 ? 'text-red-500' : 'text-muted-foreground'}>
                      {c.unassigned}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableShell>
      </div>

      {/* Per-sub-category table */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">By sub-category</h2>
        <TableShell>
          <Table>
            <THead>
              <tr>
                <TH>Sub-category</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Fully assigned</TH>
                <TH className="text-right">Complete</TH>
                <TH className="text-right">Pending</TH>
                <TH className="text-right">Unassigned</TH>
              </tr>
            </THead>
            <TBody>
              {subCategoryStats.map(c => (
                <TR key={c.key}>
                  <TD className="font-medium text-foreground">{categoryLabel(c.key)}</TD>
                  <TD className="text-right text-muted-foreground">{c.total}</TD>
                  <TD className="text-right text-muted-foreground">{c.fullyAssigned}</TD>
                  <TD className="text-right">
                    <span className={c.complete > 0 ? 'font-medium text-emerald-700' : 'text-muted-foreground'}>
                      {c.complete}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <span className={c.pending > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                      {c.pending}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <span className={c.unassigned > 0 ? 'text-red-500' : 'text-muted-foreground'}>
                      {c.unassigned}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableShell>
      </div>

      {/* Per-juror table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">By juror</h2>
        {jurorStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jurors yet.</p>
        ) : (
          <TableShell>
            <Table>
              <THead>
                <tr>
                  <TH>Juror</TH>
                  <TH className="text-right">Assigned</TH>
                  <TH className="text-right">Scored</TH>
                  <TH className="text-right">Pending</TH>
                  <TH className="text-right">% done</TH>
                </tr>
              </THead>
              <TBody>
                {jurorStats.map(j => {
                  const pct = j.assigned > 0 ? Math.round((j.scored / j.assigned) * 100) : 0
                  return (
                    <TR key={j.id}>
                      <TD className="font-medium text-foreground">{j.name}</TD>
                      <TD className="text-right text-muted-foreground">{j.assigned}</TD>
                      <TD className="text-right">
                        <span className={j.scored > 0 ? 'text-emerald-700' : 'text-muted-foreground'}>
                          {j.scored}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <span className={j.pending > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                          {j.pending}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </TableShell>
        )}
      </div>
    </div>
  )
}
