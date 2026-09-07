'use client'

import Link from 'next/link'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import styles from './pre-planning.module.css'


const DEFAULT_DAY_WIDTH = 34
const MIN_DAY_WIDTH = 24
const MAX_DAY_WIDTH = 84

const MIN_TIMELINE_DAYS = 30
const TIMELINE_PADDING_DAYS = 15

const ROW_HEIGHT = 44

const AUTO_SCROLL_EDGE = 70
const AUTO_SCROLL_SPEED = 16


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
      maximumFractionDigits:
        digits,
    }
  ).format(
    numeric
  )
}


function getBasisLabel(
  basis
) {
  if (
    basis ===
    'crew_day'
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
    !Number.isFinite(
      value
    ) ||
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
    (index + 1) *
      10
  ).padStart(
    4,
    '0'
  )
}


function moveItem(
  items,
  fromIndex,
  toIndex
) {
  if (
    fromIndex < 0 ||
    fromIndex >=
      items.length
  ) {
    return items
  }


  const next =
    [...items]


  const [
    movedItem,
  ] =
    next.splice(
      fromIndex,
      1
    )


  let insertionIndex =
    toIndex


  if (
    toIndex >
    fromIndex
  ) {
    insertionIndex -= 1
  }


  insertionIndex =
    Math.max(
      0,
      Math.min(
        insertionIndex,
        next.length
      )
    )


  next.splice(
    insertionIndex,
    0,
    movedItem
  )


  return next
}


function reorderVisibleActivities({
  fullOrder,
  visibleIds,
  movedActivityId,
  dropIndex,
}) {
  if (
    !Array.isArray(
      fullOrder
    ) ||
    !Array.isArray(
      visibleIds
    ) ||
    visibleIds.length ===
      0
  ) {
    return fullOrder
  }


  const visibleIdSet =
    new Set(
      visibleIds
    )


  const visibleActivities =
    fullOrder.filter(
      (activity) =>
        visibleIdSet.has(
          activity.id
        )
    )


  const sourceIndex =
    visibleActivities.findIndex(
      (activity) =>
        activity.id ===
        movedActivityId
    )


  if (
    sourceIndex <
    0
  ) {
    return fullOrder
  }


  const reorderedVisible =
    moveItem(
      visibleActivities,
      sourceIndex,
      dropIndex
    )


  let visibleCursor =
    0


  return fullOrder.map(
    (activity) => {
      if (
        !visibleIdSet.has(
          activity.id
        )
      ) {
        return activity
      }


      const replacement =
        reorderedVisible[
          visibleCursor
        ]


      visibleCursor +=
        1


      return replacement
    }
  )
}


/* =========================================================
   APPLY SEQUENCE HELPERS
   ========================================================= */

function getScopeSequenceKey(
  activity
) {
  /*
   * Prefer a stable database identifier
   * whenever page.js provides one.
   *
   * The textual fallback keeps the feature
   * compatible with the current activity
   * payload without changing the API.
   */
  const stableId =
    activity?.scopeItemId ||
    activity?.serviceId ||
    activity?.projectServiceId ||
    null


  if (stableId) {
    return `id:${stableId}`
  }


  const workPackage =
    String(
      activity?.workPackageCode ||
      ''
    )
      .trim()
      .toLowerCase()


  const scopeItem =
    String(
      activity?.scopeItemName ||
      ''
    )
      .trim()
      .toLowerCase()


  return `text:${workPackage}::${scopeItem}`
}


function getProductionGroupKey(
  activity
) {
  const location =
    activity?.locationId ||
    '__no_location__'


  const division =
    activity?.divisionId ||
    '__no_division__'


  return `${location}::${division}`
}


function applySequenceTemplate({
  fullOrder,
  sourceLocationId,
  sourceDivisionId,
}) {
  const sourceGroupKey =
    `${sourceLocationId}::${sourceDivisionId}`


  const sourceActivities =
    fullOrder.filter(
      (activity) =>
        getProductionGroupKey(
          activity
        ) ===
        sourceGroupKey
    )


  if (
    sourceActivities.length ===
    0
  ) {
    return {
      activities:
        fullOrder,

      targetGroups:
        0,

      changedGroups:
        0,

      matchedActivities:
        0,
    }
  }


  /*
   * Build the source template.
   *
   * Example:
   *
   * FRM - Interior Wall Framing -> 0
   * FRM - Door Framing          -> 1
   * ELE - Electrical Rough-In   -> 2
   */
  const sourceRank =
    new Map()


  sourceActivities.forEach(
    (
      activity,
      index
    ) => {
      const key =
        getScopeSequenceKey(
          activity
        )


      if (
        !sourceRank.has(
          key
        )
      ) {
        sourceRank.set(
          key,
          index
        )
      }
    }
  )


  const groups =
    new Map()


  fullOrder.forEach(
    (
      activity,
      globalIndex
    ) => {
      const groupKey =
        getProductionGroupKey(
          activity
        )


      if (
        !groups.has(
          groupKey
        )
      ) {
        groups.set(
          groupKey,
          []
        )
      }


      groups
        .get(
          groupKey
        )
        .push({
          activity,
          globalIndex,
        })
    }
  )


  const replacements =
    new Map()


  let targetGroups =
    0
  let changedGroups =
    0
  let matchedActivities =
    0


  groups.forEach(
    (
      entries,
      groupKey
    ) => {
      /*
       * Never rewrite the source group.
       */
      if (
        groupKey ===
        sourceGroupKey
      ) {
        return
      }


      /*
       * Only matching scope items participate.
       *
       * Target-only activities remain exactly
       * where they currently are.
       */
      const matchingEntries =
        entries.filter(
          ({
            activity,
          }) =>
            sourceRank.has(
              getScopeSequenceKey(
                activity
              )
            )
        )


      if (
        matchingEntries.length ===
        0
      ) {
        return
      }


      targetGroups +=
        1

      matchedActivities +=
        matchingEntries.length


      const sortedMatchingActivities =
        matchingEntries
          .map(
            (
              entry,
              originalIndex
            ) => ({
              activity:
                entry.activity,

              originalIndex,
            })
          )
          .sort(
            (
              first,
              second
            ) => {
              const firstRank =
                sourceRank.get(
                  getScopeSequenceKey(
                    first.activity
                  )
                )


              const secondRank =
                sourceRank.get(
                  getScopeSequenceKey(
                    second.activity
                  )
                )


              if (
                firstRank !==
                secondRank
              ) {
                return (
                  firstRank -
                  secondRank
                )
              }


              return (
                first.originalIndex -
                second.originalIndex
              )
            }
          )
          .map(
            ({
              activity,
            }) =>
              activity
          )


      const groupChanged =
        matchingEntries.some(
          (
            entry,
            index
          ) =>
            entry.activity.id !==
            sortedMatchingActivities[
              index
            ]?.id
        )


      if (
        groupChanged
      ) {
        changedGroups +=
          1
      }


      /*
       * Replace only the slots occupied by
       * matching scope items.
       *
       * Any activity that exists only in the
       * target area remains untouched.
       */
      matchingEntries.forEach(
        (
          entry,
          index
        ) => {
          replacements.set(
            entry.globalIndex,
            sortedMatchingActivities[
              index
            ]
          )
        }
      )
    }
  )


  const nextActivities =
    fullOrder.map(
      (
        activity,
        index
      ) =>
        replacements.get(
          index
        ) ||
        activity
    )


  return {
    activities:
      nextActivities,

    targetGroups,

    changedGroups,

    matchedActivities,
  }
}


function orderSignature(
  activities
) {
  return activities
    .map(
      (activity) =>
        activity.id
    )
    .join('|')
}


export default function PrePlanningWorkspace({
  project,
  activities = [],
  targetTakt = null,
  strategyStatus = 'draft',
  activeVersion = null,
  versionCount = 0,
  changeProjectHref = '/dashboard/planning/pre-planning',
}) {
  const router =
    useRouter()


  const normalizedActivities =
    useMemo(
      () =>
        Array.isArray(
          activities
        )
          ? activities
          : [],
      [
        activities,
      ]
    )


  const [
    orderedActivities,
    setOrderedActivities,
  ] =
    useState(
      normalizedActivities
    )


  const [
    savedSignature,
    setSavedSignature,
  ] =
    useState(
      orderSignature(
        normalizedActivities
      )
    )


  const [
    selectedActivityId,
    setSelectedActivityId,
  ] =
    useState(
      normalizedActivities
        ?.[0]
        ?.id ||
      null
    )


  const [
    selectedLocation,
    setSelectedLocation,
  ] =
    useState(
      'all'
    )


  const [
    selectedDivision,
    setSelectedDivision,
  ] =
    useState(
      'all'
    )


  const [
    rowDrag,
    setRowDrag,
  ] =
    useState(
      null
    )


  const [
    dayWidth,
    setDayWidth,
  ] =
    useState(
      DEFAULT_DAY_WIDTH
    )


  const [
    actionState,
    setActionState,
  ] =
    useState(
      'idle'
    )


  const [
    notice,
    setNotice,
  ] =
    useState(
      null
    )


  const leftBodyRef =
    useRef(
      null
    )

  const rightBodyRef =
    useRef(
      null
    )

  const ganttHeaderRef =
    useRef(
      null
    )

  const scrollOwnerRef =
    useRef(
      null
    )

  const rowDragRef =
    useRef(
      null
    )


  useEffect(
    () => {
      setOrderedActivities(
        normalizedActivities
      )


      setSavedSignature(
        orderSignature(
          normalizedActivities
        )
      )


      setSelectedActivityId(
        normalizedActivities
          ?.[0]
          ?.id ||
        null
      )


      setSelectedLocation(
        'all'
      )


      setSelectedDivision(
        'all'
      )


      setRowDrag(
        null
      )


      rowDragRef.current =
        null
    },
    [
      normalizedActivities,
      activeVersion?.id,
    ]
  )


  const currentSignature =
    useMemo(
      () =>
        orderSignature(
          orderedActivities
        ),
      [
        orderedActivities,
      ]
    )


  const hasUnsavedChanges =
    currentSignature !==
    savedSignature


  /* =========================================================
     FILTER OPTIONS
     ========================================================= */

  const locationOptions =
    useMemo(
      () => {
        const values =
          new Map()


        orderedActivities.forEach(
          (activity) => {
            if (
              activity.locationId &&
              activity.locationName
            ) {
              values.set(
                activity.locationId,
                activity.locationName
              )
            }
          }
        )


        return Array.from(
          values.entries()
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
        orderedActivities,
      ]
    )


  const divisionOptions =
    useMemo(
      () => {
        const values =
          new Map()


        orderedActivities
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
                values.set(
                  activity.divisionId,
                  activity.divisionName
                )
              }
            }
          )


        return Array.from(
          values.entries()
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
        orderedActivities,
        selectedLocation,
      ]
    )


  const filteredActivities =
    useMemo(
      () =>
        orderedActivities.filter(
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
        orderedActivities,
        selectedLocation,
        selectedDivision,
      ]
    )


  const visibleActivityIds =
    useMemo(
      () =>
        filteredActivities.map(
          (activity) =>
            activity.id
        ),
      [
        filteredActivities,
      ]
    )


  const sequenceIndexMap =
    useMemo(
      () => {
        const map =
          new Map()


        orderedActivities.forEach(
          (
            activity,
            index
          ) => {
            map.set(
              activity.id,
              index
            )
          }
        )


        return map
      },
      [
        orderedActivities,
      ]
    )


  const selectedActivity =
    useMemo(
      () => {
        const selected =
          filteredActivities.find(
            (activity) =>
              activity.id ===
              selectedActivityId
          )


        return (
          selected ||
          filteredActivities[0] ||
          null
        )
      },
      [
        filteredActivities,
        selectedActivityId,
      ]
    )


  const hasFilters =
    selectedLocation !==
      'all' ||
    selectedDivision !==
      'all'


  const hasExactSourceFilter =
    selectedLocation !==
      'all' &&
    selectedDivision !==
      'all'


  /* =========================================================
     TIMELINE
     ========================================================= */

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
                duration >
                  0
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
      () =>
        Math.max(
          MIN_TIMELINE_DAYS,

          Math.ceil(
            maxRawDuration
          ) +
            TIMELINE_PADDING_DAYS
        ),
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


  /* =========================================================
     FILTERS
     ========================================================= */

  function handleLocationChange(
    event
  ) {
    setSelectedLocation(
      event.target.value
    )


    setSelectedDivision(
      'all'
    )


    setRowDrag(
      null
    )


    rowDragRef.current =
      null
  }


  function handleDivisionChange(
    event
  ) {
    setSelectedDivision(
      event.target.value
    )


    setRowDrag(
      null
    )


    rowDragRef.current =
      null
  }


  function clearFilters() {
    setSelectedLocation(
      'all'
    )


    setSelectedDivision(
      'all'
    )


    setRowDrag(
      null
    )


    rowDragRef.current =
      null
  }


  /* =========================================================
     APPLY SEQUENCE TO ALL LOCATIONS / DIVISIONS
     ========================================================= */

  function handleApplySequenceToAll() {
    if (
      actionState !==
      'idle'
    ) {
      return
    }


    if (
      selectedLocation ===
        'all' ||
      selectedDivision ===
        'all'
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Select one Location and one Division to use as the source sequence.',
      })

      return
    }


    if (
      filteredActivities.length ===
      0
    ) {
      setNotice({
        type:
          'warning',

        text:
          'The selected source area has no activities.',
      })

      return
    }


    const result =
      applySequenceTemplate({
        fullOrder:
          orderedActivities,

        sourceLocationId:
          selectedLocation,

        sourceDivisionId:
          selectedDivision,
      })


    if (
      result.targetGroups ===
      0
    ) {
      setNotice({
        type:
          'warning',

        text:
          'No other Location / Division groups contain matching scope items.',
      })

      return
    }


    const nextSignature =
      orderSignature(
        result.activities
      )


    if (
      nextSignature ===
      currentSignature
    ) {
      setNotice({
        type:
          'success',

        text:
          `${result.targetGroups} target ${
            result.targetGroups ===
            1
              ? 'area already follows'
              : 'areas already follow'
          } this sequence.`,
      })

      return
    }


    setOrderedActivities(
      result.activities
    )


    setNotice({
      type:
        'success',

      text:
        `Sequence applied to ${result.changedGroups} ${
          result.changedGroups ===
          1
            ? 'area'
            : 'areas'
        }. Review and save when ready.`,
    })
  }


  /* =========================================================
     SAVE / VERSIONING
     ========================================================= */

  async function runSequenceAction(
    action
  ) {
    if (
      actionState !==
      'idle'
    ) {
      return
    }


    if (
      orderedActivities.length ===
      0
    ) {
      return
    }


    if (
      action ===
        'create_version' &&
      !activeVersion
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Save Sequence first to create Version 1.',
      })

      return
    }


    setActionState(
      action ===
        'save'
        ? 'saving'
        : 'creating'
    )


    setNotice(
      null
    )


    try {
      const response =
        await fetch(
          '/api/pre-planning/sequence',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                action,

                projectId:
                  project.id,

                versionId:
                  activeVersion?.id ||
                  null,

                /*
                 * Always save the FULL
                 * project sequence,
                 * regardless of active
                 * filters.
                 */
                allocationIds:
                  orderedActivities.map(
                    (activity) =>
                      activity.id
                  ),
              }),
          }
        )


      const result =
        await response.json()


      if (
        !response.ok
      ) {
        throw new Error(
          result?.error ||
          'Sequence could not be saved.'
        )
      }


      setSavedSignature(
        currentSignature
      )


      if (
        action ===
        'save'
      ) {
        setNotice({
          type:
            'success',

          text:
            `${result.version.versionName} saved successfully.`,
        })
      } else {
        setNotice({
          type:
            'success',

          text:
            `${result.version.versionName} created from the current sequence.`,
        })
      }


      router.refresh()
    } catch (
      error
    ) {
      setNotice({
        type:
          'error',

        text:
          error?.message ||
          'Sequence could not be saved.',
      })
    } finally {
      setActionState(
        'idle'
      )
    }
  }


  const saveDisabled =
    actionState !==
      'idle' ||
    (
      activeVersion &&
      !hasUnsavedChanges
    )


  const createVersionDisabled =
    actionState !==
      'idle' ||
    !activeVersion


  const applySequenceDisabled =
    actionState !==
      'idle' ||
    !hasExactSourceFilter ||
    filteredActivities.length ===
      0


  /* =========================================================
     VERTICAL DRAG
     ========================================================= */

  useEffect(
    () => {
      function handlePointerMove(
        event
      ) {
        const currentDrag =
          rowDragRef.current


        if (
          !currentDrag
        ) {
          return
        }


        const body =
          leftBodyRef.current


        if (!body) {
          return
        }


        const bounds =
          body.getBoundingClientRect()


        if (
          event.clientY <
          bounds.top +
            AUTO_SCROLL_EDGE
        ) {
          body.scrollTop =
            Math.max(
              0,
              body.scrollTop -
                AUTO_SCROLL_SPEED
            )


          if (
            rightBodyRef.current
          ) {
            rightBodyRef.current.scrollTop =
              body.scrollTop
          }
        } else if (
          event.clientY >
          bounds.bottom -
            AUTO_SCROLL_EDGE
        ) {
          body.scrollTop +=
            AUTO_SCROLL_SPEED


          if (
            rightBodyRef.current
          ) {
            rightBodyRef.current.scrollTop =
              body.scrollTop
          }
        }


        const relativeY =
          event.clientY -
          bounds.top +
          body.scrollTop


        const rowIndex =
          Math.floor(
            relativeY /
            ROW_HEIGHT
          )


        const offsetInsideRow =
          relativeY %
          ROW_HEIGHT


        const dropIndex =
          Math.max(
            0,
            Math.min(
              rowIndex +
                (
                  offsetInsideRow >
                  ROW_HEIGHT /
                    2
                    ? 1
                    : 0
                ),

              filteredActivities.length
            )
          )


        if (
          currentDrag.dropIndex ===
          dropIndex
        ) {
          return
        }


        const nextDrag = {
          ...currentDrag,
          dropIndex,
        }


        rowDragRef.current =
          nextDrag


        setRowDrag(
          nextDrag
        )
      }


      function handlePointerUp() {
        const currentDrag =
          rowDragRef.current


        if (
          !currentDrag
        ) {
          return
        }


        setOrderedActivities(
          (currentOrder) =>
            reorderVisibleActivities({
              fullOrder:
                currentOrder,

              visibleIds:
                currentDrag.visibleIds,

              movedActivityId:
                currentDrag.activityId,

              dropIndex:
                currentDrag.dropIndex,
            })
        )


        rowDragRef.current =
          null


        setRowDrag(
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
      filteredActivities.length,
    ]
  )


  function beginRowDrag(
    event,
    activity,
    visibleIndex
  ) {
    event.preventDefault()
    event.stopPropagation()


    event.currentTarget
      .setPointerCapture?.(
        event.pointerId
      )


    setSelectedActivityId(
      activity.id
    )


    const nextDrag = {
      activityId:
        activity.id,

      sourceIndex:
        visibleIndex,

      dropIndex:
        visibleIndex,

      visibleIds:
        [...visibleActivityIds],
    }


    rowDragRef.current =
      nextDrag


    setRowDrag(
      nextDrag
    )
  }


  /* =========================================================
     SCROLL
     ========================================================= */

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
      source ===
      'left'
    ) {
      if (
        leftBodyRef.current &&
        rightBodyRef.current
      ) {
        rightBodyRef.current.scrollTop =
          leftBodyRef.current.scrollTop
      }
    } else if (
      leftBodyRef.current &&
      rightBodyRef.current
    ) {
      leftBodyRef.current.scrollTop =
        rightBodyRef.current.scrollTop
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


  /* =========================================================
     ZOOM
     ========================================================= */

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
    Number(
      targetTakt
    )


  const hasTargetTakt =
    Number.isFinite(
      targetTaktNumber
    ) &&
    targetTaktNumber >
      0


  const selectedSequenceIndex =
    selectedActivity
      ? sequenceIndexMap.get(
          selectedActivity.id
        )
      : undefined


  const selectedSequence =
    Number.isInteger(
      selectedSequenceIndex
    )
      ? getActivityCode(
          selectedSequenceIndex
        )
      : '—'


  const dropIndicatorTop =
    rowDrag
      ? rowDrag.dropIndex *
        ROW_HEIGHT
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
                strategyStatus ===
                'approved'
                  ? styles.statusApproved
                  : styles.statusDraft
              }
            >
              {strategyStatus ===
              'approved'
                ? 'Approved'
                : 'Draft'}
            </span>
          </div>


          <p
            className={
              styles.projectDescription
            }
          >
            Define the preliminary production sequence. Raw Duration is calculated from Project Setup data and remains locked.
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

              {hasFilters ? (
                <span
                  className={
                    styles.filteredActivityCount
                  }
                >
                  {' '}
                  / {
                    orderedActivities.length
                  }
                </span>
              ) : null}
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
            styles.toolbarLeft
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
                styles.sequenceHint
              }
            >
              ⠿ DRAG TO REORDER
            </span>
          </div>


          <div
            className={
              styles.filterGroup
            }
          >
            <label
              className={
                styles.filterControl
              }
            >
              <span
                className={
                  styles.filterLabel
                }
              >
                Location
              </span>

              <select
                value={
                  selectedLocation
                }
                onChange={
                  handleLocationChange
                }
                className={
                  selectedLocation !==
                  'all'
                    ? styles.filterSelectActive
                    : styles.filterSelect
                }
              >
                <option value="all">
                  All Locations
                </option>

                {locationOptions.map(
                  (location) => (
                    <option
                      key={
                        location.id
                      }
                      value={
                        location.id
                      }
                    >
                      {
                        location.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>


            <label
              className={
                styles.filterControl
              }
            >
              <span
                className={
                  styles.filterLabel
                }
              >
                Division
              </span>

              <select
                value={
                  selectedDivision
                }
                onChange={
                  handleDivisionChange
                }
                className={
                  selectedDivision !==
                  'all'
                    ? styles.filterSelectActive
                    : styles.filterSelect
                }
              >
                <option value="all">
                  All Divisions
                </option>

                {divisionOptions.map(
                  (division) => (
                    <option
                      key={
                        division.id
                      }
                      value={
                        division.id
                      }
                    >
                      {
                        division.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>


            {hasFilters ? (
              <button
                type="button"
                className={
                  styles.clearFiltersButton
                }
                onClick={
                  clearFilters
                }
              >
                Clear
              </button>
            ) : null}
          </div>
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
          styles.versionBar
        }
      >
        <div
          className={
            styles.versionIdentity
          }
        >
          <span
            className={
              styles.versionLabel
            }
          >
            SEQUENCE VERSION
          </span>


          <strong
            className={
              styles.versionName
            }
          >
            {activeVersion
              ? activeVersion.versionName
              : 'Not saved yet'}
          </strong>


          {activeVersion ? (
            <span
              className={
                styles.currentVersionBadge
              }
            >
              CURRENT
            </span>
          ) : null}


          {versionCount >
          0 ? (
            <span
              className={
                styles.versionCount
              }
            >
              {versionCount}{' '}
              {versionCount ===
              1
                ? 'version'
                : 'versions'}
            </span>
          ) : null}


          {hasUnsavedChanges ? (
            <span
              className={
                styles.unsavedBadge
              }
            >
              UNSAVED CHANGES
            </span>
          ) : activeVersion ? (
            <span
              className={
                styles.savedBadge
              }
            >
              SAVED
            </span>
          ) : null}
        </div>


        <div
          className={
            styles.versionActions
          }
        >
          {notice ? (
            <span
              className={`${styles.actionNotice} ${
                notice.type ===
                'success'
                  ? styles.actionNoticeSuccess
                  : notice.type ===
                      'warning'
                    ? styles.actionNoticeWarning
                    : styles.actionNoticeError
              }`}
            >
              {
                notice.text
              }
            </span>
          ) : null}


          <button
            type="button"
            className={
              styles.createVersionButton
            }
            disabled={
              applySequenceDisabled
            }
            onClick={
              handleApplySequenceToAll
            }
            title={
              hasExactSourceFilter
                ? 'Use this Location / Division sequence as the template for every other production area'
                : 'Select one Location and one Division first'
            }
          >
            Apply Sequence to All
          </button>


          <button
            type="button"
            className={
              styles.createVersionButton
            }
            disabled={
              createVersionDisabled
            }
            onClick={() =>
              runSequenceAction(
                'create_version'
              )
            }
          >
            {actionState ===
            'creating'
              ? 'Creating...'
              : 'Create Version'}
          </button>


          <button
            type="button"
            className={
              styles.saveSequenceButton
            }
            disabled={
              saveDisabled
            }
            onClick={() =>
              runSequenceAction(
                'save'
              )
            }
          >
            {actionState ===
            'saving'
              ? 'Saving...'
              : activeVersion
                ? 'Save Sequence'
                : 'Save Sequence · Create V1'}
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
                styles.activityHeaderHandleCell
              }
            >
              ⠿
            </div>

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
            <div
              className={
                styles.activityRowsContainer
              }
              style={{
                height:
                  Math.max(
                    filteredActivities.length *
                      ROW_HEIGHT,

                    ROW_HEIGHT
                  ),
              }}
            >
              {rowDrag ? (
                <div
                  className={
                    styles.sequenceDropIndicator
                  }
                  style={{
                    top:
                      dropIndicatorTop,
                  }}
                />
              ) : null}


              {filteredActivities.length >
              0 ? (
                filteredActivities.map(
                  (
                    activity,
                    visibleIndex
                  ) => {
                    const isSelected =
                      selectedActivity?.id ===
                      activity.id


                    const isDragging =
                      rowDrag?.activityId ===
                      activity.id


                    const rawDuration =
                      Number(
                        activity.rawDuration
                      )


                    const hasDuration =
                      Number.isFinite(
                        rawDuration
                      ) &&
                      rawDuration >
                        0


                    const globalSequenceIndex =
                      sequenceIndexMap.get(
                        activity.id
                      )


                    return (
                      <div
                        key={
                          activity.id
                        }
                        className={`${styles.activityRowShell} ${
                          isSelected
                            ? styles.activityRowShellSelected
                            : ''
                        } ${
                          isDragging
                            ? styles.activityRowShellDragging
                            : ''
                        }`}
                        style={{
                          top:
                            visibleIndex *
                            ROW_HEIGHT,
                        }}
                        onClick={() =>
                          setSelectedActivityId(
                            activity.id
                          )
                        }
                      >
                        <div
                          className={
                            styles.sequenceHandleCell
                          }
                        >
                          <button
                            type="button"
                            className={
                              styles.sequenceHandle
                            }
                            onPointerDown={(
                              event
                            ) =>
                              beginRowDrag(
                                event,
                                activity,
                                visibleIndex
                              )
                            }
                            title="Drag to change activity sequence"
                          >
                            <span
                              className={
                                styles.sequenceHandleIcon
                              }
                            >
                              ⠿
                            </span>
                          </button>
                        </div>


                        <div
                          className={
                            styles.activityId
                          }
                        >
                          {Number.isInteger(
                            globalSequenceIndex
                          )
                            ? getActivityCode(
                                globalSequenceIndex
                              )
                            : '—'}
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
                            hasDuration
                              ? styles.durationCell
                              : styles.missingDurationCell
                          }
                        >
                          {hasDuration
                            ? `${safeNumber(
                                rawDuration
                              )} d`
                            : '—'}
                        </div>
                      </div>
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
                    Change or clear the Location and Division filters.
                  </span>

                  <button
                    type="button"
                    className={
                      styles.emptyClearButton
                    }
                    onClick={
                      clearFilters
                    }
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
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
                    filteredActivities.length *
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


              {rowDrag ? (
                <div
                  className={
                    styles.ganttDropIndicator
                  }
                  style={{
                    top:
                      dropIndicatorTop,
                  }}
                />
              ) : null}


              {filteredActivities.map(
                (
                  activity,
                  visibleIndex
                ) => {
                  const rawDuration =
                    Number(
                      activity.rawDuration
                    )


                  const hasDuration =
                    Number.isFinite(
                      rawDuration
                    ) &&
                    rawDuration >
                      0


                  const isSelected =
                    selectedActivity?.id ===
                    activity.id


                  const isDragging =
                    rowDrag?.activityId ===
                    activity.id


                  const width =
                    hasDuration
                      ? Math.max(
                          rawDuration *
                            dayWidth,

                          4
                        )
                      : 0


                  return (
                    <div
                      key={
                        activity.id
                      }
                      className={`${styles.ganttRow} ${
                        isSelected
                          ? styles.ganttRowSelected
                          : ''
                      } ${
                        isDragging
                          ? styles.ganttRowDragging
                          : ''
                      }`}
                      style={{
                        top:
                          visibleIndex *
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
                          className={
                            styles.ganttBar
                          }
                          style={{
                            left: 0,
                            width,
                            background:
                              activity.workPackageColor ||
                              '#00998b',
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
                label="Sequence"
                value={
                  selectedSequence
                }
                detail="Drag handle to reorder"
                emphasized
              />


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
                    Number(
                      selectedActivity.rawDuration
                    )
                  )
                    ? `${safeNumber(
                        selectedActivity.rawDuration
                      )} d`
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
