import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '../../../../lib/supabase/server'


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


function sequencePayload({
  projectId,
  versionId,
  allocationIds,
  userId,
}) {
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
       * Database order remains simple:
       * 1, 2, 3...
       *
       * The UI displays these as:
       * 0010, 0020, 0030...
       */
      sequence_number:
        index + 1,

      created_by:
        userId,

      updated_at:
        new Date().toISOString(),
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
    backup.length === 0
  ) {
    return
  }


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
          new Date().toISOString(),
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
     * A future migration may move this
     * replacement into a transactional
     * Postgres RPC. For V1 we protect
     * the previous sequence by restoring
     * it when insertion fails.
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
          is_current
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


  return data ||
    null
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
          `Version ${versionNumber}`,

        status:
          'working',

        is_current:
          true,

        created_by:
          userId,

        updated_at:
          new Date().toISOString(),
      })
      .select(
        `
          id,
          project_id,
          version_number,
          version_name,
          status,
          is_current
        `
      )
      .single()


  if (error) {
    throw error
  }


  return {
    version:
      data,

    created:
      true,
  }
}


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
            is_current
          `
        )
        .eq(
          'id',
          requestedVersionId
        )
        .eq(
          'project_id',
          projectId
        )
        .maybeSingle()


    if (error) {
      throw error
    }


    version =
      data ||
      null
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
    return NextResponse.json(
      {
        error:
          'Only the current working version can be edited.',
      },
      {
        status: 409,
      }
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
            new Date().toISOString(),
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

      version: {
        id:
          version.id,

        versionNumber:
          version.version_number,

        versionName:
          version.version_name ||
          `Version ${version.version_number}`,
      },
    })
  } catch (
    error
  ) {
    /*
     * If Version 1 was created by this
     * request but the first sequence save
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


  /*
   * Older version becomes historical.
   */
  if (
    currentVersion
  ) {
    const {
      error:
        archiveError,
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
            new Date().toISOString(),
        })
        .eq(
          'id',
          currentVersion.id
        )
        .eq(
          'project_id',
          projectId
        )


    if (
      archiveError
    ) {
      throw archiveError
    }
  }


  let newVersion =
    null


  try {
    const {
      data,
      error:
        createError,
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
            `Version ${versionNumber}`,

          status:
            'working',

          is_current:
            true,

          created_by:
            userId,

          updated_at:
            new Date().toISOString(),
        })
        .select(
          `
            id,
            version_number,
            version_name,
            status,
            is_current
          `
        )
        .single()


    if (
      createError
    ) {
      throw createError
    }


    newVersion =
      data


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

      version: {
        id:
          newVersion.id,

        versionNumber:
          newVersion.version_number,

        versionName:
          newVersion.version_name ||
          `Version ${newVersion.version_number}`,
      },
    })
  } catch (
    error
  ) {
    /*
     * Roll back the version switch as
     * far as possible if the new version
     * cannot be completed.
     */
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
            new Date().toISOString(),
        })
        .eq(
          'id',
          currentVersion.id
        )
        .eq(
          'project_id',
          projectId
        )
    }


    throw error
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


    const allocationIds =
      normalizeAllocationIds(
        body?.allocationIds
      )


    if (
      !projectId
    ) {
      return NextResponse.json(
        {
          error:
            'Project ID is required.',
        },
        {
          status: 400,
        }
      )
    }


    if (
      allocationIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            'At least one activity is required.',
        },
        {
          status: 400,
        }
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


    return NextResponse.json(
      {
        error:
          'Unsupported Pre-Planning action.',
      },
      {
        status: 400,
      }
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
          'Pre-Planning sequence could not be saved.',
      },
      {
        status: 500,
      }
    )
  }
}
