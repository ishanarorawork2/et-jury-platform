import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import NominationsBrowser, { type BrowserNomination } from '@/components/admin/NominationsBrowser'
import { fetchAll } from '@/lib/supabase/fetch-all'
import type { LifecycleStatus } from '@/lib/status'

type ResultRow = {
  nomination_id: string
  display_id: string
  nominee_name: string
  company: string
  master_category: string
  category_key: string
  lifecycle_status: LifecycleStatus
}
type NomMeta = { id: string; designation: string | null; editorial_summary: { id: string } | { id: string }[] | null }
type AssignmentRow = {
  id: string
  nomination_id: string
  juror_id: string
  jury_users: { id: string; name: string } | null
}
type ConflictRow = { juror_id: string; company: string }
type JurorRow = { id: string; name: string; role: string }

export default async function AdminNominationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jurorUser } = await supabase
    .from('jury_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (jurorUser?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()

  const [results, meta, allJurors, conflicts, assignmentRows, scoredRows] = await Promise.all([
    fetchAll<ResultRow>(
      service, 'nomination_results',
      'nomination_id, display_id, nominee_name, company, master_category, category_key, lifecycle_status'
    ),
    fetchAll<NomMeta>(service, 'nominations', 'id, designation, editorial_summary ( id )'),
    fetchAll<JurorRow>(service, 'jury_users', 'id, name, role'),
    fetchAll<ConflictRow>(service, 'conflicts', 'juror_id, company'),
    fetchAll<AssignmentRow>(
      service,
      'assignments',
      'id, nomination_id, juror_id, jury_users!juror_id ( id, name )'
    ),
    fetchAll<{ nomination_id: string; juror_id: string }>(service, 'latest_scores', 'nomination_id, juror_id'),
  ])

  const metaMap = new Map(meta.map((m) => [m.id, m]))
  const hasSummary = (rel: NomMeta['editorial_summary']) =>
    Array.isArray(rel) ? rel.length > 0 : rel != null

  const scoredSet = new Set(scoredRows.map((s) => `${s.nomination_id}:${s.juror_id}`))

  // Group assignments by nomination id
  const assignmentsByNomId = new Map<string, BrowserNomination['assignments']>()
  for (const a of assignmentRows) {
    if (!assignmentsByNomId.has(a.nomination_id)) assignmentsByNomId.set(a.nomination_id, [])
    assignmentsByNomId.get(a.nomination_id)!.push({
      id: a.id,
      juror_id: a.juror_id,
      status: scoredSet.has(`${a.nomination_id}:${a.juror_id}`) ? 'scored' : 'pending',
      jury_users: a.jury_users,
    })
  }

  const nominations: BrowserNomination[] = results
    .map((r) => {
      const m = metaMap.get(r.nomination_id)
      return {
        id: r.nomination_id,
        nomination_id: r.display_id,
        nominee_name: r.nominee_name,
        company: r.company,
        designation: m?.designation ?? null,
        master_category: r.master_category,
        category_key: r.category_key,
        has_summary: hasSummary(m?.editorial_summary ?? null),
        lifecycle_status: r.lifecycle_status,
        assignments: assignmentsByNomId.get(r.nomination_id) ?? [],
      }
    })
    .sort(
      (a, b) =>
        a.master_category.localeCompare(b.master_category) ||
        a.nominee_name.localeCompare(b.nominee_name)
    )

  const jurors = allJurors.filter((j) => j.role === 'juror').map((j) => ({ id: j.id, name: j.name }))

  return (
    <>
      <PageHeader title="Nominations" description={`${nominations.length} imported nominations`} />
      <NominationsBrowser nominations={nominations} jurors={jurors} conflicts={conflicts} />
    </>
  )
}
