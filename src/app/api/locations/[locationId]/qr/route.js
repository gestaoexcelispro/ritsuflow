import { NextResponse } from 'next/server'

import { createClient } from '../../../../../lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request, { params }) {
  const { locationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('id, project_id, location_type, qr_token')
    .eq('id', locationId)
    .maybeSingle()

  if (locationError) return NextResponse.json({ error: locationError.message }, { status: 500 })
  if (!location) return NextResponse.json({ error: 'Location not found or access denied.' }, { status: 404 })

  if (['building', 'floor', 'zone'].includes(location.location_type)) {
    return NextResponse.json({ error: 'QR codes are only available for production locations.' }, { status: 400 })
  }

  const { count, error: childrenError } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', location.project_id)
    .eq('parent_id', location.id)

  if (childrenError) return NextResponse.json({ error: childrenError.message }, { status: 500 })
  if ((count || 0) > 0) {
    return NextResponse.json({ error: 'QR codes are only available for leaf production locations.' }, { status: 400 })
  }

  if (location.qr_token) return NextResponse.json({ qr_token: location.qr_token, created: false })

  const qrToken = crypto.randomUUID()
  const { data: updated, error: updateError } = await supabase
    .from('locations')
    .update({ qr_token: qrToken })
    .eq('id', location.id)
    .eq('project_id', location.project_id)
    .is('qr_token', null)
    .select('qr_token')
    .maybeSingle()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  if (updated?.qr_token) return NextResponse.json({ qr_token: updated.qr_token, created: true })

  const { data: concurrent } = await supabase
    .from('locations')
    .select('qr_token')
    .eq('id', location.id)
    .eq('project_id', location.project_id)
    .maybeSingle()

  if (concurrent?.qr_token) return NextResponse.json({ qr_token: concurrent.qr_token, created: false })

  return NextResponse.json({ error: 'The location QR token could not be created.' }, { status: 409 })
}
