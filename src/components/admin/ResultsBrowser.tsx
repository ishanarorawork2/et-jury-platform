'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { TableShell, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { categoryLabel } from '@/lib/categories'
import ReviewLink from '@/components/nomination/ReviewLink'

type JurorScore = { juror_id: string; juror_name: string; total_score: number }

export type ResultRow = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  master_category: string
  category_key: string
  complete: boolean
  final_score: number | null
  juror_scores: JurorScore[]
  rank: number | null
  tied: boolean
}

const selectClass =
  'rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30'

export default function ResultsBrowser({ categoryResults }: { categoryResults: Record<string, ResultRow[]> }) {
  const [master, setMaster] = useState('')
  const [sub, setSub] = useState('')

  const masters = useMemo(() => Object.keys(categoryResults).sort(), [categoryResults])

  // Sub-categories available within the current master selection (or all).
  const subs = useMemo(() => {
    const rows = master ? (categoryResults[master] ?? []) : Object.values(categoryResults).flat()
    return Array.from(new Set(rows.map(r => r.category_key)))
      .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
  }, [categoryResults, master])

  const visibleMasters = master ? [master] : masters

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label className="mr-2 text-xs text-muted-foreground">Category:</label>
          <select value={master} onChange={e => { setMaster(e.target.value); setSub('') }} className={selectClass}>
            <option value="">All categories</option>
            {masters.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {subs.length > 1 && (
          <div>
            <label className="mr-2 text-xs text-muted-foreground">Sub-category:</label>
            <select value={sub} onChange={e => setSub(e.target.value)} className={selectClass}>
              <option value="">All sub-categories</option>
              {subs.map(k => <option key={k} value={k}>{categoryLabel(k)}</option>)}
            </select>
          </div>
        )}
      </div>

      {visibleMasters.map(cat => {
        const allRows = categoryResults[cat] ?? []
        const catRows = sub ? allRows.filter(r => r.category_key === sub) : allRows
        if (catRows.length === 0) return null

        const completeCount = catRows.filter(r => r.complete).length
        const tieCount = catRows.filter(r => r.tied).length
        const subCategories = [...new Set(catRows.map(r => r.category_key))].sort()
        const rowIds = catRows.map(r => r.id)

        return (
          <div key={cat} className="mb-10">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">{cat}</h2>
              <span className="text-xs text-muted-foreground">{completeCount} of {catRows.length} scored</span>
              {tieCount > 0 && (
                <Badge variant="warning">{tieCount} tied — manual review required</Badge>
              )}
              <a
                href={`/api/admin/results/export?scope=master&master=${encodeURIComponent(cat)}`}
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Export master (.xlsx)
              </a>
            </div>

            <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium">Per category:</span>
              {subCategories.map(sc => (
                <a key={sc} href={`/api/admin/results/export?scope=category&key=${encodeURIComponent(sc)}`} className="text-primary hover:underline">
                  {categoryLabel(sc)}
                </a>
              ))}
            </div>

            <TableShell>
              <Table>
                <THead>
                  <tr>
                    <TH className="w-16">Rank</TH>
                    <TH>Nominee</TH>
                    <TH>Company</TH>
                    <TH>Sub-category</TH>
                    <TH className="text-right">Final Score</TH>
                    <TH className="text-right">Juror 1</TH>
                    <TH className="text-right">Juror 2</TH>
                  </tr>
                </THead>
                <TBody>
                  {catRows.map(row => (
                    <TR key={row.id} className={row.complete ? '' : 'bg-muted/40 opacity-60'}>
                      <TD>
                        {row.rank != null ? (
                          <span className={`font-semibold ${row.tied ? 'text-amber-600' : 'text-foreground'}`}>
                            {row.rank}{row.tied ? '=' : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TD>
                      <TD className="font-medium text-foreground">
                        <ReviewLink id={row.id} ids={rowIds} className="text-primary hover:underline">
                          {row.nominee_name}
                        </ReviewLink>
                      </TD>
                      <TD className="text-muted-foreground">{row.company}</TD>
                      <TD className="text-muted-foreground">{categoryLabel(row.category_key)}</TD>
                      <TD className="text-right font-semibold text-foreground">
                        {row.final_score != null ? row.final_score.toFixed(1) : <span className="text-muted-foreground/50">—</span>}
                      </TD>
                      <TD className="text-right text-muted-foreground" title={row.juror_scores[0]?.juror_name}>
                        {row.juror_scores[0] != null ? row.juror_scores[0].total_score : <span className="text-muted-foreground/50">—</span>}
                      </TD>
                      <TD className="text-right text-muted-foreground" title={row.juror_scores[1]?.juror_name}>
                        {row.juror_scores[1] != null ? row.juror_scores[1].total_score : <span className="text-muted-foreground/50">—</span>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          </div>
        )
      })}
    </>
  )
}
