import {
  LayoutDashboard,
  ListChecks,
  Users,
  GitMerge,
  Activity,
  Trophy,
  Upload,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Extra search terms for the command palette. */
  keywords?: string[]
}

export type NavGroup = { label: string; items: NavItem[] }

export const JUROR_NAV: NavGroup[] = [
  {
    label: 'Evaluation',
    items: [{ href: '/dashboard', label: 'My Assignments', icon: LayoutDashboard, keywords: ['nominations', 'score', 'home'] }],
  },
]

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Evaluation',
    items: [
      { href: '/admin/nominations', label: 'Nominations', icon: ListChecks, keywords: ['entries', 'browse'] },
      { href: '/admin/results', label: 'Results', icon: Trophy, keywords: ['rankings', 'awards', 'winners', 'export'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/jurors', label: 'Jurors', icon: Users, keywords: ['panel', 'judges', 'conflicts'] },
      { href: '/admin/assignments', label: 'Assignments', icon: GitMerge, keywords: ['assign', 'workload', 'coverage'] },
      { href: '/admin/progress', label: 'Progress', icon: Activity, keywords: ['dashboard', 'status', 'completion'] },
      { href: '/admin/jury-view', label: 'Jury: My Assignments', icon: ClipboardList, keywords: ['juror view', 'juror dashboard', 'assignments preview'] },
    ],
  },
  {
    label: 'Data',
    items: [{ href: '/admin/import', label: 'Import', icon: Upload, keywords: ['upload', 'excel', 'reconcile'] }],
  },
]

export function navFor(isAdmin: boolean): NavGroup[] {
  return isAdmin ? ADMIN_NAV : JUROR_NAV
}

export function homeFor(isAdmin: boolean): string {
  return isAdmin ? '/admin/nominations' : '/dashboard'
}

const flatLabels: Record<string, string> = {
  '/dashboard': 'My Assignments',
  '/admin/nominations': 'Nominations',
  '/admin/jurors': 'Jurors',
  '/admin/assignments': 'Assignments',
  '/admin/progress': 'Progress',
  '/admin/results': 'Results',
  '/admin/import': 'Import',
  '/admin/jury-view': 'Jury: My Assignments',
  '/nominations': 'Nomination',
  '/admin': 'Admin',
}

export type Crumb = { label: string; href?: string }

/** Build breadcrumb trail from a pathname using the known route→label map. */
export function breadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let acc = ''
  for (let i = 0; i < segments.length; i++) {
    acc += '/' + segments[i]
    const label =
      flatLabels[acc] ??
      segments[i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const isLast = i === segments.length - 1
    crumbs.push({ label, href: isLast ? undefined : acc })
  }
  return crumbs
}
