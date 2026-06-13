import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import NominationsBrowser, { type BrowserNomination } from '@/components/admin/NominationsBrowser'

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

  const { data } = await supabase
    .from('nominations')
    .select(`
      id, nomination_id, nominee_name, company, designation, master_category, category_key,
      editorial_summary ( id )
    `)
    .order('master_category')
    .order('nominee_name')

  const nominations = (data ?? []) as BrowserNomination[]

  return (
    <>
      <PageHeader title="Nominations" description={`${nominations.length} imported nominations`} />
      <NominationsBrowser nominations={nominations} />
    </>
  )
}
