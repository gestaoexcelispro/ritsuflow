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
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 400,
    }
  )
}


export async function POST(request) {
  try {
    const payload =
      await request.json()

    const {
      organizationId,
      fullName,
      email,
      role,
      projectAccessMode,
      status,
      projectIds,
    } = payload || {}


    if (!organizationId) {
      return badRequest(
        'Organization is required.'
      )
    }


    if (
      !email ||
      typeof email !== 'string'
    ) {
      return badRequest(
        'Email is required.'
      )
    }


    if (
      !fullName ||
      typeof fullName !== 'string'
    ) {
      return badRequest(
        'Name is required.'
      )
    }


    const supabase =
      await createClient()


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
      return NextResponse.json(
        {
          error:
            'Authentication required.',
        },
        {
          status: 401,
        }
      )
    }


    // =====================================================
    // AUTHORIZE BEFORE USING SERVICE ROLE
    // =====================================================

    const {
      data:
        canManageUsers,
      error:
        authorizationError,
    } =
      await supabase.rpc(
        'can_manage_organization_users',
        {
          target_organization_id:
            organizationId,
        }
      )


    if (
      authorizationError ||
      !canManageUsers
    ) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to invite organization users.',
        },
        {
          status: 403,
        }
      )
    }


    // =====================================================
    // CREATE INVITATION
    // =====================================================

    const admin =
      createAdminClient()


    const origin =
      new URL(
        request.url
      ).origin


    const {
      data:
        invitationData,
      error:
        invitationError,
    } =
      await admin.auth.admin
        .inviteUserByEmail(
          email
            .trim()
            .toLowerCase(),
          {
            data: {
              full_name:
                fullName.trim(),
            },

            redirectTo:
              `${origin}/login`,
          }
        )


    if (
      invitationError ||
      !invitationData?.user
    ) {
      return NextResponse.json(
        {
          error:
            invitationError
              ?.message ||
            'Invitation could not be sent.',
        },
        {
          status: 400,
        }
      )
    }


    const invitedUserId =
      invitationData.user.id


    // =====================================================
    // ASSIGN ORGANIZATION ACCESS
    // =====================================================

    const {
      error:
        membershipError,
    } =
      await supabase.rpc(
        'set_organization_member_access',
        {
          target_organization_id:
            organizationId,

          target_user_id:
            invitedUserId,

          target_role:
            role,

          target_project_access_mode:
            projectAccessMode,

          target_status:
            status,

          target_project_ids:
            Array.isArray(
              projectIds
            )
              ? projectIds
              : [],
        }
      )


    if (membershipError) {
      /*
       * Best-effort rollback:
       *
       * If Auth invitation succeeds but
       * organization membership fails,
       * remove the invited Auth user so
       * we do not leave an orphaned
       * account.
       */

      try {
        await admin.auth.admin
          .deleteUser(
            invitedUserId
          )
      } catch (
        rollbackError
      ) {
        console.error(
          'Invitation rollback failed.',
          rollbackError
        )
      }


      return NextResponse.json(
        {
          error:
            membershipError
              .message ||
            'Organization access could not be created.',
        },
        {
          status: 400,
        }
      )
    }


    return NextResponse.json(
      {
        success: true,
        userId:
          invitedUserId,
      }
    )

  } catch (error) {
    console.error(
      'Administration invitation failed.',
      error
    )


    return NextResponse.json(
      {
        error:
          'The invitation could not be completed.',
      },
      {
        status: 500,
      }
    )
  }
}
