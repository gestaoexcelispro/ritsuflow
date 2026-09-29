import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Server user-management configuration is incomplete. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function authClient(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase public configuration is incomplete.')
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function findAuthUserByEmail(admin, email) {
  let page = 1
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users || []
    const match = users.find((user) => String(user.email || '').toLowerCase() === email)
    if (match) return match
    if (users.length < 1000) return null
    page += 1
  }
  return null
}

async function isActivePlatformOwner(admin, userId) {
  const { data, error } = await admin
    .schema('private')
    .from('platform_users')
    .select('user_id')
    .eq('user_id', userId)
    .eq('platform_role', 'platform_owner')
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function POST(request) {
  try {
    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json()
    const organizationId = String(body.organizationId || '')
    const fullName = String(body.fullName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const jobTitle = String(body.jobTitle || '').trim()
    const role = String(body.role || 'member')
    const projectAccessMode = String(body.projectAccessMode || 'assigned_projects')
    const projectIds = Array.isArray(body.projectIds) ? body.projectIds.filter(Boolean) : []
    const workspaceAccess = Array.isArray(body.workspaceAccess) ? body.workspaceAccess.filter(Boolean) : []
    const requestedAvatarExt = String(body.avatarExt || '').toLowerCase()
    const avatarExt = ['jpg', 'jpeg', 'png', 'webp'].includes(requestedAvatarExt) ? requestedAvatarExt : null

    if (!organizationId || !fullName || !email) return NextResponse.json({ error: 'Name, email and organization are required.' }, { status: 400 })
    if (!['owner', 'admin', 'manager', 'member', 'viewer', 'user'].includes(role)) return NextResponse.json({ error: 'Invalid RitsuFlow role.' }, { status: 400 })
    if (!['all_projects', 'assigned_projects', 'selected_projects'].includes(projectAccessMode)) return NextResponse.json({ error: 'Invalid project access mode.' }, { status: 400 })

    const selectedMode = projectAccessMode === 'assigned_projects' || projectAccessMode === 'selected_projects'
    if (selectedMode && !projectIds.length) return NextResponse.json({ error: 'Select at least one assigned project.' }, { status: 400 })
    if (!workspaceAccess.length) return NextResponse.json({ error: 'Select at least one workspace.' }, { status: 400 })

    const caller = authClient(token)
    const { data: { user: callerUser }, error: callerError } = await caller.auth.getUser()
    if (callerError || !callerUser) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const admin = adminClient()
    const platformOwner = await isActivePlatformOwner(admin, callerUser.id)

    if (!platformOwner) {
      const { data: canManage, error: permissionError } = await caller.rpc('can_manage_organization_users', { target_organization_id: organizationId })
      if (permissionError || !canManage) return NextResponse.json({ error: 'You do not have permission to manage users for this organization.' }, { status: 403 })
    }

    if (projectIds.length) {
      const { data: validProjects, error: projectError } = await admin.from('projects').select('id').eq('organization_id', organizationId).in('id', projectIds)
      if (projectError) throw projectError
      if ((validProjects || []).length !== projectIds.length) return NextResponse.json({ error: 'One or more selected projects do not belong to this organization.' }, { status: 400 })
    }

    let authUser = await findAuthUserByEmail(admin, email)
    let identityWasCreated = false
    let deliveryMode = 'existing_account'
    const origin = new URL(request.url).origin

    if (authUser) {
      const { data: existingMembership, error: membershipReadError } = await admin
        .from('organization_members')
        .select('user_id,status')
        .eq('organization_id', organizationId)
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (membershipReadError) throw membershipReadError
      if (existingMembership) {
        return NextResponse.json({ error: 'This RitsuFlow account already belongs to this organization.' }, { status: 409 })
      }
    } else {
      const redirectTo = `${origin}/auth/invite`
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName, job_title: jobTitle, organization_id: organizationId, workspace_access: workspaceAccess },
      })
      if (inviteError) {
        authUser = await findAuthUserByEmail(admin, email)
        if (!authUser) return NextResponse.json({ error: inviteError.message }, { status: 400 })
      } else {
        authUser = invited?.user
        identityWasCreated = true
        deliveryMode = 'activation_invite'
      }
    }

    if (!authUser?.id) throw new Error('Supabase did not return the RitsuFlow user identity.')

    const avatarPath = avatarExt ? `${organizationId}/${authUser.id}/avatar.${avatarExt}` : null

    const { error: profileError } = await admin.from('profiles').upsert({ id: authUser.id, email, full_name: fullName }, { onConflict: 'id' })
    if (profileError) throw profileError

    const { error: userProfileError } = await admin.from('user_profiles').upsert({
      user_id: authUser.id,
      email,
      full_name: fullName,
      display_name: fullName,
      job_title: jobTitle,
      status: 'active',
      workspace_access: workspaceAccess,
      avatar_path: avatarPath,
    }, { onConflict: 'user_id' })
    if (userProfileError) throw userProfileError

    const dbRole = role === 'member' || role === 'viewer' ? 'user' : role === 'owner' ? 'admin' : role
    const dbAccessMode = selectedMode ? 'selected_projects' : 'all_projects'
    const membershipStatus = authUser.email_confirmed_at ? 'active' : 'invited'

    let accessError = null
    if (platformOwner) {
      const { error } = await admin.rpc('set_organization_member_access', {
        target_organization_id: organizationId,
        target_user_id: authUser.id,
        target_role: dbRole,
        target_project_access_mode: dbAccessMode,
        target_status: membershipStatus,
        target_project_ids: selectedMode ? projectIds : [],
      })
      accessError = error
    } else {
      const { error } = await caller.rpc('set_organization_member_access', {
        target_organization_id: organizationId,
        target_user_id: authUser.id,
        target_role: dbRole,
        target_project_access_mode: dbAccessMode,
        target_status: membershipStatus,
        target_project_ids: selectedMode ? projectIds : [],
      })
      accessError = error
    }
    if (accessError) throw accessError

    if (!identityWasCreated && !authUser.email_confirmed_at) {
      const { error: recoveryError } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })
      if (recoveryError) throw recoveryError
      deliveryMode = 'account_recovery'
    }

    let avatarUpload = null
    if (avatarPath) {
      const { data: signed, error: signedError } = await admin.storage.from('user-avatars').createSignedUploadUrl(avatarPath)
      if (signedError) throw signedError
      avatarUpload = { path: avatarPath, token: signed.token }
    }

    return NextResponse.json({
      ok: true,
      identityWasCreated,
      deliveryMode,
      user: {
        id: authUser.id,
        email,
        fullName,
        jobTitle,
        role,
        status: membershipStatus,
        projectAccessMode,
        projectIds,
        workspaceAccess,
        avatarPath,
      },
      avatarUpload,
    })
  } catch (error) {
    console.error('Invite organization user failed:', error)
    return NextResponse.json({ error: error?.message || 'Unable to invite user.' }, { status: 500 })
  }
}
