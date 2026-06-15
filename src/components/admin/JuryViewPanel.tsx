'use client'

import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import AssignmentsTable from '@/components/dashboard/AssignmentsTable'

type Juror = { id: string; name: string; email: string }

type Row = {
  id: string
  status: string
  nomination_id: string
  nomination_display_id: string
  nominee_name: string
  designation: string
  company: string
  master_category: string
  category_key: string
  score: number | null
  summary: string | null
}

type Props = {
  jurors: Juror[]
  selectedJurorId: string | null
  selectedJurorName: string | null
  rows: Row[]
}

export default function JuryViewPanel({ jurors, selectedJurorId, selectedJurorName, rows }: Props) {
  const router = useRouter()

  const jurorOptions = jurors.map((j) => ({ value: j.id, label: j.name || j.email }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {selectedJurorId && selectedJurorName && (
          <Avatar name={selectedJurorName} size="sm" />
        )}
        <Select
          aria-label="Select juror"
          value={selectedJurorId ?? ''}
          onValueChange={(v) => router.push(v ? `/admin/jury-view?juror=${v}` : '/admin/jury-view')}
          placeholder="Select a juror…"
          options={[{ value: '', label: 'Select a juror…' }, ...jurorOptions]}
          className="h-9 w-72"
        />
      </div>

      {!selectedJurorId ? (
        <EmptyState
          icon={Users}
          title="Select a juror"
          description="Choose a juror above to see their assigned nominations and scoring progress."
        />
      ) : (
        <AssignmentsTable rows={rows} />
      )}
    </div>
  )
}
