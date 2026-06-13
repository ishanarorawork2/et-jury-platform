'use client'

import NominationTabs from './NominationTabs'
import { type EditorialSummary } from './EditorialSummaryView'
import { Badge } from '@/components/ui/badge'
import { categoryLabel } from '@/lib/categories'

export type Criterion = { key: string; label: string; min: number; max: number }
export type SubmittedScore = {
  criteria_scores_json: Record<string, number>
  total_score: number
  comment: string | null
  version: number
  submitted_at: string
} | null

export type ReviewData = {
  nomination: {
    id: string
    nomination_id: string
    nominee_name: string
    company: string
    designation: string | null
    master_category: string
    category_key: string
    raw_data_json: Record<string, Record<string, string>>
  }
  summary: EditorialSummary
  rubric: Criterion[]
  existingScore: SubmittedScore
  role: string
}

// Shared review surface (header + 3 tabs) rendered by both the standalone detail
// page and the full-page review modal.
export default function NominationReview({ data }: { data: ReviewData }) {
  const { nomination: n } = data
  return (
    <div>
      <div className="card-surface mb-6 flex items-start justify-between gap-4 p-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{n.nominee_name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {n.company}{n.designation ? ` · ${n.designation}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Badge variant="info">{n.master_category}</Badge>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {categoryLabel(n.category_key)} · #{n.nomination_id}
          </p>
        </div>
      </div>

      <NominationTabs
        rawData={n.raw_data_json}
        summary={data.summary}
        nominationId={n.id}
        role={data.role}
        rubric={data.rubric}
        existingScore={data.existingScore}
      />
    </div>
  )
}
