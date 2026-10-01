'use client'

import {
  useMemo,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/client'

import styles from './project-setup.module.css'


function getErrorMessage(error) {
  if (!error) {
    return 'An unexpected error occurred.'
  }

  if (error.code === '23505') {
    return 'A quantity record with the same identifying information already exists.'
  }

  if (error.code === '23503') {
    return 'This quantity is connected to other project information and cannot be changed.'
  }

  if (error.code === '23514') {
    return 'The quantity does not satisfy the project allocation rules.'
  }

  if (error.code === '42501') {
    return 'Your account does not have permission to perform this action.'
  }

  return (
    error.message ||
    'The requested operation could not be completed.'
  )
}


function getLocationTypeLabel(locationType) {
  const labels = {
    building: 'Building',
    floor: 'Floor',
    zone: 'Zone',
    area: 'Area',
    room: 'Room',
    custom: 'Custom',
  }

  return (
    labels[locationType] ||
    locationType ||
    'Location'
  )
}


function getZoneColor(zoneName) {
  if (!zoneName) {
    return '#ffffff'
  }

  const normalized =
    String(zoneName)
      .trim()
      .toUpperCase()

  const fixedColors = {
    Z1: '#ebf8ff',
    Z2: '#f0fff4',
    Z3: '#fffaf0',
    Z4: '#f5f3ff',
    Z5: '#fff1f2',
    Z6: '#ecfeff',
    Z7: '#fefce8',
    Z8: '#f0fdf4',

    'ZONE 1': '#ebf8ff',
    'ZONE 2': '#f0fff4',
    'ZONE 3': '#fffaf0',
    'ZONE 4': '#f5f3ff',
    'ZONE 5': '#fff1f2',
    'ZONE 6': '#ecfeff',

    'ZONE A': '#f5f3ff',
    'ZONE B': '#fffaf0',
    'ZONE C': '#f0fff4',
  }

  if (
    fixedColors[normalized]
  ) {
    return fixedColors[normalized]
  }

  const palette = [
    '#ebf8ff',
    '#f0fff4',
    '#fffaf0',
    '#f5f3ff',
    '#fff1f2',
    '#ecfeff',
    '#fefce8',
    '#f0fdf4',
    '#fdf4ff',
    '#f8fafc',
  ]

  let hash = 0

  for (
    let index = 0;
    index < normalized.length;
    index += 1
  ) {
    hash =
      normalized.charCodeAt(index) +
      ((hash << 5) - hash)
  }

  return palette[
    Math.abs(hash) %
      palette.length
  ]
}


function formatQuantity(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  const numericValue =
    Number(value)

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return String(value)
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(numericValue)
}


export default function QuantityAllocationMatrix({
  projectId,
  projectCode = '',
  userId,
  locations = [],
  scopeItems = [],
  initialAllocations = [],
}) {
  const router =
    useRouter()

  const supabase =
    useMemo(
      () => createClient(),
      []
    )


  // ==========================================================
  // STATE
  // ==========================================================

  const [
    allocations,
    setAllocations,
  ] =
    useState(
      initialAllocations
    )

  const [
    quantityDrafts,
    setQuantityDrafts,
  ] =
    useState(() => {
      const drafts = {}

      initialAllocations.forEach(
        (allocation) => {
          const key =
            `${allocation.location_id}___${allocation.service_id}`

          drafts[key] =
            allocation.quantity ===
              null ||
            allocation.quantity ===
              undefined
              ? ''
              : String(
                  allocation.quantity
                )
        }
      )

      return drafts
    })

  const [
    searchTerm,
    setSearchTerm,
  ] =
    useState('')

  const [
    floorFilter,
    setFloorFilter,
  ] =
    useState('all')

  const [
    savingCellKey,
    setSavingCellKey,
  ] =
    useState(null)

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')

  const [
    noticeMessage,
    setNoticeMessage,
  ] =
    useState('')

  const [
    showQuantification,
    setShowQuantification,
  ] =
    useState(true)


  // ==========================================================
  // LOCATION MAP
  // ==========================================================

  const locationMap =
    useMemo(
      () =>
        new Map(
          locations.map(
            (location) => [
              location.id,
              location,
            ]
          )
        ),
      [
        locations,
      ]
    )


  // ==========================================================
  // LOCATION PATHS
  // ==========================================================

  const locationPathMap =
    useMemo(
      () => {
        const pathMap =
          new Map()

        function buildPath(
          location
        ) {
          if (!location) {
            return []
          }

          if (
            pathMap.has(
              location.id
            )
          ) {
            return pathMap.get(
              location.id
            )
          }

          const path = []
          const visitedIds =
            new Set()

          let currentLocation =
            location

          while (
            currentLocation &&
            !visitedIds.has(
              currentLocation.id
            )
          ) {
            visitedIds.add(
              currentLocation.id
            )

            path.unshift(
              currentLocation
            )

            currentLocation =
              currentLocation.parent_id
                ? locationMap.get(
                    currentLocation.parent_id
                  )
                : null
          }

          pathMap.set(
            location.id,
            path
          )

          return path
        }

        locations.forEach(
          (location) => {
            buildPath(location)
          }
        )

        return pathMap
      },
      [
        locations,
        locationMap,
      ]
    )


  // ==========================================================
  // SORT LOCATIONS
  // ==========================================================

  const sortedLocations =
    useMemo(
      () =>
        [...locations].sort(
          (
            firstLocation,
            secondLocation
          ) => {
            const firstSequence =
              Number(
                firstLocation.sequence_number
              ) || 0

            const secondSequence =
              Number(
                secondLocation.sequence_number
              ) || 0

            if (
              firstSequence !==
              secondSequence
            ) {
              return (
                firstSequence -
                secondSequence
              )
            }

            return String(
              firstLocation.name ||
                ''
            ).localeCompare(
              String(
                secondLocation.name ||
                  ''
              )
            )
          }
        ),
      [
        locations,
      ]
    )


  // ==========================================================
  // ACTIVE SCOPE ITEMS
  // ==========================================================

  const activeScopeItems =
    useMemo(
      () =>
        [...scopeItems]
          .filter(
            (scopeItem) =>
              scopeItem.is_active !==
              false
          )
          .sort(
            (
              firstScopeItem,
              secondScopeItem
            ) => {
              const firstSequence =
                Number(
                  firstScopeItem.sequence_number
                ) || 0

              const secondSequence =
                Number(
                  secondScopeItem.sequence_number
                ) || 0

              if (
                firstSequence !==
                secondSequence
              ) {
                return (
                  firstSequence -
                  secondSequence
                )
              }

              return String(
                firstScopeItem.service_name ||
                  ''
              ).localeCompare(
                String(
                  secondScopeItem.service_name ||
                    ''
                )
              )
            }
          ),
      [
        scopeItems,
      ]
    )


  // ==========================================================
  // FLOOR LOCATIONS
  // ==========================================================

  const floorLocations =
    useMemo(
      () =>
        sortedLocations.filter(
          (location) =>
            location.location_type ===
            'floor'
        ),
      [
        sortedLocations,
      ]
    )


  // ==========================================================
  // MATRIX LOCATIONS
  //
  // Prefer assignable locations.
  //
  // If Area / Room / Custom locations do not exist,
  // leaf locations are used. This preserves the current
  // RF-0001 model where Zones are acting as the production
  // locations.
  // ==========================================================

  const matrixLocations =
    useMemo(
      () => {
        const assignableLocations =
          sortedLocations.filter(
            (location) =>
              location.location_type ===
                'area' ||
              location.location_type ===
                'room' ||
              location.location_type ===
                'custom'
          )

        const sourceLocations =
          assignableLocations.length >
          0
            ? assignableLocations
            : sortedLocations.filter(
                (location) =>
                  !locations.some(
                    (
                      candidate
                    ) =>
                      candidate.parent_id ===
                      location.id
                  )
              )

        const normalizedSearch =
          searchTerm
            .trim()
            .toLowerCase()

        return sourceLocations.filter(
          (location) => {
            const path =
              locationPathMap.get(
                location.id
              ) || []

            const floor =
              path.find(
                (
                  pathLocation
                ) =>
                  pathLocation.location_type ===
                  'floor'
              )

            const searchableText =
              [
                location.name,
                location.environment_type,
                location.location_type,

                ...path.map(
                  (
                    pathLocation
                  ) =>
                    pathLocation.name
                ),

                ...activeScopeItems.map(
                  (
                    scopeItem
                  ) =>
                    scopeItem.service_name
                ),

                ...activeScopeItems.map(
                  (
                    scopeItem
                  ) =>
                    scopeItem.service_code
                ),
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            const matchesSearch =
              !normalizedSearch ||
              searchableText.includes(
                normalizedSearch
              )

            const matchesFloor =
              floorFilter ===
                'all' ||
              floor?.id ===
                floorFilter

            return (
              matchesSearch &&
              matchesFloor
            )
          }
        )
      },
      [
        activeScopeItems,
        floorFilter,
        locationPathMap,
        locations,
        searchTerm,
        sortedLocations,
      ]
    )


  // ==========================================================
  // QUANTIFICATION BY DIVISION / ZONE
  // ==========================================================

  const quantificationByDivision =
    useMemo(
      () =>
        floorLocations
          .map((floor) => {
            const zones =
              sortedLocations
                .filter(
                  (location) =>
                    location.location_type ===
                    'zone'
                )
                .filter((zone) => {
                  const path =
                    locationPathMap.get(
                      zone.id
                    ) || []

                  return path.some(
                    (pathLocation) =>
                      pathLocation.id ===
                      floor.id
                  )
                })

            const totals =
              new Map()

            activeScopeItems.forEach(
              (scopeItem) => {
                zones.forEach(
                  (zone) => {
                    totals.set(
                      `${scopeItem.id}___${zone.id}`,
                      0
                    )
                  }
                )
              }
            )

            allocations.forEach(
              (allocation) => {
                const location =
                  locationMap.get(
                    allocation.location_id
                  )

                if (!location) return

                const path =
                  locationPathMap.get(
                    location.id
                  ) || []

                const floorInPath =
                  path.find(
                    (pathLocation) =>
                      pathLocation.location_type ===
                      'floor'
                  )

                const zoneInPath =
                  path.find(
                    (pathLocation) =>
                      pathLocation.location_type ===
                      'zone'
                  )

                if (
                  floorInPath?.id !==
                    floor.id ||
                  !zoneInPath ||
                  !zones.some(
                    (zone) =>
                      zone.id ===
                      zoneInPath.id
                  )
                ) {
                  return
                }

                const key =
                  `${allocation.service_id}___${zoneInPath.id}`

                totals.set(
                  key,
                  (totals.get(key) || 0) +
                    Number(
                      allocation.quantity ||
                        0
                    )
                )
              }
            )

            return {
              floor,
              zones,
              totals,
            }
          })
          .filter(
            (division) =>
              division.zones.length > 0
          ),
      [
        activeScopeItems,
        allocations,
        floorLocations,
        locationMap,
        locationPathMap,
        sortedLocations,
      ]
    )


  // ==========================================================
  // ALLOCATION MAP
  // ==========================================================

  const allocationMap =
    useMemo(
      () => {
        const map =
          new Map()

        allocations.forEach(
          (allocation) => {
            map.set(
              `${allocation.location_id}___${allocation.service_id}`,
              allocation
            )
          }
        )

        return map
      },
      [
        allocations,
      ]
    )


  // ==========================================================
  // SAVE QUANTITY
  // ==========================================================

  async function saveQuantity(
    locationId,
    serviceId
  ) {
    if (
      !projectId ||
      !userId
    ) {
      return
    }

    const key =
      `${locationId}___${serviceId}`

    const rawValue =
      quantityDrafts[key] ??
      ''

    const normalizedText =
      String(
        rawValue
      ).trim()

    const existingRecord =
      allocationMap.get(key)


    // --------------------------------------------------------
    // DELETE EXISTING QUANTITY WHEN FIELD IS CLEARED
    // --------------------------------------------------------

    if (
      normalizedText ===
      ''
    ) {
      if (
        !existingRecord
      ) {
        return
      }

      setSavingCellKey(
        key
      )

      setErrorMessage('')
      setNoticeMessage('')

      const {
        error,
      } =
        await supabase
          .from(
            'location_service_quantities'
          )
          .delete()
          .eq(
            'id',
            existingRecord.id
          )
          .eq(
            'project_id',
            projectId
          )

      if (error) {
        setErrorMessage(
          getErrorMessage(
            error
          )
        )

        setQuantityDrafts(
          (
            currentDrafts
          ) => ({
            ...currentDrafts,

            [key]:
              existingRecord.quantity ===
                null ||
              existingRecord.quantity ===
                undefined
                ? ''
                : String(
                    existingRecord.quantity
                  ),
          })
        )

        setSavingCellKey(
          null
        )

        return
      }

      setAllocations(
        (
          currentAllocations
        ) =>
          currentAllocations.filter(
            (
              allocation
            ) =>
              !(
                allocation.location_id ===
                  locationId &&
                allocation.service_id ===
                  serviceId
              )
          )
      )

      setQuantityDrafts(
        (
          currentDrafts
        ) => ({
          ...currentDrafts,

          [key]:
            '',
        })
      )

      setSavingCellKey(
        null
      )

      setNoticeMessage(
        'Allocation quantity was cleared.'
      )

      router.refresh()

      return
    }


    // --------------------------------------------------------
    // VALIDATE QUANTITY
    // --------------------------------------------------------

    const numericValue =
      Number(
        normalizedText.replace(
          ',',
          '.'
        )
      )

    if (
      !Number.isFinite(
        numericValue
      ) ||
      numericValue < 0
    ) {
      setErrorMessage(
        'Enter a valid quantity greater than or equal to zero.'
      )

      if (
        existingRecord
      ) {
        setQuantityDrafts(
          (
            currentDrafts
          ) => ({
            ...currentDrafts,

            [key]:
              existingRecord.quantity ===
                null ||
              existingRecord.quantity ===
                undefined
                ? ''
                : String(
                    existingRecord.quantity
                  ),
          })
        )
      } else {
        setQuantityDrafts(
          (
            currentDrafts
          ) => ({
            ...currentDrafts,

            [key]:
              '',
          })
        )
      }

      return
    }


    // --------------------------------------------------------
    // NOTHING CHANGED
    // --------------------------------------------------------

    if (
      existingRecord &&
      Number(
        existingRecord.quantity
      ) ===
        numericValue
    ) {
      return
    }


    setSavingCellKey(
      key
    )

    setErrorMessage('')
    setNoticeMessage('')


    // ========================================================
    // UPDATE EXISTING ALLOCATION
    // ========================================================

    if (
      existingRecord
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'location_service_quantities'
          )
          .update({
            quantity:
              numericValue,
          })
          .eq(
            'id',
            existingRecord.id
          )
          .eq(
            'project_id',
            projectId
          )
          .select(`
            id,
            project_id,
            location_id,
            service_id,
            quantity,
            source_scope_item_id,
            created_at,
            updated_at
          `)
          .single()

      if (error) {
        setErrorMessage(
          getErrorMessage(
            error
          )
        )

        setQuantityDrafts(
          (
            currentDrafts
          ) => ({
            ...currentDrafts,

            [key]:
              existingRecord.quantity ===
                null ||
              existingRecord.quantity ===
                undefined
                ? ''
                : String(
                    existingRecord.quantity
                  ),
          })
        )

        setSavingCellKey(
          null
        )

        return
      }

      setAllocations(
        (
          currentAllocations
        ) =>
          currentAllocations.map(
            (
              allocation
            ) =>
              allocation.id ===
              data.id
                ? data
                : allocation
          )
      )

      setQuantityDrafts(
        (
          currentDrafts
        ) => ({
          ...currentDrafts,

          [key]:
            String(
              data.quantity
            ),
        })
      )

      setSavingCellKey(
        null
      )

      setNoticeMessage(
        'Allocation quantity was updated.'
      )

      router.refresh()

      return
    }


    // ========================================================
    // CREATE NEW ALLOCATION
    // ========================================================

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'location_service_quantities'
        )
        .insert({
          project_id:
            projectId,

          location_id:
            locationId,

          service_id:
            serviceId,

          quantity:
            numericValue,

          created_by:
            userId,
        })
        .select(`
          id,
          project_id,
          location_id,
          service_id,
          quantity,
          source_scope_item_id,
          created_at,
          updated_at
        `)
        .single()

    if (error) {
      setErrorMessage(
        getErrorMessage(
          error
        )
      )

      setQuantityDrafts(
        (
          currentDrafts
        ) => ({
          ...currentDrafts,

          [key]:
            '',
        })
      )

      setSavingCellKey(
        null
      )

      return
    }

    setAllocations(
      (
        currentAllocations
      ) => [
        ...currentAllocations,
        data,
      ]
    )

    setQuantityDrafts(
      (
        currentDrafts
      ) => ({
        ...currentDrafts,

        [key]:
          String(
            data.quantity
          ),
      })
    )

    setSavingCellKey(
      null
    )

    setNoticeMessage(
      'Allocation quantity was saved.'
    )

    router.refresh()
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section
      className={
        styles.formPanel
      }
    >
      <div
        className={
          styles.formHeader
        }
      >
        <h2
          className={
            styles.formTitle
          }
        >
          Scope Allocation Matrix
        </h2>

        <p
          className={
            styles.formDescription
          }
        >
          Distribute each Scope Item quantity across the
          project&apos;s production locations. Scope Quantity
          remains authoritative and the reconciliation above
          updates after each saved allocation.
        </p>
      </div>


      {/* ======================================================
          MATRIX TOOLBAR
          ====================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 18px',
          borderBottom:
            '1px solid #e4ebf1',
          background:
            '#fbfcfd',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position:
                'absolute',
              left: '13px',
              top: '50%',
              transform:
                'translateY(-50%)',
              color: '#8391a4',
              fontSize:
                '0.85rem',
              pointerEvents:
                'none',
            }}
          >
            ⌕
          </span>

          <input
            type="search"
            value={
              searchTerm
            }
            onChange={(
              event
            ) =>
              setSearchTerm(
                event.target.value
              )
            }
            placeholder="Search locations or Scope Items..."
            style={{
              width: '100%',
              minHeight: '42px',
              boxSizing:
                'border-box',
              padding:
                '0 13px 0 36px',
              border:
                '1px solid #cfdbe5',
              borderRadius:
                '9px',
              outline:
                'none',
              background:
                '#ffffff',
              color:
                '#102f49',
              font:
                'inherit',
              fontSize:
                '0.82rem',
            }}
          />
        </div>

        <select
          value={
            floorFilter
          }
          onChange={(
            event
          ) =>
            setFloorFilter(
              event.target.value
            )
          }
          aria-label="Filter allocation matrix by division"
          style={{
            minWidth:
              '170px',
            minHeight:
              '42px',
            padding:
              '0 12px',
            border:
              '1px solid #cfdbe5',
            borderRadius:
              '9px',
            outline:
              'none',
            background:
              '#ffffff',
            color:
              '#28435c',
            font:
              'inherit',
            fontSize:
              '0.8rem',
            fontWeight:
              700,
          }}
        >
          <option
            value="all"
          >
            All divisions
          </option>

          {floorLocations.map(
            (
              floor
            ) => (
              <option
                value={
                  floor.id
                }
                key={
                  floor.id
                }
              >
                {
                  floor.name
                }
              </option>
            )
          )}
        </select>
      </div>


      {/* ======================================================
          ERROR
          ====================================================== */}

      {errorMessage && (
        <div
          className={
            styles.scopeWorkspaceError
          }
          role="alert"
        >
          {errorMessage}
        </div>
      )}


      {/* ======================================================
          EMPTY SCOPE
          ====================================================== */}

      {activeScopeItems.length ===
      0 ? (
        <div
          className={
            styles.workspaceEmpty
          }
        >
          <span
            className={
              styles.workspaceEmptyIcon
            }
          >
            SBS
          </span>

          <h3>
            No Scope Items
            available.
          </h3>

          <p>
            Define the project
            Scope Breakdown
            Structure before
            allocating quantities.
          </p>
        </div>
      ) : matrixLocations.length ===
        0 ? (
        <div
          className={
            styles.workspaceEmpty
          }
        >
          <span
            className={
              styles.workspaceEmptyIcon
            }
          >
            LOC
          </span>

          <h3>
            No production
            locations available.
          </h3>

          <p>
            Define the physical
            production hierarchy
            before allocating Scope
            Item quantities.
          </p>
        </div>
      ) : (
        <>
          {/* ==================================================
              MATRIX
              ================================================== */}

          <div
            style={{
              overflowX:
                'auto',
              overflowY:
                'auto',
              maxHeight:
                '560px',
              borderBottom:
                '1px solid #e4ebf1',
            }}
          >
            <table
              style={{
                width:
                  'max-content',
                minWidth:
                  '100%',
                borderCollapse:
                  'separate',
                borderSpacing:
                  0,
                fontSize:
                  '0.78rem',
              }}
            >
              <thead
                style={{
                  position:
                    'sticky',
                  top: 0,
                  zIndex: 20,
                }}
              >
                <tr>
                  <th
                    style={{
                      minWidth:
                        '200px',
                      position:
                        'sticky',
                      left: 0,
                      zIndex: 25,
                      padding:
                        '12px 14px',
                      borderRight:
                        '1px solid #365475',
                      borderBottom:
                        '1px solid #365475',
                      background:
                        '#2a4365',
                      color:
                        '#ffffff',
                      textAlign:
                        'left',
                      fontSize:
                        '0.65rem',
                      fontWeight:
                        850,
                      letterSpacing:
                        '0.05em',
                      textTransform:
                        'uppercase',
                    }}
                  >
                    Location
                  </th>

                  <th
                    style={{
                      minWidth:
                        '120px',
                      padding:
                        '12px 14px',
                      borderBottom:
                        '1px solid #dce5ed',
                      background:
                        '#f7fafc',
                      color:
                        '#718096',
                      fontSize:
                        '0.65rem',
                      fontWeight:
                        850,
                      textTransform:
                        'uppercase',
                    }}
                  >
                    Type
                  </th>

                  <th
                    style={{
                      minWidth:
                        '120px',
                      padding:
                        '12px 14px',
                      borderBottom:
                        '1px solid #dce5ed',
                      background:
                        '#f7fafc',
                      color:
                        '#718096',
                      fontSize:
                        '0.65rem',
                      fontWeight:
                        850,
                      textTransform:
                        'uppercase',
                    }}
                  >
                    Division
                  </th>

                  <th
                    style={{
                      minWidth:
                        '125px',
                      padding:
                        '12px 14px',
                      borderBottom:
                        '1px solid #dce5ed',
                      background:
                        '#f7fafc',
                      color:
                        '#718096',
                      fontSize:
                        '0.65rem',
                      fontWeight:
                        850,
                      textTransform:
                        'uppercase',
                    }}
                  >
                    Zone
                  </th>

                  {activeScopeItems.map(
                    (
                      scopeItem
                    ) => (
                      <th
                        key={
                          scopeItem.id
                        }
                        style={{
                          minWidth:
                            '145px',
                          maxWidth:
                            '180px',
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #dce5ed',
                          background:
                            '#f7fafc',
                          color:
                            '#52677d',
                          textAlign:
                            'center',
                          verticalAlign:
                            'bottom',
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            flexDirection:
                              'column',
                            alignItems:
                              'center',
                            gap:
                              '3px',
                          }}
                        >
                          <span
                            style={{
                              fontSize:
                                '0.64rem',
                              fontWeight:
                                850,
                              letterSpacing:
                                '0.03em',
                              textTransform:
                                'uppercase',
                              lineHeight:
                                1.25,
                            }}
                          >
                            {
                              scopeItem.service_name
                            }
                          </span>

                          {scopeItem.unit && (
                            <span
                              style={{
                                color:
                                  '#95a1af',
                                fontSize:
                                  '0.62rem',
                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                scopeItem.unit
                              }
                            </span>
                          )}

                          <span
                            style={{
                              color:
                                '#00a99d',
                              fontSize:
                                '0.59rem',
                              fontWeight:
                                850,
                            }}
                          >
                            Scope:{' '}
                            {formatQuantity(
                              scopeItem.scope_quantity
                            )}
                          </span>
                        </div>
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {matrixLocations.map(
                  (
                    location
                  ) => {
                    const path =
                      locationPathMap.get(
                        location.id
                      ) || []

                    const floor =
                      path.find(
                        (
                          pathLocation
                        ) =>
                          pathLocation.location_type ===
                          'floor'
                      )

                    const zone =
                      path.find(
                        (
                          pathLocation
                        ) =>
                          pathLocation.location_type ===
                          'zone'
                      )

                    const rowColor =
                      getZoneColor(
                        zone?.name ||
                          location.name
                      )

                    return (
                      <tr
                        key={
                          location.id
                        }
                        style={{
                          backgroundColor:
                            rowColor,
                        }}
                      >
                        <td
                          style={{
                            minWidth:
                              '200px',
                            position:
                              'sticky',
                            left: 0,
                            zIndex:
                              10,
                            padding:
                              '11px 14px',
                            borderRight:
                              '1px solid #cbd5e0',
                            borderBottom:
                              '1px solid #e4ebf1',
                            backgroundColor:
                              rowColor,
                            color:
                              '#153c58',
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            location.name
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              '11px 14px',
                            borderBottom:
                              '1px solid #e4ebf1',
                            backgroundColor:
                              rowColor,
                            textAlign:
                              'center',
                          }}
                        >
                          <span
                            style={{
                              display:
                                'inline-flex',
                              minHeight:
                                '24px',
                              alignItems:
                                'center',
                              padding:
                                '0 8px',
                              borderRadius:
                                '999px',
                              background:
                                '#edf2f7',
                              color:
                                '#52677d',
                              fontSize:
                                '0.64rem',
                              fontWeight:
                                800,
                              textTransform:
                                'uppercase',
                            }}
                          >
                            {location.environment_type ||
                              getLocationTypeLabel(
                                location.location_type
                              )}
                          </span>
                        </td>

                        <td
                          style={{
                            padding:
                              '11px 14px',
                            borderBottom:
                              '1px solid #e4ebf1',
                            backgroundColor:
                              rowColor,
                            color:
                              '#52677d',
                            textAlign:
                              'center',
                          }}
                        >
                          {floor?.name ||
                            '—'}
                        </td>

                        <td
                          style={{
                            padding:
                              '11px 14px',
                            borderBottom:
                              '1px solid #e4ebf1',
                            backgroundColor:
                              rowColor,
                            color:
                              '#153c58',
                            textAlign:
                              'center',
                            fontWeight:
                              800,
                          }}
                        >
                          {zone?.name ||
                            (
                              location.location_type ===
                              'zone'
                                ? location.name
                                : '—'
                            )}
                        </td>

                        {activeScopeItems.map(
                          (
                            scopeItem
                          ) => {
                            const cellKey =
                              `${location.id}___${scopeItem.id}`

                            const value =
                              quantityDrafts[
                                cellKey
                              ] ??
                              ''

                            const isCellSaving =
                              savingCellKey ===
                              cellKey

                            return (
                              <td
                                key={
                                  scopeItem.id
                                }
                                style={{
                                  minWidth:
                                    '145px',
                                  padding:
                                    '8px 10px',
                                  borderBottom:
                                    '1px solid #e4ebf1',
                                  backgroundColor:
                                    rowColor,
                                  textAlign:
                                    'center',
                                }}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  inputMode="decimal"
                                  value={
                                    value
                                  }
                                  onChange={(
                                    event
                                  ) => {
                                    const nextValue =
                                      event.target.value

                                    setQuantityDrafts(
                                      (
                                        currentDrafts
                                      ) => ({
                                        ...currentDrafts,

                                        [cellKey]:
                                          nextValue,
                                      })
                                    )
                                  }}
                                  onBlur={() =>
                                    saveQuantity(
                                      location.id,
                                      scopeItem.id
                                    )
                                  }
                                  onKeyDown={(
                                    event
                                  ) => {
                                    if (
                                      event.key ===
                                      'Enter'
                                    ) {
                                      event.currentTarget.blur()
                                    }
                                  }}
                                  disabled={
                                    isCellSaving
                                  }
                                  aria-label={`Quantity of ${scopeItem.service_name} at ${location.name}`}
                                  style={{
                                    width:
                                      '92px',
                                    maxWidth:
                                      '100%',
                                    minHeight:
                                      '35px',
                                    boxSizing:
                                      'border-box',
                                    padding:
                                      '0 8px',
                                    border:
                                      '1px solid #cbd5e0',
                                    borderRadius:
                                      '7px',
                                    outline:
                                      'none',
                                    backgroundColor:
                                      isCellSaving
                                        ? '#edf2f7'
                                        : '#ffffff',
                                    color:
                                      '#102f49',
                                    font:
                                      'inherit',
                                    fontSize:
                                      '0.8rem',
                                    textAlign:
                                      'center',
                                  }}
                                />
                              </td>
                            )
                          }
                        )}
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>


          {/* ==================================================
              FOOTER
              ================================================== */}

          <div
            style={{
              display:
                'flex',
              alignItems:
                'center',
              justifyContent:
                'space-between',
              gap:
                '16px',
              padding:
                '12px 16px',
              background:
                '#f8fafc',
              color:
                '#718096',
              fontSize:
                '0.7rem',
              fontWeight:
                700,
            }}
          >
            <span>
              {
                matrixLocations.length
              }{' '}
              {matrixLocations.length ===
              1
                ? 'production location'
                : 'production locations'}
            </span>

            <span>
              {
                activeScopeItems.length
              }{' '}
              {activeScopeItems.length ===
              1
                ? 'Scope Item column'
                : 'Scope Item columns'}
            </span>

            <span>
              Project:{' '}
              {
                projectCode ||
                projectId
              }
            </span>
          </div>
        </>
      )}


      {/* ======================================================
          QUANTIFICATION BY LOCATION
          ====================================================== */}

      <div
        style={{
          marginTop: '28px',
          borderTop: '1px solid #e4ebf1',
          paddingTop: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            marginBottom: showQuantification ? '18px' : 0,
          }}
        >
          <div>
            <p
              className={styles.formDescription}
              style={{
                margin: '0 0 6px',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Quantity consolidation
            </p>

            <h3
              className={styles.formTitle}
              style={{ margin: 0 }}
            >
              Quantification by Location
            </h3>
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              setShowQuantification(
                (currentValue) =>
                  !currentValue
              )
            }
          >
            {showQuantification
              ? 'Hide ▲'
              : 'Show ▼'}
          </button>
        </div>

        {showQuantification && (
          <div
            style={{
              border: '1px solid #cbd5e0',
              borderRadius: '8px',
              overflowX: 'auto',
              background: '#ffffff',
            }}
          >
            {quantificationByDivision.length ===
            0 ? (
              <div
                className={styles.workspaceEmpty}
              >
                <h3>
                  No division totals available.
                </h3>
                <p>
                  Create Division / Floor and Zone locations and enter Scope Item quantities to generate this table.
                </p>
              </div>
            ) : (
              quantificationByDivision.map(
                ({ floor, zones, totals }) => (
                  <div
                    key={floor.id}
                    style={{
                      marginBottom: '24px',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        minWidth: `${Math.max(
                          680,
                          360 +
                            zones.length *
                              180
                        )}px`,
                        borderCollapse: 'collapse',
                        fontSize: '0.86rem',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: '#2a4365',
                            color: '#ffffff',
                          }}
                        >
                          <th
                            style={{
                              width: '34%',
                              padding: '12px 14px',
                              border: '1px solid #1a365d',
                              textAlign: 'left',
                              fontWeight: 800,
                            }}
                          >
                            {floor.name}
                          </th>

                          <th
                            colSpan={zones.length}
                            style={{
                              padding: '12px 14px',
                              border: '1px solid #1a365d',
                              textAlign: 'center',
                              fontWeight: 800,
                              letterSpacing: '0.06em',
                            }}
                          >
                            ZONES
                          </th>
                        </tr>

                        <tr
                          style={{
                            backgroundColor: '#e2e8f0',
                            color: '#1a365d',
                          }}
                        >
                          <th
                            style={{
                              padding: '10px 14px',
                              border: '1px solid #cbd5e0',
                              textAlign: 'left',
                              fontStyle: 'italic',
                              fontWeight: 800,
                            }}
                          >
                            Scope Item
                          </th>

                          {zones.map((zone) => (
                            <th
                              key={zone.id}
                              style={{
                                padding: '10px 14px',
                                border: '1px solid #cbd5e0',
                                textAlign: 'center',
                                fontWeight: 800,
                                backgroundColor:
                                  getZoneColor(
                                    zone.name
                                  ),
                              }}
                            >
                              {zone.name}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {activeScopeItems.map(
                          (scopeItem) => (
                            <tr
                              key={scopeItem.id}
                            >
                              <td
                                style={{
                                  padding: '11px 14px',
                                  border: '1px solid #cbd5e0',
                                  fontWeight: 800,
                                  color: '#2d3748',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span>
                                    {String(
                                      scopeItem.service_name ||
                                        ''
                                    ).toUpperCase()}
                                  </span>

                                  {scopeItem.unit && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        color: '#718096',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {scopeItem.unit}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {zones.map((zone) => {
                                const total =
                                  totals.get(
                                    `${scopeItem.id}___${zone.id}`
                                  ) || 0

                                return (
                                  <td
                                    key={zone.id}
                                    style={{
                                      padding: '11px 14px',
                                      border: '1px solid #cbd5e0',
                                      textAlign: 'center',
                                      fontWeight:
                                        total > 0
                                          ? 700
                                          : 500,
                                      color:
                                        total > 0
                                          ? '#1a202c'
                                          : '#a0aec0',
                                      backgroundColor:
                                        total > 0
                                          ? getZoneColor(
                                              zone.name
                                            )
                                          : undefined,
                                    }}
                                  >
                                    {formatQuantity(
                                      total
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              )
            )}
          </div>
        )}
      </div>


      {/* ======================================================
          NOTICE
          ====================================================== */}

      {noticeMessage && (
        <div
          className={
            styles.scopeWorkspaceNotice
          }
          role="status"
        >
          <span>
            ✓
          </span>

          <span>
            {
              noticeMessage
            }
          </span>

          <button
            type="button"
            onClick={() =>
              setNoticeMessage(
                ''
              )
            }
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}
    </section>
  )
}
