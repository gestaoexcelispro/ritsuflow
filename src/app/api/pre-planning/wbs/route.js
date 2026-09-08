import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '../../../../lib/supabase/server'


const VALID_ITEM_TYPES =
  new Set([
    'summary',
    'task',
    'milestone',
  ])


function badRequest(
  message
) {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  )
}


function conflict(
  message
) {
  return NextResponse.json(
    { error: message },
    { status: 409 }
  )
}


function notFound(
  message
) {
  return NextResponse.json(
    { error: message },
    { status: 404 }
  )
}


function normalizeName(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      240
    )
}


function itemResponse(
  item
) {
  return {
    id:
      item.id,

    projectId:
      item.project_id,

    versionId:
      item.version_id,

    parentId:
      item.parent_id,

    allocationId:
      item.allocation_id,

    itemType:
      item.item_type,

    name:
      item.name,

    durationDays:
      item.duration_days ===
      null
        ? null
        : Number(
            item.duration_days
          ),

    sortOrder:
      Number(
        item.sort_order ||
        0
      ),
  }
}


function dependencyResponse(
  row
) {
  return {
    id:
      row.id,

    successorItemId:
      row.successor_item_id,

    predecessorItemId:
      row.predecessor_item_id,

    relationship:
      row.relationship,

    lagDays:
      Number(
        row.lag_days ||
        0
      ),
  }
}


async function getVersion({
  supabase,
  projectId,
  versionId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_versions'
      )
      .select(
        `
          id,
          project_id,
          status,
          is_current
        `
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'id',
        versionId
      )
      .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}


async function requireEditableVersion({
  supabase,
  projectId,
  versionId,
}) {
  const version =
    await getVersion({
      supabase,
      projectId,
      versionId,
    })

  if (!version) {
    return {
      response:
        notFound(
          'The selected Pre-Planning version was not found.'
        ),
    }
  }

  if (
    !version.is_current ||
    version.status !==
      'working'
  ) {
    return {
      response:
        conflict(
          'Only the current working Pre-Planning version can be edited.'
        ),
    }
  }

  return {
    version,
  }
}


async function loadItems({
  supabase,
  projectId,
  versionId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_wbs_items'
      )
      .select(
        `
          id,
          project_id,
          version_id,
          parent_id,
          allocation_id,
          item_type,
          name,
          duration_days,
          sort_order
        `
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'version_id',
        versionId
      )
      .order(
        'sort_order',
        {
          ascending: true,
        }
      )

  if (error) {
    throw error
  }

  return data || []
}


async function loadDependencies({
  supabase,
  projectId,
  versionId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_wbs_dependencies'
      )
      .select(
        `
          id,
          successor_item_id,
          predecessor_item_id,
          relationship,
          lag_days
        `
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'version_id',
        versionId
      )

  if (error) {
    throw error
  }

  return data || []
}


async function loadPayload({
  supabase,
  projectId,
  versionId,
}) {
  const [
    items,
    dependencies,
  ] =
    await Promise.all([
      loadItems({
        supabase,
        projectId,
        versionId,
      }),

      loadDependencies({
        supabase,
        projectId,
        versionId,
      }),
    ])

  return {
    items:
      items.map(
        itemResponse
      ),

    dependencies:
      dependencies.map(
        dependencyResponse
      ),
  }
}


async function getNextSortOrder({
  supabase,
  projectId,
  versionId,
  parentId,
}) {
  let query =
    supabase
      .from(
        'project_pre_planning_wbs_items'
      )
      .select(
        'sort_order'
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'version_id',
        versionId
      )
      .order(
        'sort_order',
        {
          ascending: false,
        }
      )
      .limit(1)

  query =
    parentId
      ? query.eq(
          'parent_id',
          parentId
        )
      : query.is(
          'parent_id',
          null
        )

  const {
    data,
    error,
  } =
    await query

  if (error) {
    throw error
  }

  return (
    Number(
      data?.[0]
        ?.sort_order ||
      0
    ) + 1
  )
}


async function validateParent({
  supabase,
  projectId,
  versionId,
  parentId,
}) {
  if (!parentId) {
    return
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_wbs_items'
      )
      .select(
        `
          id,
          item_type
        `
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'version_id',
        versionId
      )
      .eq(
        'id',
        parentId
      )
      .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'The selected WBS parent was not found.'
    )
  }

  if (
    data.item_type !==
    'summary'
  ) {
    throw new Error(
      'Only a Summary can contain child WBS lines.'
    )
  }
}


async function addItem({
  supabase,
  projectId,
  versionId,
  userId,
  body,
}) {
  const itemType =
    String(
      body?.itemType ||
      ''
    )
      .trim()
      .toLowerCase()

  if (
    !VALID_ITEM_TYPES.has(
      itemType
    )
  ) {
    return badRequest(
      'WBS line type must be Summary, Task, or Milestone.'
    )
  }

  const name =
    normalizeName(
      body?.name
    )

  if (!name) {
    return badRequest(
      'WBS line name is required.'
    )
  }

  const parentId =
    body?.parentId
      ? String(
          body.parentId
        ).trim()
      : null

  await validateParent({
    supabase,
    projectId,
    versionId,
    parentId,
  })

  const sortOrder =
    await getNextSortOrder({
      supabase,
      projectId,
      versionId,
      parentId,
    })

  let durationDays =
    null

  if (
    itemType ===
    'milestone'
  ) {
    durationDays = 0
  } else if (
    itemType ===
    'task'
  ) {
    const numeric =
      Number(
        body?.durationDays
      )

    durationDays =
      Number.isFinite(
        numeric
      ) &&
      numeric > 0
        ? numeric
        : null
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_wbs_items'
      )
      .insert({
        project_id:
          projectId,

        version_id:
          versionId,

        parent_id:
          parentId,

        allocation_id:
          null,

        item_type:
          itemType,

        name,

        duration_days:
          durationDays,

        sort_order:
          sortOrder,

        created_by:
          userId,
      })
      .select(
        `
          id,
          project_id,
          version_id,
          parent_id,
          allocation_id,
          item_type,
          name,
          duration_days,
          sort_order
        `
      )
      .single()

  if (error) {
    throw error
  }

  const payload =
    await loadPayload({
      supabase,
      projectId,
      versionId,
    })

  return NextResponse.json({
    ok: true,
    action:
      'add_item',
    item:
      itemResponse(
        data
      ),
    ...payload,
  })
}


async function updateItem({
  supabase,
  projectId,
  versionId,
  body,
}) {
  const itemId =
    String(
      body?.itemId ||
      ''
    ).trim()

  if (!itemId) {
    return badRequest(
      'WBS item ID is required.'
    )
  }

  const {
    data: existing,
    error:
      existingError,
  } =
    await supabase
      .from(
        'project_pre_planning_wbs_items'
      )
      .select(
        `
          id,
          item_type,
          name,
          duration_days
        `
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'version_id',
        versionId
      )
      .eq(
        'id',
        itemId
      )
      .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (!existing) {
    return notFound(
      'The selected WBS line was not found.'
    )
  }

  const name =
    normalizeName(
      body?.name ??
      existing.name
    )

  if (!name) {
    return badRequest(
      'WBS line name is required.'
    )
  }

  let durationDays =
    null

  if (
    existing.item_type ===
    'milestone'
  ) {
    durationDays = 0
  } else if (
    existing.item_type ===
    'task'
  ) {
    const numeric =
      Number(
        body?.durationDays
      )

    durationDays =
      Number.isFinite(
        numeric
      ) &&
      numeric > 0
        ? numeric
        : null
  }

  const {
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_wbs_items'
      )
      .update({
        name,
        duration_days:
          durationDays,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'version_id',
        versionId
      )
      .eq(
        'id',
        itemId
      )

  if (error) {
    throw error
  }

  const payload =
    await loadPayload({
      supabase,
      projectId,
      versionId,
    })

  return NextResponse.json({
    ok: true,
    action:
      'update_item',
    ...payload,
  })
}


async function setStructure({
  supabase,
  projectId,
  versionId,
  body,
}) {
  const structure =
    Array.isArray(
      body?.structure
    )
      ? body.structure
      : []

  const currentItems =
    await loadItems({
      supabase,
      projectId,
      versionId,
    })

  if (
    structure.length !==
    currentItems.length
  ) {
    return badRequest(
      'The complete WBS structure must be supplied.'
    )
  }

  const currentMap =
    new Map(
      currentItems.map(
        (item) => [
          item.id,
          item,
        ]
      )
    )

  const requestedMap =
    new Map()

  structure.forEach(
    (
      row,
      index
    ) => {
      const id =
        String(
          row?.id ||
          ''
        ).trim()

      if (
        !currentMap.has(
          id
        )
      ) {
        throw new Error(
          'The WBS structure contains an unknown line.'
        )
      }

      const parentId =
        row?.parentId
          ? String(
              row.parentId
            ).trim()
          : null

      requestedMap.set(
        id,
        {
          id,
          parentId,
          sortOrder:
            Math.max(
              1,
              Number(
                row?.sortOrder ||
                index + 1
              )
            ),
        }
      )
    }
  )

  requestedMap.forEach(
    (row) => {
      if (
        row.parentId
      ) {
        const parent =
          currentMap.get(
            row.parentId
          )

        if (!parent) {
          throw new Error(
            'The WBS structure contains an invalid parent.'
          )
        }

        if (
          parent.item_type !==
          'summary'
        ) {
          throw new Error(
            'Only a Summary can contain child WBS lines.'
          )
        }
      }

      const visited =
        new Set([
          row.id,
        ])

      let cursor =
        row.parentId

      while (cursor) {
        if (
          visited.has(
            cursor
          )
        ) {
          throw new Error(
            'The WBS hierarchy cannot contain a cycle.'
          )
        }

        visited.add(
          cursor
        )

        cursor =
          requestedMap.get(
            cursor
          )?.parentId ||
          null
      }
    }
  )

  for (
    const row of
    requestedMap.values()
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          'project_pre_planning_wbs_items'
        )
        .update({
          parent_id:
            row.parentId,
          sort_order:
            row.sortOrder,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'project_id',
          projectId
        )
        .eq(
          'version_id',
          versionId
        )
        .eq(
          'id',
          row.id
        )

    if (error) {
      throw error
    }
  }

  const payload =
    await loadPayload({
      supabase,
      projectId,
      versionId,
    })

  return NextResponse.json({
    ok: true,
    action:
      'set_structure',
    ...payload,
  })
}


function descendantsDeepestFirst(
  items,
  rootId
) {
  const childMap =
    new Map()

  items.forEach(
    (item) => {
      if (
        !item.parent_id
      ) {
        return
      }

      if (
        !childMap.has(
          item.parent_id
        )
      ) {
        childMap.set(
          item.parent_id,
          []
        )
      }

      childMap
        .get(
          item.parent_id
        )
        .push(
          item.id
        )
    }
  )

  const rows = []

  function visit(
    id,
    depth
  ) {
    rows.push({
      id,
      depth,
    })

    ;(
      childMap.get(
        id
      ) ||
      []
    ).forEach(
      (childId) =>
        visit(
          childId,
          depth + 1
        )
    )
  }

  visit(
    rootId,
    0
  )

  return rows.sort(
    (
      first,
      second
    ) =>
      second.depth -
      first.depth
  )
}


async function deleteItem({
  supabase,
  projectId,
  versionId,
  body,
}) {
  const itemId =
    String(
      body?.itemId ||
      ''
    ).trim()

  if (!itemId) {
    return badRequest(
      'WBS item ID is required.'
    )
  }

  const items =
    await loadItems({
      supabase,
      projectId,
      versionId,
    })

  if (
    !items.some(
      (item) =>
        item.id ===
        itemId
    )
  ) {
    return notFound(
      'The selected WBS line was not found.'
    )
  }

  const deleteRows =
    descendantsDeepestFirst(
      items,
      itemId
    )

  for (
    const row of
    deleteRows
  ) {
    const {
      error:
        dependencyError,
    } =
      await supabase
        .from(
          'project_pre_planning_wbs_dependencies'
        )
        .delete()
        .eq(
          'project_id',
          projectId
        )
        .eq(
          'version_id',
          versionId
        )
        .or(
          `successor_item_id.eq.${row.id},predecessor_item_id.eq.${row.id}`
        )

    if (dependencyError) {
      throw dependencyError
    }

    const {
      error,
    } =
      await supabase
        .from(
          'project_pre_planning_wbs_items'
        )
        .delete()
        .eq(
          'project_id',
          projectId
        )
        .eq(
          'version_id',
          versionId
        )
        .eq(
          'id',
          row.id
        )

    if (error) {
      throw error
    }
  }

  const payload =
    await loadPayload({
      supabase,
      projectId,
      versionId,
    })

  return NextResponse.json({
    ok: true,
    action:
      'delete_item',
    ...payload,
  })
}


export async function GET(
  request
) {
  try {
    const supabase =
      await createClient()

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser()

    if (!user) {
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

    const {
      searchParams,
    } =
      new URL(
        request.url
      )

    const projectId =
      String(
        searchParams.get(
          'projectId'
        ) ||
        ''
      ).trim()

    const versionId =
      String(
        searchParams.get(
          'versionId'
        ) ||
        ''
      ).trim()

    if (
      !projectId ||
      !versionId
    ) {
      return badRequest(
        'Project ID and version ID are required.'
      )
    }

    const version =
      await getVersion({
        supabase,
        projectId,
        versionId,
      })

    if (!version) {
      return notFound(
        'The selected Pre-Planning version was not found.'
      )
    }

    const payload =
      await loadPayload({
        supabase,
        projectId,
        versionId,
      })

    return NextResponse.json({
      ok: true,
      ...payload,
    })
  } catch (
    error
  ) {
    console.error(
      'Pre-Planning WBS GET error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'The Pre-Planning WBS could not be loaded.',
      },
      {
        status: 500,
      }
    )
  }
}


export async function POST(
  request
) {
  try {
    const supabase =
      await createClient()

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser()

    if (!user) {
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

    const body =
      await request.json()

    const action =
      String(
        body?.action ||
        ''
      )
        .trim()
        .toLowerCase()

    const projectId =
      String(
        body?.projectId ||
        ''
      ).trim()

    const versionId =
      String(
        body?.versionId ||
        ''
      ).trim()

    if (!projectId) {
      return badRequest(
        'Project ID is required.'
      )
    }

    if (!versionId) {
      return badRequest(
        'Version ID is required.'
      )
    }

    const editableCheck =
      await requireEditableVersion({
        supabase,
        projectId,
        versionId,
      })

    if (
      editableCheck.response
    ) {
      return editableCheck.response
    }

    if (
      action ===
      'add_item'
    ) {
      return await addItem({
        supabase,
        projectId,
        versionId,
        userId:
          user.id,
        body,
      })
    }

    if (
      action ===
      'update_item'
    ) {
      return await updateItem({
        supabase,
        projectId,
        versionId,
        body,
      })
    }

    if (
      action ===
      'set_structure'
    ) {
      return await setStructure({
        supabase,
        projectId,
        versionId,
        body,
      })
    }

    if (
      action ===
      'delete_item'
    ) {
      return await deleteItem({
        supabase,
        projectId,
        versionId,
        body,
      })
    }

    return badRequest(
      'Unsupported Pre-Planning WBS action.'
    )
  } catch (
    error
  ) {
    console.error(
      'Pre-Planning WBS POST error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'The Pre-Planning WBS operation failed.',
      },
      {
        status: 500,
      }
    )
  }
}
