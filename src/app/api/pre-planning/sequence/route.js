import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '../../../../lib/supabase/server'


/* =========================================================
   NORMALIZATION
   ========================================================= */

function normalizeAllocationIds(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }


  const seen =
    new Set()


  const result = []


  value.forEach(
    (item) => {
      const id =
        String(
          item ||
          ''
        ).trim()


      if (
        !id ||
        seen.has(
          id
        )
      ) {
        return
      }


      seen.add(
        id
      )


      result.push(
        id
      )
    }
  )


  return result
}


function normalizeVersionName(
  value
) {
  return String(
    value ||
    ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      120
    )
}


/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function versionResponse(
  version
) {
  if (!version) {
    return null
  }


  return {
    id:
      version.id,

    projectId:
      version.project_id,

    versionNumber:
      version.version_number,

    versionName:
      version.version_name ||
      `Version ${version.version_number}`,

    status:
      version.status,

    isCurrent:
      Boolean(
        version.is_current
      ),
  }
}


function badRequest(
  message
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status: 400,
    }
  )
}


function conflict(
  message
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status: 409,
    }
  )
}


function notFound(
  message
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status: 404,
    }
  )
}


/* =========================================================
   SEQUENCE HELPERS
   ========================================================= */

function sequencePayload({
  projectId,
  versionId,
  allocationIds,
  userId,
}) {
  const timestamp =
    new Date()
      .toISOString()


  return allocationIds.map(
    (
      allocationId,
      index
    ) => ({
      project_id:
        projectId,

      version_id:
        versionId,

      allocation_id:
        allocationId,

      /*
       * Database order:
       * 1, 2, 3...
       *
       * UI display:
       * 0010, 0020, 0030...
       */
      sequence_number:
        index + 1,

      created_by:
        userId,

      updated_at:
        timestamp,
    })
  )
}


async function restoreSequence({
  supabase,
  projectId,
  versionId,
  backup,
  userId,
}) {
  if (
    !Array.isArray(
      backup
    ) ||
    backup.length ===
      0
  ) {
    return
  }


  const timestamp =
    new Date()
      .toISOString()


  const rows =
    backup.map(
      (row) => ({
        project_id:
          projectId,

        version_id:
          versionId,

        allocation_id:
          row.allocation_id,

        sequence_number:
          row.sequence_number,

        created_by:
          row.created_by ||
          userId,

        updated_at:
          timestamp,
      })
    )


  const {
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_activity_sequence'
      )
      .insert(
        rows
      )


  if (error) {
    console.error(
      'Pre-Planning sequence backup restoration failed.',
      error
    )
  }
}


async function replaceSequence({
  supabase,
  projectId,
  versionId,
  allocationIds,
  userId,
}) {
  const {
    data: backup,
    error:
      backupError,
  } =
    await supabase
      .from(
        'project_pre_planning_activity_sequence'
      )
      .select(
        `
          allocation_id,
          sequence_number,
          created_by
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
        'sequence_number',
        {
          ascending: true,
        }
      )


  if (
    backupError
  ) {
    throw backupError
  }


  const {
    error:
      deleteError,
  } =
    await supabase
      .from(
        'project_pre_planning_activity_sequence'
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


  if (
    deleteError
  ) {
    throw deleteError
  }


  if (
    allocationIds.length ===
    0
  ) {
    return
  }


  const rows =
    sequencePayload({
      projectId,
      versionId,
      allocationIds,
      userId,
    })


  const {
    error:
      insertError,
  } =
    await supabase
      .from(
        'project_pre_planning_activity_sequence'
      )
      .insert(
        rows
      )


  if (
    insertError
  ) {
    /*
     * Best-effort recovery.
     *
     * A future Postgres RPC can make this
     * replacement fully transactional.
     */
    await restoreSequence({
      supabase,
      projectId,
      versionId,
      backup:
        backup ||
        [],
      userId,
    })


    throw insertError
  }
}


async function getStoredSequence({
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
        'project_pre_planning_activity_sequence'
      )
      .select(
        `
          allocation_id,
          sequence_number
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
        'sequence_number',
        {
          ascending: true,
        }
      )


  if (error) {
    throw error
  }


  return (
    data ||
    []
  ).map(
    (row) =>
      row.allocation_id
  )
}


/* =========================================================
   VERSION QUERIES
   ========================================================= */

async function getVersion({
  supabase,
  projectId,
  versionId,
}) {
  if (
    !versionId
  ) {
    return null
  }


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
          version_number,
          version_name,
          status,
          is_current,
          created_at,
          updated_at
        `
      )
      .eq(
        'id',
        versionId
      )
      .eq(
        'project_id',
        projectId
      )
      .maybeSingle()


  if (error) {
    throw error
  }


  return (
    data ||
    null
  )
}


async function getCurrentVersion({
  supabase,
  projectId,
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
          version_number,
          version_name,
          status,
          is_current,
          created_at,
          updated_at
        `
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'is_current',
        true
      )
      .maybeSingle()


  if (error) {
    throw error
  }


  return (
    data ||
    null
  )
}


async function getNextVersionNumber({
  supabase,
  projectId,
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
        'version_number'
      )
      .eq(
        'project_id',
        projectId
      )
      .order(
        'version_number',
        {
          ascending: false,
        }
      )
      .limit(
        1
      )


  if (error) {
    throw error
  }


  const currentMaximum =
    Number(
      data?.[0]
        ?.version_number ||
      0
    )


  return (
    currentMaximum +
    1
  )
}


async function createVersionRecord({
  supabase,
  projectId,
  versionNumber,
  versionName,
  userId,
  isCurrent,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_versions'
      )
      .insert({
        project_id:
          projectId,

        version_number:
          versionNumber,

        version_name:
          versionName ||
          `Version ${versionNumber}`,

        status:
          isCurrent
            ? 'working'
            : 'archived',

        is_current:
          isCurrent,

        created_by:
          userId,

        updated_at:
          new Date()
            .toISOString(),
      })
      .select(
        `
          id,
          project_id,
          version_number,
          version_name,
          status,
          is_current,
          created_at,
          updated_at
        `
      )
      .single()


  if (error) {
    throw error
  }


  return data
}


async function archiveVersion({
  supabase,
  projectId,
  versionId,
}) {
  const {
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_versions'
      )
      .update({
        status:
          'archived',

        is_current:
          false,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'id',
        versionId
      )


  if (error) {
    throw error
  }
}


async function activateVersion({
  supabase,
  projectId,
  versionId,
}) {
  const {
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_versions'
      )
      .update({
        status:
          'working',

        is_current:
          true,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'id',
        versionId
      )


  if (error) {
    throw error
  }
}


/* =========================================================
   INITIAL VERSION
   ========================================================= */

async function createInitialVersion({
  supabase,
  projectId,
  userId,
}) {
  const existingCurrent =
    await getCurrentVersion({
      supabase,
      projectId,
    })


  if (
    existingCurrent
  ) {
    return {
      version:
        existingCurrent,

      created:
        false,
    }
  }


  const versionNumber =
    await getNextVersionNumber({
      supabase,
      projectId,
    })


  const version =
    await createVersionRecord({
      supabase,
      projectId,
      versionNumber,
      versionName:
        `Version ${versionNumber}`,
      userId,
      isCurrent:
        true,
    })


  return {
    version,

    created:
      true,
  }
}


/* =========================================================
   SAVE CURRENT VERSION
   ========================================================= */

async function handleSaveSequence({
  supabase,
  projectId,
  requestedVersionId,
  allocationIds,
  userId,
}) {
  let version =
    null


  let createdVersion =
    false


  if (
    requestedVersionId
  ) {
    version =
      await getVersion({
        supabase,
        projectId,
        versionId:
          requestedVersionId,
      })
  }


  if (
    !version
  ) {
    const initial =
      await createInitialVersion({
        supabase,
        projectId,
        userId,
      })


    version =
      initial.version


    createdVersion =
      initial.created
  }


  if (
    version.status !==
      'working' ||
    !version.is_current
  ) {
    return conflict(
      'Only the current working version can be edited.'
    )
  }


  try {
    await replaceSequence({
      supabase,
      projectId,
      versionId:
        version.id,
      allocationIds,
      userId,
    })


    const {
      error:
        versionUpdateError,
    } =
      await supabase
        .from(
          'project_pre_planning_versions'
        )
        .update({
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          version.id
        )
        .eq(
          'project_id',
          projectId
        )


    if (
      versionUpdateError
    ) {
      throw versionUpdateError
    }


    return NextResponse.json({
      ok: true,

      action:
        'save',

      version:
        versionResponse(
          version
        ),
    })
  } catch (
    error
  ) {
    /*
     * If the first version was created
     * by this request but the sequence
     * failed, remove the empty version.
     */
    if (
      createdVersion
    ) {
      await supabase
        .from(
          'project_pre_planning_versions'
        )
        .delete()
        .eq(
          'id',
          version.id
        )
        .eq(
          'project_id',
          projectId
        )
    }


    throw error
  }
}


/* =========================================================
   CREATE VERSION FROM CURRENT BROWSER SEQUENCE
   ========================================================= */

async function handleCreateVersion({
  supabase,
  projectId,
  allocationIds,
  userId,
}) {
  const currentVersion =
    await getCurrentVersion({
      supabase,
      projectId,
    })


  const versionNumber =
    await getNextVersionNumber({
      supabase,
      projectId,
    })


  if (
    currentVersion
  ) {
    await archiveVersion({
      supabase,
      projectId,
      versionId:
        currentVersion.id,
    })
  }


  let newVersion =
    null


  try {
    newVersion =
      await createVersionRecord({
        supabase,
        projectId,
        versionNumber,
        versionName:
          `Version ${versionNumber}`,
        userId,
        isCurrent:
          true,
      })


    await replaceSequence({
      supabase,
      projectId,
      versionId:
        newVersion.id,
      allocationIds,
      userId,
    })


    return NextResponse.json({
      ok: true,

      action:
        'create_version',

      version:
        versionResponse(
          newVersion
        ),
    })
  } catch (
    error
  ) {
    if (
      newVersion?.id
    ) {
      await supabase
        .from(
          'project_pre_planning_versions'
        )
        .delete()
        .eq(
          'id',
          newVersion.id
        )
        .eq(
          'project_id',
          projectId
        )
    }


    if (
      currentVersion?.id
    ) {
      await activateVersion({
        supabase,
        projectId,
        versionId:
          currentVersion.id,
      })
    }


    throw error
  }
}


/* =========================================================
   DUPLICATE SELECTED VERSION
   ========================================================= */

async function handleDuplicateVersion({
  supabase,
  projectId,
  sourceVersionId,
  userId,
}) {
  if (
    !sourceVersionId
  ) {
    return badRequest(
      'A source version is required.'
    )
  }


  const sourceVersion =
    await getVersion({
      supabase,
      projectId,
      versionId:
        sourceVersionId,
    })


  if (
    !sourceVersion
  ) {
    return notFound(
      'The selected source version was not found.'
    )
  }


  const sourceAllocationIds =
    await getStoredSequence({
      supabase,
      projectId,
      versionId:
        sourceVersion.id,
    })


  if (
    sourceAllocationIds.length ===
    0
  ) {
    return conflict(
      'The selected version has no saved sequence to duplicate.'
    )
  }


  const currentVersion =
    await getCurrentVersion({
      supabase,
      projectId,
    })


  const versionNumber =
    await getNextVersionNumber({
      supabase,
      projectId,
    })


  if (
    currentVersion
  ) {
    await archiveVersion({
      supabase,
      projectId,
      versionId:
        currentVersion.id,
    })
  }


  let newVersion =
    null


  try {
    newVersion =
      await createVersionRecord({
        supabase,
        projectId,
        versionNumber,
        versionName:
          `Version ${versionNumber}`,
        userId,
        isCurrent:
          true,
      })


    await replaceSequence({
      supabase,
      projectId,
      versionId:
        newVersion.id,
      allocationIds:
        sourceAllocationIds,
      userId,
    })


    return NextResponse.json({
      ok: true,

      action:
        'duplicate_version',

      sourceVersion:
        versionResponse(
          sourceVersion
        ),

      version:
        versionResponse(
          newVersion
        ),
    })
  } catch (
    error
  ) {
    if (
      newVersion?.id
    ) {
      await supabase
        .from(
          'project_pre_planning_versions'
        )
        .delete()
        .eq(
          'id',
          newVersion.id
        )
        .eq(
          'project_id',
          projectId
        )
    }


    if (
      currentVersion?.id
    ) {
      await activateVersion({
        supabase,
        projectId,
        versionId:
          currentVersion.id,
      })
    }


    throw error
  }
}


/* =========================================================
   RENAME VERSION
   ========================================================= */

async function handleRenameVersion({
  supabase,
  projectId,
  versionId,
  versionName,
}) {
  if (
    !versionId
  ) {
    return badRequest(
      'Version ID is required.'
    )
  }


  const normalizedName =
    normalizeVersionName(
      versionName
    )


  if (
    !normalizedName
  ) {
    return badRequest(
      'Version name is required.'
    )
  }


  const version =
    await getVersion({
      supabase,
      projectId,
      versionId,
    })


  if (
    !version
  ) {
    return notFound(
      'The selected version was not found.'
    )
  }


  const {
    data,
    error,
  } =
    await supabase
      .from(
        'project_pre_planning_versions'
      )
      .update({
        version_name:
          normalizedName,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'id',
        versionId
      )
      .select(
        `
          id,
          project_id,
          version_number,
          version_name,
          status,
          is_current,
          created_at,
          updated_at
        `
      )
      .single()


  if (error) {
    throw error
  }


  return NextResponse.json({
    ok: true,

    action:
      'rename_version',

    version:
      versionResponse(
        data
      ),
  })
}


/* =========================================================
   SET SELECTED VERSION AS CURRENT
   ========================================================= */

async function handleSetCurrentVersion({
  supabase,
  projectId,
  versionId,
}) {
  if (
    !versionId
  ) {
    return badRequest(
      'Version ID is required.'
    )
  }


  const selectedVersion =
    await getVersion({
      supabase,
      projectId,
      versionId,
    })


  if (
    !selectedVersion
  ) {
    return notFound(
      'The selected version was not found.'
    )
  }


  if (
    selectedVersion.is_current
  ) {
    return NextResponse.json({
      ok: true,

      action:
        'set_current',

      version:
        versionResponse(
          selectedVersion
        ),
    })
  }


  const currentVersion =
    await getCurrentVersion({
      supabase,
      projectId,
    })


  /*
   * Because the database has a partial
   * unique index allowing only one current
   * version per project, archive the old
   * current version before activating the
   * selected one.
   */
  if (
    currentVersion?.id
  ) {
    await archiveVersion({
      supabase,
      projectId,
      versionId:
        currentVersion.id,
    })
  }


  try {
    await activateVersion({
      supabase,
      projectId,
      versionId:
        selectedVersion.id,
    })


    const activatedVersion =
      await getVersion({
        supabase,
        projectId,
        versionId:
          selectedVersion.id,
      })


    return NextResponse.json({
      ok: true,

      action:
        'set_current',

      version:
        versionResponse(
          activatedVersion
        ),
    })
  } catch (
    error
  ) {
    /*
     * Best-effort restoration of the
     * previous current version.
     */
    if (
      currentVersion?.id
    ) {
      await activateVersion({
        supabase,
        projectId,
        versionId:
          currentVersion.id,
      })
    }


    throw error
  }
}


/* =========================================================
   DELETE HISTORICAL VERSION
   ========================================================= */

async function handleDeleteVersion({
  supabase,
  projectId,
  versionId,
}) {
  if (
    !versionId
  ) {
    return badRequest(
      'Version ID is required.'
    )
  }


  const version =
    await getVersion({
      supabase,
      projectId,
      versionId,
    })


  if (
    !version
  ) {
    return notFound(
      'The selected version was not found.'
    )
  }


  if (
    version.is_current
  ) {
    return conflict(
      'The current working version cannot be deleted. Make another version current first.'
    )
  }


  /*
   * Explicitly delete sequence rows first.
   *
   * This keeps the behavior clear even if
   * the FK is not configured with CASCADE.
   */
  const {
    error:
      sequenceDeleteError,
  } =
    await supabase
      .from(
        'project_pre_planning_activity_sequence'
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


  if (
    sequenceDeleteError
  ) {
    throw sequenceDeleteError
  }


  const {
    error:
      versionDeleteError,
  } =
    await supabase
      .from(
        'project_pre_planning_versions'
      )
      .delete()
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'id',
        versionId
      )


  if (
    versionDeleteError
  ) {
    throw versionDeleteError
  }


  return NextResponse.json({
    ok: true,

    action:
      'delete_version',

    deletedVersionId:
      versionId,
  })
}


/* =========================================================
   POST
   ========================================================= */

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


    const requestedVersionId =
      body?.versionId
        ? String(
            body.versionId
          ).trim()
        : ''


    const sourceVersionId =
      body?.sourceVersionId
        ? String(
            body.sourceVersionId
          ).trim()
        : ''


    const allocationIds =
      normalizeAllocationIds(
        body?.allocationIds
      )


    if (
      !projectId
    ) {
      return badRequest(
        'Project ID is required.'
      )
    }


    /*
     * Only these two actions require
     * activity IDs from the browser.
     *
     * Duplicate uses the stored source
     * version sequence instead.
     */
    if (
      (
        action ===
          'save' ||
        action ===
          'create_version'
      ) &&
      allocationIds.length ===
        0
    ) {
      return badRequest(
        'At least one activity is required.'
      )
    }


    if (
      action ===
      'save'
    ) {
      return await handleSaveSequence({
        supabase,
        projectId,
        requestedVersionId,
        allocationIds,
        userId:
          user.id,
      })
    }


    if (
      action ===
      'create_version'
    ) {
      return await handleCreateVersion({
        supabase,
        projectId,
        allocationIds,
        userId:
          user.id,
      })
    }


    if (
      action ===
      'duplicate_version'
    ) {
      return await handleDuplicateVersion({
        supabase,
        projectId,
        sourceVersionId:
          sourceVersionId ||
          requestedVersionId,
        userId:
          user.id,
      })
    }


    if (
      action ===
      'rename_version'
    ) {
      return await handleRenameVersion({
        supabase,
        projectId,
        versionId:
          requestedVersionId,
        versionName:
          body?.versionName,
      })
    }


    if (
      action ===
      'set_current'
    ) {
      return await handleSetCurrentVersion({
        supabase,
        projectId,
        versionId:
          requestedVersionId,
      })
    }


    if (
      action ===
      'delete_version'
    ) {
      return await handleDeleteVersion({
        supabase,
        projectId,
        versionId:
          requestedVersionId,
      })
    }


    return badRequest(
      'Unsupported Pre-Planning action.'
    )
  } catch (
    error
  ) {
    console.error(
      'Pre-Planning sequence API error:',
      error
    )


    return NextResponse.json(
      {
        error:
          error?.message ||
          'Pre-Planning version operation failed.',
      },
      {
        status: 500,
      }
    )
  }
}
