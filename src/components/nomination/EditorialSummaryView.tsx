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

  // Narrative only — the AI's numeric scores (total and per-criterion) are never shown
  // to jurors, to avoid anchoring. They remain available to admins in the export.
  const { summary: summaryText, jury_notes, strategic_feedback } = summary
  const hasAny = summaryText || jury_notes || strategic_feedback

  if (!hasAny) {
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

      {[
        { label: 'Summary', value: summaryText },
        { label: 'Editorial Notes', value: jury_notes },
        { label: 'Strategic Feedback', value: strategic_feedback },
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
