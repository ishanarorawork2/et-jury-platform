import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ImportBatch } from '@/lib/import/types'

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

// List upload-batch history, newest first, with the uploader's name resolved.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uploaderIds = [...new Set((data ?? []).map((b) => b.uploaded_by).filter(Boolean))]
  const names = new Map<string, string>()
  if (uploaderIds.length) {
    const { data: users } = await service.from('jury_users').select('id, name').in('id', uploaderIds)
    for (const u of users ?? []) names.set(u.id, u.name)
  }

  const batches: ImportBatch[] = (data ?? []).map((b) => ({
    ...b,
    uploaded_by_name: b.uploaded_by ? names.get(b.uploaded_by) ?? null : null,
  }))

  return NextResponse.json({ batches })
}
