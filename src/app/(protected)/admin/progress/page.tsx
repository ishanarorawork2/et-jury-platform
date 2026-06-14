import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { RefreshButton } from '@/components/ui/refresh-button'
import ProgressDashboard from '@/components/admin/ProgressDashboard'

export default async function AdminProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()

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
  const totalPending = categoryStats.reduce((n, c) => n + c.pending, 0)

  return (
    <div className="mx-auto max-w-[80rem]">
      <PageHeader
        title="Progress"
        description="Assignment and scoring completion across the panel"
        actions={<RefreshButton />}
      />

      <ProgressDashboard
        totals={{
          total: totalNoms,
          fullyAssigned: totalFullyAssigned,
          complete: totalComplete,
          unassigned: totalUnassigned,
          pending: totalPending,
        }}
        categoryStats={categoryStats}
        subCategoryStats={subCategoryStats}
        jurorStats={jurorStats}
      />
    </div>
  )
}
