'use client'

import Link from 'next/link'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import styles from './pre-planning.module.css'


const DEFAULT_DAY_WIDTH = 34
const MIN_DAY_WIDTH = 24
const MAX_DAY_WIDTH = 84
const MIN_TIMELINE_DAYS = 20
const TIMELINE_PADDING_DAYS = 5


function safeNumber(
  value,
  digits = 2
) {
  const numeric =
    Number(value)

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
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }
  ).format(numeric)
}


function getActivityStatus(
  activity,
  targetTakt
) {
  const rawDuration =
    Number(
      activity?.rawDuration
    )

  const takt =
    Number(targetTakt)

  if (
    !Number.isFinite(rawDuration) ||
    rawDuration <= 0 ||
    !Number.isFinite(takt) ||
    takt <= 0
  ) {
    return {
      key: 'waiting',
      label: 'Waiting',
    }
  }

  const utilization =
    rawDuration / takt

  if (
    utilization > 1
  ) {
    return {
      key: 'gap',
      label: 'Capacity Gap',
    }
  }

  if (
    utilization >= 0.75
  ) {
    return {
      key: 'balanced',
      label: 'Balanced',
    }
  }

  return {
    key: 'underloaded',
    label: 'Underloaded',
  }
}


function getBasisLabel(
  basis
) {
  if (
    basis === 'crew_day'
  ) {
    return 'Per crew / day'
  }

  return 'Per worker / day'
}


function getResourceLabel(
  activity
) {
  const value =
    Number(
      activity
        ?.effectiveWorkforce
    )

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return '—'
  }

  const unit =
    activity
      ?.productivityBasis ===
    'crew_day'
      ? value === 1
        ? 'crew'
        : 'crews'
      : value === 1
        ? 'worker'
        : 'workers'

  return `${safeNumber(
    value
  )} ${unit}`
}


function getActivityCode(
  index
) {
  return String(
    (index + 1) * 10
  ).padStart(
    4,
    '0'
  )
}


function HeaderFilter({
  label,
  options,
  selectedValue,
  onChange,
  isOpen,
  onToggle,
  allLabel,
}) {
  const active =
    selectedValue !== 'all'

  const selectedOption =
    options.find(
      (option) =>
        option.id ===
        selectedValue
    )

  return (
    <div
      className={
        styles.headerFilter
      }
    >
      <button
        type="button"
        className={
          active
            ? styles.headerFilterButtonActive
            : styles.headerFilterButton
        }
        onClick={
          onToggle
        }
        aria-expanded={
          isOpen
        }
      >
        <span>
          {label}
        </span>

        <span
          className={
            isOpen
              ? styles.headerFilterArrowOpen
              : styles.headerFilterArrow
          }
        >
          ▾
        </span>
      </button>

      {active ? (
        <span
          className={
            styles.headerFilterDot
          }
        />
      ) : null}

      {isOpen ? (
        <div
          className={
            styles.headerFilterMenu
          }
        >
          <button
            type="button"
            className={
              selectedValue ===
              'all'
                ? styles.headerFilterOptionSelected
                : styles.headerFilterOption
            }
            onClick={() =>
              onChange(
                'all'
              )
            }
          >
            {allLabel}
          </button>

          {options.map(
            (option) => (
              <button
                key={
                  option.id
                }
                type="button"
                className={
                  selectedValue ===
                  option.id
                    ? styles.headerFilterOptionSelected
                    : styles.headerFilterOption
                }
                onClick={() =>
                  onChange(
                    option.id
                  )
                }
              >
                {
                  option.name
                }
              </button>
            )
          )}

          {active ? (
            <div
              className={
                styles.headerFilterSelection
              }
            >
              Filtered by:{' '}
              <strong>
                {selectedOption
                  ?.name ||
                  ''}
              </strong>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}


export default function PrePlanningWorkspace({
  project,
  activities = [],
  targetTakt = null,
  strategyStatus = 'draft',
  changeProjectHref = '/dashboard/planning/pre-planning',
}) {
  const [
    selectedActivityId,
    setSelectedActivityId,
  ] =
    useState(
      activities?.[0]?.id ||
      null
    )

  const [
    selectedLocation,
    setSelectedLocation,
  ] =
    useState('all')

  const [
    selectedDivision,
    setSelectedDivision,
  ] =
    useState('all')

  const [
    openFilter,
    setOpenFilter,
  ] =
    useState(null)

  const [
    dayWidth,
    setDayWidth,
  ] =
    useState(
      DEFAULT_DAY_WIDTH
    )


  const leftBodyRef =
    useRef(null)

  const rightBodyRef =
    useRef(null)

  const ganttHeaderRef =
    useRef(null)

  const scrollOwnerRef =
    useRef(null)

  const workspaceRef =
    useRef(null)


  const normalizedActivities =
    useMemo(
      () =>
        Array.isArray(
          activities
        )
          ? activities
          : [],
      [activities]
    )


  const locationOptions =
    useMemo(
      () => {
        const map =
          new Map()

        normalizedActivities.forEach(
          (activity) => {
            if (
              activity.locationId &&
              activity.locationName
            ) {
              map.set(
                activity.locationId,
                activity.locationName
              )
            }
          }
        )

        return Array.from(
          map.entries()
        )
          .map(
            ([
              id,
              name,
            ]) => ({
              id,
              name,
            })
          )
          .sort(
            (
              first,
              second
            ) =>
              first.name.localeCompare(
                second.name,
                undefined,
                {
                  numeric: true,
                }
              )
          )
      },
      [
        normalizedActivities,
      ]
    )


  const divisionOptions =
    useMemo(
      () => {
        const map =
          new Map()

        normalizedActivities
          .filter(
            (activity) =>
              selectedLocation ===
                'all' ||
              activity.locationId ===
                selectedLocation
          )
          .forEach(
            (activity) => {
              if (
                activity.divisionId &&
                activity.divisionName &&
                activity.divisionName !==
                  '—'
              ) {
                map.set(
                  activity.divisionId,
                  activity.divisionName
                )
              }
            }
          )

        return Array.from(
          map.entries()
        )
          .map(
            ([
              id,
              name,
            ]) => ({
              id,
              name,
            })
          )
          .sort(
            (
              first,
              second
            ) =>
              first.name.localeCompare(
                second.name,
                undefined,
                {
                  numeric: true,
                }
              )
          )
      },
      [
        normalizedActivities,
        selectedLocation,
      ]
    )


  const filteredActivities =
    useMemo(
      () =>
        normalizedActivities.filter(
          (activity) => {
            const matchesLocation =
              selectedLocation ===
                'all' ||
              activity.locationId ===
                selectedLocation

            const matchesDivision =
              selectedDivision ===
                'all' ||
              activity.divisionId ===
                selectedDivision

            return (
              matchesLocation &&
              matchesDivision
            )
          }
        ),
      [
        normalizedActivities,
        selectedLocation,
        selectedDivision,
      ]
    )


  const selectedActivity =
    useMemo(
      () =>
        filteredActivities.find(
          (activity) =>
            activity.id ===
            selectedActivityId
        ) ||
        filteredActivities[0] ||
        null,
      [
        filteredActivities,
        selectedActivityId,
      ]
    )


  const maxRawDuration =
    useMemo(
      () => {
        const durations =
          filteredActivities
            .map(
              (activity) =>
                Number(
                  activity.rawDuration
                )
            )
            .filter(
              (duration) =>
                Number.isFinite(
                  duration
                ) &&
                duration > 0
            )

        if (
          durations.length ===
          0
        ) {
          return 0
        }

        return Math.max(
          ...durations
        )
      },
      [
        filteredActivities,
      ]
    )


  const timelineDays =
    useMemo(
      () => {
        const calculated =
          Math.ceil(
            maxRawDuration
          ) +
          TIMELINE_PADDING_DAYS

        return Math.max(
          MIN_TIMELINE_DAYS,
          calculated
        )
      },
      [
        maxRawDuration,
      ]
    )


  const dayMarkers =
    useMemo(
      () =>
        Array.from(
          {
            length:
              timelineDays + 1,
          },
          (
            _,
            index
          ) =>
            index
        ),
      [
        timelineDays,
      ]
    )


  const timelineWidth =
    timelineDays *
    dayWidth


  useEffect(
    () => {
      function handleClickOutside(
        event
      ) {
        if (
          !workspaceRef
            .current
            ?.contains(
              event.target
            )
        ) {
          setOpenFilter(
            null
          )
        }
      }

      document.addEventListener(
        'mousedown',
        handleClickOutside
      )

      return () => {
        document.removeEventListener(
          'mousedown',
          handleClickOutside
        )
      }
    },
    []
  )


  function syncVerticalScroll(
    source
  ) {
    if (
      scrollOwnerRef.current &&
      scrollOwnerRef.current !==
        source
    ) {
      return
    }

    scrollOwnerRef.current =
      source

    if (
      source === 'left'
    ) {
      if (
        leftBodyRef.current &&
        rightBodyRef.current
      ) {
        rightBodyRef.current.scrollTop =
          leftBodyRef.current.scrollTop
      }
    } else {
      if (
        leftBodyRef.current &&
        rightBodyRef.current
      ) {
        leftBodyRef.current.scrollTop =
          rightBodyRef.current.scrollTop
      }
    }

    window.requestAnimationFrame(
      () => {
        scrollOwnerRef.current =
          null
      }
    )
  }


  function handleGanttScroll() {
    syncVerticalScroll(
      'right'
    )

    if (
      rightBodyRef.current &&
      ganttHeaderRef.current
    ) {
      ganttHeaderRef.current.scrollLeft =
        rightBodyRef.current.scrollLeft
    }
  }


  function handleLocationChange(
    value
  ) {
    setSelectedLocation(
      value
    )

    setSelectedDivision(
      'all'
    )

    setOpenFilter(
      null
    )
  }


  function handleDivisionChange(
    value
  ) {
    setSelectedDivision(
      value
    )

    setOpenFilter(
      null
    )
  }


  function zoomIn() {
    setDayWidth(
      (current) =>
        Math.min(
          MAX_DAY_WIDTH,
          current + 6
        )
    )
  }


  function zoomOut() {
    setDayWidth(
      (current) =>
        Math.max(
          MIN_DAY_WIDTH,
          current - 6
        )
    )
  }


  function fitTimeline() {
    setDayWidth(
      DEFAULT_DAY_WIDTH
    )

    if (
      rightBodyRef.current
    ) {
      rightBodyRef.current.scrollLeft =
        0
    }

    if (
      ganttHeaderRef.current
    ) {
      ganttHeaderRef.current.scrollLeft =
        0
    }
  }


  const targetTaktNumber =
    Number(targetTakt)

  const hasTargetTakt =
    Number.isFinite(
      targetTaktNumber
    ) &&
    targetTaktNumber > 0


  const isApproved =
    strategyStatus ===
    'approved'


  return (
    <div
      ref={
        workspaceRef
      }
      className={
        styles.workspace
      }
    >
      <header
        className={
          styles.workspaceHeader
        }
      >
        <div
          className={
            styles.projectIdentity
          }
        >
          <div
            className={
              styles.eyebrow
            }
          >
            PRE-PLANNING
          </div>

          <div
            className={
              styles.projectTitleRow
            }
          >
            <h1
              className={
                styles.projectTitle
              }
            >
              {project?.code
                ? `${project.code} · `
                : ''}

              {project?.name ||
                'Project'}
            </h1>

            <span
              className={
                isApproved
                  ? styles.statusApproved
                  : styles.statusDraft
              }
            >
              {isApproved
                ? 'Approved'
                : 'Draft'}
            </span>
          </div>

          <p
            className={
              styles.projectDescription
            }
          >
            Production data visualization before detailed scheduling.
            Raw Duration is calculated from quantity, productivity and
            effective resources.
          </p>
        </div>


        <div
          className={
            styles.headerActions
          }
        >
          <div
            className={
              styles.summaryMetric
            }
          >
            <span
              className={
                styles.summaryMetricLabel
              }
            >
              Activities
            </span>

            <strong>
              {
                filteredActivities.length
              }
            </strong>
          </div>

          <div
            className={
              styles.summaryMetric
            }
          >
            <span
              className={
                styles.summaryMetricLabel
              }
            >
              Target Takt
            </span>

            <strong>
              {hasTargetTakt
                ? `${safeNumber(
                    targetTaktNumber
                  )} d`
                : '—'}
            </strong>
          </div>

          <Link
            href={
              changeProjectHref
            }
            className={
              styles.changeProjectButton
            }
          >
            Change Project
          </Link>
        </div>
      </header>


      <div
        className={
          styles.toolbar
        }
      >
        <div
          className={
            styles.toolbarGroup
          }
        >
          <div
            className={
              styles.toolbarTitle
            }
          >
            Production Gantt
          </div>

          <span
            className={
              styles.lockedBadge
            }
          >
            DURATIONS LOCKED
          </span>
        </div>


        <div
          className={
            styles.toolbarGroup
          }
        >
          <button
            type="button"
            onClick={
              zoomOut
            }
            disabled={
              dayWidth <=
              MIN_DAY_WIDTH
            }
            className={
              styles.toolbarButton
            }
          >
            −
          </button>

          <div
            className={
              styles.zoomValue
            }
          >
            {dayWidth}px / day
          </div>

          <button
            type="button"
            onClick={
              zoomIn
            }
            disabled={
              dayWidth >=
              MAX_DAY_WIDTH
            }
            className={
              styles.toolbarButton
            }
          >
            +
          </button>

          <button
            type="button"
            onClick={
              fitTimeline
            }
            className={
              styles.toolbarButtonWide
            }
          >
            Fit
          </button>
        </div>
      </div>


      <div
        className={
          styles.planningGrid
        }
      >
        <section
          className={
            styles.activityPane
          }
        >
          <div
            className={
              styles.activityHeader
            }
          >
            <div
              className={
                styles.activityHeaderCell
              }
            >
              ID
            </div>

            <div
              className={
                styles.activityHeaderCell
              }
            >
              WP
            </div>

            <div
              className={
                styles.activityHeaderCell
              }
            >
              Scope Item
            </div>

            <div
              className={
                styles.activityHeaderFilterCell
              }
            >
              <HeaderFilter
                label="Location"
                options={
                  locationOptions
                }
                selectedValue={
                  selectedLocation
                }
                onChange={
                  handleLocationChange
                }
                isOpen={
                  openFilter ===
                  'location'
                }
                onToggle={() =>
                  setOpenFilter(
                    (
                      current
                    ) =>
                      current ===
                      'location'
                        ? null
                        : 'location'
                  )
                }
                allLabel="All Locations"
              />
            </div>

            <div
              className={
                styles.activityHeaderFilterCell
              }
            >
              <HeaderFilter
                label="Division"
                options={
                  divisionOptions
                }
                selectedValue={
                  selectedDivision
                }
                onChange={
                  handleDivisionChange
                }
                isOpen={
                  openFilter ===
                  'division'
                }
                onToggle={() =>
                  setOpenFilter(
                    (
                      current
                    ) =>
                      current ===
                      'division'
                        ? null
                        : 'division'
                  )
                }
                allLabel="All Divisions"
              />
            </div>

            <div
              className={
                styles.activityHeaderCellRight
              }
            >
              Qty
            </div>

            <div
              className={
                styles.activityHeaderCellRight
              }
            >
              Capacity
            </div>

            <div
              className={
                styles.activityHeaderCellRight
              }
            >
              Raw Dur.
            </div>
          </div>


          <div
            ref={
              leftBodyRef
            }
            className={
              styles.activityBody
            }
            onScroll={() =>
              syncVerticalScroll(
                'left'
              )
            }
          >
            {filteredActivities.length >
            0 ? (
              filteredActivities.map(
                (
                  activity,
                  index
                ) => {
                  const isSelected =
                    selectedActivity?.id ===
                    activity.id

                  const hasDuration =
                    Number.isFinite(
                      Number(
                        activity.rawDuration
                      )
                    )

                  return (
                    <button
                      key={
                        activity.id
                      }
                      type="button"
                      className={
                        isSelected
                          ? styles.activityRowSelected
                          : styles.activityRow
                      }
                      onClick={() =>
                        setSelectedActivityId(
                          activity.id
                        )
                      }
                    >
                      <div
                        className={
                          styles.activityId
                        }
                      >
                        {getActivityCode(
                          index
                        )}
                      </div>

                      <div
                        className={
                          styles.workPackageCode
                        }
                      >
                        <span
                          className={
                            styles.workPackageIndicator
                          }
                          style={{
                            background:
                              activity.workPackageColor ||
                              '#00998b',
                          }}
                        />

                        <span>
                          {activity.workPackageCode ||
                            '—'}
                        </span>
                      </div>

                      <div
                        className={
                          styles.scopeItemName
                        }
                      >
                        {activity.scopeItemName ||
                          'Scope Item'}
                      </div>

                      <div
                        className={
                          styles.locationName
                        }
                      >
                        {activity.locationName ||
                          '—'}
                      </div>

                      <div
                        className={
                          styles.divisionName
                        }
                      >
                        {activity.divisionName ||
                          '—'}
                      </div>

                      <div
                        className={
                          styles.numericCell
                        }
                      >
                        {safeNumber(
                          activity.quantity
                        )}{' '}

                        <span
                          className={
                            styles.unitText
                          }
                        >
                          {activity.unit ||
                            ''}
                        </span>
                      </div>

                      <div
                        className={
                          styles.numericCell
                        }
                      >
                        {Number.isFinite(
                          Number(
                            activity.productionCapacity
                          )
                        )
                          ? `${safeNumber(
                              activity.productionCapacity
                            )}/d`
                          : '—'}
                      </div>

                      <div
                        className={
                          hasDuration
                            ? styles.durationCell
                            : styles.missingDurationCell
                        }
                      >
                        {hasDuration
                          ? `${safeNumber(
                              activity.rawDuration
                            )} d`
                          : '—'}
                      </div>
                    </button>
                  )
                }
              )
            ) : (
              <div
                className={
                  styles.emptyActivityState
                }
              >
                <strong>
                  No activities match the selected filters
                </strong>

                <span>
                  Change the Location or Division filter from the column header.
                </span>
              </div>
            )}
          </div>
        </section>


        <section
          className={
            styles.ganttPane
          }
        >
          <div
            ref={
              ganttHeaderRef
            }
            className={
              styles.ganttHeaderScroll
            }
          >
            <div
              className={
                styles.ganttHeader
              }
              style={{
                width:
                  timelineWidth,
              }}
            >
              {dayMarkers.map(
                (day) => (
                  <div
                    key={day}
                    className={
                      day %
                        5 ===
                      0
                        ? styles.dayHeaderMajor
                        : styles.dayHeader
                    }
                    style={{
                      width:
                        dayWidth,
                      left:
                        day *
                        dayWidth,
                    }}
                  >
                    {day}
                  </div>
                )
              )}
            </div>
          </div>


          <div
            ref={
              rightBodyRef
            }
            className={
              styles.ganttBody
            }
            onScroll={
              handleGanttScroll
            }
          >
            <div
              className={
                styles.ganttCanvas
              }
              style={{
                width:
                  timelineWidth,

                height:
                  Math.max(
                    filteredActivities.length *
                      44,
                    44
                  ),
              }}
            >
              <div
                className={
                  styles.gridBackground
                }
                style={{
                  backgroundSize: `${dayWidth}px 100%`,
                }}
              />

              {dayMarkers.map(
                (day) =>
                  day %
                    5 ===
                  0 ? (
                    <div
                      key={`major-${day}`}
                      className={
                        styles.majorGridLine
                      }
                      style={{
                        left:
                          day *
                          dayWidth,
                      }}
                    />
                  ) : null
              )}


              {filteredActivities.map(
                (
                  activity,
                  index
                ) => {
                  const rawDuration =
                    Number(
                      activity.rawDuration
                    )

                  const hasDuration =
                    Number.isFinite(
                      rawDuration
                    ) &&
                    rawDuration > 0

                  const isSelected =
                    selectedActivity?.id ===
                    activity.id

                  const status =
                    getActivityStatus(
                      activity,
                      targetTakt
                    )

                  const width =
                    hasDuration
                      ? Math.max(
                          rawDuration *
                            dayWidth,
                          4
                        )
                      : 0

                  return (
                    <button
                      key={
                        activity.id
                      }
                      type="button"
                      className={
                        isSelected
                          ? styles.ganttRowSelected
                          : styles.ganttRow
                      }
                      style={{
                        top:
                          index *
                          44,
                      }}
                      onClick={() =>
                        setSelectedActivityId(
                          activity.id
                        )
                      }
                    >
                      {hasDuration ? (
                        <div
                          className={`${styles.ganttBar} ${
                            status.key ===
                            'gap'
                              ? styles.ganttBarGap
                              : status.key ===
                                  'balanced'
                                ? styles.ganttBarBalanced
                                : status.key ===
                                    'underloaded'
                                  ? styles.ganttBarUnderloaded
                                  : styles.ganttBarWaiting
                          }`}
                          style={{
                            left: 0,
                            width,
                          }}
                        >
                          <span
                            className={
                              styles.ganttBarLabel
                            }
                          >
                            {safeNumber(
                              rawDuration
                            )}{' '}
                            d
                          </span>
                        </div>
                      ) : (
                        <span
                          className={
                            styles.missingBar
                          }
                        >
                          Missing Production Parameters
                        </span>
                      )}
                    </button>
                  )
                }
              )}
            </div>
          </div>
        </section>
      </div>


      <footer
        className={
          styles.inspector
        }
      >
        {selectedActivity ? (
          <>
            <div
              className={
                styles.inspectorIdentity
              }
            >
              <div
                className={
                  styles.inspectorEyebrow
                }
              >
                SELECTED ACTIVITY
              </div>

              <div
                className={
                  styles.inspectorTitle
                }
              >
                <span
                  className={
                    styles.inspectorWorkPackage
                  }
                >
                  {selectedActivity.workPackageCode ||
                    '—'}
                </span>

                <span>
                  {selectedActivity.scopeItemName ||
                    'Scope Item'}
                </span>
              </div>

              <div
                className={
                  styles.inspectorLocation
                }
              >
                {selectedActivity.locationName ||
                  '—'}

                {selectedActivity.divisionName &&
                selectedActivity.divisionName !==
                  '—'
                  ? ` / ${selectedActivity.divisionName}`
                  : ''}
              </div>
            </div>


            <div
              className={
                styles.inspectorMetrics
              }
            >
              <InspectorMetric
                label="Location"
                value={
                  selectedActivity.locationName ||
                  '—'
                }
              />

              <InspectorMetric
                label="Division"
                value={
                  selectedActivity.divisionName ||
                  '—'
                }
                detail={
                  selectedActivity.divisionType ||
                  ''
                }
              />

              <InspectorMetric
                label="Quantity"
                value={`${safeNumber(
                  selectedActivity.quantity
                )} ${
                  selectedActivity.unit ||
                  ''
                }`}
              />

              <InspectorMetric
                label="Productivity"
                value={
                  Number.isFinite(
                    Number(
                      selectedActivity.productivity
                    )
                  )
                    ? `${safeNumber(
                        selectedActivity.productivity
                      )} ${
                        selectedActivity.unit ||
                        ''
                      }`
                    : '—'
                }
                detail={
                  getBasisLabel(
                    selectedActivity.productivityBasis
                  )
                }
              />

              <InspectorMetric
                label="Effective Resource"
                value={
                  getResourceLabel(
                    selectedActivity
                  )
                }
              />

              <InspectorMetric
                label="Capacity"
                value={
                  Number.isFinite(
                    Number(
                      selectedActivity.productionCapacity
                    )
                  )
                    ? `${safeNumber(
                        selectedActivity.productionCapacity
                      )} ${
                        selectedActivity.unit ||
                        ''
                      }/day`
                    : '—'
                }
              />

              <InspectorMetric
                label="Raw Duration"
                value={
                  Number.isFinite(
                    Number(
                      selectedActivity.rawDuration
                    )
                  )
                    ? `${safeNumber(
                        selectedActivity.rawDuration
                      )} d`
                    : '—'
                }
                emphasized
              />

              <InspectorMetric
                label="Takt Status"
                value={
                  getActivityStatus(
                    selectedActivity,
                    targetTakt
                  ).label
                }
                detail={
                  hasTargetTakt &&
                  Number.isFinite(
                    Number(
                      selectedActivity.rawDuration
                    )
                  )
                    ? `${safeNumber(
                        (
                          Number(
                            selectedActivity.rawDuration
                          ) /
                          targetTaktNumber
                        ) *
                          100,
                        0
                      )}% utilization`
                    : 'Target Takt required'
                }
              />
            </div>
          </>
        ) : (
          <div
            className={
              styles.noSelection
            }
          >
            No activity is available with the current filters.
          </div>
        )}
      </footer>
    </div>
  )
}


function InspectorMetric({
  label,
  value,
  detail = '',
  emphasized = false,
}) {
  return (
    <div
      className={
        emphasized
          ? styles.inspectorMetricEmphasized
          : styles.inspectorMetric
      }
    >
      <span
        className={
          styles.inspectorMetricLabel
        }
      >
        {label}
      </span>

      <strong
        className={
          styles.inspectorMetricValue
        }
      >
        {value}
      </strong>

      {detail ? (
        <span
          className={
            styles.inspectorMetricDetail
          }
        >
          {detail}
        </span>
      ) : null}
    </div>
  )
}
