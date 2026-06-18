import { NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NominationPDFDocument, type NominationPDFData } from '@/lib/pdf/nomination-pdf'
import { categoryLabel } from '@/lib/categories'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: jurorUser } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (jurorUser?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  const { data: nomination } = await service
    .from('nominations')
    .select('id, nomination_id, nominee_name, company, company_size, designation, master_category, category_key, raw_data_json')
    .eq('id', id)
    .maybeSingle()

  if (!nomination) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: summary } = await service
    .from('editorial_summary')
    .select('summary, jury_notes, strategic_feedback, criteria_scores_json, total_score')
    .eq('nomination_id', id)
    .maybeSingle()

  const nom: NominationPDFData = { ...nomination, editorial_summary: summary ?? null }

  const buffer = await renderToBuffer(
    React.createElement(NominationPDFDocument, { nominations: [nom] }) as React.ReactElement<DocumentProps>
  )

  const safeLabel = categoryLabel(nom.category_key).replace(/[^a-zA-Z0-9]+/g, '-')
  const filename = `nomination-${nom.nomination_id}-${safeLabel}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
