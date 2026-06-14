'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { toast } from '@/lib/toast'

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
}

type Props = {
  nominationId: string
  rubric: Criterion[]
  existingScore: SubmittedScore | null
}

export default function ScoringForm({ nominationId, rubric, existingScore }: Props) {
  const router = useRouter()
  const initScores = (): Record<string, number | ''> => {
    const map: Record<string, number | ''> = {}
    for (const c of rubric) {
      map[c.key] = existingScore?.criteria_scores_json?.[c.key] ?? ''
    }
    return map
  }

  const [scores, setScores] = useState<Record<string, number | ''>>(initScores)
  const [comment, setComment] = useState(existingScore?.comment ?? '')
  const [lastSubmission, setLastSubmission] = useState<SubmittedScore | null>(existingScore)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const draftKey = `et-score-draft:${nominationId}`

  // Restore any unsaved draft on mount (per nomination).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const draft = JSON.parse(raw) as { scores?: Record<string, number | ''>; comment?: string }
      /* eslint-disable react-hooks/set-state-in-effect */
      if (draft.scores) setScores(s => ({ ...s, ...draft.scores }))
      if (typeof draft.comment === 'string') setComment(draft.comment)
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch { /* ignore corrupt draft */ }
  }, [draftKey])

  // Persist draft as the juror types.
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ scores, comment })) } catch { /* quota */ }
  }, [scores, comment, draftKey])

  const computedTotal = rubric.length > 0
    ? Math.round((rubric.reduce((sum, c) => sum + (Number(scores[c.key]) || 0), 0) / rubric.length) * 10) / 10
    : 0
  const allFilled = rubric.length > 0 && rubric.every(c => scores[c.key] !== '')

  const handleChange = (key: string, raw: string) => {
    if (raw === '') {
      setScores(s => ({ ...s, [key]: '' }))
      return
    }
    const val = Math.min(100, Math.max(0, parseInt(raw, 10)))
    if (!isNaN(val)) setScores(s => ({ ...s, [key]: val }))
  }

  const handleSubmit = async () => {
    if (!allFilled || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)

    const criteriaJson: Record<string, number> = {}
    for (const c of rubric) criteriaJson[c.key] = Number(scores[c.key])

    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomination_id: nominationId, criteria_scores_json: criteriaJson, comment }),
    })
    const data = await res.json()
    setIsSubmitting(false)

    if (!res.ok) {
      setSubmitError(data.error ?? 'Submission failed. Please try again.')
      toast.error('Submission failed', { description: data.error ?? 'Please try again.' })
    } else {
      const wasUpdate = !!lastSubmission
      setLastSubmission({
        criteria_scores_json: criteriaJson,
        total_score: data.total_score,
        comment: comment || null,
        version: data.version,
        submitted_at: new Date().toISOString(),
      })
      try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
      toast.success(wasUpdate ? 'Scores updated' : 'Scores submitted', {
        description: `Total score ${data.total_score} recorded (version ${data.version}).`,
      })
      router.refresh()
    }
  }

  if (rubric.length === 0) {
    return (
      <div className="card-surface border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No scoring rubric is configured for this category yet.</p>
      </div>
    )
  }

  const filledCount = rubric.filter(c => scores[c.key] !== '').length

  return (
    <div className="space-y-5">
      {lastSubmission && (
        <div className="flex items-start gap-2.5 rounded-lg border border-success-border bg-success-subtle px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Version {lastSubmission.version} submitted</span> —{' '}
            {new Date(lastSubmission.submitted_at).toLocaleString()}. You can update your scores
            below; each submission appends a new version.
          </span>
        </div>
      )}

      <div className="space-y-2">
        {rubric.map(criterion => (
          <div key={criterion.key} className="card-surface flex items-center gap-4 px-4 py-3">
            <span className="flex-1 text-sm font-medium text-foreground">{criterion.label}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {criterion.min}–{criterion.max}
            </span>
            <input
              type="number"
              min={criterion.min}
              max={criterion.max}
              value={scores[criterion.key]}
              onChange={e => handleChange(criterion.key, e.target.value)}
              className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-center text-sm font-semibold tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="—"
            />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total score</span>
          <span className={`text-2xl font-semibold tabular-nums ${allFilled ? 'text-foreground' : 'text-muted-foreground'}`}>
            {computedTotal}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </span>
        </div>
        <div className="mt-2.5">
          <Meter value={computedTotal} tone={allFilled ? 'primary' : 'neutral'} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Mean of {rubric.length} criteria · {filledCount} of {rubric.length} scored
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Comments <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="Add any comments or observations…"
        />
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <Button onClick={handleSubmit} disabled={!allFilled || isSubmitting} size="lg" className="w-full">
        {isSubmitting ? 'Submitting…' : lastSubmission ? 'Update Scores' : 'Submit Scores'}
      </Button>

      {!allFilled && (
        <p className="text-center text-xs text-muted-foreground">Score all criteria (0–100) to submit.</p>
      )}
    </div>
  )
}
