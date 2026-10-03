import { NextResponse } from 'next/server'

import { createClient } from '../../../../../lib/supabase/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export async function POST(request) {
  try {
    const { organizationId, userId } = await request.json()

    if (!organizationId || !userId) {
      return NextResponse.json(
        { error: 'Organization and user are required.' },
        { status: 400 }
      )
    }

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

    const { data: canManageUsers, error: authorizationError } = await supabase.rpc(
      'can_manage_organization_users',
      { target_organization_id: organizationId }
    )

    if (authorizationError || !canManageUsers) {
      return NextResponse.json(
        { error: 'You are not authorized to manage organization users.' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .select('user_id, status')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message || 'Invitation status could not be checked.' },
        { status: 400 }
      )
    }

    if (!membership || membership.status !== 'invited') {
      return NextResponse.json(
        { error: 'Only pending invitations can be resent.' },
        { status: 400 }
      )
    }

    const { data: authUserData, error: authUserError } =
      await admin.auth.admin.getUserById(userId)

    if (authUserError || !authUserData?.user?.email) {
      return NextResponse.json(
        { error: authUserError?.message || 'Invited user email could not be found.' },
        { status: 400 }
      )
    }

    const email = authUserData.user.email.trim().toLowerCase()
    const origin = new URL(request.url).origin

    const { error: resendError } = await admin.auth.resend({
      type: 'invite',
      email,
      options: {
        emailRedirectTo: `${origin}/auth/invite`,
      },
    })

    if (resendError) {
      return NextResponse.json(
        { error: resendError.message || 'Invitation could not be resent.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invitation resend failed.', error)

    return NextResponse.json(
      { error: 'The invitation could not be resent.' },
      { status: 500 }
    )
  }
}
