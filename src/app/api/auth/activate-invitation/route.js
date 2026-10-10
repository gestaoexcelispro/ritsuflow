import { NextResponse } from 'next/server'

import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authenticationError,
    } = await supabase.auth.getUser()

    if (authenticationError || !user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()

    const { data: memberships, error: membershipError } = await admin
      .from('organization_members')
      .select('organization_id,user_id,status')
      .eq('user_id', user.id)
      .eq('status', 'invited')

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message || 'Pending membership could not be checked.' },
        { status: 400 }
      )
    }

    if (!memberships?.length) {
      const { data: activeMemberships, error: activeMembershipError } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)

      if (activeMembershipError) {
        return NextResponse.json(
          { error: activeMembershipError.message || 'Membership status could not be checked.' },
          { status: 400 }
        )
      }

      if (activeMemberships?.length) {
        return NextResponse.json({ success: true, activated: 0, alreadyActive: true })
      }

      return NextResponse.json(
        { error: 'No pending RitsuFlow invitation was found for this account.' },
        { status: 400 }
      )
    }

    const { data: activatedMemberships, error: activationError } = await admin
      .from('organization_members')
      .update({
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'invited')
      .select('organization_id')

    if (activationError) {
      return NextResponse.json(
        { error: activationError.message || 'RitsuFlow membership could not be activated.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      activated: activatedMemberships?.length || 0,
    })
  } catch (error) {
    console.error('Invitation membership activation failed.', error)

    return NextResponse.json(
      { error: 'Your RitsuFlow membership could not be activated.' },
      { status: 500 }
    )
  }
}
