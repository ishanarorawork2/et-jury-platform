'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, LockOpen, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { useConfirm } from '@/components/ui/confirm'
import { toast } from '@/lib/toast'

export type FinalizeState = {
  categoryKey: string
  label: string
  completeCount: number
  incompleteCount: number
  tiedCount: number
  divergentCount: number
  topThree: { name: string; score: number | null }[]
  finalized: { count: number; finalized_at: string; finalized_by_name: string | null } | null
  divergenceThreshold: number
}

function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ts
  }
}

/**
 * Per-sub-category finalize/reopen control. Finalization is keyed by
 * category_key (the award category), matching finalize_category in the DB.
 * Finalizing is allowed while some nominations are still incomplete — they stay
 * unranked and won't enter the snapshot (confirmed decision).
 */
export function CategoryFinalizeBar(props: FinalizeState) {
  const router = useRouter()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const post = async (path: string) => {
    setBusy(true)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_key: props.categoryKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      return data
    } finally {
      setBusy(false)
    }
  }

  const finalize = async () => {
    const ok = await confirm({
      title: `Finalize ${props.label}?`,
      description: (
        <span className="block space-y-2 text-sm">
          <span className="block">
            Snapshots the current ranking of <strong>{props.completeCount}</strong> complete
            nomination{props.completeCount === 1 ? '' : 's'}. Re-scores afterward update live results
            but will <strong>not</strong> move the locked ranking.
          </span>
          {props.topThree.length > 0 && (
            <span className="block text-muted-foreground">
              Top: {props.topThree.map((t, i) => `${i + 1}. ${t.name} (${t.score ?? '—'})`).join('  ·  ')}
            </span>
          )}
          {props.incompleteCount > 0 && (
            <span className="block text-warning">
              {props.incompleteCount} incomplete nomination{props.incompleteCount === 1 ? '' : 's'} will
              stay unranked and can be scored later.
            </span>
          )}
          {props.tiedCount > 0 && (
            <span className="block text-warning">{props.tiedCount} tie(s) present — review before locking.</span>
          )}
          {props.divergentCount > 0 && (
            <span className="block text-warning">
              ⚠ {props.divergentCount} nomination(s) have high juror divergence (≥ {props.divergenceThreshold}).
              By finalizing you acknowledge this is advisory only.
            </span>
          )}
        </span>
      ),
      confirmLabel: 'Finalize & lock',
    })
    if (!ok) return
    try {
      const data = await post('/api/admin/results/finalize')
      toast.success('Category finalized', { description: `${data.finalized} ranking(s) locked.` })
      router.refresh()
    } catch (e) {
      toast.error('Finalize failed', { description: e instanceof Error ? e.message : 'Please try again.' })
    }
  }

  const reopen = async () => {
    const ok = await confirm({
      title: `Re-open ${props.label}?`,
      description:
        'Clears the locked snapshot so live results drive the ranking again. This is logged.',
      variant: 'destructive',
      confirmLabel: 'Re-open',
    })
    if (!ok) return
    try {
      await post('/api/admin/results/reopen')
      toast.success('Category re-opened')
      router.refresh()
    } catch (e) {
      toast.error('Re-open failed', { description: e instanceof Error ? e.message : 'Please try again.' })
    }
  }

  if (props.finalized) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm">
        <Lock className="size-4 text-primary" />
        <span className="font-medium text-accent-foreground">Finalized</span>
        <span className="text-muted-foreground">
          {props.finalized.count} ranking{props.finalized.count === 1 ? '' : 's'} locked
          {props.finalized.finalized_by_name ? ` by ${props.finalized.finalized_by_name}` : ''} on{' '}
          {fmtDate(props.finalized.finalized_at)} · re-scores won&apos;t change the locked ranking
        </span>
        <Button variant="ghost" size="sm" className="ml-auto text-danger" onClick={reopen} disabled={busy}>
          <LockOpen className="size-3.5" />
          Re-open
        </Button>
      </div>
    )
  }

  if (props.completeCount === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <TriangleAlert className="size-4" />
        No complete nominations to finalize yet.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <ShieldCheck className="size-4 text-primary" />
      <span className="font-medium text-foreground">Ready to finalize</span>
      <Badge variant="success">{props.completeCount} complete</Badge>
      {props.incompleteCount > 0 && <Badge variant="neutral">{props.incompleteCount} incomplete</Badge>}
      {props.divergentCount > 0 && (
        <Tooltip content={`Jurors differ by ≥ ${props.divergenceThreshold} points`}>
          <Badge variant="warning">{props.divergentCount} divergent</Badge>
        </Tooltip>
      )}
      <Button size="sm" className="ml-auto" onClick={finalize} disabled={busy}>
        <Lock className="size-3.5" />
        Finalize &amp; lock
      </Button>
    </div>
  )
}
