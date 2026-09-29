import { NextResponse } from 'next/server'

import { createClient } from '../../../../../lib/supabase/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request) {
  try {
    const payload = await request.json()
    const {
      organizationId,
      userId,
      fullName,
      role,
      projectAccessMode,
      status,
      projectIds,
    } = payload || {}

    if (!organizationId) return jsonError('Organization is required.', 400)
    if (!userId) return jsonError('User is required.', 400)
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return jsonError('Name is required.', 400)
    }

    const allowedRoles = ['admin', 'manager', 'user']
    if (!allowedRoles.includes(role)) return jsonError('Invalid organization role.', 400)

    const allowedAccessModes = ['all_projects', 'selected_projects']
    if (!allowedAccessModes.includes(projectAccessMode)) {
      return jsonError('Invalid project access mode.', 400)
    }

    const allowedStatuses = ['active', 'disabled']
    if (!allowedStatuses.includes(status)) return jsonError('Invalid membership status.', 400)

    const normalizedProjectIds = Array.isArray(projectIds) ? projectIds.filter(Boolean) : []
    if (projectAccessMode === 'selected_projects' && normalizedProjectIds.length === 0) {
      return jsonError('Select at least one project.', 400)
    }

    const supabase = await createClient()
    const {
      data: { user: authenticatedUser },
      error: authenticationError,
    } = await supabase.auth.getUser()

    if (authenticationError || !authenticatedUser) {
      return jsonError('Authentication required.', 401)
    }

    const { data: canManageOrganization, error: authorizationError } = await supabase.rpc(
      'can_manage_organization_users',
      { target_organization_id: organizationId }
    )

    if (authorizationError) {
      console.error('Organization authorization failed.', authorizationError)
      return jsonError('Organization authorization could not be verified.', 403)
    }

    if (!canManageOrganization) {
      return jsonError('You are not authorized to manage users in this organization.', 403)
    }

    const {
      data: targetMembership,
      error: membershipLookupError,
    } = await supabase
      .from('organization_members')
      .select('organization_id,user_id,role,status')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipLookupError) {
      console.error('Target membership lookup failed.', membershipLookupError)
      return jsonError('User membership could not be verified.', 400)
    }

    if (!targetMembership) {
      return jsonError('The selected user does not belong to this organization.', 403)
    }

    // Canonical Platform Owner protection.
    // Do not infer ownership from email or organization role. The service-role
    // client checks the authoritative private.platform_users record discovered
    // by the existing private.is_platform_owner() authorization architecture.
    const admin = createAdminClient()
    const { data: protectedPlatformUser, error: platformLookupError } = await admin
      .schema('private')
      .from('platform_users')
      .select('user_id,platform_role,status')
      .eq('user_id', userId)
      .eq('platform_role', 'platform_owner')
      .eq('status', 'active')
      .maybeSingle()

    if (platformLookupError) {
      console.error('Platform Owner protection lookup failed.', platformLookupError)
      return jsonError('Platform authorization could not be verified.', 500)
    }

    if (protectedPlatformUser) {
      return jsonError(
        'This account is the protected RitsuFlow Platform Owner. Platform authority cannot be changed from organization user administration.',
        403
      )
    }

    if (projectAccessMode === 'selected_projects') {
      const { data: allowedProjects, error: projectValidationError } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId)
        .in('id', normalizedProjectIds)

      if (projectValidationError) {
        console.error('Project validation failed.', projectValidationError)
        return jsonError('Project access could not be verified.', 400)
      }

      const validProjectIds = new Set((allowedProjects || []).map((project) => project.id))
      const allProjectsValid = normalizedProjectIds.every((projectId) => validProjectIds.has(projectId))
      if (!allProjectsValid) {
        return jsonError('One or more selected projects do not belong to this organization.', 403)
      }
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: fullName.trim() },
    })

    if (authUpdateError) {
      console.error('Auth user name update failed.', authUpdateError)
      return jsonError(authUpdateError.message || 'User name could not be updated.', 400)
    }

    const { error: accessUpdateError } = await supabase.rpc('set_organization_member_access', {
      target_organization_id: organizationId,
      target_user_id: userId,
      target_role: role,
      target_project_access_mode: projectAccessMode,
      target_status: status,
      target_project_ids: normalizedProjectIds,
    })

    if (accessUpdateError) {
      console.error('Organization access update failed.', accessUpdateError)
      return jsonError(accessUpdateError.message || 'User access could not be updated.', 400)
    }

    return NextResponse.json({ success: true, userId, organizationId })
  } catch (error) {
    console.error('Administration user update failed.', error)
    return jsonError('The user could not be updated.', 500)
  }
}
