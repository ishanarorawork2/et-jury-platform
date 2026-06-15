'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

type SubmittedScore = {
  criteria_scores_json: Record<string, number>
  total_score: number
  comment: string | null
  version: number
  submitted_at: string
}

type Props = {
  nominationId: string
  rubric: { key: string; label: string; min: number; max: number }[]
  existingScore: SubmittedScore | null
}

export default function ScoringForm({ nominationId, existingScore }: Props) {
  const router = useRouter()

  const [score, setScore] = useState<number | ''>(() => existingScore?.total_score ?? '')
  const [comment, setComment] = useState(existingScore?.comment ?? '')
  const [lastSubmission, setLastSubmission] = useState<SubmittedScore | null>(existingScore)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const draftKey = `et-score-draft:${nominationId}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const draft = JSON.parse(raw) as { score?: number | ''; comment?: string }
      if (draft.score !== undefined) setScore(draft.score)
      if (typeof draft.comment === 'string') setComment(draft.comment)
    } catch { /* ignore corrupt draft */ }
  }, [draftKey])

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ score, comment })) } catch { /* quota */ }
  }, [score, comment, draftKey])

  const handleChange = (raw: string) => {
    if (raw === '') { setScore(''); return }
    const val = parseInt(raw, 10)
    if (!isNaN(val)) setScore(Math.min(10, Math.max(1, val)))
  }

  const isValid = score !== '' && Number(score) >= 1 && Number(score) <= 10

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)

    const criteriaJson = { score: Number(score) }

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
      toast.success(wasUpdate ? 'Score updated' : 'Score submitted', {
        description: `Score ${data.total_score} recorded (version ${data.version}).`,
      })
      router.refresh()
    }
  }

  return (
    <div className="space-y-5">
      {lastSubmission && (
        <div className="flex items-start gap-2.5 rounded-lg border border-success-border bg-success-subtle px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Version {lastSubmission.version} submitted</span> —{' '}
            {new Date(lastSubmission.submitted_at).toLocaleString()}. You can update your score
            below; each submission appends a new version.
          </span>
        </div>
      )}

      <div className="card-surface flex items-center gap-4 px-4 py-4">
        <span className="flex-1 text-sm font-medium text-foreground">Your Score</span>
        <span className="text-xs tabular-nums text-muted-foreground">1–10</span>
        <input
          type="number"
          min={1}
          max={10}
          value={score}
          onChange={e => handleChange(e.target.value)}
          className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-center text-sm font-semibold tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="—"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Comments
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

      <Button onClick={handleSubmit} disabled={!isValid || isSubmitting} size="lg" className="w-full">
        {isSubmitting ? 'Submitting…' : lastSubmission ? 'Update Score' : 'Submit Score'}
      </Button>

      {!isValid && (
        <p className="text-center text-xs text-muted-foreground">Enter a score between 1 and 10 to submit.</p>
      )}
    </div>
  )
}
