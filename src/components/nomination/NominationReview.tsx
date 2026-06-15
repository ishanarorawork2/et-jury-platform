'use client'

import { Building2, Hash, Tag, CheckCircle2, Clock } from 'lucide-react'
import NominationTabs from './NominationTabs'
import { type EditorialSummary } from './EditorialSummaryView'
import { Badge } from '@/components/ui/badge'
import { categoryLabel } from '@/lib/categories'
import { cn } from '@/lib/utils'

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

function MetaRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function MetaPanel({ data }: { data: ReviewData }) {
  const { nomination: n, existingScore, role } = data
  return (
    <div className="space-y-5">
      <div>
        <Badge variant="accent">{n.master_category}</Badge>
      </div>
      <div className="space-y-4">
        <MetaRow icon={Building2} label="Company" value={n.company} />
        {n.designation && <MetaRow icon={Tag} label="Designation" value={n.designation} />}
        <MetaRow icon={Tag} label="Sub-category" value={categoryLabel(n.category_key)} />
        <MetaRow icon={Hash} label="Nomination ID" value={`#${n.nomination_id}`} />
      </div>
      {role === 'juror' && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your evaluation
          </p>
          {existingScore ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              <span className="text-sm font-medium text-foreground">
                Scored {existingScore.total_score}
              </span>
              <Badge variant="neutral">v{existingScore.version}</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-warning" />
              <span className="text-sm text-muted-foreground">Not yet scored</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Shared review surface rendered by both the standalone detail page (split view)
// and the full-page review modal (stacked).
export default function NominationReview({
  data,
  layout = 'modal',
  initialTab,
}: {
  data: ReviewData
  layout?: 'page' | 'modal'
  initialTab?: string
}) {
  const { nomination: n } = data

  const header = (
    <div className={cn(layout === 'modal' && 'card-surface mb-6 p-5')}>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{n.nominee_name}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {n.company}
        {n.designation ? ` · ${n.designation}` : ''}
      </p>
      {layout === 'modal' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="accent">{n.master_category}</Badge>
          <span className="text-xs text-muted-foreground">
            {categoryLabel(n.category_key)} · #{n.nomination_id}
          </span>
        </div>
      )}
    </div>
  )

  if (layout === 'page') {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
        <div className="min-w-0">
          {header}
          <div className="mt-6">
            <NominationTabs
              rawData={n.raw_data_json}
              summary={data.summary}
              nominationId={n.id}
              role={data.role}
              rubric={data.rubric}
              existingScore={data.existingScore}
              initialTab={initialTab}
              company={n.company}
            />
          </div>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card-surface p-5">
            <MetaPanel data={data} />
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div>
      {header}
      <NominationTabs
        rawData={n.raw_data_json}
        summary={data.summary}
        nominationId={n.id}
        role={data.role}
        rubric={data.rubric}
        existingScore={data.existingScore}
        initialTab={initialTab}
        company={n.company}
      />
    </div>
  )
}
