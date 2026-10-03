import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '../../../../../lib/supabase/server'

import {
  createAdminClient,
} from '../../../../../lib/supabase/admin'

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request) {
  try {
    const payload = await request.json()
    const {
      organizationId,
      fullName,
      email,
      role,
      projectAccessMode,
      projectIds,
    } = payload || {}

    if (!organizationId) return badRequest('Organization is required.')
    if (!email || typeof email !== 'string') return badRequest('Email is required.')
    if (!fullName || typeof fullName !== 'string') return badRequest('Name is required.')

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = fullName.trim()
    const normalizedRole = String(role || 'user').trim().toLowerCase()
    const normalizedAccessMode = String(projectAccessMode || 'selected_projects').trim().toLowerCase()
    const normalizedProjectIds = Array.isArray(projectIds) ? projectIds.filter(Boolean) : []

    if (!['admin', 'manager', 'user'].includes(normalizedRole)) {
      return badRequest('Invalid organization role.')
    }

    if (!['all_projects', 'selected_projects'].includes(normalizedAccessMode)) {
      return badRequest('Invalid project access mode.')
    }

    if (normalizedRole === 'admin' && normalizedAccessMode !== 'all_projects') {
      return badRequest('Admins must have All Projects access.')
    }

    if (normalizedRole === 'user' && normalizedAccessMode !== 'selected_projects') {
      return badRequest('Users must use Selected Projects access.')
    }

    if (normalizedAccessMode === 'selected_projects' && normalizedProjectIds.length === 0) {
      return badRequest('Selected Projects access requires at least one project.')
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authenticationError,
    } = await supabase.auth.getUser()

    if (authenticationError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const {
      data: canManageUsers,
      error: authorizationError,
    } = await supabase.rpc('can_manage_organization_users', {
      target_organization_id: organizationId,
    })

    if (authorizationError || !canManageUsers) {
      return NextResponse.json(
        { error: 'You are not authorized to invite organization users.' },
        { status: 403 }
      )
    }

    // Validate selected projects before sending an external invitation.
    if (normalizedAccessMode === 'selected_projects') {
      const { data: validProjects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId)
        .in('id', normalizedProjectIds)

      if (projectsError) {
        return badRequest('Selected projects could not be validated.')
      }

      const validIds = new Set((validProjects || []).map((project) => project.id))
      if (normalizedProjectIds.some((projectId) => !validIds.has(projectId))) {
        return badRequest('One or more selected projects do not belong to the organization.')
      }
    }

    const admin = createAdminClient()
    const origin = new URL(request.url).origin

    const {
      data: invitationData,
      error: invitationError,
    } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { full_name: normalizedName },
      redirectTo: `${origin}/auth/invite`,
    })

    if (invitationError || !invitationData?.user) {
      return NextResponse.json(
        { error: invitationError?.message || 'Invitation could not be sent.' },
        { status: 400 }
      )
    }

    const invitedUserId = invitationData.user.id

    // The Auth trigger owns profile creation. Invitation state belongs to the
    // organization membership, never to user_profiles.status.
    const { error: profileError } = await admin
      .from('user_profiles')
      .update({
        full_name: normalizedName,
        display_name: normalizedName,
        email: normalizedEmail,
      })
      .eq('user_id', invitedUserId)

    if (profileError) {
      console.error('Invited user profile metadata could not be updated.', profileError)
    }

    const { error: membershipError } = await admin
      .from('organization_members')
      .upsert(
        {
          organization_id: organizationId,
          user_id: invitedUserId,
          role: normalizedRole,
          status: 'invited',
          project_access_mode: normalizedAccessMode,
        },
        { onConflict: 'organization_id,user_id' }
      )

    if (membershipError) {
      try {
        await admin.auth.admin.deleteUser(invitedUserId)
      } catch (rollbackError) {
        console.error('Invitation rollback failed.', rollbackError)
      }

      return NextResponse.json(
        { error: membershipError.message || 'Organization invitation could not be created.' },
        { status: 400 }
      )
    }

    if (normalizedAccessMode === 'selected_projects') {
      const projectMembershipRows = normalizedProjectIds.map((projectId) => ({
        project_id: projectId,
        user_id: invitedUserId,
        role: 'viewer',
      }))

      const { error: projectMembershipError } = await admin
        .from('project_members')
        .upsert(projectMembershipRows, { onConflict: 'project_id,user_id' })

      if (projectMembershipError) {
        await admin
          .from('organization_members')
          .delete()
          .eq('organization_id', organizationId)
          .eq('user_id', invitedUserId)

        try {
          await admin.auth.admin.deleteUser(invitedUserId)
        } catch (rollbackError) {
          console.error('Invitation rollback failed.', rollbackError)
        }

        return NextResponse.json(
          { error: projectMembershipError.message || 'Project access could not be created.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      userId: invitedUserId,
      membershipStatus: 'invited',
    })
  } catch (error) {
    console.error('Administration invitation failed.', error)
    return NextResponse.json(
      { error: 'The invitation could not be completed.' },
      { status: 500 }
    )
  }
}
