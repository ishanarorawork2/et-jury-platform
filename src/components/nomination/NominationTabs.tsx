'use client'

import { useState } from 'react'
import RawDataView from './RawDataView'
import EditorialSummaryView, { type EditorialSummary } from './EditorialSummaryView'
import ScoringForm from './ScoringForm'

type Criterion = {
  key: string
  label: string
  min: number
  max: number
}

type SubmittedScore = {
  criteria_scores_json: Record<string, number>
  total_score: number
  comment: string | null
  version: number
  submitted_at: string
} | null

type Props = {
  rawData: Record<string, Record<string, string>>
  summary: EditorialSummary
  nominationId: string
  role: string
  rubric: Criterion[]
  existingScore: SubmittedScore
}

const TABS = [
  { id: 'nomination', label: 'Nomination' },
  { id: 'summary', label: 'Editorial Summary' },
  { id: 'evaluation', label: 'Your Evaluation' },
]

export default function NominationTabs({ rawData, summary, nominationId, role, rubric, existingScore }: Props) {
  const [active, setActive] = useState('nomination')

  return (
    <div>
      <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/60 p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-card text-foreground shadow-[var(--shadow-card)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {active === 'nomination' && <RawDataView rawData={rawData} />}
        {active === 'summary' && <EditorialSummaryView summary={summary} />}
        {active === 'evaluation' && (
          role === 'juror' ? (
            <ScoringForm
              nominationId={nominationId}
              rubric={rubric}
              existingScore={existingScore}
            />
          ) : (
            <div className="card-surface border-dashed p-12 text-center">
              <p className="text-sm text-muted-foreground">Scoring is for assigned jurors only.</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
