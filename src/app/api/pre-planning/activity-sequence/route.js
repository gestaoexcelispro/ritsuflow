import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '../../../../lib/supabase/server'


export async function POST(request) {
  try {
    const body =
      await request.json()

    const projectId =
      String(
        body?.projectId || ''
      )

    const items =
      Array.isArray(body?.items)
        ? body.items
        : []

    if (
      !projectId ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Project and activity sequence are required.',
        },
        {
          status: 400,
        }
      )
    }

    const normalizedItems =
      items.map(
        (item) => ({
          serviceId:
            String(
              item?.serviceId || ''
            ),
          sequence:
            Number(
              item?.sequence
            ),
        })
      )

    const invalidItem =
      normalizedItems.find(
        (item) =>
          !item.serviceId ||
          !Number.isInteger(
            item.sequence
          ) ||
          item.sequence <= 0
      )

    if (invalidItem) {
      return NextResponse.json(
        {
          error:
            'The activity sequence contains invalid data.',
        },
        {
          status: 400,
        }
      )
    }

    const supabase =
      await createClient()

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'Authentication is required.',
        },
        {
          status: 401,
        }
      )
    }

    /*
     * Validate that every submitted Scope Item
     * belongs to the selected project before
     * attempting the write.
     */
    const serviceIds =
      normalizedItems.map(
        (item) =>
          item.serviceId
      )

    const {
      data: services,
      error: servicesError,
    } =
      await supabase
        .from(
          'project_services'
        )
        .select('id')
        .eq(
          'project_id',
          projectId
        )
        .in(
          'id',
          serviceIds
        )

    if (servicesError) {
      return NextResponse.json(
        {
          error:
            servicesError.message,
        },
        {
          status: 400,
        }
      )
    }

    const validServiceIds =
      new Set(
        (services || []).map(
          (service) =>
            service.id
        )
      )

    if (
      serviceIds.some(
        (serviceId) =>
          !validServiceIds.has(
            serviceId
          )
      )
    ) {
      return NextResponse.json(
        {
          error:
            'One or more Scope Items do not belong to this project.',
        },
        {
          status: 400,
        }
      )
    }

    const payload =
      normalizedItems.map(
        (item) => ({
          project_id:
            projectId,
          service_id:
            item.serviceId,
          pre_sequence_number:
            item.sequence,
          created_by:
            user.id,
          updated_at:
            new Date().toISOString(),
        })
      )

    const {
      error: saveError,
    } =
      await supabase
        .from(
          'project_scope_activity_pre_sequence'
        )
        .upsert(
          payload,
          {
            onConflict:
              'project_id,service_id',
          }
        )

    if (saveError) {
      return NextResponse.json(
        {
          error:
            saveError.message,
        },
        {
          status: 400,
        }
      )
    }

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(
      'Activity Pre-Sequence save failed.',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error while saving the activity sequence.',
      },
      {
        status: 500,
      }
    )
  }
}
