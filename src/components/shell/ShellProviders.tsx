'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toast'
import { ConfirmProvider } from '@/components/ui/confirm'
import { CommandPaletteProvider } from '@/components/ui/command'

type SidebarCtx = { collapsed: boolean; toggle: () => void }
const SidebarContext = createContext<SidebarCtx | null>(null)

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within ShellProviders')
  return ctx
}

const STORAGE_KEY = 'et-sidebar-collapsed'

export function ShellProviders({
  isAdmin,
  children,
}: {
  isAdmin: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {}
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      <TooltipProvider delay={250} closeDelay={80}>
        <ConfirmProvider>
          <CommandPaletteProvider isAdmin={isAdmin}>
            <Toaster>{children}</Toaster>
          </CommandPaletteProvider>
        </ConfirmProvider>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}
