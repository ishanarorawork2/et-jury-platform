'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CornerDownLeft } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { navFor, type NavGroup } from '@/lib/nav'
import { cn } from '@/lib/utils'

export type CommandItem = {
  id: string
  label: string
  group: string
  keywords?: string[]
  icon?: React.ComponentType<{ className?: string }>
  href?: string
  onSelect?: () => void
}

const CommandContext = createContext<{ open: () => void; close: () => void } | null>(null)

export function useCommandPalette() {
  const ctx = useContext(CommandContext)
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  return ctx
}

export function CommandPaletteProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const items = useMemo<CommandItem[]>(() => {
    const groups: NavGroup[] = navFor(isAdmin)
    return groups.flatMap((g) =>
      g.items.map((it) => ({
        id: it.href,
        label: it.label,
        group: g.label,
        keywords: it.keywords,
        icon: it.icon,
        href: it.href,
      }))
    )
  }, [isAdmin])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ctxValue = useMemo(
    () => ({ open: () => setOpen(true), close: () => setOpen(false) }),
    []
  )

  const onSelect = (item: CommandItem) => {
    setOpen(false)
    if (item.onSelect) item.onSelect()
    else if (item.href) router.push(item.href)
  }

  return (
    <CommandContext.Provider value={ctxValue}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} items={items} onSelect={onSelect} />
    </CommandContext.Provider>
  )
}

function CommandDialog({
  open,
  onOpenChange,
  items,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandItem[]
  onSelect: (item: CommandItem) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const hay = [it.label, it.group, ...(it.keywords ?? [])].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setActive(0)
    }
  }, [open])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(0)
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    filtered.forEach((it) => {
      const arr = map.get(it.group) ?? []
      arr.push(it)
      map.set(it.group, arr)
    })
    return Array.from(map.entries())
  }, [filtered])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[active]
        if (item) onSelect(item)
      }
    },
    [filtered, active, onSelect]
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-(--duration-base) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-xl)] outline-none transition-all duration-(--duration-base) ease-(--ease-out) data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0"
          onKeyDown={onKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages…"
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">No results found.</p>
            ) : (
              grouped.map(([group, groupItems]) => (
                <div key={group} className="mb-1 last:mb-0">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</p>
                  {groupItems.map((item) => {
                    const idx = filtered.indexOf(item)
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => onSelect(item)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none',
                          idx === active ? 'bg-muted text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {Icon && <Icon className="size-4 shrink-0" />}
                        <span className="flex-1 truncate text-foreground">{item.label}</span>
                        {idx === active && (
                          <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
