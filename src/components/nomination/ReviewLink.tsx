'use client'

import { useReviewModal } from './ReviewModalProvider'

// Opens a nomination in the full-page review modal, preserving the list underneath.
// Falls back to the standalone /nominations/[id] page for new-tab / deep links.
export default function ReviewLink({
  id,
  ids,
  className,
  children,
}: {
  id: string
  ids: string[]
  className?: string
  children: React.ReactNode
}) {
  const open = useReviewModal()
  return (
    <a
      href={`/nominations/${id}`}
      className={className}
      onClick={(e) => {
        // Let modifier-clicks / middle-clicks open the real page in a new tab.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        open(ids, id)
      }}
    >
      {children}
    </a>
  )
}
