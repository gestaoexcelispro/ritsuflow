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

const MIN_TIMELINE_DAYS = 30
const TIMELINE_PADDING_DAYS = 15

const SNAP_INCREMENT = 0.25
const ROW_HEIGHT = 44

const AUTO_SCROLL_EDGE = 70
const AUTO_SCROLL_SPEED = 18


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


function snapDay(
  value
) {
  const snapped =
    Math.round(
      value /
      SNAP_INCREMENT
    ) *
    SNAP_INCREMENT

  return Math.max(
    0,
    Number(
      snapped.toFixed(2)
    )
  )
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
    !Number.isFinite(
      rawDuration
    ) ||
    rawDuration <= 0 ||
    !Number.isFinite(
      takt
    ) ||
    takt <= 0
  ) {
    return {
      key: 'waiting',
      label: 'Waiting',
    }
  }

  const utilization =
    rawDuration /
    takt

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
      activity?.effectiveWorkforce
    )

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return '—'
  }

  const unit =
    activity?.productivityBasis ===
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


export default function PrePlanningWorkspace({
  project,
  activities = [],
  targetTakt = null,
  strategyStatus = 'draft',
  changeProjectHref = '/dashboard/planning/pre-planning',
}) {
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


  const [
    selectedActivityId,
    setSelectedActivityId,
  ] =
    useState(
      normalizedActivities?.[0]?.id ||
      null
    )


  const [
    startOffsets,
    setStartOffsets,
  ] =
    useState(() => {
      const initial = {}

      normalizedActivities.forEach(
        (activity) => {
          initial[
            activity.id
          ] = 0
        }
      )

      return initial
    })


  const [
    dragging,
    setDragging,
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


  useEffect(
    () => {
      setStartOffsets(
        (current) => {
          const next = {
            ...current,
          }

          normalizedActivities.forEach(
            (activity) => {
              if (
                next[
                  activity.id
                ] ===
                undefined
              ) {
                next[
                  activity.id
                ] = 0
              }
            }
          )

          return next
        }
      )
    },
    [
      normalizedActivities,
    ]
  )


  const selectedActivity =
    useMemo(
      () =>
        normalizedActivities.find(
          (activity) =>
            activity.id ===
            selectedActivityId
        ) ||
        normalizedActivities[0] ||
        null,
      [
        normalizedActivities,
        selectedActivityId,
      ]
    )


  const maxFinishOffset =
    useMemo(
      () => {
        let maximum = 0

        normalizedActivities.forEach(
          (activity) => {
            const duration =
              Number(
                activity.rawDuration
              )

            if (
              !Number.isFinite(
                duration
              ) ||
              duration <= 0
            ) {
              return
            }

            const start =
              Number(
                startOffsets[
                  activity.id
                ] ||
                0
              )

            maximum =
              Math.max(
                maximum,
                start +
                  duration
              )
          }
        )

        return maximum
      },
      [
        normalizedActivities,
        startOffsets,
      ]
    )


  const timelineDays =
    useMemo(
      () =>
        Math.max(
          MIN_TIMELINE_DAYS,
          Math.ceil(
            maxFinishOffset
          ) +
            TIMELINE_PADDING_DAYS
        ),
      [
        maxFinishOffset,
      ]
    )


  const dayMarkers =
    useMemo(
      () =>
        Array.from(
          {
            length:
              timelineDays +
              1,
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
      if (!dragging) {
        return undefined
      }


      function handlePointerMove(
        event
      ) {
        const ganttBody =
          rightBodyRef.current

        if (!ganttBody) {
          return
        }


        const bounds =
          ganttBody
            .getBoundingClientRect()


        if (
          event.clientX >
          bounds.right -
            AUTO_SCROLL_EDGE
        ) {
          ganttBody.scrollLeft +=
            AUTO_SCROLL_SPEED
        } else if (
          event.clientX <
          bounds.left +
            AUTO_SCROLL_EDGE
        ) {
          ganttBody.scrollLeft =
            Math.max(
              0,
              ganttBody.scrollLeft -
                AUTO_SCROLL_SPEED
            )
        }


        const scrollDelta =
          ganttBody.scrollLeft -
          dragging.initialScrollLeft


        const pixelDelta =
          event.clientX -
          dragging.startClientX +
          scrollDelta


        const dayDelta =
          pixelDelta /
          dayWidth


        const nextStart =
          snapDay(
            dragging.initialOffset +
              dayDelta
          )


        setStartOffsets(
          (current) => ({
            ...current,

            [dragging.activityId]:
              nextStart,
          })
        )
      }


      function handlePointerUp() {
        setDragging(
          null
        )
      }


      window.addEventListener(
        'pointermove',
        handlePointerMove
      )

      window.addEventListener(
        'pointerup',
        handlePointerUp
      )

      window.addEventListener(
        'pointercancel',
        handlePointerUp
      )


      return () => {
        window.removeEventListener(
          'pointermove',
          handlePointerMove
        )

        window.removeEventListener(
          'pointerup',
          handlePointerUp
        )

        window.removeEventListener(
          'pointercancel',
          handlePointerUp
        )
      }
    },
    [
      dragging,
      dayWidth,
    ]
  )


  function beginDrag(
    event,
    activity
  ) {
    const duration =
      Number(
        activity.rawDuration
      )

    if (
      !Number.isFinite(
        duration
      ) ||
      duration <= 0
    ) {
      return
    }


    event.preventDefault()
    event.stopPropagation()


    event.currentTarget
      .setPointerCapture?.(
        event.pointerId
      )


    setSelectedActivityId(
      activity.id
    )


    const currentOffset =
      Number(
        startOffsets[
          activity.id
        ] ||
        0
      )


    setDragging({
      activityId:
        activity.id,

      startClientX:
        event.clientX,

      initialOffset:
        currentOffset,

      initialScrollLeft:
        rightBodyRef
          .current
          ?.scrollLeft ||
        0,
    })
  }


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


  const selectedStartOffset =
    selectedActivity
      ? Number(
          startOffsets[
            selectedActivity.id
          ] ||
          0
        )
      : 0


  const selectedRawDuration =
    selectedActivity
      ? Number(
          selectedActivity.rawDuration
        )
      : null


  const selectedFinishOffset =
    Number.isFinite(
      selectedRawDuration
    )
      ? selectedStartOffset +
        selectedRawDuration
      : null


  return (
    <div
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
            Use the drag handle to position activities horizontally.
            Raw Duration remains calculated and locked.
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
                normalizedActivities.length
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

          <span
            className={
              styles.dragHint
            }
          >
            ⠿ DRAG HANDLE
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
            title="Zoom out"
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
            title="Zoom in"
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
                styles.activityHeaderCell
              }
            >
              Location
            </div>

            <div
              className={
                styles.activityHeaderCell
              }
            >
              Division
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
            {normalizedActivities.length >
            0 ? (
              normalizedActivities.map(
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
                        title={
                          activity.scopeItemName ||
                          ''
                        }
                      >
                        {activity.scopeItemName ||
                          'Scope Item'}
                      </div>

                      <div
                        className={
                          styles.locationName
                        }
                        title={
                          activity.locationName ||
                          ''
                        }
                      >
                        {activity.locationName ||
                          '—'}
                      </div>

                      <div
                        className={
                          styles.divisionName
                        }
                        title={
                          activity.divisionName ||
                          ''
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
                  No production activities
                </strong>

                <span>
                  Positive location quantities are required before
                  activities can be visualized.
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
                    key={
                      day
                    }
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
                    normalizedActivities.length *
                      ROW_HEIGHT,
                    ROW_HEIGHT
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


              {normalizedActivities.map(
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


                  const isDragging =
                    dragging?.activityId ===
                    activity.id


                  const startOffset =
                    Number(
                      startOffsets[
                        activity.id
                      ] ||
                      0
                    )


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
                          26
                        )
                      : 0


                  const left =
                    startOffset *
                    dayWidth


                  return (
                    <div
                      key={
                        activity.id
                      }
                      className={
                        isSelected
                          ? styles.ganttRowSelected
                          : styles.ganttRow
                      }
                      style={{
                        top:
                          index *
                          ROW_HEIGHT,
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
                          } ${
                            isDragging
                              ? styles.ganttBarDragging
                              : ''
                          }`}
                          style={{
                            left,
                            width,
                          }}
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation()

                            setSelectedActivityId(
                              activity.id
                            )
                          }}
                          title={`Start Day ${safeNumber(
                            startOffset
                          )} · Duration ${safeNumber(
                            rawDuration
                          )} days`}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            className={
                              styles.dragHandle
                            }
                            onPointerDown={(
                              event
                            ) =>
                              beginDrag(
                                event,
                                activity
                              )
                            }
                            title="Click, hold and drag"
                            aria-label={`Move ${activity.scopeItemName}`}
                          >
                            <span
                              className={
                                styles.dragHandleDots
                              }
                            >
                              ⠿
                            </span>
                          </div>

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
                    </div>
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
                label="Resource"
                value={
                  getResourceLabel(
                    selectedActivity
                  )
                }
              />

              <InspectorMetric
                label="Raw Duration"
                value={
                  Number.isFinite(
                    selectedRawDuration
                  )
                    ? `${safeNumber(
                        selectedRawDuration
                      )} d`
                    : '—'
                }
                emphasized
              />

              <InspectorMetric
                label="Start Offset"
                value={`Day ${safeNumber(
                  selectedStartOffset
                )}`}
                detail="Drag handle to change"
              />

              <InspectorMetric
                label="Finish Offset"
                value={
                  Number.isFinite(
                    selectedFinishOffset
                  )
                    ? `Day ${safeNumber(
                        selectedFinishOffset
                      )}`
                    : '—'
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
            Select an activity to inspect its production data.
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
