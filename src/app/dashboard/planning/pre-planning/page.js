import Link from 'next/link'

import {
  createClient,
} from '../../../../lib/supabase/server'

import PrePlanningWorkspace from './PrePlanningWorkspace'


const NAVY = '#052c49'
const TEAL = '#00998b'
const MUTED = '#6b7d8d'
const BORDER = '#dce5ed'
const DANGER = '#b42318'


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


function buildLocationPath(
  location,
  locationMap
) {
  if (!location) {
    return '—'
  }

  const parts = []
  const visited =
    new Set()

  let cursor =
    location

  while (
    cursor &&
    !visited.has(
      cursor.id
    )
  ) {
    visited.add(
      cursor.id
    )

    if (
      cursor.name
    ) {
      parts.unshift(
        cursor.name
      )
    }

    cursor =
      cursor.parent_id
        ? locationMap.get(
            cursor.parent_id
          )
        : null
  }

  return (
    parts.join(' / ') ||
    location.name ||
    'Location'
  )
}


function buildLocationDepth(
  location,
  locationMap
) {
  let depth = 0

  const visited =
    new Set()

  let cursor =
    location

  while (
    cursor?.parent_id &&
    !visited.has(
      cursor.parent_id
    )
  ) {
    visited.add(
      cursor.parent_id
    )

    depth += 1

    cursor =
      locationMap.get(
        cursor.parent_id
      )
  }

  return depth
}


function compareLocations(
  first,
  second,
  locationMap
) {
  if (
    !first &&
    !second
  ) {
    return 0
  }

  if (!first) {
    return 1
  }

  if (!second) {
    return -1
  }

  const firstDepth =
    buildLocationDepth(
      first,
      locationMap
    )

  const secondDepth =
    buildLocationDepth(
      second,
      locationMap
    )

  if (
    firstDepth !==
    secondDepth
  ) {
    return (
      firstDepth -
      secondDepth
    )
  }

  const sequenceDifference =
    Number(
      first.sequence_number ||
      0
    ) -
    Number(
      second.sequence_number ||
      0
    )

  if (
    sequenceDifference !==
    0
  ) {
    return sequenceDifference
  }

  return buildLocationPath(
    first,
    locationMap
  ).localeCompare(
    buildLocationPath(
      second,
      locationMap
    )
  )
}


/* =========================================================
   PRODUCTION CALCULATION
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
      parameter
        ?.productivity_rate
    )

  const effectiveWorkforce =
    Number(
      parameter
        ?.effective_workforce
    )

  const productivityBasis =
    parameter
      ?.productivity_basis ||
    'worker_day'

  const hasProductivity =
    Number.isFinite(
      productivity
    ) &&
    productivity > 0

  const hasEffectiveResource =
    Number.isFinite(
      effectiveWorkforce
    ) &&
    effectiveWorkforce > 0

  /*
   * Existing RitsuFlow Production Parameters logic:
   *
   * worker_day:
   * productivity × effective workers
   *
   * crew_day:
   * productivity × effective crews
   *
   * Raw Duration:
   * quantity ÷ production capacity
   */

  const productionCapacity =
    hasProductivity &&
    hasEffectiveResource
      ? productivity *
        effectiveWorkforce
      : null

  const rawDuration =
    Number.isFinite(
      productionCapacity
    ) &&
    productionCapacity > 0 &&
    quantity > 0
      ? quantity /
        productionCapacity
      : null

  return {
    /*
     * One activity =
     * Scope Item × Location allocation.
     *
     * allocation.id is therefore
     * the correct V1 activity identity.
     */
    id:
      allocation.id,

    serviceId:
      scopeItem.id,

    locationId:
      location.id,

    workPackageId:
      scopeItem
        .project_work_package_id,

    workPackageCode:
      workPackage?.code ||
      '—',

    workPackageName:
      workPackage
        ?.description ||
      'Work Package',

    workPackageColor:
      workPackage?.color ||
      TEAL,

    scopeItemName:
      scopeItem
        ?.service_name ||
      'Scope Item',

    scopeSequence:
      Number(
        scopeItem
          ?.sequence_number ||
        0
      ),

    locationPath:
      buildLocationPath(
        location,
        locationMap
      ),

    locationSequence:
      Number(
        location
          ?.sequence_number ||
        0
      ),

    quantity,

    unit:
      scopeItem?.unit ||
      parameter
        ?.quantity_unit ||
      'unit',

    productivity:
      hasProductivity
        ? productivity
        : null,

    productivityBasis,

    effectiveWorkforce:
      hasEffectiveResource
        ? effectiveWorkforce
        : null,

    productionCapacity,

    rawDuration,

    complete:
      Boolean(
        productionCapacity &&
        rawDuration
      ),
  }
}


/* =========================================================
   PROJECT SELECTOR
   ========================================================= */

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
          padding:
            '22px',
          border:
            `1px solid ${BORDER}`,
          borderRadius:
            '12px',
          background:
            '#ffffff',
        }}
      >
        <div
          style={{
            color: TEAL,
            fontSize:
              '10px',
            fontWeight:
              900,
            letterSpacing:
              '0.08em',
            textTransform:
              'uppercase',
          }}
        >
          Planning
        </div>

        <h1
          style={{
            margin:
              '7px 0 0',
            color: NAVY,
            fontSize:
              '22px',
            fontWeight:
              900,
          }}
        >
          Pre-Planning
        </h1>

        <p
          style={{
            maxWidth:
              '820px',
            margin:
              '8px 0 0',
            color: MUTED,
            fontSize:
              '13px',
            lineHeight:
              1.55,
          }}
        >
          Select a project to visualize its existing production data before detailed planning begins.
        </p>
      </div>


      {projects.length >
      0 ? (
        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(270px, 1fr))',
            gap: '12px',
          }}
        >
          {projects.map(
            (
              project
            ) => (
              <Link
                key={
                  project.id
                }
                href={`/dashboard/planning/pre-planning?projectId=${encodeURIComponent(
                  project.id
                )}`}
                style={{
                  display:
                    'grid',
                  gap: '6px',
                  padding:
                    '18px',
                  border:
                    `1px solid ${BORDER}`,
                  borderRadius:
                    '10px',
                  background:
                    '#ffffff',
                  color:
                    'inherit',
                  textDecoration:
                    'none',
                }}
              >
                <div
                  style={{
                    color:
                      TEAL,
                    fontSize:
                      '10px',
                    fontWeight:
                      900,
                    letterSpacing:
                      '0.05em',
                    textTransform:
                      'uppercase',
                  }}
                >
                  {project.code ||
                    'PROJECT'}
                </div>

                <div
                  style={{
                    color:
                      NAVY,
                    fontSize:
                      '15px',
                    fontWeight:
                      900,
                  }}
                >
                  {project.name}
                </div>

                <div
                  style={{
                    marginTop:
                      '5px',
                    color:
                      MUTED,
                    fontSize:
                      '10px',
                    fontWeight:
                      700,
                  }}
                >
                  Open Pre-Planning
                </div>
              </Link>
            )
          )}
        </div>
      ) : (
        <div
          style={{
            padding:
              '20px',
            border:
              `1px solid ${BORDER}`,
            borderRadius:
              '10px',
            background:
              '#ffffff',
            color: MUTED,
            fontSize:
              '13px',
          }}
        >
          No accessible projects were found.
        </div>
      )}
    </section>
  )
}


/* =========================================================
   PAGE
   ========================================================= */

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


  /* ---------------------------------------------------------
     AUTHENTICATION
     --------------------------------------------------------- */

  const {
    data: {
      user,
    },
  } =
    await supabase
      .auth
      .getUser()

  if (!user) {
    return (
      <div
        style={{
          padding:
            '24px',
          border:
            `1px solid ${BORDER}`,
          borderRadius:
            '10px',
          background:
            '#ffffff',
          color:
            MUTED,
          fontSize:
            '13px',
        }}
      >
        Authentication is required.
      </div>
    )
  }


  /* ---------------------------------------------------------
     PROJECTS
     --------------------------------------------------------- */

  const {
    data:
      projectsData,
    error:
      projectsError,
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
          ascending:
            true,
        }
      )


  if (
    projectsError
  ) {
    console.error(
      'Pre-Planning projects could not be loaded.',
      projectsError
    )

    return (
      <div
        style={{
          padding:
            '20px',
          border:
            '1px solid #fecaca',
          borderRadius:
            '10px',
          background:
            '#fef2f2',
          color:
            DANGER,
          fontSize:
            '13px',
          fontWeight:
            700,
        }}
      >
        Projects could not be loaded.
      </div>
    )
  }


  const projects =
    projectsData ||
    []


  const selectedProject =
    projects.find(
      (
        project
      ) =>
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


  /* ---------------------------------------------------------
     PRE-PLANNING DATA
     --------------------------------------------------------- */

  const [
    workPackagesResult,
    scopeItemsResult,
    locationsResult,
    allocationsResult,
    productionParametersResult,
    settingsResult,
  ] =
    await Promise.all(
      [
        /*
         * Work Packages
         */
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
              ascending:
                true,
            }
          ),


        /*
         * Scope Items
         */
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
              ascending:
                true,
            }
          ),


        /*
         * Location Structure
         */
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
              ascending:
                true,
            }
          ),


        /*
         * Scope quantities allocated
         * to production locations.
         */
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


        /*
         * Existing Production Parameters.
         *
         * Pre-Planning consumes these.
         * It does not duplicate them.
         */
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


        /*
         * Existing Target Takt / approval status.
         *
         * V1 only displays this information.
         */
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
      ]
    )


  const loadErrors =
    [
      workPackagesResult.error,
      scopeItemsResult.error,
      locationsResult.error,
      allocationsResult.error,
      productionParametersResult.error,
      settingsResult.error,
    ].filter(
      Boolean
    )


  if (
    loadErrors.length >
    0
  ) {
    console.error(
      'Pre-Planning data could not be loaded.',
      loadErrors
    )

    return (
      <section
        style={{
          display:
            'grid',
          gap: '12px',
        }}
      >
        <div
          style={{
            padding:
              '20px',
            border:
              '1px solid #fecaca',
            borderRadius:
              '10px',
            background:
              '#fef2f2',
            color:
              DANGER,
            fontSize:
              '13px',
            fontWeight:
              700,
          }}
        >
          One or more Pre-Planning data sources could not be loaded.
        </div>

        <Link
          href="/dashboard/planning/pre-planning"
          style={{
            width:
              'fit-content',
            color:
              NAVY,
            fontSize:
              '12px',
            fontWeight:
              900,
            textDecoration:
              'none',
          }}
        >
          ← Change Project
        </Link>
      </section>
    )
  }


  /* ---------------------------------------------------------
     NORMALIZE DATA
     --------------------------------------------------------- */

  const workPackages =
    (
      workPackagesResult
        .data ||
      []
    ).filter(
      (
        item
      ) =>
        item.is_active !==
        false
    )


  const scopeItems =
    (
      scopeItemsResult
        .data ||
      []
    ).filter(
      (
        item
      ) =>
        item.is_active !==
        false
    )


  const locations =
    locationsResult
      .data ||
    []


  const allocations =
    allocationsResult
      .data ||
    []


  const productionParameters =
    productionParametersResult
      .data ||
    []


  const settings =
    settingsResult
      .data ||
    null


  /* ---------------------------------------------------------
     LOOKUP MAPS
     --------------------------------------------------------- */

  const workPackageMap =
    new Map(
      workPackages.map(
        (
          item
        ) => [
          item.id,
          item,
        ]
      )
    )


  const scopeItemMap =
    new Map(
      scopeItems.map(
        (
          item
        ) => [
          item.id,
          item,
        ]
      )
    )


  const locationMap =
    buildLocationMap(
      locations
    )


  const parameterMap =
    new Map(
      productionParameters.map(
        (
          item
        ) => [
          item.service_id,
          item,
        ]
      )
    )


  /* ---------------------------------------------------------
     BUILD PRODUCTION ACTIVITIES

     One row =
     Scope Item × Location
     --------------------------------------------------------- */

  const activities =
    allocations
      .map(
        (
          allocation
        ) => {
          const scopeItem =
            scopeItemMap.get(
              allocation.service_id
            )

          const location =
            locationMap.get(
              allocation.location_id
            )

          if (
            !scopeItem ||
            !location
          ) {
            return null
          }

          const workPackage =
            workPackageMap.get(
              scopeItem
                .project_work_package_id
            )

          /*
           * Ignore allocation rows whose
           * Work Package is no longer active.
           */
          if (
            !workPackage
          ) {
            return null
          }

          const parameter =
            parameterMap.get(
              scopeItem.id
            )

          return calculateActivity({
            allocation,
            scopeItem,
            workPackage,
            parameter,
            location,
            locationMap,
          })
        }
      )
      .filter(
        Boolean
      )


  /* ---------------------------------------------------------
     ORDER ACTIVITIES

     V1 does NOT invent production precedence.

     Sorting is only for visual organization:
     Work Package → Scope Item → Location.

     All bars still begin at Day 0.
     --------------------------------------------------------- */

  activities.sort(
    (
      first,
      second
    ) => {
      const workPackageDifference =
        String(
          first.workPackageCode ||
          ''
        ).localeCompare(
          String(
            second.workPackageCode ||
            ''
          )
        )

      if (
        workPackageDifference !==
        0
      ) {
        return workPackageDifference
      }


      const scopeSequenceDifference =
        Number(
          first.scopeSequence ||
          0
        ) -
        Number(
          second.scopeSequence ||
          0
        )

      if (
        scopeSequenceDifference !==
        0
      ) {
        return scopeSequenceDifference
      }


      const scopeNameDifference =
        String(
          first.scopeItemName ||
          ''
        ).localeCompare(
          String(
            second.scopeItemName ||
            ''
          )
        )

      if (
        scopeNameDifference !==
        0
      ) {
        return scopeNameDifference
      }


      const firstLocation =
        locationMap.get(
          first.locationId
        )

      const secondLocation =
        locationMap.get(
          second.locationId
        )

      return compareLocations(
        firstLocation,
        secondLocation,
        locationMap
      )
    }
  )


  /* ---------------------------------------------------------
     TARGET TAKT
     --------------------------------------------------------- */

  const parsedTargetTakt =
    Number(
      settings
        ?.target_takt_days
    )


  const targetTakt =
    Number.isFinite(
      parsedTargetTakt
    ) &&
    parsedTargetTakt >
    0
      ? parsedTargetTakt
      : null


  const strategyStatus =
    settings?.status ||
    'draft'


  /* ---------------------------------------------------------
     WORKSPACE
     --------------------------------------------------------- */

  return (
    <PrePlanningWorkspace
      project={{
        id:
          selectedProject.id,

        code:
          selectedProject.code,

        name:
          selectedProject.name,
      }}
      activities={
        activities
      }
      targetTakt={
        targetTakt
      }
      strategyStatus={
        strategyStatus
      }
      changeProjectHref="/dashboard/planning/pre-planning"
    />
  )
}
