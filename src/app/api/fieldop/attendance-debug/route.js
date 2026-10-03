import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[FieldOp attendance diagnostic] auth failed', userError)
    return NextResponse.json({ ok: false, stage: 'auth' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ ok: false, stage: 'input' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('fieldop_worker_attendance_status', {
    p_project_id: projectId,
  })

  if (error) {
    console.error('[FieldOp attendance diagnostic] attendance RPC failed', {
      code: error.code || null,
      message: error.message || null,
      details: error.details || null,
      hint: error.hint || null,
    })
    return NextResponse.json({ ok: false, stage: 'attendance_status_rpc' }, { status: 500 })
  }

  console.info('[FieldOp attendance diagnostic] attendance RPC succeeded', {
    hasResult: Array.isArray(data) ? data.length > 0 : Boolean(data),
  })

  return NextResponse.json({ ok: true, stage: 'attendance_status_rpc' })
}
