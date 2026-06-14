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
  company: string
  master_category: string
  category_key: string
  score: number | null
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
      id, status,
      nominations ( id, nomination_id, nominee_name, company, master_category, category_key )
    `)
    .eq('juror_id', user.id)
    .order('assigned_at', { ascending: true })

  // Fetch all scores for this juror (ordered ASC so Map ends up with highest version per nomination).
  const { data: scores } = await supabase
    .from('scores')
    .select('nomination_id, total_score')
    .eq('juror_id', user.id)
    .order('version', { ascending: true })

  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.nomination_id as string, s.total_score as number])
  )

  const rows: AssignmentRow[] = (assignments ?? []).map((a) => {
    const nom = (Array.isArray(a.nominations) ? a.nominations[0] : a.nominations) as {
      id?: string
      nomination_id?: string
      nominee_name?: string
      company?: string
      master_category?: string
      category_key?: string
    } | null
    return {
      id: a.id,
      status: a.status,
      nomination_id: nom?.id ?? '',
      nomination_display_id: nom?.nomination_id ?? '',
      nominee_name: nom?.nominee_name ?? '',
      company: nom?.company ?? '',
      master_category: nom?.master_category ?? '',
      category_key: nom?.category_key ?? '',
      score: scoreMap.get(nom?.id ?? '') ?? null,
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
