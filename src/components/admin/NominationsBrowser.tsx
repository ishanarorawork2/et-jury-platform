'use client'

import { useMemo, useState } from 'react'
import ReviewLink from '@/components/nomination/ReviewLink'
import { Badge } from '@/components/ui/badge'
import { TableShell, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { categoryLabel } from '@/lib/categories'

export type BrowserNomination = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  designation: string | null
  master_category: string
  category_key: string
  // PostgREST returns this as an object (or null) because editorial_summary.nomination_id
  // is unique (to-one relation); older/other inferences may return an array.
  editorial_summary: { id: string } | Array<{ id: string }> | null
}

function hasSummary(rel: BrowserNomination['editorial_summary']): boolean {
  return Array.isArray(rel) ? rel.length > 0 : rel != null
}

const selectClass =
  'rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30'

export default function NominationsBrowser({ nominations }: { nominations: BrowserNomination[] }) {
  const [master, setMaster] = useState('')
  const [sub, setSub] = useState('')

  const masters = useMemo(
    () => Array.from(new Set(nominations.map(n => n.master_category))).sort(),
    [nominations]
  )
  const subs = useMemo(
    () => Array.from(
      new Set(nominations.filter(n => !master || n.master_category === master).map(n => n.category_key))
    ).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b))),
    [nominations, master]
  )

  const filtered = useMemo(
    () => nominations.filter(n =>
      (!master || n.master_category === master) && (!sub || n.category_key === sub)
    ),
    [nominations, master, sub]
  )

  // Group the filtered set by master category for display.
  const byCategory = useMemo(() => {
    const groups: Record<string, BrowserNomination[]> = {}
    for (const nom of filtered) {
      ;(groups[nom.master_category] ??= []).push(nom)
    }
    return groups
  }, [filtered])

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
        {(master || sub) && (
          <span className="text-xs text-muted-foreground">{filtered.length} of {nominations.length} shown</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card-surface border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No nominations match this filter.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(byCategory).map(([category, noms]) => {
            const ids = noms.map(n => n.id)
            return (
              <div key={category}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category} ({noms.length})
                </h2>
                <TableShell>
                  <Table>
                    <THead>
                      <tr>
                        <TH>Nominee</TH>
                        <TH>Company</TH>
                        <TH>Sub-category</TH>
                        <TH className="text-center">Editorial Summary</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {noms.map(nom => (
                        <TR key={nom.id}>
                          <TD>
                            <ReviewLink id={nom.id} ids={ids} className="font-medium text-primary hover:underline">
                              {nom.nominee_name}
                            </ReviewLink>
                            {nom.designation && (
                              <span className="ml-1.5 text-xs text-muted-foreground">{nom.designation}</span>
                            )}
                          </TD>
                          <TD className="text-muted-foreground">{nom.company}</TD>
                          <TD className="text-muted-foreground">{categoryLabel(nom.category_key)}</TD>
                          <TD className="text-center">
                            {hasSummary(nom.editorial_summary)
                              ? <Badge variant="success">✓ Ready</Badge>
                              : <Badge variant="warning">Awaiting</Badge>}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableShell>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
