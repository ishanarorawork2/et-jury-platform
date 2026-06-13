import { LogOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
  name: string
  email: string
  role: string
}

export default function Topbar({ name, email, role }: Props) {
  const isAdmin = role === 'admin'
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-sm font-medium text-foreground">{name || email}</span>
          <span className="text-xs text-muted-foreground">{email}</span>
        </div>
        <Badge variant={isAdmin ? 'accent' : 'info'} className="uppercase">
          {isAdmin ? 'Admin' : 'Juror'}
        </Badge>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            title="Sign out"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </header>
  )
}
