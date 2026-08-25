import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '../../../../../lib/supabase/server'

import {
  createAdminClient,
} from '../../../../../lib/supabase/admin'


function jsonError(
  message,
  status = 400
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    }
  )
}


function normalizeSlug(
  value
) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
}


export async function POST(
  request
) {
  let createdAuthUserId =
    null

  let organizationCreated =
    false

  try {
    // =====================================================
    // AUTHENTICATE PLATFORM USER
    // =====================================================

    const supabase =
      await createClient()

    const {
      data: {
        user:
          authenticatedUser,
      },
      error:
        authenticationError,
    } =
      await supabase.auth
        .getUser()


    if (
      authenticationError ||
      !authenticatedUser
    ) {
      return jsonError(
        'Authentication required.',
        401
      )
    }


    // =====================================================
    // AUTHORIZE PLATFORM OWNER
    // =====================================================

    const {
      data:
        isPlatformOwner,
      error:
        authorizationError,
    } =
      await supabase.rpc(
        'is_platform_owner'
      )


    if (
      authorizationError
    ) {
      console.error(
        'Platform authorization failed.',
        authorizationError
      )

      return jsonError(
        'Platform authorization could not be verified.',
        403
      )
    }


    if (
      !isPlatformOwner
    ) {
      return jsonError(
        'Platform Owner authorization required.',
        403
      )
    }


    // =====================================================
    // REQUEST
    // =====================================================

    let payload

    try {
      payload =
        await request.json()
    } catch {
      return jsonError(
        'Invalid request body.',
        400
      )
    }


    const {
      organizationName,
      organizationSlug,
      planCode,
      seatLimit,
      licenseStatus,
      startsAt,
      expiresAt,
      moduleKeys,
      primaryAdminName,
      primaryAdminEmail,
    } = payload || {}


    // =====================================================
    // NORMALIZE
    // =====================================================

    const normalizedName =
      typeof organizationName ===
        'string'
        ? organizationName.trim()
        : ''


    const normalizedSlug =
      normalizeSlug(
        typeof organizationSlug ===
          'string' &&
        organizationSlug.trim()
          ? organizationSlug
          : normalizedName
      )


    const normalizedAdminName =
      typeof primaryAdminName ===
        'string'
        ? primaryAdminName.trim()
        : ''


    const normalizedAdminEmail =
      typeof primaryAdminEmail ===
        'string'
        ? primaryAdminEmail
            .trim()
            .toLowerCase()
        : ''


    const normalizedSeatLimit =
      Number(
        seatLimit
      )


    const normalizedModules =
      Array.isArray(
        moduleKeys
      )
        ? [
            ...new Set(
              moduleKeys.filter(
                Boolean
              )
            ),
          ]
        : []


    const normalizedExpiration =
      expiresAt || null


    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      !normalizedName
    ) {
      return jsonError(
        'Company name is required.'
      )
    }


    if (
      !normalizedSlug
    ) {
      return jsonError(
        'Organization slug is required.'
      )
    }


    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        normalizedSlug
      )
    ) {
      return jsonError(
        'Organization slug is invalid.'
      )
    }


    if (
      !normalizedAdminName
    ) {
      return jsonError(
        'Primary Admin name is required.'
      )
    }


    if (
      !normalizedAdminEmail ||
      !normalizedAdminEmail.includes(
        '@'
      )
    ) {
      return jsonError(
        'A valid Primary Admin email is required.'
      )
    }


    const allowedPlans = [
      'pilot',
      'standard',
      'academic',
      'custom',
    ]


    if (
      !allowedPlans.includes(
        planCode
      )
    ) {
      return jsonError(
        'Invalid license plan.'
      )
    }


    if (
      !Number.isInteger(
        normalizedSeatLimit
      ) ||
      normalizedSeatLimit < 1
    ) {
      return jsonError(
        'Seat limit must be at least 1.'
      )
    }


    const allowedStatuses = [
      'trial',
      'active',
      'suspended',
      'expired',
      'cancelled',
    ]


    if (
      !allowedStatuses.includes(
        licenseStatus
      )
    ) {
      return jsonError(
        'Invalid license status.'
      )
    }


    if (
      !startsAt
    ) {
      return jsonError(
        'License start date is required.'
      )
    }


    if (
      normalizedExpiration &&
      normalizedExpiration <
        startsAt
    ) {
      return jsonError(
        'License expiration date cannot be before the start date.'
      )
    }


    const allowedModules =
      new Set([
        'project_setup',
        'planning',
        'daily_reports',
        'workforce',
        'production_control',
      ])


    const invalidModule =
      normalizedModules.find(
        (moduleKey) =>
          !allowedModules.has(
            moduleKey
          )
      )


    if (
      invalidModule
    ) {
      return jsonError(
        'One or more selected modules are invalid.'
      )
    }


    // =====================================================
    // ADMIN CLIENT
    // =====================================================
    //
    // Only now do we create the privileged client.
    //
    // Authorization has already succeeded.
    // =====================================================

    const admin =
      createAdminClient()


    // =====================================================
    // CHECK WHETHER EMAIL ALREADY EXISTS
    // =====================================================
    //
    // For the first provisioning version we deliberately
    // reject an existing Auth identity.
    //
    // Later we can support an existing person belonging to
    // multiple organizations if RitsuFlow needs that model.
    // =====================================================

    const {
      data:
        existingUsersData,
      error:
        existingUsersError,
    } =
      await admin.auth.admin
        .listUsers({
          page: 1,
          perPage: 1000,
        })


    if (
      existingUsersError
    ) {
      console.error(
        'Auth user lookup failed.',
        existingUsersError
      )

      return jsonError(
        'Primary Admin account could not be validated.',
        500
      )
    }


    const existingUser =
      (
        existingUsersData
          ?.users ||
        []
      ).find(
        (user) =>
          user.email
            ?.toLowerCase() ===
          normalizedAdminEmail
      )


    if (
      existingUser
    ) {
      return jsonError(
        'An account already exists for the Primary Admin email. Use a different email for this provisioning operation.',
        409
      )
    }


    // =====================================================
    // INVITATION REDIRECT
    // =====================================================

    const origin =
      new URL(
        request.url
      ).origin


    // =====================================================
    // CREATE / INVITE PRIMARY ADMIN
    // =====================================================

    const {
      data:
        invitationData,
      error:
        invitationError,
    } =
      await admin.auth.admin
        .inviteUserByEmail(
          normalizedAdminEmail,
          {
            data: {
              full_name:
                normalizedAdminName,
            },

            redirectTo:
              `${origin}/auth/invite`,
          }
        )


    if (
      invitationError ||
      !invitationData?.user
    ) {
      console.error(
        'Primary Admin invitation failed.',
        invitationError
      )

      return jsonError(
        invitationError
          ?.message ||
          'Primary Admin invitation could not be sent.',
        400
      )
    }


    createdAuthUserId =
      invitationData.user.id


    // =====================================================
    // PROVISION CUSTOMER TENANT
    // =====================================================

    const {
      data:
        createdOrganizationId,
      error:
        provisioningError,
    } =
      await supabase.rpc(
        'provision_platform_organization',
        {
          target_name:
            normalizedName,

          target_slug:
            normalizedSlug,

          target_primary_admin_user_id:
            createdAuthUserId,

          target_plan_code:
            planCode,

          target_seat_limit:
            normalizedSeatLimit,

          target_license_status:
            licenseStatus,

          target_starts_at:
            startsAt,

          target_expires_at:
            normalizedExpiration,

          target_module_keys:
            normalizedModules,
        }
      )


    if (
      provisioningError ||
      !createdOrganizationId
    ) {
      console.error(
        'Organization provisioning failed.',
        provisioningError
      )


      // ===================================================
      // BEST-EFFORT AUTH ROLLBACK
      // ===================================================
      //
      // The database provisioning function is transactional.
      // If it fails, its DB inserts are rolled back.
      //
      // The Auth invitation is external to that DB
      // transaction, so we remove the newly-created Auth
      // identity here.
      // ===================================================

      if (
        createdAuthUserId
      ) {
        try {
          const {
            error:
              rollbackError,
          } =
            await admin.auth.admin
              .deleteUser(
                createdAuthUserId
              )


          if (
            rollbackError
          ) {
            console.error(
              'Primary Admin Auth rollback failed.',
              rollbackError
            )
          }
        } catch (
          rollbackException
        ) {
          console.error(
            'Primary Admin Auth rollback threw an exception.',
            rollbackException
          )
        }
      }


      createdAuthUserId =
        null


      return jsonError(
        provisioningError
          ?.message ||
          'Organization could not be provisioned.',
        400
      )
    }


    organizationCreated =
      true


    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json(
      {
        success: true,

        organization: {
          id:
            createdOrganizationId,

          name:
            normalizedName,

          slug:
            normalizedSlug,
        },

        primaryAdmin: {
          id:
            createdAuthUserId,

          name:
            normalizedAdminName,

          email:
            normalizedAdminEmail,

          invitationSent:
            true,
        },
      },
      {
        status: 201,
      }
    )

  } catch (error) {
    console.error(
      'Platform organization creation failed.',
      error
    )


    // =====================================================
    // LAST-RESORT AUTH ROLLBACK
    // =====================================================

    if (
      createdAuthUserId &&
      !organizationCreated
    ) {
      try {
        const admin =
          createAdminClient()

        const {
          error:
            rollbackError,
        } =
          await admin.auth.admin
            .deleteUser(
              createdAuthUserId
            )


        if (
          rollbackError
        ) {
          console.error(
            'Last-resort Auth rollback failed.',
            rollbackError
          )
        }
      } catch (
        rollbackException
      ) {
        console.error(
          'Last-resort Auth rollback threw an exception.',
          rollbackException
        )
      }
    }


    return jsonError(
      'The organization could not be created.',
      500
    )
  }
}
