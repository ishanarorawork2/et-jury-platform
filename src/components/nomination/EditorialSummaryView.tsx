import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// The editorial summary is an AI-generated structured analysis to help jurors review
// nominations efficiently. It is reference material only — the AI does not score or
// judge, and its numeric score/qualification are intentionally NOT shown to jurors.
export type EditorialSummary = {
  summary: string | null
  jury_notes: string | null
  strategic_feedback: string | null
  criteria_scores_json: Record<string, number> | null
} | null

export default function EditorialSummaryView({ summary }: { summary: EditorialSummary }) {
  if (!summary) {
    return (
      <div className="card-surface border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No editorial summary for this nomination yet.</p>
      </div>
    )
  }

  const { summary: summaryText, jury_notes, strategic_feedback, criteria_scores_json } = summary
  const hasAny = summaryText || jury_notes || strategic_feedback

  const CRITERIA = [
    { key: 'People', label: 'People Score' },
    { key: 'Process', label: 'Process Score' },
    { key: 'Technology', label: 'Technology Score' },
  ] as const

  const criteriaRows = CRITERIA.filter(c => criteria_scores_json?.[c.key] != null)

  if (!hasAny && criteriaRows.length === 0) {
    return (
      <div className="card-surface border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No editorial summary content for this nomination.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Editorial summary — an AI-generated analysis to help your review. Reference only; your
        evaluation is the sole basis for scoring.
      </p>

      {criteriaRows.length > 0 && (() => {
        const mean = Math.round(criteriaRows.reduce((sum, c) => sum + criteria_scores_json![c.key], 0) / criteriaRows.length)
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">AI Dimension Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                {criteriaRows.map(c => (
                  <div key={c.key} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">{c.label.replace(' Score', '')}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{criteria_scores_json![c.key]}</span>
                  </div>
                ))}
                <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-muted/50 px-5 py-2">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">{mean}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {[
        { label: 'Summary', value: summaryText },
        { label: 'Jury Notes', value: jury_notes },
        { label: 'Strengths & Weakness', value: strategic_feedback },
      ]
        .filter(({ value }) => value)
        .map(({ label, value }) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{value}</p>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}
