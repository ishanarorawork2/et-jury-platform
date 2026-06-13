'use client'

import { useMemo, useRef, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TableShell, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { categoryLabel } from '@/lib/categories'
import { useReviewModal } from '@/components/nomination/ReviewModalProvider'

type Row = {
  id: string
  status: string
  nomination_id: string
  nomination_display_id: string
  nominee_name: string
  company: string
  master_category: string
  category_key: string
  score: number | null
}

export default function AssignmentsTable({ rows }: { rows: Row[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [master, setMaster] = useState('')
  const [sub, setSub] = useState('')
  const open = useReviewModal()
  const orderedIds = useRef<string[]>([])

  // Master categories present in this juror's assignments.
  const masters = useMemo(
    () => Array.from(new Set(rows.map(r => r.master_category))).sort(),
    [rows]
  )
  // Sub-categories present, scoped to the selected master if one is chosen.
  const subs = useMemo(
    () => Array.from(
      new Set(rows.filter(r => !master || r.master_category === master).map(r => r.category_key))
    ).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b))),
    [rows, master]
  )

  const filteredRows = useMemo(
    () => rows.filter(r =>
      (!master || r.master_category === master) && (!sub || r.category_key === sub)
    ),
    [rows, master, sub]
  )

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      accessorKey: 'nominee_name',
      header: 'Nominee',
      cell: ({ row }) => (
        <button
          onClick={() => open(orderedIds.current, row.original.nomination_id)}
          className="font-medium text-primary hover:underline"
        >
          {row.getValue<string>('nominee_name')}
        </button>
      ),
    },
    {
      accessorKey: 'company',
      header: 'Company',
    },
    {
      accessorKey: 'master_category',
      header: 'Category',
    },
    {
      accessorKey: 'category_key',
      header: 'Sub-category',
      cell: ({ row }) => categoryLabel(row.original.category_key),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.getValue<string>('status')
        return (
          <Badge variant={s === 'scored' ? 'success' : 'warning'}>
            {s === 'scored' ? 'Scored' : 'Pending'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'score',
      header: 'Score',
      cell: ({ row }) => {
        const score = row.getValue<number | null>('score')
        return score !== null
          ? <span className="font-semibold">{score}</span>
          : <span className="text-muted-foreground">—</span>
      },
    },
    {
      id: 'action',
      cell: ({ row }) => (
        <button
          onClick={() => open(orderedIds.current, row.original.nomination_id)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.original.status === 'scored' ? 'Review' : 'Evaluate →'}
        </button>
      ),
    },
  ], [open])

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Keep the modal's Prev/Next order in sync with the table's current sort.
  orderedIds.current = table.getRowModel().rows.map(r => r.original.nomination_id)

  if (rows.length === 0) {
    return (
      <div className="card-surface flex flex-col items-center gap-2 border-dashed p-12 text-center">
        <Inbox className="size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">No nominations assigned yet.</p>
        <p className="text-sm text-muted-foreground">The admin will assign nominations to you shortly.</p>
      </div>
    )
  }

  const selectClass = 'rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30'

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="mr-2 text-xs text-muted-foreground">Category:</label>
          <select
            value={master}
            onChange={e => { setMaster(e.target.value); setSub('') }}
            className={selectClass}
          >
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
          <span className="text-xs text-muted-foreground">
            {filteredRows.length} of {rows.length} shown
          </span>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <div className="card-surface border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No nominations match this filter.</p>
        </div>
      ) : (
    <TableShell>
      <Table>
        <THead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(header => (
                <TH
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none hover:text-foreground"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc'
                    ? ' ↑'
                    : header.column.getIsSorted() === 'desc'
                    ? ' ↓'
                    : ''}
                </TH>
              ))}
            </tr>
          ))}
        </THead>
        <TBody>
          {table.getRowModel().rows.map(row => (
            <TR key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TD key={cell.id} className="text-muted-foreground">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </TableShell>
      )}
    </>
  )
}
