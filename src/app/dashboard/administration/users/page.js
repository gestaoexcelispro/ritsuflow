import { redirect } from 'next/navigation'

import {
  createClient,
} from '../../../../lib/supabase/server'

import UsersAccessClient from './UsersAccessClient'

export const dynamic = 'force-dynamic'

export default async function UsersAccessPage() {
  const supabase =
    await createClient()

  // =====================================================
  // AUTHENTICATED USER
  // =====================================================

  const {
    data: {
      user,
    },
    error:
      authenticationError,
  } =
    await supabase.auth.getUser()

  if (
    authenticationError ||
    !user
  ) {
    redirect('/login')
  }

  // =====================================================
  // AUTHENTICATED ORGANIZATION CONTEXT
  // =====================================================
  //
  // IMPORTANT:
  //
  // We NEVER select the first organization in the
  // database.
  //
  // Organization context comes exclusively from:
  //
  // auth.uid()
  //      ↓
  // active organization_members
  //      ↓
  // organization
  //
  // =====================================================

  const {
    data:
      organizationMemberships,
    error:
      organizationContextError,
  } =
    await supabase.rpc(
      'get_my_organizations'
    )

  if (
    organizationContextError
  ) {
    console.error(
      'Organization context could not be loaded.',
      organizationContextError
    )

    return (
      <div
        style={{
          padding: '28px',
        }}
      >
        <h2>
          Organization unavailable
        </h2>

        <p>
          RitsuFlow could not determine
          your organization access.
        </p>
      </div>
    )
  }

  const memberships =
    organizationMemberships || []

  // =====================================================
  // NO ACTIVE ORGANIZATION
  // =====================================================

  if (
    memberships.length === 0
  ) {
    return (
      <div
        style={{
          padding: '28px',
        }}
      >
        <h2>
          No organization access
        </h2>

        <p>
          Your account does not have
          an active organization
          membership.
        </p>
      </div>
    )
  }

  // =====================================================
  // MULTIPLE ORGANIZATIONS
  // =====================================================
  //
  // Do NOT guess.
  //
  // When organization switching is introduced, this state
  // will route the user to the organization selector.
  //
  // Until then, refusing to guess is safer than silently
  // entering the wrong tenant.
  // =====================================================

  if (
    memberships.length > 1
  ) {
    return (
      <div
        style={{
          padding: '28px',
        }}
      >
        <h2>
          Select an organization
        </h2>

        <p>
          Your account belongs to
          multiple organizations.
          Organization switching will
          be required before opening
          Users &amp; Access.
        </p>
      </div>
    )
  }

  // =====================================================
  // SINGLE ORGANIZATION
  // =====================================================

  const membership =
    memberships[0]

  const organization = {
    id:
      membership.organization_id,

    name:
      membership.organization_name,

    role:
      membership.organization_role,

    projectAccessMode:
      membership.project_access_mode,
  }

  // =====================================================
  // ADMINISTRATION AUTHORIZATION
  // =====================================================
  //
  // Users & Access is organization administration.
  //
  // The authenticated user must be an Admin of THIS
  // organization.
  // =====================================================

  if (
    organization.role !==
    'admin'
  ) {
    return (
      <div
        style={{
          padding: '28px',
        }}
      >
        <h2>
          Administration access required
        </h2>

        <p>
          Only organization
          administrators can manage
          users and access.
        </p>
      </div>
    )
  }

  // =====================================================
  // LOAD TENANT-SCOPED DATA
  // =====================================================

  const [
    usersResult,
    projectsResult,
  ] =
    await Promise.all([
      supabase.rpc(
        'get_administration_users',
        {
          target_organization_id:
            organization.id,
        }
      ),

      supabase
        .from('projects')
        .select(`
          id,
          code,
          name,
          status
        `)
        .eq(
          'organization_id',
          organization.id
        )
        .order(
          'code',
          {
            ascending: true,
          }
        ),
    ])

  // =====================================================
  // USERS RESULT
  // =====================================================

  if (
    usersResult.error
  ) {
    console.error(
      'Administration users could not be loaded.',
      usersResult.error
    )

    return (
      <div
        style={{
          padding: '28px',
        }}
      >
        <h2>
          Administration access required
        </h2>

        <p>
          RitsuFlow could not load
          Users &amp; Access for this
          organization.
        </p>
      </div>
    )
  }

  // =====================================================
  // PROJECTS RESULT
  // =====================================================

  if (
    projectsResult.error
  ) {
    console.error(
      'Administration projects could not be loaded.',
      projectsResult.error
    )
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <UsersAccessClient
      organization={
        organization
      }
      currentUserId={
        user.id
      }
      initialUsers={
        usersResult.data || []
      }
      projects={
        projectsResult.data || []
      }
    />
  )
}
