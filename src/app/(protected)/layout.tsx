import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/shell/AppShell'
import ReviewModalProvider from '@/components/nomination/ReviewModalProvider'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jurorUser } = await supabase
    .from('jury_users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return (
    <AppShell
      name={jurorUser?.name ?? ''}
      email={user.email ?? ''}
      role={jurorUser?.role ?? 'juror'}
    >
      <ReviewModalProvider>{children}</ReviewModalProvider>
    </AppShell>
  )
}
