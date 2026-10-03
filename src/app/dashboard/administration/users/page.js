import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import UsersAccessClient from './UsersAccessClient'

export const dynamic = 'force-dynamic'

export default async function UsersAccessPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser()

  if (authenticationError || !user) redirect('/login')

  const { data: organizationMemberships, error: organizationContextError } =
    await supabase.rpc('get_my_organizations')

  if (organizationContextError) {
    console.error('Organization context could not be loaded.', organizationContextError)
    return <div style={{ padding: '28px' }}><h2>Organization unavailable</h2><p>RitsuFlow could not determine your organization access.</p></div>
  }

  const memberships = organizationMemberships || []

  if (memberships.length === 0) {
    return <div style={{ padding: '28px' }}><h2>No organization access</h2><p>Your account does not have an active organization membership.</p></div>
  }

  if (memberships.length > 1) {
    return <div style={{ padding: '28px' }}><h2>Select an organization</h2><p>Your account belongs to multiple organizations. Organization switching will be required before opening Users &amp; Access.</p></div>
  }

  const membership = memberships[0]
  const organization = {
    id: membership.organization_id,
    name: membership.organization_name,
    role: membership.organization_role,
    projectAccessMode: membership.project_access_mode,
  }

  if (organization.role !== 'admin') {
    return <div style={{ padding: '28px' }}><h2>Administration access required</h2><p>Only organization administrators can manage users and access.</p></div>
  }

  const [usersResult, projectsResult, platformOwnerResult] = await Promise.all([
    supabase.rpc('get_administration_users', { target_organization_id: organization.id }),
    supabase.from('projects').select('id,code,name,status').eq('organization_id', organization.id).order('code', { ascending: true }),
    supabase.rpc('is_platform_owner'),
  ])

  if (usersResult.error) {
    console.error('Administration users could not be loaded.', usersResult.error)
    return <div style={{ padding: '28px' }}><h2>Administration access required</h2><p>RitsuFlow could not load Users &amp; Access for this organization.</p></div>
  }

  if (projectsResult.error) console.error('Administration projects could not be loaded.', projectsResult.error)
  if (platformOwnerResult.error) console.error('Platform Owner status could not be loaded.', platformOwnerResult.error)

  return (
    <UsersAccessClient
      organization={organization}
      currentUserId={user.id}
      currentUserIsPlatformOwner={platformOwnerResult.data === true}
      initialUsers={usersResult.data || []}
      projects={projectsResult.data || []}
    />
  )
}
