import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Re-open a finalized category: clears its finalized_rankings snapshot so live
// results drive the ranking again. Runs on the admin's own session (is_admin()
// guard inside the SECURITY DEFINER RPC).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { category_key } = (await req.json()) as { category_key?: string }
  if (!category_key) return NextResponse.json({ error: 'category_key required' }, { status: 400 })

  const { data, error } = await supabase.rpc('unfinalize_category', { p_category_key: category_key })

  if (error) {
    if (error.code === '42501') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/admin/results')
  revalidatePath('/admin/nominations')

  return NextResponse.json({ ok: true, reopened: data as number })
}
