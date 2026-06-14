'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, LogOut, Search } from 'lucide-react'
import { breadcrumbs } from '@/lib/nav'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useCommandPalette } from '@/components/ui/command'

type Props = { name: string; email: string; role: string }

export default function Topbar({ name, email, role }: Props) {
  const isAdmin = role === 'admin'
  const pathname = usePathname()
  const crumbs = breadcrumbs(pathname)
  const command = useCommandPalette()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">{crumb.label}</span>
            )}
          </Fragment>
        ))}
      </nav>

      <button
        type="button"
        onClick={command.open}
        className="hidden items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
      >
        <Search className="size-3.5" />
        <span>Search</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.65rem] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-lg p-0.5 pr-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Account menu"
        >
          <Avatar name={name || email} />
          <div className="hidden flex-col items-start leading-tight md:flex">
            <span className="max-w-[12rem] truncate text-sm font-medium text-foreground">
              {name || email}
            </span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[14rem]">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar name={name || email} size="lg" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-foreground">{name || email}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          </div>
          <div className="px-2.5 pb-1.5">
            <Badge variant={isAdmin ? 'accent' : 'info'} className="uppercase">
              {isAdmin ? 'Admin' : 'Juror'}
            </Badge>
          </div>
          <DropdownMenuSeparator />
          <form action="/api/auth/signout" method="POST">
            <DropdownMenuItem variant="destructive" render={<button type="submit" />} className="w-full">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
