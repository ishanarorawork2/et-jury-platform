'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import NominationReview, { type ReviewData } from './NominationReview'
import { Skeleton } from '@/components/ui/skeleton'

type OpenFn = (ids: string[], id: string) => void
const ReviewModalContext = createContext<OpenFn | null>(null)

export function useReviewModal(): OpenFn {
  const ctx = useContext(ReviewModalContext)
  // No-op fallback if a link is rendered outside the provider.
  return ctx ?? (() => {})
}

export default function ReviewModalProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([])
  const [index, setIndex] = useState<number>(-1)
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback((list: string[], id: string) => {
    const i = list.indexOf(id)
    setIds(list)
    setIndex(i >= 0 ? i : 0)
  }, [])

  const close = useCallback(() => {
    setIndex(-1)
    setData(null)
    setError(null)
  }, [])

  const currentId = index >= 0 ? ids[index] : null

  // Fetch review payload whenever the current nomination changes.
  useEffect(() => {
    if (!currentId) return
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/nominations/${currentId}/review`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed to load')
        return json
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentId])

  const goPrev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : i)), [])
  const goNext = useCallback(() => setIndex((i) => (i < ids.length - 1 ? i + 1 : i)), [ids.length])

  // Keyboard: ESC closes, ←/→ navigate.
  useEffect(() => {
    if (index < 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, close, goPrev, goNext])

  const isOpen = index >= 0

  return (
    <ReviewModalContext.Provider value={open}>
      {children}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-foreground/30 p-3 backdrop-blur-[2px] sm:p-6"
          onClick={close}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-xl)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={index <= 0}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
                  title="Previous (←)"
                ><ChevronLeft className="size-4" /></button>
                <button
                  onClick={goNext}
                  disabled={index >= ids.length - 1}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
                  title="Next (→)"
                ><ChevronRight className="size-4" /></button>
                <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                  {index + 1} of {ids.length}
                </span>
              </div>
              <button
                onClick={close}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                title="Close (Esc)"
              ><X className="size-4" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-8">
              {error && (
                <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-sm text-danger">
                  {error}
                </div>
              )}
              {loading && !data && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-64" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-9 w-80" />
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </div>
              )}
              {data && currentId && <NominationReview key={currentId} data={data} layout="modal" />}
            </div>
          </div>
        </div>
      )}
    </ReviewModalContext.Provider>
  )
}
