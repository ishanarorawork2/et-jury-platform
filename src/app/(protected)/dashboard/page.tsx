import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AssignmentsTable from '@/components/dashboard/AssignmentsTable'
import { PageHeader } from '@/components/ui/page-header'

type AssignmentRow = {
  id: string
  status: string
  nomination_id: string
  nomination_display_id: string
  nominee_name: string
  designation: string
  company: string
  master_category: string
  category_key: string
  score: number | null
  summary: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jurorUser } = await supabase
    .from('jury_users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (jurorUser?.role === 'admin') redirect('/admin/nominations')

  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      id,
      nominations (
        id, nomination_id, nominee_name, designation, company, master_category, category_key,
        editorial_summary ( summary )
      )
    `)
    .eq('juror_id', user.id)
    .order('assigned_at', { ascending: true })

  // The juror's own latest score per nomination — completion derives from this
  // (the score's existence), never assignments.status. No co-juror data here.
  const { data: scores } = await supabase
    .from('latest_scores')
    .select('nomination_id, total_score')
    .eq('juror_id', user.id)

  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.nomination_id as string, Number(s.total_score)])
  )

  const rows: AssignmentRow[] = (assignments ?? []).map((a) => {
    const nom = (Array.isArray(a.nominations) ? a.nominations[0] : a.nominations) as {
      id?: string
      nomination_id?: string
      nominee_name?: string
      designation?: string
      company?: string
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
      master_category: nom?.master_category ?? '',
      category_key: nom?.category_key ?? '',
      score: scoreMap.get(nomId) ?? null,
      summary: es?.summary ?? null,
    }
  })

  return (
    <>
      <PageHeader
        title="My Assignments"
        description={
          rows.length === 0
            ? 'No nominations assigned yet'
            : `${rows.length} nomination${rows.length !== 1 ? 's' : ''} assigned to you`
        }
      />
      <AssignmentsTable rows={rows} />
    </>
  )
}
