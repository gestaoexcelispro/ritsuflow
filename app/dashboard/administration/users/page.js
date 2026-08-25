import { redirect } from 'next/navigation'

import {
  createClient,
} from '../../../../lib/supabase/server'

import UsersAccessClient from './UsersAccessClient'

export const dynamic = 'force-dynamic'

export default async function UsersAccessPage() {
  const supabase =
    await createClient()

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: organization,
    error: organizationError,
  } =
    await supabase
      .from('organizations')
      .select(`
        id,
        name
      `)
      .order(
        'created_at',
        {
          ascending: true,
        }
      )
      .limit(1)
      .maybeSingle()

  if (
    organizationError ||
    !organization
  ) {
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
          RitsuFlow could not identify
          an organization for your
          account.
        </p>
      </div>
    )
  }

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

  if (usersResult.error) {
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
          Your account does not have
          permission to view Users &amp;
          Access for this organization.
        </p>
      </div>
    )
  }

  if (projectsResult.error) {
    console.error(
      'Administration projects could not be loaded.',
      projectsResult.error
    )
  }

  return (
    <UsersAccessClient
      organization={organization}
      currentUserId={user.id}
      initialUsers={
        usersResult.data || []
      }
      projects={
        projectsResult.data || []
      }
    />
  )
}
