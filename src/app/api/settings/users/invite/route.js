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
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } })
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
    const role = String(body.role || 'member')
    const projectAccessMode = String(body.projectAccessMode || 'assigned_projects')
    if (!organizationId || !fullName || !email) return NextResponse.json({ error: 'Name, email and organization are required.' }, { status: 400 })
    if (!['owner','admin','manager','member','viewer'].includes(role)) return NextResponse.json({ error: 'Invalid organization role.' }, { status: 400 })
    if (!['all_projects','assigned_projects'].includes(projectAccessMode)) return NextResponse.json({ error: 'Invalid project access mode.' }, { status: 400 })

    const caller = authClient(token)
    const { data: canManage, error: permissionError } = await caller.rpc('can_manage_organization_users', { target_organization_id: organizationId })
    if (permissionError || !canManage) return NextResponse.json({ error: 'You do not have permission to manage users for this organization.' }, { status: 403 })

    const admin = adminClient()
    const { data: licenseRows } = await caller.rpc('get_platform_organizations')
    const license = Array.isArray(licenseRows) ? licenseRows.find(x => x.organization_id === organizationId) : null
    const { count: activeCount, error: countError } = await admin.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'active')
    if (countError) throw countError
    if (license?.seat_limit != null && activeCount >= license.seat_limit) return NextResponse.json({ error: `Seat limit reached (${license.seat_limit}). Increase the license seat limit before activating another user.` }, { status: 409 })

    const redirectTo = `${new URL(request.url).origin}/login`
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName, organization_id: organizationId } })
    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 })
    const invitedUser = invited?.user
    if (!invitedUser?.id) throw new Error('Supabase did not return the invited user.')

    const { error: profileError } = await admin.from('profiles').upsert({ id: invitedUser.id, email, full_name: fullName }, { onConflict: 'id' })
    if (profileError) throw profileError

    const { error: accessError } = await admin.rpc('set_organization_member_access', { target_organization_id: organizationId, target_user_id: invitedUser.id, target_role: role, target_project_access_mode: projectAccessMode, target_status: 'invited', target_project_ids: [] })
    if (accessError) throw accessError

    return NextResponse.json({ ok: true, user: { id: invitedUser.id, email, fullName, role, status: 'invited', projectAccessMode } })
  } catch (error) {
    console.error('Invite organization user failed:', error)
    return NextResponse.json({ error: error?.message || 'Unable to invite user.' }, { status: 500 })
  }
}
