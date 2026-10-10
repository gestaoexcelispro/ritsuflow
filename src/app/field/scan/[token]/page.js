import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import LocationHub from './LocationHub'

export const dynamic = 'force-dynamic'

/**
 * FieldOp location hub, opened by scanning a location's QR code.
 * The server only makes sure the person is signed in; the hub itself runs in the browser
 * so it can read the device location and follow the chosen language.
 */
export default async function FieldLocationScanPage({ params }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/field/scan/${token}`)}`)
  }

  return <LocationHub token={token} />
}
