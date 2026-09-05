import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import {
  createClient,
} from '../../../../lib/supabase/server'


const NAVY = '#052c49'
const TEAL = '#00998b'
const TEXT = '#263c4d'
const MUTED = '#6b7d8d'
const BORDER = '#dce5ed'
const READY = '#087f73'
const WARNING = '#a16207'
const DANGER = '#b42318'


function safeNumber(value, digits = 2) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return '—'
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }
  ).format(numeric)
}


function locationTypeLabel(value) {
  const labels = {
    project: 'Project',
    building: 'Building',
    floor: 'Level',
    division: 'Level',
    level: 'Level',
    zone: 'Zone',
    area: 'Area',
    room: 'Room',
    custom: 'Custom',
  }

  return labels[value] || value || 'Location'
}


function buildLocationMap(locations) {
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
  const parts = []
  const visited = new Set()
  let cursor = location

  while (
    cursor &&
    !visited.has(cursor.id)
  ) {
    visited.add(cursor.id)
    parts.unshift(cursor.name)

    cursor =
      cursor.parent_id
        ? locationMap.get(cursor.parent_id)
        : null
  }

  return parts.join(' / ')
}


function buildLocationDepth(
  location,
  locationMap
) {
  let depth = 0
  const visited = new Set()
  let cursor = location

  while (
    cursor?.parent_id &&
    !visited.has(cursor.parent_id)
  ) {
    visited.add(cursor.parent_id)
    depth += 1

    cursor =
      locationMap.get(cursor.parent_id)
  }

  return depth
}


function sortLocations(
  locations,
  locationMap
) {
  return [...locations].sort(
    (first, second) => {
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

      if (firstDepth !== secondDepth) {
        return firstDepth - secondDepth
      }

      const sequenceDifference =
        Number(first.sequence_number || 0) -
        Number(second.sequence_number || 0)

      if (sequenceDifference !== 0) {
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
  )
}


function calculateScopeRow({
  allocation,
  scopeItem,
  workPackage,
  parameter,
  location,
  locationMap,
  targetTakt,
}) {
  const quantity =
    Number(allocation?.quantity || 0)

  const productivity =
    Number(parameter?.productivity_rate)

  const effectiveWorkforce =
    Number(parameter?.effective_workforce)

  const productivityBasis =
    parameter?.productivity_basis ||
    'worker_day'

  const hasProductivity =
    Number.isFinite(productivity) &&
    productivity > 0

  const hasWorkforce =
    Number.isFinite(effectiveWorkforce) &&
    effectiveWorkforce > 0

  /*
   * effective_workforce means:
   * - worker_day: effective workers
   * - crew_day: effective crews
   *
   * This keeps the existing database usable without
   * duplicating Production Parameters in Pre-Planning.
   */
  const productionCapacity =
    hasProductivity &&
    hasWorkforce
      ? productivity * effectiveWorkforce
      : null

  const rawDuration =
    productionCapacity &&
    quantity > 0
      ? quantity / productionCapacity
      : null

  const requiredWorkforce =
    hasProductivity &&
    Number.isFinite(targetTakt) &&
    targetTakt > 0 &&
    quantity > 0
      ? quantity /
        (productivity * targetTakt)
      : null

  const workforceGap =
    requiredWorkforce !== null &&
    hasWorkforce
      ? requiredWorkforce -
        effectiveWorkforce
      : null

  const taktUtilization =
    rawDuration !== null &&
    Number.isFinite(targetTakt) &&
    targetTakt > 0
      ? rawDuration / targetTakt
      : null

  return {
    id: allocation.id,
    serviceId: scopeItem.id,
    workPackageId:
      scopeItem.project_work_package_id,
    locationId: location.id,
    locationPath:
      buildLocationPath(
        location,
        locationMap
      ),
    workPackageCode:
      workPackage?.code || '—',
    scopeItemName:
      scopeItem?.service_name ||
      'Scope Item',
    unit:
      scopeItem?.unit ||
      parameter?.quantity_unit ||
      'unit',
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
    requiredWorkforce,
    workforceGap,
    taktUtilization,
    complete:
      Boolean(productionCapacity),
  }
}


function MetricCard({
  label,
  value,
  detail,
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '18px 18px 16px',
        border: `1px solid ${BORDER}`,
        borderRadius: '12px',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: '10px',
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: '9px',
          color: '#071f37',
          fontSize: '26px',
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: '8px',
          color: '#718096',
          fontSize: '11px',
          lineHeight: 1.35,
        }}
      >
        {detail}
      </div>
    </div>
  )
}


function SectionHeader({
  step,
  title,
  description,
}) {
  return (
    <div
      style={{
        padding: '17px 18px',
        borderBottom:
          `1px solid ${BORDER}`,
        background: '#f7fafc',
      }}
    >
      <div
        style={{
          color: TEAL,
          fontSize: '10px',
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Step {step}
      </div>

      <h3
        style={{
          margin: '5px 0 0',
          color: NAVY,
          fontSize: '17px',
          fontWeight: 900,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          maxWidth: '920px',
          margin: '6px 0 0',
          color: MUTED,
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </div>
  )
}


function statusPresentation(
  utilization
) {
  if (!Number.isFinite(utilization)) {
    return {
      label: 'Waiting',
      color: MUTED,
      background: '#f1f5f9',
    }
  }

  if (utilization > 1) {
    return {
      label: 'Capacity Gap',
      color: DANGER,
      background: '#fef2f2',
    }
  }

  if (utilization >= 0.75) {
    return {
      label: 'Balanced',
      color: READY,
      background: '#e9f8f4',
    }
  }

  return {
    label: 'Underloaded',
    color: WARNING,
    background: '#fff7e3',
  }
}


export default async function PrePlanningPage({
  searchParams,
}) {
  const params =
    await searchParams

  const selectedProjectId =
    params?.projectId || ''

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


  async function saveTakt(formData) {
    'use server'

    const projectId =
      String(
        formData.get('project_id') || ''
      )

    const taktText =
      String(
        formData.get('target_takt_days') ||
        ''
      ).trim()

    if (!projectId) {
      return
    }

    const targetTakt =
      Number(taktText)

    if (
      !Number.isFinite(targetTakt) ||
      targetTakt <= 0
    ) {
      return
    }

    const actionSupabase =
      await createClient()

    const {
      data: {
        user: actionUser,
      },
    } =
      await actionSupabase.auth.getUser()

    if (!actionUser) {
      return
    }

    const {
      data: existing,
    } =
      await actionSupabase
        .from(
          'project_pre_planning_settings'
        )
        .select(
          'project_id, status'
        )
        .eq(
          'project_id',
          projectId
        )
        .maybeSingle()

    const payload = {
      project_id: projectId,
      target_takt_days:
        targetTakt,
      status:
        existing?.status ||
        'draft',
      created_by:
        actionUser.id,
      updated_at:
        new Date().toISOString(),
    }

    await actionSupabase
      .from(
        'project_pre_planning_settings'
      )
      .upsert(
        payload,
        {
          onConflict:
            'project_id',
        }
      )

    revalidatePath(
      '/dashboard/planning/pre-planning'
    )
  }


  async function saveExecutionMode(
    formData
  ) {
    'use server'

    const projectId =
      String(
        formData.get('project_id') || ''
      )

    const workPackageId =
      String(
        formData.get(
          'project_work_package_id'
        ) || ''
      )

    const executionMode =
      String(
        formData.get(
          'execution_mode'
        ) || ''
      )

    if (
      !projectId ||
      !workPackageId ||
      ![
        'concurrent',
        'sequential',
      ].includes(executionMode)
    ) {
      return
    }

    const actionSupabase =
      await createClient()

    const {
      data: {
        user: actionUser,
      },
    } =
      await actionSupabase.auth.getUser()

    if (!actionUser) {
      return
    }

    await actionSupabase
      .from(
        'project_work_package_pre_planning'
      )
      .upsert(
        {
          project_id:
            projectId,
          project_work_package_id:
            workPackageId,
          execution_mode:
            executionMode,
          created_by:
            actionUser.id,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'project_id,project_work_package_id',
        }
      )

    revalidatePath(
      '/dashboard/planning/pre-planning'
    )
  }


  async function approveStrategy(
    formData
  ) {
    'use server'

    const projectId =
      String(
        formData.get('project_id') || ''
      )

    if (!projectId) {
      return
    }

    const actionSupabase =
      await createClient()

    const {
      data: {
        user: actionUser,
      },
    } =
      await actionSupabase.auth.getUser()

    if (!actionUser) {
      return
    }

    const {
      data: settings,
    } =
      await actionSupabase
        .from(
          'project_pre_planning_settings'
        )
        .select(
          'target_takt_days'
        )
        .eq(
          'project_id',
          projectId
        )
        .maybeSingle()

    if (
      !settings ||
      Number(
        settings.target_takt_days
      ) <= 0
    ) {
      return
    }

    await actionSupabase
      .from(
        'project_pre_planning_settings'
      )
      .update(
        {
          status: 'approved',
          approved_at:
            new Date().toISOString(),
          approved_by:
            actionUser.id,
          updated_at:
            new Date().toISOString(),
        }
      )
      .eq(
        'project_id',
        projectId
      )

    revalidatePath(
      '/dashboard/planning/pre-planning'
    )
  }


  async function reopenStrategy(
    formData
  ) {
    'use server'

    const projectId =
      String(
        formData.get('project_id') || ''
      )

    if (!projectId) {
      return
    }

    const actionSupabase =
      await createClient()

    await actionSupabase
      .from(
        'project_pre_planning_settings'
      )
      .update(
        {
          status: 'draft',
          approved_at: null,
          approved_by: null,
          updated_at:
            new Date().toISOString(),
        }
      )
      .eq(
        'project_id',
        projectId
      )

    revalidatePath(
      '/dashboard/planning/pre-planning'
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

  if (projectsError) {
    console.error(
      'Pre-Planning projects could not be loaded.',
      projectsError
    )
  }

  const projects =
    projectsData || []

  const selectedProject =
    projects.find(
      (project) =>
        project.id ===
        selectedProjectId
    ) || null

  if (!selectedProject) {
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
            Select a project to convert scope, quantities, productivity and resource assumptions into a balanced production strategy before scheduling begins.
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
          {projects.length > 0 ? (
            projects.map(
              (project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/planning/pre-planning?projectId=${project.id}`}
                  style={{
                    display: 'block',
                    padding: '18px',
                    border:
                      `1px solid ${BORDER}`,
                    borderRadius: '12px',
                    background: '#ffffff',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      color: TEAL,
                      fontSize: '11px',
                      fontWeight: 900,
                    }}
                  >
                    {project.code}
                  </div>

                  <div
                    style={{
                      marginTop: '5px',
                      color: NAVY,
                      fontSize: '15px',
                      fontWeight: 900,
                    }}
                  >
                    {project.name}
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


  const [
    workPackagesResult,
    scopeItemsResult,
    locationsResult,
    allocationsResult,
    productionParametersResult,
    settingsResult,
    workPackageRulesResult,
  ] =
    await Promise.all(
      [
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
          .from('locations')
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
            'project_work_package_pre_planning'
          )
          .select(
            `
              id,
              project_work_package_id,
              execution_mode
            `
          )
          .eq(
            'project_id',
            selectedProject.id
          ),
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
      workPackageRulesResult.error,
    ].filter(Boolean)

  if (loadErrors.length > 0) {
    console.error(
      'Pre-Planning data could not be loaded.',
      loadErrors
    )

    return (
      <div
        style={{
          padding: '20px',
          border:
            '1px solid #fecaca',
          borderRadius: '12px',
          background: '#fef2f2',
          color: DANGER,
          fontSize: '13px',
          fontWeight: 700,
        }}
      >
        One or more Pre-Planning data sources could not be loaded.
      </div>
    )
  }


  const workPackages =
    (
      workPackagesResult.data || []
    ).filter(
      (item) =>
        item.is_active !== false
    )

  const scopeItems =
    (
      scopeItemsResult.data || []
    ).filter(
      (item) =>
        item.is_active !== false
    )

  const locations =
    locationsResult.data || []

  const allocations =
    allocationsResult.data || []

  const productionParameters =
    productionParametersResult.data ||
    []

  const settings =
    settingsResult.data || null

  const targetTakt =
    Number(
      settings?.target_takt_days
    )

  const hasTargetTakt =
    Number.isFinite(targetTakt) &&
    targetTakt > 0

  const strategyApproved =
    settings?.status ===
    'approved'

  const workPackageMap =
    new Map(
      workPackages.map(
        (item) => [
          item.id,
          item,
        ]
      )
    )

  const scopeItemMap =
    new Map(
      scopeItems.map(
        (item) => [
          item.id,
          item,
        ]
      )
    )

  const locationMap =
    buildLocationMap(locations)

  const parameterMap =
    new Map(
      productionParameters.map(
        (item) => [
          item.service_id,
          item,
        ]
      )
    )

  const ruleMap =
    new Map(
      (
        workPackageRulesResult.data ||
        []
      ).map(
        (item) => [
          item.project_work_package_id,
          item.execution_mode,
        ]
      )
    )

  const calculations =
    allocations
      .map(
        (allocation) => {
          const location =
            locationMap.get(
              allocation.location_id
            )

          const scopeItem =
            scopeItemMap.get(
              allocation.service_id
            )

          if (
            !location ||
            !scopeItem
          ) {
            return null
          }

          const workPackage =
            workPackageMap.get(
              scopeItem.project_work_package_id
            )

          const parameter =
            parameterMap.get(
              scopeItem.id
            )

          return calculateScopeRow({
            allocation,
            scopeItem,
            workPackage,
            parameter,
            location,
            locationMap,
            targetTakt:
              hasTargetTakt
                ? targetTakt
                : null,
          })
        }
      )
      .filter(Boolean)

  const orderedLocations =
    sortLocations(
      locations,
      locationMap
    )

  const locationRows =
    orderedLocations
      .map(
        (location) => ({
          location,
          rows:
            calculations
              .filter(
                (row) =>
                  row.locationId ===
                  location.id
              )
              .sort(
                (
                  first,
                  second
                ) => {
                  const packageDifference =
                    first.workPackageCode
                      .localeCompare(
                        second.workPackageCode
                      )

                  if (
                    packageDifference !==
                    0
                  ) {
                    return packageDifference
                  }

                  return first.scopeItemName
                    .localeCompare(
                      second.scopeItemName
                    )
                }
              ),
        })
      )
      .filter(
        (group) =>
          group.rows.length > 0
      )

  const workPackageFlowRows =
    locationRows.map(
      (group) => {
        const packages = {}

        for (
          const workPackage
          of workPackages
        ) {
          const packageRows =
            group.rows.filter(
              (row) =>
                row.workPackageId ===
                workPackage.id
            )

          const validDurations =
            packageRows
              .map(
                (row) =>
                  row.rawDuration
              )
              .filter(
                (value) =>
                  Number.isFinite(value)
              )

          const executionMode =
            ruleMap.get(
              workPackage.id
            ) || 'concurrent'

          let rawDuration = null

          if (
            validDurations.length > 0
          ) {
            rawDuration =
              executionMode ===
              'sequential'
                ? validDurations.reduce(
                    (
                      total,
                      value
                    ) =>
                      total + value,
                    0
                  )
                : Math.max(
                    ...validDurations
                  )
          }

          const utilization =
            rawDuration !== null &&
            hasTargetTakt
              ? rawDuration /
                targetTakt
              : null

          packages[
            workPackage.id
          ] = {
            rawDuration,
            utilization,
            executionMode,
          }
        }

        return {
          locationId:
            group.location.id,
          locationPath:
            buildLocationPath(
              group.location,
              locationMap
            ),
          packages,
        }
      }
    )

  const calculatedCount =
    calculations.filter(
      (row) =>
        row.complete
    ).length

  const unresolvedCount =
    calculations.length -
    calculatedCount

  const rawDurations =
    calculations
      .map(
        (row) =>
          row.rawDuration
      )
      .filter(
        (value) =>
          Number.isFinite(value)
      )

  const averageRawDuration =
    rawDurations.length > 0
      ? rawDurations.reduce(
          (
            total,
            value
          ) =>
            total + value,
          0
        ) /
        rawDurations.length
      : null

  const flowCells =
    workPackageFlowRows.flatMap(
      (row) =>
        workPackages
          .map(
            (workPackage) =>
              row.packages[
                workPackage.id
              ]
          )
          .filter(
            (item) =>
              Number.isFinite(
                item?.utilization
              )
          )
    )

  const capacityGapCount =
    flowCells.filter(
      (item) =>
        item.utilization > 1
    ).length

  const balancedCount =
    flowCells.filter(
      (item) =>
        item.utilization >= 0.75 &&
        item.utilization <= 1
    ).length

  const underloadedCount =
    flowCells.filter(
      (item) =>
        item.utilization < 0.75
    ).length

  const criticalPackage =
    workPackages
      .map(
        (workPackage) => {
          const packageCells =
            workPackageFlowRows
              .map(
                (row) =>
                  row.packages[
                    workPackage.id
                  ]
              )
              .filter(
                (item) =>
                  Number.isFinite(
                    item?.utilization
                  )
              )

          const maxUtilization =
            packageCells.length > 0
              ? Math.max(
                  ...packageCells.map(
                    (item) =>
                      item.utilization
                  )
                )
              : null

          return {
            workPackage,
            maxUtilization,
          }
        }
      )
      .filter(
        (item) =>
          Number.isFinite(
            item.maxUtilization
          )
      )
      .sort(
        (first, second) =>
          second.maxUtilization -
          first.maxUtilization
      )[0] || null


  return (
    <section
      style={{
        display: 'grid',
        gap: '18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent:
            'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          padding: '20px 22px',
          border:
            `1px solid ${BORDER}`,
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <div>
          <div
            style={{
              color: TEAL,
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {selectedProject.code}
          </div>

          <h2
            style={{
              margin: '6px 0 0',
              color: NAVY,
              fontSize: '22px',
              fontWeight: 900,
            }}
          >
            Pre-Planning
          </h2>

          <p
            style={{
              maxWidth: '900px',
              margin: '8px 0 0',
              color: MUTED,
              fontSize: '13px',
              lineHeight: 1.55,
            }}
          >
            Convert project quantities and Production Parameters into a balanced production strategy before the Master Plan is built.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              minHeight: '30px',
              alignItems: 'center',
              padding: '0 10px',
              borderRadius: '999px',
              background:
                strategyApproved
                  ? '#e9f8f4'
                  : '#f1f5f9',
              color:
                strategyApproved
                  ? READY
                  : MUTED,
              fontSize: '10px',
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            {strategyApproved
              ? 'Approved'
              : 'Draft'}
          </span>

          <Link
            href="/dashboard/planning/pre-planning"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: '38px',
              padding: '0 12px',
              border:
                `1px solid ${BORDER}`,
              borderRadius: '8px',
              color: '#425a70',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            Change Project
          </Link>
        </div>
      </div>


      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <MetricCard
          label="Production Locations"
          value={locationRows.length}
          detail="Locations with allocated quantity"
        />

        <MetricCard
          label="Target Takt"
          value={
            hasTargetTakt
              ? `${safeNumber(
                  targetTakt
                )} d`
              : '—'
          }
          detail="Common production rhythm"
        />

        <MetricCard
          label="Capacity Gaps"
          value={
            hasTargetTakt
              ? capacityGapCount
              : '—'
          }
          detail="WP/location cells above Takt"
        />

        <MetricCard
          label="Critical WP"
          value={
            criticalPackage
              ? criticalPackage
                  .workPackage.code
              : '—'
          }
          detail={
            criticalPackage
              ? `${safeNumber(
                  criticalPackage
                    .maxUtilization *
                    100,
                  0
                )}% peak Takt utilization`
              : 'Waiting for Takt analysis'
          }
        />
      </div>


      <section
        style={{
          overflow: 'hidden',
          border:
            `1px solid ${BORDER}`,
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <SectionHeader
          step="1"
          title="Production Inputs"
          description="Production Parameters remain owned by Project Setup. Pre-Planning reads the existing productivity database and combines it with allocated quantity by location."
        />

        <div
          style={{
            padding: '14px 16px',
            background: '#f0fdfa',
            borderBottom:
              `1px solid ${BORDER}`,
            color: '#135e56',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          <strong>
            Calculation rule:
          </strong>{' '}
          worker/day = productivity per worker × effective workers. crew/day = productivity per crew × effective crews. Raw Duration = Quantity ÷ Production Capacity.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            padding: '16px',
          }}
        >
          <MetricCard
            label="Scope Calculations"
            value={
              calculations.length
            }
            detail={`${calculatedCount} calculated`}
          />

          <MetricCard
            label="Missing Parameters"
            value={unresolvedCount}
            detail="Rows without usable capacity"
          />

          <MetricCard
            label="Average Raw Duration"
            value={
              averageRawDuration !==
              null
                ? `${safeNumber(
                    averageRawDuration
                  )} d`
                : '—'
            }
            detail="Scope Item level"
          />
        </div>
      </section>


      <section
        style={{
          overflow: 'hidden',
          border:
            `1px solid ${BORDER}`,
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <SectionHeader
          step="2"
          title="Work Package Logic"
          description="Define how Scope Items behave inside each Work Package. Concurrent uses the longest Scope Item duration; Sequential adds the Scope Item durations."
        />

        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: '760px',
              borderCollapse:
                'collapse',
            }}
          >
            <thead>
              <tr>
                {[
                  'Work Package',
                  'Description',
                  'Scope Items',
                  'Execution Mode',
                ].map(
                  (label) => (
                    <th
                      key={label}
                      style={{
                        padding:
                          '10px 12px',
                        borderBottom:
                          `1px solid ${BORDER}`,
                        background:
                          '#eef3f6',
                        color:
                          '#52677d',
                        fontSize:
                          '10px',
                        fontWeight: 900,
                        textAlign:
                          'left',
                        textTransform:
                          'uppercase',
                      }}
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {workPackages.map(
                (workPackage) => {
                  const scopeCount =
                    scopeItems.filter(
                      (scopeItem) =>
                        scopeItem
                          .project_work_package_id ===
                        workPackage.id
                    ).length

                  const executionMode =
                    ruleMap.get(
                      workPackage.id
                    ) || 'concurrent'

                  return (
                    <tr
                      key={
                        workPackage.id
                      }
                    >
                      <td
                        style={{
                          padding:
                            '11px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color: TEAL,
                          fontSize:
                            '12px',
                          fontWeight: 900,
                        }}
                      >
                        {workPackage.code}
                      </td>

                      <td
                        style={{
                          padding:
                            '11px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color: TEXT,
                          fontSize:
                            '12px',
                        }}
                      >
                        {workPackage.description ||
                          '—'}
                      </td>

                      <td
                        style={{
                          padding:
                            '11px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color: TEXT,
                          fontSize:
                            '12px',
                        }}
                      >
                        {scopeCount}
                      </td>

                      <td
                        style={{
                          padding:
                            '8px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                        }}
                      >
                        <form
                          action={
                            saveExecutionMode
                          }
                          style={{
                            display:
                              'flex',
                            gap: '8px',
                          }}
                        >
                          <input
                            type="hidden"
                            name="project_id"
                            value={
                              selectedProject.id
                            }
                          />

                          <input
                            type="hidden"
                            name="project_work_package_id"
                            value={
                              workPackage.id
                            }
                          />

                          <select
                            name="execution_mode"
                            defaultValue={
                              executionMode
                            }
                            style={{
                              minHeight:
                                '36px',
                              border:
                                `1px solid ${BORDER}`,
                              borderRadius:
                                '7px',
                              padding:
                                '0 8px',
                              background:
                                '#ffffff',
                            }}
                          >
                            <option value="concurrent">
                              Concurrent
                            </option>

                            <option value="sequential">
                              Sequential
                            </option>
                          </select>

                          <button
                            type="submit"
                            style={{
                              minHeight:
                                '36px',
                              padding:
                                '0 10px',
                              border:
                                `1px solid ${BORDER}`,
                              borderRadius:
                                '7px',
                              background:
                                '#ffffff',
                              color:
                                NAVY,
                              fontSize:
                                '11px',
                              fontWeight:
                                800,
                              cursor:
                                'pointer',
                            }}
                          >
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                }
              )}
            </tbody>
          </table>
        </div>
      </section>


      <section
        style={{
          overflow: 'hidden',
          border:
            `1px solid ${BORDER}`,
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <SectionHeader
          step="3"
          title="Takt & Balancing"
          description="Set the common production rhythm. RitsuFlow compares calculated production capability with the Target Takt and identifies balancing requirements."
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'end',
            justifyContent:
              'space-between',
            gap: '18px',
            flexWrap: 'wrap',
            padding: '18px',
          }}
        >
          <form
            action={saveTakt}
            style={{
              display: 'flex',
              alignItems: 'end',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <input
              type="hidden"
              name="project_id"
              value={
                selectedProject.id
              }
            />

            <label
              style={{
                display: 'grid',
                gap: '6px',
                color: TEXT,
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              Target Takt
              <input
                type="number"
                name="target_takt_days"
                min="0.01"
                step="0.01"
                defaultValue={
                  hasTargetTakt
                    ? targetTakt
                    : ''
                }
                placeholder="Days"
                style={{
                  width: '150px',
                  minHeight: '40px',
                  border:
                    `1px solid ${BORDER}`,
                  borderRadius: '8px',
                  padding: '0 10px',
                }}
              />
            </label>

            <button
              type="submit"
              style={{
                minHeight: '40px',
                padding: '0 14px',
                border: 0,
                borderRadius: '8px',
                background: NAVY,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Save Takt
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              gap: '18px',
              flexWrap: 'wrap',
              color: MUTED,
              fontSize: '11px',
            }}
          >
            <span>
              <strong
                style={{
                  color: READY,
                }}
              >
                {balancedCount}
              </strong>{' '}
              balanced
            </span>

            <span>
              <strong
                style={{
                  color: WARNING,
                }}
              >
                {underloadedCount}
              </strong>{' '}
              underloaded
            </span>

            <span>
              <strong
                style={{
                  color: DANGER,
                }}
              >
                {capacityGapCount}
              </strong>{' '}
              capacity gaps
            </span>
          </div>
        </div>
      </section>


      <section
        style={{
          overflow: 'hidden',
          border:
            `1px solid ${BORDER}`,
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <SectionHeader
          step="4"
          title="Flow Review"
          description="Review Work Package duration by production location against the common Target Takt. This matrix exposes bottlenecks and underloaded production packages before scheduling."
        />

        {workPackageFlowRows.length >
        0 ? (
          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth:
                  `${Math.max(
                    900,
                    250 +
                      workPackages.length *
                        130
                  )}px`,
                borderCollapse:
                  'collapse',
                tableLayout:
                  'fixed',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      width: '250px',
                      padding:
                        '11px 12px',
                      borderBottom:
                        `1px solid ${BORDER}`,
                      background:
                        '#eef3f6',
                      color:
                        '#52677d',
                      fontSize:
                        '10px',
                      fontWeight: 900,
                      textAlign:
                        'left',
                      textTransform:
                        'uppercase',
                      position:
                        'sticky',
                      left: 0,
                      zIndex: 2,
                    }}
                  >
                    Location
                  </th>

                  {workPackages.map(
                    (workPackage) => (
                      <th
                        key={
                          workPackage.id
                        }
                        style={{
                          width:
                            '130px',
                          padding:
                            '11px 10px',
                          borderBottom:
                            `1px solid ${BORDER}`,
                          background:
                            '#eef3f6',
                          color: TEAL,
                          fontSize:
                            '10px',
                          fontWeight: 900,
                          textAlign:
                            'center',
                          textTransform:
                            'uppercase',
                        }}
                      >
                        {workPackage.code}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {workPackageFlowRows.map(
                  (
                    row,
                    rowIndex
                  ) => (
                    <tr
                      key={
                        row.locationId
                      }
                    >
                      <td
                        style={{
                          padding:
                            '11px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          background:
                            rowIndex %
                              2 ===
                            1
                              ? '#f8fafc'
                              : '#ffffff',
                          color: NAVY,
                          fontSize:
                            '11px',
                          fontWeight: 900,
                          position:
                            'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        {row.locationPath}
                      </td>

                      {workPackages.map(
                        (
                          workPackage
                        ) => {
                          const cell =
                            row.packages[
                              workPackage.id
                            ]

                          const presentation =
                            statusPresentation(
                              cell?.utilization
                            )

                          return (
                            <td
                              key={
                                workPackage.id
                              }
                              style={{
                                padding:
                                  '9px 10px',
                                borderBottom:
                                  '1px solid #edf1f4',
                                textAlign:
                                  'center',
                              }}
                            >
                              {cell
                                ?.rawDuration ===
                              null ? (
                                <span
                                  style={{
                                    color:
                                      MUTED,
                                    fontSize:
                                      '11px',
                                  }}
                                >
                                  —
                                </span>
                              ) : (
                                <div
                                  style={{
                                    display:
                                      'grid',
                                    justifyItems:
                                      'center',
                                    gap: '4px',
                                  }}
                                >
                                  <strong
                                    style={{
                                      color:
                                        NAVY,
                                      fontSize:
                                        '12px',
                                    }}
                                  >
                                    {safeNumber(
                                      cell.rawDuration
                                    )}{' '}
                                    d
                                  </strong>

                                  {hasTargetTakt && (
                                    <>
                                      <span
                                        style={{
                                          color:
                                            presentation.color,
                                          fontSize:
                                            '10px',
                                          fontWeight:
                                            900,
                                        }}
                                      >
                                        {safeNumber(
                                          cell.utilization *
                                            100,
                                          0
                                        )}
                                        %
                                      </span>

                                      <span
                                        style={{
                                          display:
                                            'inline-flex',
                                          minHeight:
                                            '21px',
                                          alignItems:
                                            'center',
                                          padding:
                                            '0 7px',
                                          borderRadius:
                                            '999px',
                                          background:
                                            presentation.background,
                                          color:
                                            presentation.color,
                                          fontSize:
                                            '9px',
                                          fontWeight:
                                            900,
                                          whiteSpace:
                                            'nowrap',
                                        }}
                                      >
                                        {
                                          presentation.label
                                        }
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          )
                        }
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              padding: '22px',
              color: MUTED,
              fontSize: '13px',
            }}
          >
            No positive location allocations are available for this project.
          </div>
        )}
      </section>


      <section
        style={{
          overflow: 'hidden',
          border:
            `1px solid ${BORDER}`,
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <SectionHeader
          step="5"
          title="Production Strategy"
          description="Approve the production strategy only after Production Parameters, Work Package logic, Target Takt and flow balance have been reviewed."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            padding: '16px',
          }}
        >
          <MetricCard
            label="Target Takt"
            value={
              hasTargetTakt
                ? `${safeNumber(
                    targetTakt
                  )} d`
                : '—'
            }
            detail="Production rhythm"
          />

          <MetricCard
            label="Balanced Cells"
            value={
              hasTargetTakt
                ? balancedCount
                : '—'
            }
            detail="75%–100% utilization"
          />

          <MetricCard
            label="Capacity Gaps"
            value={
              hasTargetTakt
                ? capacityGapCount
                : '—'
            }
            detail="Above 100% utilization"
          />

          <MetricCard
            label="Status"
            value={
              strategyApproved
                ? 'Approved'
                : 'Draft'
            }
            detail={
              strategyApproved &&
              settings?.approved_at
                ? `Approved ${new Date(
                    settings.approved_at
                  ).toLocaleDateString(
                    'en-US'
                  )}`
                : 'Not released to planning'
            }
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent:
              'flex-end',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '14px 16px',
            borderTop:
              `1px solid ${BORDER}`,
            background: '#fbfcfd',
          }}
        >
          {strategyApproved ? (
            <form
              action={reopenStrategy}
            >
              <input
                type="hidden"
                name="project_id"
                value={
                  selectedProject.id
                }
              />

              <button
                type="submit"
                style={{
                  minHeight: '40px',
                  padding: '0 14px',
                  border:
                    `1px solid ${BORDER}`,
                  borderRadius: '8px',
                  background:
                    '#ffffff',
                  color: NAVY,
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Reopen Strategy
              </button>
            </form>
          ) : (
            <form
              action={approveStrategy}
            >
              <input
                type="hidden"
                name="project_id"
                value={
                  selectedProject.id
                }
              />

              <button
                type="submit"
                disabled={
                  !hasTargetTakt ||
                  unresolvedCount > 0
                }
                title={
                  !hasTargetTakt
                    ? 'Define Target Takt first.'
                    : unresolvedCount >
                        0
                      ? 'Resolve missing Production Parameters first.'
                      : 'Approve Production Strategy'
                }
                style={{
                  minHeight: '40px',
                  padding: '0 16px',
                  border: 0,
                  borderRadius: '8px',
                  background:
                    !hasTargetTakt ||
                    unresolvedCount > 0
                      ? '#cbd5e1'
                      : TEAL,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor:
                    !hasTargetTakt ||
                    unresolvedCount > 0
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                Approve Production Strategy
              </button>
            </form>
          )}
        </div>
      </section>


      {locationRows.length > 0 && (
        <section
          style={{
            overflow: 'hidden',
            border:
              `1px solid ${BORDER}`,
            borderRadius: '12px',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              padding: '17px 18px',
              borderBottom:
                `1px solid ${BORDER}`,
              background: '#f7fafc',
            }}
          >
            <h3
              style={{
                margin: 0,
                color: NAVY,
                fontSize: '16px',
                fontWeight: 900,
              }}
            >
              Scope Item Calculation Detail
            </h3>

            <p
              style={{
                margin: '6px 0 0',
                color: MUTED,
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              Detailed calculation trace from quantity and the existing Production Parameters database.
            </p>
          </div>

          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '1380px',
                borderCollapse:
                  'collapse',
              }}
            >
              <thead>
                <tr>
                  {[
                    'Location',
                    'WP',
                    'Scope Item',
                    'Qty',
                    'Productivity',
                    'Basis',
                    'Effective Resource',
                    'Capacity',
                    'Raw Duration',
                    'Required Resource',
                    'Gap',
                  ].map(
                    (label) => (
                      <th
                        key={label}
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            `1px solid ${BORDER}`,
                          background:
                            '#eef3f6',
                          color:
                            '#52677d',
                          fontSize:
                            '10px',
                          fontWeight:
                            900,
                          textAlign:
                            'left',
                          textTransform:
                            'uppercase',
                          whiteSpace:
                            'nowrap',
                        }}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {calculations.map(
                  (row) => (
                    <tr key={row.id}>
                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color: NAVY,
                          fontSize:
                            '11px',
                          fontWeight:
                            800,
                        }}
                      >
                        {row.locationPath}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color: TEAL,
                          fontSize:
                            '11px',
                          fontWeight:
                            900,
                        }}
                      >
                        {row.workPackageCode}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color: TEXT,
                          fontSize:
                            '11px',
                        }}
                      >
                        {row.scopeItemName}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          fontSize:
                            '11px',
                        }}
                      >
                        {safeNumber(
                          row.quantity
                        )}{' '}
                        {row.unit}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          fontSize:
                            '11px',
                        }}
                      >
                        {row.productivity ===
                        null
                          ? '—'
                          : safeNumber(
                              row.productivity
                            )}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          fontSize:
                            '11px',
                        }}
                      >
                        {row.productivityBasis ===
                        'crew_day'
                          ? 'Per crew / day'
                          : 'Per worker / day'}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          fontSize:
                            '11px',
                        }}
                      >
                        {row.effectiveWorkforce ===
                        null
                          ? '—'
                          : `${safeNumber(
                              row.effectiveWorkforce
                            )} ${
                              row.productivityBasis ===
                              'crew_day'
                                ? 'crew(s)'
                                : 'worker(s)'
                            }`}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          fontSize:
                            '11px',
                        }}
                      >
                        {row.productionCapacity ===
                        null
                          ? '—'
                          : `${safeNumber(
                              row.productionCapacity
                            )} ${row.unit}/day`}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color: NAVY,
                          fontSize:
                            '11px',
                          fontWeight:
                            900,
                        }}
                      >
                        {row.rawDuration ===
                        null
                          ? '—'
                          : `${safeNumber(
                              row.rawDuration
                            )} d`}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          fontSize:
                            '11px',
                        }}
                      >
                        {row.requiredWorkforce ===
                        null
                          ? '—'
                          : `${safeNumber(
                              row.requiredWorkforce
                            )} ${
                              row.productivityBasis ===
                              'crew_day'
                                ? 'crew(s)'
                                : 'worker(s)'
                            }`}
                      </td>

                      <td
                        style={{
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #edf1f4',
                          color:
                            row.workforceGap !==
                              null &&
                            row.workforceGap >
                              0
                              ? DANGER
                              : READY,
                          fontSize:
                            '11px',
                          fontWeight:
                            900,
                        }}
                      >
                        {row.workforceGap ===
                        null
                          ? '—'
                          : `${
                              row.workforceGap >
                              0
                                ? '+'
                                : ''
                            }${safeNumber(
                              row.workforceGap
                            )}`}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
