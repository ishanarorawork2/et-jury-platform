import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import JuryViewPanel from '@/components/admin/JuryViewPanel'

type AssignmentRow = {
  id: string
  status: string
  nomination_id: string
  nomination_display_id: string
  nominee_name: string
  designation: string
  company: string
  company_size: string | null
  master_category: string
  category_key: string
  score: number | null
  summary: string | null
}

type PageProps = {
  searchParams: Promise<{ juror?: string }>
}

export default async function JuryViewPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('jury_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()
  const params = await searchParams
  const selectedJurorId = params.juror ?? null

  const { data: jurors } = await service
    .from('jury_users')
    .select('id, name, email')
    .eq('role', 'juror')
    .order('name')

  const jurorList = jurors ?? []

  let rows: AssignmentRow[] = []
  let selectedJurorName: string | null = null

  if (selectedJurorId) {
    const selected = jurorList.find((j) => j.id === selectedJurorId)
    selectedJurorName = selected?.name ?? selected?.email ?? null

    const [{ data: assignments }, { data: scores }] = await Promise.all([
      service
        .from('assignments')
        .select(`
          id,
          nominations (
            id, nomination_id, nominee_name, designation, company, company_size, master_category, category_key,
            editorial_summary ( summary )
          )
        `)
        .eq('juror_id', selectedJurorId)
        .order('assigned_at', { ascending: true }),
      service
        .from('latest_scores')
        .select('nomination_id, total_score')
        .eq('juror_id', selectedJurorId),
    ])

    const scoreMap = new Map(
      (scores ?? []).map((s) => [s.nomination_id as string, Number(s.total_score)])
    )

    rows = (assignments ?? []).map((a) => {
      const nom = (Array.isArray(a.nominations) ? a.nominations[0] : a.nominations) as {
        id?: string
        nomination_id?: string
        nominee_name?: string
        designation?: string
        company?: string
        company_size?: string | null
        master_category?: string
        category_key?: string
        editorial_summary?: { summary?: string | null } | { summary?: string | null }[] | null
      } | null
      const nomId = nom?.id ?? ''
      const es = Array.isArray(nom?.editorial_summary)
        ? nom?.editorial_summary[0]
        : nom?.editorial_summary
      return {
        id: a.id,
        status: scoreMap.has(nomId) ? 'scored' : 'pending',
        nomination_id: nomId,
        nomination_display_id: nom?.nomination_id ?? '',
        nominee_name: nom?.nominee_name ?? '',
        designation: nom?.designation ?? '',
        company: nom?.company ?? '',
        company_size: nom?.company_size ?? null,
        master_category: nom?.master_category ?? '',
        category_key: nom?.category_key ?? '',
        score: scoreMap.get(nomId) ?? null,
        summary: es?.summary ?? null,
      }
    })
  }

  const description = selectedJurorId
    ? rows.length === 0
      ? 'No nominations assigned to this juror'
      : `${rows.length} nomination${rows.length !== 1 ? 's' : ''} assigned to ${selectedJurorName ?? 'this juror'}`
    : `${jurorList.length} juror${jurorList.length !== 1 ? 's' : ''} on the panel`

  return (
    <>
      <PageHeader
        title="Jury: My Assignments"
        description={description}
      />
      <JuryViewPanel
        jurors={jurorList}
        selectedJurorId={selectedJurorId}
        selectedJurorName={selectedJurorName}
        rows={rows}
      />
    </>
  )
}
