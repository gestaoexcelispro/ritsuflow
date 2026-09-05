import Link from 'next/link'

import {
  createClient,
} from '../../../../lib/supabase/server'


const NAVY = '#052c49'
const TEAL = '#00998b'
const TEXT = '#263c4d'
const MUTED = '#6b7d8d'
const BORDER = '#dce5ed'
const SOFT = '#f7fafc'
const READY = '#087f73'
const WARNING = '#a16207'


function safeNumber(
  value,
  digits = 2
) {

  const numeric =
    Number(
      value
    )


  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return '—'
  }


  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        digits,
    }
  ).format(
    numeric
  )

}


function locationTypeLabel(
  value
) {

  const labels = {
    project:
      'Project',

    building:
      'Building',

    floor:
      'Level',

    division:
      'Level',

    level:
      'Level',

    zone:
      'Zone',

    area:
      'Area',

    room:
      'Room',

    custom:
      'Custom',
  }


  return (
    labels[
      value
    ] ||
    value ||
    'Location'
  )

}


function buildLocationMap(
  locations
) {

  return new Map(
    locations.map(
      (
        location
      ) => [
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

  const parts =
    []


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


    parts.unshift(
      cursor.name
    )


    cursor =
      cursor.parent_id
        ? locationMap.get(
            cursor.parent_id
          )
        : null

  }


  return parts.join(
    ' / '
  )

}


function buildLocationDepth(
  location,
  locationMap
) {

  let depth =
    0


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


    depth +=
      1


    cursor =
      locationMap.get(
        cursor.parent_id
      )

  }


  return depth

}


function sortLocations(
  locations,
  locationMap
) {

  return [
    ...locations,
  ].sort(
    (
      first,
      second
    ) => {

      const firstPath =
        buildLocationPath(
          first,
          locationMap
        )


      const secondPath =
        buildLocationPath(
          second,
          locationMap
        )


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


      return firstPath.localeCompare(
        secondPath
      )

    }
  )

}


function calculateRow({
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


  const workforce =
    Number(
      parameter
        ?.effective_workforce
    )


  const hasProductivity =
    Number.isFinite(
      productivity
    ) &&
    productivity >
      0


  const hasWorkforce =
    Number.isFinite(
      workforce
    ) &&
    workforce >
      0


  const productionCapacity =
    hasProductivity &&
    hasWorkforce
      ? productivity *
        workforce
      : null


  const rawDuration =
    productionCapacity &&
    quantity >
      0
      ? quantity /
        productionCapacity
      : null


  return {
    id:
      allocation.id,

    locationId:
      location.id,

    locationPath:
      buildLocationPath(
        location,
        locationMap
      ),

    locationType:
      locationTypeLabel(
        location.location_type
      ),

    workPackageCode:
      workPackage
        ?.code ||
      '—',

    scopeItemName:
      scopeItem
        ?.service_name ||
      'Scope Item',

    unit:
      scopeItem
        ?.unit ||
      parameter
        ?.quantity_unit ||
      'unit',

    quantity,

    productivity:
      hasProductivity
        ? productivity
        : null,

    productivityBasis:
      parameter
        ?.productivity_basis ||
      null,

    workforce:
      hasWorkforce
        ? workforce
        : null,

    productionCapacity,

    rawDuration,

    complete:
      Boolean(
        productionCapacity
      ),
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
        minWidth:
          0,

        padding:
          '18px 18px 16px',

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
          color:
            '#64748b',

          fontSize:
            '10px',

          lineHeight:
            1,

          fontWeight:
            900,

          letterSpacing:
            '0.08em',

          textTransform:
            'uppercase',
        }}
      >
        {label}
      </div>


      <div
        style={{
          marginTop:
            '9px',

          color:
            '#071f37',

          fontSize:
            '26px',

          lineHeight:
            1,

          fontWeight:
            900,
        }}
      >
        {value}
      </div>


      <div
        style={{
          marginTop:
            '8px',

          color:
            '#718096',

          fontSize:
            '11px',

          lineHeight:
            1.35,
        }}
      >
        {detail}
      </div>

    </div>

  )

}


export default async function PrePlanningPage({
  searchParams,
}) {

  const params =
    await searchParams


  const selectedProjectId =
    params?.projectId ||
    ''


  const supabase =
    await createClient()


  const {
    data: {
      user,
    },
  } =
    await supabase
      .auth
      .getUser()


  if (
    !user
  ) {

    return (

      <div
        style={{
          padding:
            '24px',
        }}
      >
        Authentication is required.
      </div>

    )

  }


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

      <section
        style={{
          display:
            'grid',

          gap:
            '18px',
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

          <h2
            style={{
              margin:
                0,

              color:
                NAVY,

              fontSize:
                '22px',

              lineHeight:
                1.2,

              fontWeight:
                900,
            }}
          >
            Pre-Planning
          </h2>


          <p
            style={{
              maxWidth:
                '780px',

              margin:
                '8px 0 0',

              color:
                MUTED,

              fontSize:
                '13px',

              lineHeight:
                1.55,
            }}
          >
            Select a project to calculate raw activity duration by production location using allocated quantity and project-wide production parameters.
          </p>

        </div>


        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(280px, 1fr))',

            gap:
              '12px',
          }}
        >

          {projects.length >
          0 ? (

            projects.map(
              (
                project
              ) => (

                <Link
                  key={
                    project.id
                  }
                  href={`/dashboard/planning/pre-planning?projectId=${project.id}`}
                  style={{
                    display:
                      'block',

                    padding:
                      '18px',

                    border:
                      `1px solid ${BORDER}`,

                    borderRadius:
                      '12px',

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
                        '11px',

                      fontWeight:
                        900,

                      letterSpacing:
                        '0.05em',
                    }}
                  >
                    {
                      project.code
                    }
                  </div>


                  <div
                    style={{
                      marginTop:
                        '5px',

                      color:
                        NAVY,

                      fontSize:
                        '15px',

                      lineHeight:
                        1.35,

                      fontWeight:
                        900,
                    }}
                  >
                    {
                      project.name
                    }
                  </div>


                  <div
                    style={{
                      marginTop:
                        '10px',

                      color:
                        MUTED,

                      fontSize:
                        '11px',
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
                padding:
                  '20px',

                border:
                  `1px solid ${BORDER}`,

                borderRadius:
                  '12px',

                background:
                  '#ffffff',

                color:
                  MUTED,

                fontSize:
                  '13px',
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
              ascending:
                true,
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
              ascending:
                true,
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
              ascending:
                true,
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

      ]
    )


  const loadErrors =
    [
      workPackagesResult.error,
      scopeItemsResult.error,
      locationsResult.error,
      allocationsResult.error,
      productionParametersResult.error,
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

      <div
        style={{
          padding:
            '20px',

          border:
            '1px solid #fecaca',

          borderRadius:
            '12px',

          background:
            '#fef2f2',

          color:
            '#b42318',

          fontSize:
            '13px',

          fontWeight:
            700,
        }}
      >
        One or more Pre-Planning data sources could not be loaded.
      </div>

    )

  }


  const workPackages =
    (
      workPackagesResult.data ||
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
      scopeItemsResult.data ||
      []
    ).filter(
      (
        item
      ) =>
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


  const calculations =
    allocations
      .map(
        (
          allocation
        ) => {

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


          return calculateRow({
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


  const orderedLocations =
    sortLocations(
      locations,
      locationMap
    )


  const locationRows =
    orderedLocations
      .map(
        (
          location
        ) => ({
          location,
          rows:
            calculations
              .filter(
                (
                  row
                ) =>
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
        (
          group
        ) =>
          group.rows.length >
          0
      )


  const productionLocationCount =
    locationRows.length


  const calculatedCount =
    calculations.filter(
      (
        row
      ) =>
        row.complete
    ).length


  const unresolvedCount =
    calculations.length -
    calculatedCount


  const rawDurations =
    calculations
      .map(
        (
          row
        ) =>
          row.rawDuration
      )
      .filter(
        (
          value
        ) =>
          Number.isFinite(
            value
          )
      )


  const averageRawDuration =
    rawDurations.length >
    0
      ? rawDurations.reduce(
          (
            total,
            value
          ) =>
            total +
            value,
          0
        ) /
        rawDurations.length
      : 0


  return (

    <section
      style={{
        display:
          'grid',

        gap:
          '18px',
      }}
    >

      <div
        style={{
          display:
            'flex',

          alignItems:
            'flex-start',

          justifyContent:
            'space-between',

          gap:
            '16px',

          flexWrap:
            'wrap',

          padding:
            '20px 22px',

          border:
            `1px solid ${BORDER}`,

          borderRadius:
            '12px',

          background:
            '#ffffff',
        }}
      >

        <div>

          <div
            style={{
              color:
                TEAL,

              fontSize:
                '11px',

              lineHeight:
                1,

              fontWeight:
                900,

              letterSpacing:
                '0.06em',

              textTransform:
                'uppercase',
            }}
          >
            {
              selectedProject.code
            }
          </div>


          <h2
            style={{
              margin:
                '6px 0 0',

              color:
                NAVY,

              fontSize:
                '22px',

              lineHeight:
                1.2,

              fontWeight:
                900,
            }}
          >
            Pre-Planning
          </h2>


          <p
            style={{
              maxWidth:
                '880px',

              margin:
                '8px 0 0',

              color:
                MUTED,

              fontSize:
                '13px',

              lineHeight:
                1.55,
            }}
          >
            Raw duration by production location. Quantity comes from Project Setup Allocation; productivity and workforce come from Production Parameters. Takt standardization is intentionally not applied yet.
          </p>

        </div>


        <Link
          href="/dashboard/planning/pre-planning"
          style={{
            display:
              'inline-flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            minHeight:
              '38px',

            padding:
              '0 12px',

            border:
              `1px solid ${BORDER}`,

            borderRadius:
              '8px',

            background:
              '#ffffff',

            color:
              '#425a70',

            fontSize:
              '12px',

            fontWeight:
              800,

            textDecoration:
              'none',

            whiteSpace:
              'nowrap',
          }}
        >
          Change Project
        </Link>

      </div>


      <div
        style={{
          display:
            'grid',

          gridTemplateColumns:
            'repeat(4, minmax(0, 1fr))',

          gap:
            '12px',
        }}
      >

        <MetricCard
          label="Production Locations"
          value={
            productionLocationCount
          }
          detail="Locations with allocated quantity"
        />


        <MetricCard
          label="Activity Calculations"
          value={
            calculations.length
          }
          detail={`${calculatedCount} calculated`}
        />


        <MetricCard
          label="Missing Parameters"
          value={
            unresolvedCount
          }
          detail="Allocation rows without usable capacity"
        />


        <MetricCard
          label="Average Raw Duration"
          value={
            rawDurations.length >
            0
              ? `${safeNumber(
                  averageRawDuration,
                  2
                )} d`
              : '—'
          }
          detail="Informational only; no Takt rounding"
        />

      </div>


      <div
        style={{
          padding:
            '13px 15px',

          border:
            '1px solid #bae6e0',

          borderRadius:
            '10px',

          background:
            '#f0fdfa',

          color:
            '#135e56',

          fontSize:
            '12px',

          lineHeight:
            1.5,
        }}
      >
        <strong>Calculation rule:</strong>{' '}
        Production Capacity = Productivity × Effective Workforce. Raw Duration = Allocated Quantity ÷ Production Capacity.
      </div>


      {locationRows.length >
      0 ? (

        locationRows.map(
          (
            group
          ) => {

            const location =
              group.location


            const locationPath =
              buildLocationPath(
                location,
                locationMap
              )


            const resolvedRows =
              group.rows.filter(
                (
                  row
                ) =>
                  row.complete
              ).length


            return (

              <section
                key={
                  location.id
                }
                style={{
                  overflow:
                    'hidden',

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
                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'space-between',

                    gap:
                      '12px',

                    padding:
                      '14px 16px',

                    background:
                      '#f7fafc',

                    borderBottom:
                      `1px solid ${BORDER}`,
                  }}
                >

                  <div>

                    <div
                      style={{
                        color:
                          '#64748b',

                        fontSize:
                          '10px',

                        fontWeight:
                          900,

                        letterSpacing:
                          '0.07em',

                        textTransform:
                          'uppercase',
                      }}
                    >
                      {
                        locationTypeLabel(
                          location.location_type
                        )
                      }
                    </div>


                    <div
                      style={{
                        marginTop:
                          '4px',

                        color:
                          NAVY,

                        fontSize:
                          '14px',

                        fontWeight:
                          900,
                      }}
                    >
                      {
                        locationPath
                      }
                    </div>

                  </div>


                  <div
                    style={{
                      color:
                        resolvedRows ===
                        group.rows.length
                          ? READY
                          : WARNING,

                      fontSize:
                        '11px',

                      fontWeight:
                        900,

                      whiteSpace:
                        'nowrap',
                    }}
                  >
                    {resolvedRows}/{group.rows.length} calculated
                  </div>

                </div>


                <div
                  style={{
                    overflowX:
                      'auto',
                  }}
                >

                  <table
                    style={{
                      width:
                        '100%',

                      minWidth:
                        '1120px',

                      borderCollapse:
                        'collapse',

                      tableLayout:
                        'fixed',
                    }}
                  >

                    <thead>

                      <tr>

                        {[
                          [
                            'WP',
                            '70px',
                          ],
                          [
                            'Scope Item',
                            '260px',
                          ],
                          [
                            'Qty',
                            '100px',
                          ],
                          [
                            'Productivity',
                            '120px',
                          ],
                          [
                            'Basis',
                            '140px',
                          ],
                          [
                            'Workforce',
                            '100px',
                          ],
                          [
                            'Capacity',
                            '150px',
                          ],
                          [
                            'Raw Duration',
                            '140px',
                          ],
                          [
                            'Status',
                            '110px',
                          ],
                        ].map(
                          (
                            [
                              label,
                              width,
                            ]
                          ) => (

                            <th
                              key={
                                label
                              }
                              style={{
                                width,

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

                                lineHeight:
                                  1.2,

                                fontWeight:
                                  900,

                                textAlign:
                                  'left',

                                textTransform:
                                  'uppercase',

                                letterSpacing:
                                  '0.04em',
                              }}
                            >
                              {label}
                            </th>

                          )
                        )}

                      </tr>

                    </thead>


                    <tbody>

                      {group.rows.map(
                        (
                          row,
                          index
                        ) => (

                          <tr
                            key={
                              row.id
                            }
                            style={{
                              background:
                                index %
                                  2 ===
                                1
                                  ? '#fbfcfd'
                                  : '#ffffff',
                            }}
                          >

                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  TEAL,

                                fontSize:
                                  '11px',

                                fontWeight:
                                  900,
                              }}
                            >
                              {
                                row.workPackageCode
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  TEXT,

                                fontSize:
                                  '12px',

                                lineHeight:
                                  1.35,

                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                row.scopeItemName
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  TEXT,

                                fontSize:
                                  '12px',
                              }}
                            >
                              {safeNumber(
                                row.quantity,
                                2
                              )}{' '}
                              {
                                row.unit
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  TEXT,

                                fontSize:
                                  '12px',
                              }}
                            >
                              {
                                row.productivity ===
                                null
                                  ? '—'
                                  : safeNumber(
                                      row.productivity,
                                      2
                                    )
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  TEXT,

                                fontSize:
                                  '12px',
                              }}
                            >
                              {
                                row.productivityBasis ===
                                'crew_day'
                                  ? 'Per crew / day'
                                  : row.productivityBasis ===
                                      'worker_day'
                                    ? 'Per worker / day'
                                    : '—'
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  TEXT,

                                fontSize:
                                  '12px',
                              }}
                            >
                              {
                                row.workforce ===
                                null
                                  ? '—'
                                  : safeNumber(
                                      row.workforce,
                                      2
                                    )
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  TEXT,

                                fontSize:
                                  '12px',
                              }}
                            >
                              {
                                row.productionCapacity ===
                                null
                                  ? '—'
                                  : `${safeNumber(
                                      row.productionCapacity,
                                      2
                                    )} ${row.unit}/day`
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,

                                color:
                                  row.rawDuration ===
                                  null
                                    ? MUTED
                                    : NAVY,

                                fontSize:
                                  '12px',

                                fontWeight:
                                  row.rawDuration ===
                                  null
                                    ? 600
                                    : 900,
                              }}
                            >
                              {
                                row.rawDuration ===
                                null
                                  ? '—'
                                  : `${safeNumber(
                                      row.rawDuration,
                                      2
                                    )} days`
                              }
                            </td>


                            <td
                              style={{
                                padding:
                                  '11px 12px',

                                borderBottom:
                                  `1px solid #edf1f4`,
                              }}
                            >

                              <span
                                style={{
                                  display:
                                    'inline-flex',

                                  alignItems:
                                    'center',

                                  minHeight:
                                    '24px',

                                  padding:
                                    '0 8px',

                                  borderRadius:
                                    '999px',

                                  background:
                                    row.complete
                                      ? '#e9f8f4'
                                      : '#fff7e3',

                                  color:
                                    row.complete
                                      ? READY
                                      : WARNING,

                                  fontSize:
                                    '10px',

                                  fontWeight:
                                    900,

                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {
                                  row.complete
                                    ? 'Calculated'
                                    : 'Missing input'
                                }
                              </span>

                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </section>

            )

          }
        )

      ) : (

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

            color:
              MUTED,

            fontSize:
              '13px',

            lineHeight:
              1.5,
          }}
        >
          No positive location allocations are available for this project. Complete Project Setup → Allocation before using Pre-Planning.
        </div>

      )}

    </section>

  )

}
