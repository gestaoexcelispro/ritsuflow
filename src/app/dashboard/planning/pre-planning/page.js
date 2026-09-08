import Link from 'next/link'

import {
  createClient,
} from '../../../../lib/supabase/server'

import PrePlanningWorkspace from './PrePlanningWorkspace'


const NAVY = '#052c49'
const TEAL = '#00998b'
const MUTED = '#6b7d8d'
const BORDER = '#dce5ed'


/* =========================================================
   LOCATION HELPERS
   ========================================================= */

function buildLocationMap(
  locations
) {
  return new Map(
    locations.map(
      (location) => [
        location.id,
        location,
      ]
    )
  )
}


function locationTypeLabel(
  value
) {
  const labels = {
    project: 'Project',
    building: 'Building',
    floor: 'Level',
    level: 'Level',
    division: 'Level',
    zone: 'Zone',
    area: 'Area',
    room: 'Room',
    custom: 'Custom',
  }


  return (
    labels[value] ||
    value ||
    'Division'
  )
}


function getLocationChain(
  location,
  locationMap
) {
  const chain = []
  const visited = new Set()

  let cursor =
    location ||
    null


  while (
    cursor &&
    !visited.has(
      cursor.id
    )
  ) {
    visited.add(
      cursor.id
    )


    chain.unshift(
      cursor
    )


    cursor =
      cursor.parent_id
        ? locationMap.get(
            cursor.parent_id
          )
        : null
  }


  return chain
}


function resolveProductionLocation(
  allocationLocation,
  locationMap
) {
  if (
    !allocationLocation
  ) {
    return {
      locationId: null,
      locationName: '—',
      divisionId: null,
      divisionName: '—',
      divisionType: '',
      locationPath: '—',
    }
  }


  const chain =
    getLocationChain(
      allocationLocation,
      locationMap
    )


  const locationPath =
    chain
      .map(
        (location) =>
          location.name
      )
      .filter(Boolean)
      .join(' / ')


  /*
   * Pre-Planning terminology:
   *
   * Location = production level
   * Division = child production area
   */
  let productionLocationIndex =
    -1


  for (
    let index = 0;
    index < chain.length;
    index += 1
  ) {
    const type =
      chain[
        index
      ]?.location_type


    if (
      type === 'floor' ||
      type === 'level' ||
      type === 'division'
    ) {
      productionLocationIndex =
        index
    }
  }


  if (
    productionLocationIndex <
    0
  ) {
    productionLocationIndex =
      chain.length > 1
        ? chain.length - 2
        : chain.length - 1
  }


  const locationNode =
    chain[
      productionLocationIndex
    ] ||
    allocationLocation


  const divisionNodes =
    chain.slice(
      productionLocationIndex +
        1
    )


  const divisionNode =
    divisionNodes.length > 0
      ? divisionNodes[
          divisionNodes.length -
            1
        ]
      : null


  const divisionName =
    divisionNodes.length > 0
      ? divisionNodes
          .map(
            (node) =>
              node.name
          )
          .filter(Boolean)
          .join(' / ')
      : '—'


  return {
    locationId:
      locationNode.id,

    locationName:
      locationNode.name ||
      '—',

    divisionId:
      divisionNode?.id ||
      null,

    divisionName,

    divisionType:
      divisionNode
        ? locationTypeLabel(
            divisionNode.location_type
          )
        : '',

    locationPath,
  }
}


/* =========================================================
   ACTIVITY CALCULATION
   ========================================================= */

function calculateActivity({
  allocation,
  scopeItem,
  workPackage,
  parameter,
  location,
  locationMap,
}) {
  const quantity =
    Number(
      allocation?.quantity ||
      0
    )


  const productivity =
    Number(
      parameter?.productivity_rate
    )


  const effectiveWorkforce =
    Number(
      parameter?.effective_workforce
    )


  const productivityBasis =
    parameter?.productivity_basis ||
    'worker_day'


  const hasProductivity =
    Number.isFinite(
      productivity
    ) &&
    productivity > 0


  const hasWorkforce =
    Number.isFinite(
      effectiveWorkforce
    ) &&
    effectiveWorkforce > 0


  const productionCapacity =
    hasProductivity &&
    hasWorkforce
      ? productivity *
        effectiveWorkforce
      : null


  const rawDuration =
    productionCapacity &&
    quantity > 0
      ? quantity /
        productionCapacity
      : null


  const locationPresentation =
    resolveProductionLocation(
      location,
      locationMap
    )


  return {
    /*
     * allocation.id is the Pre-Planning
     * production activity identity.
     */
    id:
      allocation.id,

    allocationId:
      allocation.id,

    /*
     * Stable Scope Item identity.
     */
    serviceId:
      scopeItem.id,

    serviceSequence:
      Number(
        scopeItem.sequence_number ||
        0
      ),

    workPackageId:
      scopeItem.project_work_package_id,

    workPackageCode:
      workPackage?.code ||
      '—',

    workPackageColor:
      workPackage?.color ||
      '#00998b',

    scopeItemName:
      scopeItem?.service_name ||
      'Scope Item',

    unit:
      scopeItem?.unit ||
      parameter?.quantity_unit ||
      'unit',

    /*
     * Quantity remains internal to
     * Pre-Planning calculations.
     */
    quantity,

    productivity:
      hasProductivity
        ? productivity
        : null,

    productivityBasis,

    effectiveWorkforce:
      hasWorkforce
        ? effectiveWorkforce
        : null,

    productionCapacity,

    rawDuration,

    allocationLocationId:
      location?.id ||
      null,

    ...locationPresentation,
  }
}


/* =========================================================
   DEFAULT ACTIVITY ORDER
   ========================================================= */

function sortDefaultActivities(
  activities
) {
  return [...activities].sort(
    (
      first,
      second
    ) => {
      const locationDifference =
        String(
          first.locationName ||
          ''
        ).localeCompare(
          String(
            second.locationName ||
            ''
          ),
          undefined,
          {
            numeric: true,
          }
        )


      if (
        locationDifference !==
        0
      ) {
        return locationDifference
      }


      const divisionDifference =
        String(
          first.divisionName ||
          ''
        ).localeCompare(
          String(
            second.divisionName ||
            ''
          ),
          undefined,
          {
            numeric: true,
          }
        )


      if (
        divisionDifference !==
        0
      ) {
        return divisionDifference
      }


      const serviceDifference =
        Number(
          first.serviceSequence ||
          0
        ) -
        Number(
          second.serviceSequence ||
          0
        )


      if (
        serviceDifference !==
        0
      ) {
        return serviceDifference
      }


      return String(
        first.scopeItemName ||
        ''
      ).localeCompare(
        String(
          second.scopeItemName ||
          ''
        )
      )
    }
  )
}


/* =========================================================
   SAVED SEQUENCE
   ========================================================= */

function applySavedSequence(
  activities,
  sequenceRows
) {
  if (
    !Array.isArray(
      sequenceRows
    ) ||
    sequenceRows.length ===
      0
  ) {
    return activities
  }


  const sequenceMap =
    new Map(
      sequenceRows.map(
        (row) => [
          row.allocation_id,
          Number(
            row.sequence_number
          ),
        ]
      )
    )


  const sequenced =
    []

  const unsequenced =
    []


  activities.forEach(
    (activity) => {
      const savedSequence =
        sequenceMap.get(
          activity.id
        )


      if (
        Number.isFinite(
          savedSequence
        )
      ) {
        sequenced.push({
          activity,
          savedSequence,
        })
      } else {
        unsequenced.push(
          activity
        )
      }
    }
  )


  sequenced.sort(
    (
      first,
      second
    ) =>
      first.savedSequence -
      second.savedSequence
  )


  return [
    ...sequenced.map(
      (item) =>
        item.activity
    ),
    ...unsequenced,
  ]
}


/* =========================================================
   VERSION HELPERS
   ========================================================= */

function normalizeVersion(
  version
) {
  if (!version) {
    return null
  }


  return {
    id:
      version.id,

    versionNumber:
      Number(
        version.version_number
      ),

    versionName:
      version.version_name ||
      `Version ${version.version_number}`,

    status:
      version.status,

    isCurrent:
      Boolean(
        version.is_current
      ),

    createdAt:
      version.created_at ||
      null,

    updatedAt:
      version.updated_at ||
      null,
  }
}


function buildVersionSequenceMap(
  rows
) {
  const grouped =
    new Map()


  ;(
    rows ||
    []
  ).forEach(
    (row) => {
      if (
        !row.version_id ||
        !row.allocation_id
      ) {
        return
      }


      if (
        !grouped.has(
          row.version_id
        )
      ) {
        grouped.set(
          row.version_id,
          []
        )
      }


      grouped
        .get(
          row.version_id
        )
        .push({
          allocationId:
            row.allocation_id,

          sequenceNumber:
            Number(
              row.sequence_number
            ),
        })
    }
  )


  const result = {}


  grouped.forEach(
    (
      sequence,
      versionId
    ) => {
      result[
        versionId
      ] =
        [...sequence]
          .sort(
            (
              first,
              second
            ) =>
              first.sequenceNumber -
              second.sequenceNumber
          )
    }
  )


  return result
}


/* =========================================================
   DURATION STRATEGY HELPERS
   ========================================================= */

function buildVersionDurationStrategyMap(
  rows
) {
  const result = {}


  ;(
    rows ||
    []
  ).forEach(
    (row) => {
      const versionId =
        row.version_id


      const allocationId =
        row.allocation_id


      if (
        !versionId ||
        !allocationId
      ) {
        return
      }


      if (
        !result[
          versionId
        ]
      ) {
        result[
          versionId
        ] = {}
      }


      const desiredDuration =
        Number(
          row.desired_duration
        )


      result[
        versionId
      ][
        allocationId
      ] =
        Number.isFinite(
          desiredDuration
        ) &&
        desiredDuration >
          0
          ? desiredDuration
          : null
    }
  )


  return result
}


/* =========================================================
   PROJECT SELECTOR
   ========================================================= */

function ProjectSelector({
  projects,
  baseHref = '/dashboard/planning/pre-planning',
}) {
  return (
    <section
      style={{
        display: 'grid',
        gap: '18px',
      }}
    >
      <div
        style={{
          padding: '22px',
          border:
            `1px solid ${BORDER}`,
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <h2
          style={{
            margin: 0,
            color: NAVY,
            fontSize: '22px',
            fontWeight: 900,
          }}
        >
          Pre-Planning
        </h2>


        <p
          style={{
            maxWidth: '800px',
            margin: '8px 0 0',
            color: MUTED,
            fontSize: '13px',
            lineHeight: 1.55,
          }}
        >
          Select a project to review calculated production durations and define the preliminary production sequence.
        </p>
      </div>


      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px',
        }}
      >
        {projects.length >
        0 ? (
          projects.map(
            (project) => (
              <Link
                key={
                  project.id
                }
                href={`${baseHref}?projectId=${project.id}`}
                style={{
                  display: 'block',
                  padding: '18px',
                  border:
                    `1px solid ${BORDER}`,
                  borderRadius: '12px',
                  background: '#ffffff',
                  color: 'inherit',
                  textDecoration:
                    'none',
                }}
              >
                <div
                  style={{
                    color: TEAL,
                    fontSize: '11px',
                    fontWeight: 900,
                  }}
                >
                  {
                    project.code
                  }
                </div>


                <div
                  style={{
                    marginTop: '5px',
                    color: NAVY,
                    fontSize: '15px',
                    fontWeight: 900,
                  }}
                >
                  {
                    project.name
                  }
                </div>


                <div
                  style={{
                    marginTop: '10px',
                    color: MUTED,
                    fontSize: '11px',
                  }}
                >
                  Open Pre-Planning
                </div>
              </Link>
            )
          )
        ) : (
          <div
            style={{
              padding: '20px',
              border:
                `1px solid ${BORDER}`,
              borderRadius: '12px',
              background: '#ffffff',
              color: MUTED,
              fontSize: '13px',
            }}
          >
            No accessible projects were found.
          </div>
        )}
      </div>
    </section>
  )
}


/* =========================================================
   PAGE
   ========================================================= */

export default async function PrePlanningPage({
  searchParams,
  standalone = false,
  changeProjectHref = '/dashboard/planning/pre-planning',
}) {
  const params =
    await searchParams


  const selectedProjectId =
    String(
      params?.projectId ||
      ''
    )


  const supabase =
    await createClient()


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()


  if (!user) {
    return (
      <div
        style={{
          padding: '24px',
        }}
      >
        Authentication is required.
      </div>
    )
  }


  /* =======================================================
     PROJECTS
     ======================================================= */

  const {
    data: projectsData,
    error: projectsError,
  } =
    await supabase
      .from(
        'projects'
      )
      .select(
        `
          id,
          code,
          name,
          status
        `
      )
      .order(
        'code',
        {
          ascending: true,
        }
      )


  if (
    projectsError
  ) {
    console.error(
      'Pre-Planning projects could not be loaded.',
      projectsError
    )
  }


  const projects =
    projectsData ||
    []


  const selectedProject =
    projects.find(
      (project) =>
        project.id ===
        selectedProjectId
    ) ||
    null


  if (
    !selectedProject
  ) {
    return (
      <ProjectSelector
        projects={
          projects
        }
        baseHref={
          standalone
            ? '/planning/pre-planning'
            : '/dashboard/planning/pre-planning'
        }
      />
    )
  }


  /* =======================================================
     PROJECT DATA
     ======================================================= */

  const [
    workPackagesResult,
    scopeItemsResult,
    locationsResult,
    allocationsResult,
    productionParametersResult,
    settingsResult,
    versionsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'project_work_packages'
        )
        .select(
          `
            id,
            code,
            description,
            color,
            is_active
          `
        )
        .eq(
          'project_id',
          selectedProject.id
        )
        .order(
          'code',
          {
            ascending: true,
          }
        ),


      supabase
        .from(
          'project_services'
        )
        .select(
          `
            id,
            project_work_package_id,
            service_name,
            unit,
            scope_quantity,
            sequence_number,
            is_active
          `
        )
        .eq(
          'project_id',
          selectedProject.id
        )
        .order(
          'sequence_number',
          {
            ascending: true,
          }
        ),


      supabase
        .from(
          'locations'
        )
        .select(
          `
            id,
            parent_id,
            name,
            location_type,
            sequence_number
          `
        )
        .eq(
          'project_id',
          selectedProject.id
        )
        .order(
          'sequence_number',
          {
            ascending: true,
          }
        ),


      supabase
        .from(
          'location_service_quantities'
        )
        .select(
          `
            id,
            location_id,
            service_id,
            quantity
          `
        )
        .eq(
          'project_id',
          selectedProject.id
        )
        .gt(
          'quantity',
          0
        ),


      supabase
        .from(
          'project_service_production_parameters'
        )
        .select(
          `
            id,
            service_id,
            productivity_rate,
            quantity_unit,
            productivity_basis,
            effective_workforce
          `
        )
        .eq(
          'project_id',
          selectedProject.id
        ),


      supabase
        .from(
          'project_pre_planning_settings'
        )
        .select(
          `
            project_id,
            target_takt_days,
            status,
            approved_at,
            approved_by
          `
        )
        .eq(
          'project_id',
          selectedProject.id
        )
        .maybeSingle(),


      supabase
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
          selectedProject.id
        )
        .order(
          'version_number',
          {
            ascending: false,
          }
        ),
    ])


  const loadErrors = [
    workPackagesResult.error,
    scopeItemsResult.error,
    locationsResult.error,
    allocationsResult.error,
    productionParametersResult.error,
    settingsResult.error,
    versionsResult.error,
  ].filter(Boolean)


  if (
    loadErrors.length >
    0
  ) {
    console.error(
      'Pre-Planning data load errors:',
      loadErrors
    )
  }


  /* =======================================================
     NORMALIZED PROJECT DATA
     ======================================================= */

  const workPackages =
    (
      workPackagesResult.data ||
      []
    ).filter(
      (item) =>
        item.is_active !==
        false
    )


  const scopeItems =
    (
      scopeItemsResult.data ||
      []
    ).filter(
      (item) =>
        item.is_active !==
        false
    )


  const locations =
    locationsResult.data ||
    []


  const allocations =
    allocationsResult.data ||
    []


  const productionParameters =
    productionParametersResult.data ||
    []


  const settings =
    settingsResult.data ||
    null


  const rawVersions =
    versionsResult.data ||
    []


  const currentVersion =
    rawVersions.find(
      (version) =>
        version.is_current
    ) ||
    null


  /* =======================================================
     LOAD VERSION-OWNED DATA
     ======================================================= */

  let allSequenceRows = []

  let allDurationStrategyRows =
    []


  if (
    rawVersions.length >
    0
  ) {
    const [
      sequenceResult,
      durationStrategyResult,
    ] =
      await Promise.all([
        supabase
          .from(
            'project_pre_planning_activity_sequence'
          )
          .select(
            `
              version_id,
              allocation_id,
              sequence_number
            `
          )
          .eq(
            'project_id',
            selectedProject.id
          )
          .order(
            'sequence_number',
            {
              ascending: true,
            }
          ),


        supabase
          .from(
            'project_pre_planning_activity_strategy'
          )
          .select(
            `
              version_id,
              allocation_id,
              desired_duration
            `
          )
          .eq(
            'project_id',
            selectedProject.id
          ),
      ])


    if (
      sequenceResult.error
    ) {
      console.error(
        'Pre-Planning version sequences could not be loaded.',
        sequenceResult.error
      )
    } else {
      allSequenceRows =
        sequenceResult.data ||
        []
    }


    if (
      durationStrategyResult.error
    ) {
      console.error(
        'Pre-Planning duration strategies could not be loaded.',
        durationStrategyResult.error
      )
    } else {
      allDurationStrategyRows =
        durationStrategyResult.data ||
        []
    }
  }


  /* =======================================================
     CURRENT VERSION SEQUENCE
     ======================================================= */

  const currentSequenceRows =
    currentVersion
      ? allSequenceRows.filter(
          (row) =>
            row.version_id ===
            currentVersion.id
        )
      : []


  /* =======================================================
     CLIENT-FRIENDLY VERSION DATA
     ======================================================= */

  const versionSequences =
    buildVersionSequenceMap(
      allSequenceRows
    )


  /*
   * Shape:
   *
   * {
   *   "<version-id>": {
   *     "<allocation-id>": 5,
   *     "<allocation-id>": 7.5
   *   }
   * }
   *
   * This allows PrePlanningWorkspace
   * to instantly load Desired Duration
   * when switching versions.
   */
  const versionDurationStrategies =
    buildVersionDurationStrategyMap(
      allDurationStrategyRows
    )


  const versions =
    rawVersions.map(
      normalizeVersion
    )


  const normalizedCurrentVersion =
    normalizeVersion(
      currentVersion
    )


  /* =======================================================
     LOOKUP MAPS
     ======================================================= */

  const workPackageMap =
    new Map(
      workPackages.map(
        (workPackage) => [
          workPackage.id,
          workPackage,
        ]
      )
    )


  const scopeItemMap =
    new Map(
      scopeItems.map(
        (scopeItem) => [
          scopeItem.id,
          scopeItem,
        ]
      )
    )


  const parameterMap =
    new Map(
      productionParameters.map(
        (parameter) => [
          parameter.service_id,
          parameter,
        ]
      )
    )


  const locationMap =
    buildLocationMap(
      locations
    )


  /* =======================================================
     BUILD ACTIVITIES
     ======================================================= */

  const activities =
    allocations
      .map(
        (allocation) => {
          const scopeItem =
            scopeItemMap.get(
              allocation.service_id
            )


          if (
            !scopeItem
          ) {
            return null
          }


          const location =
            locationMap.get(
              allocation.location_id
            )


          if (
            !location
          ) {
            return null
          }


          return calculateActivity({
            allocation,

            scopeItem,

            workPackage:
              workPackageMap.get(
                scopeItem.project_work_package_id
              ),

            parameter:
              parameterMap.get(
                scopeItem.id
              ),

            location,

            locationMap,
          })
        }
      )
      .filter(Boolean)


  const defaultActivities =
    sortDefaultActivities(
      activities
    )


  /*
   * The initial visible order still uses
   * the CURRENT working version.
   */
  const orderedActivities =
    applySavedSequence(
      defaultActivities,
      currentSequenceRows
    )


  const targetTakt =
    Number(
      settings?.target_takt_days
    )


  /* =======================================================
     WORKSPACE
     ======================================================= */

  return (
    <PrePlanningWorkspace
      project={
        selectedProject
      }

      activities={
        orderedActivities
      }

      /*
       * Complete saved version catalog.
       */
      versions={
        versions
      }

      /*
       * Activity sequence snapshot
       * for each version.
       */
      versionSequences={
        versionSequences
      }

      /*
       * Desired Duration strategy
       * for each version and activity.
       */
      versionDurationStrategies={
        versionDurationStrategies
      }

      /*
       * Explicit current working version.
       */
      currentVersion={
        normalizedCurrentVersion
      }

      /*
       * Backward compatibility.
       */
      activeVersion={
        normalizedCurrentVersion
      }

      targetTakt={
        Number.isFinite(
          targetTakt
        ) &&
        targetTakt > 0
          ? targetTakt
          : null
      }

      strategyStatus={
        settings?.status ||
        'draft'
      }

      versionCount={
        versions.length
      }

      changeProjectHref={
        changeProjectHref
      }

      standalone={
        standalone
      }
    />
  )
}
