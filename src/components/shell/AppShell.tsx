import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { ShellProviders } from './ShellProviders'

type Props = {
  name: string
  email: string
  role: string
  children: React.ReactNode
}

export default function AppShell({ name, email, role, children }: Props) {
  const isAdmin = role === 'admin'
  return (
    <ShellProviders isAdmin={isAdmin}>
      <div className="flex min-h-screen bg-background">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar name={name} email={email} role={role} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[88rem] px-6 py-8">{children}</div>
          </main>
        </div>
      </div>
    </ShellProviders>
  )
}
