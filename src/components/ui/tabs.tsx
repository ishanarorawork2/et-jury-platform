'use client'

import { createContext, useContext } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cn } from '@/lib/utils'

type TabsVariant = 'underline' | 'segmented'
const TabsVariantContext = createContext<TabsVariant>('underline')

const Tabs = TabsPrimitive.Root
const TabsPanel = TabsPrimitive.Panel

function TabsList({
  className,
  variant = 'underline',
  children,
  ...props
}: TabsPrimitive.List.Props & { variant?: TabsVariant }) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        className={cn(
          'relative flex items-center',
          variant === 'underline'
            ? 'gap-5 border-b border-border'
            : 'gap-1 rounded-lg border border-border bg-muted/60 p-1',
          className
        )}
        {...props}
      >
        {children}
        {variant === 'underline' && (
          <TabsPrimitive.Indicator className="absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) bg-primary transition-all duration-(--duration-base) ease-(--ease-out)" />
        )}
      </TabsPrimitive.List>
    </TabsVariantContext.Provider>
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  const variant = useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Tab
      className={cn(
        'inline-flex select-none items-center gap-1.5 whitespace-nowrap text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
        variant === 'underline'
          ? 'border-b-2 border-transparent pb-2.5 pt-1 text-muted-foreground hover:text-foreground data-[selected]:text-foreground'
          : 'flex-1 justify-center rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-[var(--shadow-xs)]',
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTab, TabsPanel }
