import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { readTrialApplication } from '../../../lib/trial'

// Simple per-instance throttle: at most 5 applications per IP every 10 minutes.
const recent = new Map()
function throttled(ip) {
  const now = Date.now()
  const list = (recent.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000)
  list.push(now)
  recent.set(ip, list)
  if (recent.size > 5000) recent.clear()
  return list.length > 5
}

/** Landing page → "Apply for the trial". Stores the application in public.trial_applications. */
export async function POST(request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    if (throttled(ip)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

    let body
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

    const result = readTrialApplication(body, new Date())
    if ('error' in result) {
      if (result.error === 'spam') return NextResponse.json({ ok: true })
      return NextResponse.json({ error: result.error === 'consent' ? 'Consent is required.' : 'Name, a valid email and company are required.' }, { status: 400 })
    }

    const { error } = await createAdminClient().from('trial_applications').insert(result.row)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Trial application failed:', error)
    return NextResponse.json({ error: 'Unable to save the application.' }, { status: 500 })
  }
}
