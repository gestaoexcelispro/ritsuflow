import Link from 'next/link'

import {
  createClient,
} from '../../../../lib/supabase/server'

import PrePlanningWorkspace from './PrePlanningWorkspace'


const NAVY = '#052c49'
const TEAL = '#00998b'
const MUTED = '#6b7d8d'
const BORDER = '#dce5ed'


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
    location || null

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
   *
   * Find the deepest Level/Floor node
   * in the allocation path.
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


  /*
   * If the hierarchy does not contain
   * a Level/Floor node, use the parent
   * of the allocation as Location when
   * possible.
   */
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
     * IMPORTANT:
     * allocation.id is the
     * Pre-Planning activity identity.
     */
    id:
      allocation.id,

    allocationId:
      allocation.id,

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
     * These remain available to the
     * calculation layer and inspector
     * logic, but Quantity and Capacity
     * are no longer shown on the page.
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


function applySavedSequence(
  activities,
  sequenceRows
) {
  if (
    !Array.isArray(
      sequenceRows
    ) ||
    sequenceRows.length === 0
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


  /*
   * Newly allocated activities that
   * did not exist when the version was
   * last saved are appended rather than
   * silently discarded.
   */
  return [
    ...sequenced.map(
      (item) =>
        item.activity
    ),
    ...unsequenced,
  ]
}


function ProjectSelector({
  projects,
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
                href={`/dashboard/planning/pre-planning?projectId=${project.id}`}
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


export default async function PrePlanningPage({
  searchParams,
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


  const {
    data: projectsData,
    error: projectsError,
  } =
    await supabase
      .from('projects')
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
      />
    )
  }


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


  const versions =
    versionsResult.data ||
    []


  const currentVersion =
    versions.find(
      (version) =>
        version.is_current
    ) ||
    null


  let sequenceRows = []


  if (
    currentVersion
  ) {
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
          selectedProject.id
        )
        .eq(
          'version_id',
          currentVersion.id
        )
        .order(
          'sequence_number',
          {
            ascending: true,
          }
        )


    if (error) {
      console.error(
        'Current Pre-Planning sequence could not be loaded.',
        error
      )
    } else {
      sequenceRows =
        data ||
        []
    }
  }


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


  const orderedActivities =
    applySavedSequence(
      defaultActivities,
      sequenceRows
    )


  const targetTakt =
    Number(
      settings?.target_takt_days
    )


  return (
    <PrePlanningWorkspace
      project={
        selectedProject
      }

      activities={
        orderedActivities
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

      activeVersion={
        currentVersion
          ? {
              id:
                currentVersion.id,

              versionNumber:
                Number(
                  currentVersion.version_number
                ),

              versionName:
                currentVersion.version_name ||
                `Version ${currentVersion.version_number}`,

              status:
                currentVersion.status,

              updatedAt:
                currentVersion.updated_at,
            }
          : null
      }

      versionCount={
        versions.length
      }

      changeProjectHref="/dashboard/planning/pre-planning"
    />
  )
}
