'use client'

import { useState } from 'react'
import { FileText, Sparkles, ClipboardCheck } from 'lucide-react'
import RawDataView from './RawDataView'
import EditorialSummaryView, { type EditorialSummary } from './EditorialSummaryView'
import ScoringForm from './ScoringForm'
import { ScoreAuditPanel } from '@/components/admin/ScoreAuditPanel'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs'
import { DIVERGENCE_THRESHOLD } from '@/lib/scoring-config'

type Criterion = { key: string; label: string; min: number; max: number }

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
  initialTab?: string
}

export default function NominationTabs({
  rawData,
  summary,
  nominationId,
  role,
  rubric,
  existingScore,
  initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState(initialTab ?? 'summary')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTab value="summary">
          <Sparkles className="size-4" />
          Jury Notes
        </TabsTab>
        <TabsTab value="nomination">
          <FileText className="size-4" />
          Nomination
        </TabsTab>
        <TabsTab value="evaluation">
          <ClipboardCheck className="size-4" />
          Your Evaluation
        </TabsTab>
      </TabsList>

      <div className="mt-6">
        <TabsPanel value="summary">
          <EditorialSummaryView summary={summary} />
        </TabsPanel>
        <TabsPanel value="nomination">
          <RawDataView rawData={rawData} />
        </TabsPanel>
        <TabsPanel value="evaluation">
          {role === 'juror' ? (
            <ScoringForm nominationId={nominationId} rubric={rubric} existingScore={existingScore} />
          ) : (
            <ScoreAuditPanel
              nominationId={nominationId}
              divergenceThreshold={DIVERGENCE_THRESHOLD}
              onOpenReview={() => {}}
            />
          )}
        </TabsPanel>
      </div>
    </Tabs>
  )
}
