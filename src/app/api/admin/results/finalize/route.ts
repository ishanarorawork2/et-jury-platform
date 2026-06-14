import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Snapshot a category's complete rankings into finalized_rankings (immutable).
// Runs on the admin's own session so the function's is_admin() check and
// finalized_by = auth.uid() resolve correctly; the RPC is SECURITY DEFINER and
// performs the privileged write internally.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { category_key } = (await req.json()) as { category_key?: string }
  if (!category_key) return NextResponse.json({ error: 'category_key required' }, { status: 400 })

  const { data, error } = await supabase.rpc('finalize_category', { p_category_key: category_key })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Category is already finalized' }, { status: 409 })
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/admin/results')
  revalidatePath('/admin/nominations')

  return NextResponse.json({ ok: true, finalized: data as number })
}
