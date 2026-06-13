'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListChecks,
  Users,
  GitMerge,
  Activity,
  Trophy,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: LucideIcon }

const JUROR_NAV: NavItem[] = [
  { href: '/dashboard', label: 'My Assignments', icon: LayoutDashboard },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/nominations', label: 'Nominations', icon: ListChecks },
  { href: '/admin/jurors', label: 'Jurors', icon: Users },
  { href: '/admin/assignments', label: 'Assignments', icon: GitMerge },
  { href: '/admin/progress', label: 'Progress', icon: Activity },
  { href: '/admin/results', label: 'Results', icon: Trophy },
  { href: '/admin/import', label: 'Import', icon: Upload },
]

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const nav = isAdmin ? ADMIN_NAV : JUROR_NAV
  const home = isAdmin ? '/admin/nominations' : '/dashboard'

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <Link href={home} className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          ET
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            Security Awards
          </span>
          <span className="truncate text-xs text-muted-foreground">Jury Platform · 2026</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        <p className="px-3 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          {isAdmin ? 'Administration' : 'Evaluation'}
        </p>
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-4 text-[0.65rem] text-muted-foreground">
        Enterprise Security Awards
      </div>
    </aside>
  )
}
