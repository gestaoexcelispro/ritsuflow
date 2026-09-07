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


/* =========================================================
   DISPLAY HELPERS
   ========================================================= */

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


function getResourceUnit(
  activity,
  value = 2
) {
  if (
    activity?.productivityBasis ===
    'crew_day'
  ) {
    return value === 1
      ? 'crew'
      : 'crews'
  }


  return value === 1
    ? 'worker'
    : 'workers'
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


  return `${safeNumber(
    value
  )} ${getResourceUnit(
    activity,
    value
  )}`
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


/* =========================================================
   RESOURCE CALCULATION
   ========================================================= */

function calculateRequiredResource(
  activity,
  desiredDuration
) {
  const quantity =
    Number(
      activity?.quantity
    )


  const productivity =
    Number(
      activity?.productivity
    )


  const duration =
    Number(
      desiredDuration
    )


  if (
    !Number.isFinite(
      quantity
    ) ||
    quantity <= 0 ||
    !Number.isFinite(
      productivity
    ) ||
    productivity <= 0 ||
    !Number.isFinite(
      duration
    ) ||
    duration <= 0
  ) {
    return {
      exact:
        null,

      recommended:
        null,

      current:
        Number.isFinite(
          Number(
            activity?.effectiveWorkforce
          )
        )
          ? Number(
              activity.effectiveWorkforce
            )
          : null,

      difference:
        null,
    }
  }


  const exact =
    quantity /
    (
      productivity *
      duration
    )


  const recommended =
    Math.ceil(
      exact
    )


  const current =
    Number(
      activity?.effectiveWorkforce
    )


  const validCurrent =
    Number.isFinite(
      current
    ) &&
    current >= 0
      ? current
      : null


  const difference =
    validCurrent !==
      null
      ? recommended -
        validCurrent
      : null


  return {
    exact,
    recommended,
    current:
      validCurrent,
    difference,
  }
}


/* =========================================================
   DURATION STRATEGY HELPERS
   ========================================================= */

function normalizeDurationMap(
  value
) {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return {}
  }


  const result = {}


  Object.entries(
    value
  ).forEach(
    ([
      allocationId,
      duration,
    ]) => {
      const numeric =
        Number(
          duration
        )


      if (
        Number.isFinite(
          numeric
        ) &&
        numeric > 0
      ) {
        result[
          allocationId
        ] =
          numeric
      }
    }
  )


  return result
}


function durationSignature(
  durationMap
) {
  return Object.entries(
    durationMap ||
    {}
  )
    .filter(
      ([
        ,
        value,
      ]) => {
        const numeric =
          Number(value)

        return (
          Number.isFinite(
            numeric
          ) &&
          numeric > 0
        )
      }
    )
    .sort(
      (
        first,
        second
      ) =>
        String(
          first[0]
        ).localeCompare(
          String(
            second[0]
          )
        )
    )
    .map(
      ([
        allocationId,
        value,
      ]) =>
        `${allocationId}:${Number(
          value
        )}`
    )
    .join('|')
}


/* =========================================================
   ORDER HELPERS
   ========================================================= */

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
   VERSION SEQUENCE HELPERS
   ========================================================= */

function applyVersionSequence(
  activities,
  sequenceRows
) {
  if (
    !Array.isArray(
      activities
    ) ||
    activities.length ===
      0
  ) {
    return []
  }


  if (
    !Array.isArray(
      sequenceRows
    ) ||
    sequenceRows.length ===
      0
  ) {
    return [
      ...activities,
    ]
  }


  const activityMap =
    new Map(
      activities.map(
        (activity) => [
          activity.id,
          activity,
        ]
      )
    )


  const ordered =
    []


  const used =
    new Set()


  ;[
    ...sequenceRows,
  ]
    .sort(
      (
        first,
        second
      ) =>
        Number(
          first.sequenceNumber ||
          0
        ) -
        Number(
          second.sequenceNumber ||
          0
        )
    )
    .forEach(
      (row) => {
        const activity =
          activityMap.get(
            row.allocationId
          )


        if (
          !activity ||
          used.has(
            activity.id
          )
        ) {
          return
        }


        ordered.push(
          activity
        )


        used.add(
          activity.id
        )
      }
    )


  activities.forEach(
    (activity) => {
      if (
        used.has(
          activity.id
        )
      ) {
        return
      }


      ordered.push(
        activity
      )
    }
  )


  return ordered
}


/* =========================================================
   APPLY SEQUENCE TO ALL HELPERS
   ========================================================= */

function getScopeSequenceKey(
  activity
) {
  const stableId =
    activity?.scopeItemId ||
    activity?.serviceId ||
    activity?.projectServiceId ||
    null


  if (
    stableId
  ) {
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
      if (
        groupKey ===
        sourceGroupKey
      ) {
        return
      }


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


/* =========================================================
   WORKSPACE
   ========================================================= */

export default function PrePlanningWorkspace({
  project,
  activities = [],

  versions = [],
  versionSequences = {},
  versionDurationStrategies = {},

  currentVersion = null,

  activeVersion = null,
  versionCount = 0,

  targetTakt = null,
  strategyStatus = 'draft',

  changeProjectHref = '/dashboard/planning/pre-planning',
}) {
  const router =
    useRouter()


  const workingVersion =
    currentVersion ||
    activeVersion ||
    null


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


  const normalizedVersions =
    useMemo(
      () =>
        Array.isArray(
          versions
        )
          ? versions
          : [],
      [
        versions,
      ]
    )


  const [
    activeTab,
    setActiveTab,
  ] =
    useState(
      'sequence'
    )


  const [
    selectedVersionId,
    setSelectedVersionId,
  ] =
    useState(
      workingVersion?.id ||
      ''
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


  const initialDurationMap =
    useMemo(
      () =>
        normalizeDurationMap(
          workingVersion?.id
            ? versionDurationStrategies?.[
                workingVersion.id
              ]
            : {}
        ),
      [
        workingVersion?.id,
        versionDurationStrategies,
      ]
    )


  const [
    desiredDurations,
    setDesiredDurations,
  ] =
    useState(
      initialDurationMap
    )


  const [
    savedDurationSignature,
    setSavedDurationSignature,
  ] =
    useState(
      durationSignature(
        initialDurationMap
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


  /* =========================================================
     VERSION STATE
     ========================================================= */

  const selectedVersion =
    useMemo(
      () =>
        normalizedVersions.find(
          (version) =>
            version.id ===
            selectedVersionId
        ) ||
        workingVersion ||
        null,
      [
        normalizedVersions,
        selectedVersionId,
        workingVersion,
      ]
    )


  const isViewingCurrentVersion =
    !workingVersion
      ? !selectedVersion
      : selectedVersion?.id ===
        workingVersion.id


  const isHistoricalView =
    Boolean(
      selectedVersion &&
      workingVersion &&
      selectedVersion.id !==
        workingVersion.id
    )


  const effectiveVersionCount =
    normalizedVersions.length >
    0
      ? normalizedVersions.length
      : versionCount


  useEffect(
    () => {
      const nextVersionId =
        workingVersion?.id ||
        ''


      const nextDurationMap =
        normalizeDurationMap(
          nextVersionId
            ? versionDurationStrategies?.[
                nextVersionId
              ]
            : {}
        )


      setSelectedVersionId(
        nextVersionId
      )


      setOrderedActivities(
        normalizedActivities
      )


      setSavedSignature(
        orderSignature(
          normalizedActivities
        )
      )


      setDesiredDurations(
        nextDurationMap
      )


      setSavedDurationSignature(
        durationSignature(
          nextDurationMap
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
      workingVersion?.id,
      versionDurationStrategies,
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


  const currentDurationSignature =
    useMemo(
      () =>
        durationSignature(
          desiredDurations
        ),
      [
        desiredDurations,
      ]
    )


  const hasUnsavedSequenceChanges =
    isViewingCurrentVersion &&
    currentSignature !==
      savedSignature


  const hasUnsavedDurationChanges =
    isViewingCurrentVersion &&
    currentDurationSignature !==
      savedDurationSignature


  const hasUnsavedChanges =
    hasUnsavedSequenceChanges ||
    hasUnsavedDurationChanges


  /* =========================================================
     VERSION SELECTION
     ========================================================= */

  function getVersionActivities(
    versionId
  ) {
    if (
      !versionId
    ) {
      return [
        ...normalizedActivities,
      ]
    }


    if (
      versionId ===
      workingVersion?.id
    ) {
      return [
        ...normalizedActivities,
      ]
    }


    const sequence =
      versionSequences?.[
        versionId
      ] ||
      []


    return applyVersionSequence(
      normalizedActivities,
      sequence
    )
  }


  function getVersionDurations(
    versionId
  ) {
    return normalizeDurationMap(
      versionId
        ? versionDurationStrategies?.[
            versionId
          ]
        : {}
    )
  }


  function handleVersionSelection(
    event
  ) {
    const nextVersionId =
      event.target.value


    if (
      nextVersionId ===
      selectedVersionId
    ) {
      return
    }


    if (
      hasUnsavedChanges
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Save your current changes before switching to another version.',
      })


      return
    }


    const nextActivities =
      getVersionActivities(
        nextVersionId
      )


    const nextDurations =
      getVersionDurations(
        nextVersionId
      )


    setSelectedVersionId(
      nextVersionId
    )


    setOrderedActivities(
      nextActivities
    )


    setSavedSignature(
      orderSignature(
        nextActivities
      )
    )


    setDesiredDurations(
      nextDurations
    )


    setSavedDurationSignature(
      durationSignature(
        nextDurations
      )
    )


    setSelectedActivityId(
      nextActivities
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


    const version =
      normalizedVersions.find(
        (item) =>
          item.id ===
          nextVersionId
      )


    if (
      version?.isCurrent
    ) {
      setNotice({
        type:
          'success',

        text:
          `${version.versionName} is the current working version.`,
      })
    } else if (
      version
    ) {
      setNotice({
        type:
          'success',

        text:
          `${version.versionName} opened in historical read-only mode.`,
      })
    } else {
      setNotice(
        null
      )
    }
  }


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

  const maxDisplayedDuration =
    useMemo(
      () => {
        const durations =
          filteredActivities
            .map(
              (activity) => {
                if (
                  activeTab ===
                  'duration'
                ) {
                  const desired =
                    Number(
                      desiredDurations[
                        activity.id
                      ]
                    )


                  if (
                    Number.isFinite(
                      desired
                    ) &&
                    desired > 0
                  ) {
                    return desired
                  }
                }


                return Number(
                  activity.rawDuration
                )
              }
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
        activeTab,
        desiredDurations,
      ]
    )


  const timelineDays =
    useMemo(
      () =>
        Math.max(
          MIN_TIMELINE_DAYS,

          Math.ceil(
            maxDisplayedDuration
          ) +
            TIMELINE_PADDING_DAYS
        ),
      [
        maxDisplayedDuration,
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
     TAB CHANGE
     ========================================================= */

  function handleTabChange(
    tab
  ) {
    setActiveTab(
      tab
    )


    setRowDrag(
      null
    )


    rowDragRef.current =
      null
  }


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
     DESIRED DURATION
     ========================================================= */

  function handleDesiredDurationChange(
    allocationId,
    value
  ) {
    if (
      !isViewingCurrentVersion
    ) {
      return
    }


    if (
      value ===
      ''
    ) {
      setDesiredDurations(
        (current) => {
          const next = {
            ...current,
          }


          delete next[
            allocationId
          ]


          return next
        }
      )


      return
    }


    const numeric =
      Number(
        value
      )


    if (
      !Number.isFinite(
        numeric
      ) ||
      numeric <= 0
    ) {
      return
    }


    setDesiredDurations(
      (current) => ({
        ...current,

        [
          allocationId
        ]:
          numeric,
      })
    )
  }


  async function saveDurationStrategy() {
    if (
      actionState !==
        'idle'
    ) {
      return
    }


    if (
      !workingVersion
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Save the sequence first to create a Pre-Planning version.',
      })


      return
    }


    if (
      !isViewingCurrentVersion
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Historical versions are read-only.',
      })


      return
    }


    setActionState(
      'saving_duration'
    )


    setNotice(
      null
    )


    try {
      const strategies =
        orderedActivities.map(
          (activity) => ({
            allocationId:
              activity.id,

            desiredDuration:
              desiredDurations[
                activity.id
              ] ||
              null,
          })
        )


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
                action:
                  'save_duration_strategy',

                projectId:
                  project.id,

                versionId:
                  workingVersion.id,

                strategies,
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
          'Duration strategy could not be saved.'
        )
      }


      setSavedDurationSignature(
        currentDurationSignature
      )


      setNotice({
        type:
          'success',

        text:
          `Duration & Resources saved for ${result.savedActivities || 0} activities.`,
      })


      router.refresh()
    } catch (
      error
    ) {
      setNotice({
        type:
          'error',

        text:
          error?.message ||
          'Duration strategy could not be saved.',
      })
    } finally {
      setActionState(
        'idle'
      )
    }
  }


  /* =========================================================
     APPLY SEQUENCE TO ALL
     ========================================================= */

  function handleApplySequenceToAll() {
    if (
      actionState !==
        'idle' ||
      !isViewingCurrentVersion
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
     SEQUENCE SAVE / CREATE VERSION
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
      !isViewingCurrentVersion &&
      workingVersion
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Historical versions are read-only. Make this version current or duplicate it first.',
      })


      return
    }


    if (
      action ===
        'create_version' &&
      !workingVersion
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Save Sequence first to create Version 1.',
      })


      return
    }


    if (
      action ===
        'create_version' &&
      hasUnsavedDurationChanges
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Save Duration & Resources before creating a new version.',
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
                  workingVersion?.id ||
                  null,

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


  /* =========================================================
     VERSION MANAGEMENT
     ========================================================= */

  async function runVersionAction({
    action,
    versionId,
    versionName = '',
  }) {
    if (
      actionState !==
      'idle'
    ) {
      return
    }


    setActionState(
      action
    )


    setNotice(
      null
    )


    try {
      const payload = {
        action,

        projectId:
          project.id,

        versionId,
      }


      if (
        action ===
        'duplicate_version'
      ) {
        payload.sourceVersionId =
          versionId
      }


      if (
        action ===
        'rename_version'
      ) {
        payload.versionName =
          versionName
      }


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
              JSON.stringify(
                payload
              ),
          }
        )


      const result =
        await response.json()


      if (
        !response.ok
      ) {
        throw new Error(
          result?.error ||
          'Version operation failed.'
        )
      }


      if (
        action ===
        'duplicate_version'
      ) {
        setNotice({
          type:
            'success',

          text:
            `${result.version.versionName} created from ${selectedVersion?.versionName || 'the selected version'}.`,
        })
      }


      if (
        action ===
        'rename_version'
      ) {
        setNotice({
          type:
            'success',

          text:
            `Version renamed to ${result.version.versionName}.`,
        })
      }


      if (
        action ===
        'set_current'
      ) {
        setNotice({
          type:
            'success',

          text:
            `${result.version.versionName} is now the current working version.`,
        })
      }


      if (
        action ===
        'delete_version'
      ) {
        const currentDurations =
          getVersionDurations(
            workingVersion?.id
          )


        setSelectedVersionId(
          workingVersion?.id ||
          ''
        )


        setOrderedActivities(
          normalizedActivities
        )


        setSavedSignature(
          orderSignature(
            normalizedActivities
          )
        )


        setDesiredDurations(
          currentDurations
        )


        setSavedDurationSignature(
          durationSignature(
            currentDurations
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


        setNotice({
          type:
            'success',

          text:
            'Historical version deleted successfully.',
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
          'Version operation failed.',
      })
    } finally {
      setActionState(
        'idle'
      )
    }
  }


  function handleWorkOnSelectedVersion() {
    if (
      !selectedVersion ||
      selectedVersion.isCurrent
    ) {
      return
    }


    if (
      hasUnsavedChanges
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Save your current changes first.',
      })


      return
    }


    runVersionAction({
      action:
        'set_current',

      versionId:
        selectedVersion.id,
    })
  }


  function handleDuplicateVersion() {
    if (
      !selectedVersion
    ) {
      return
    }


    if (
      hasUnsavedChanges
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Save your current changes before duplicating a version.',
      })


      return
    }


    runVersionAction({
      action:
        'duplicate_version',

      versionId:
        selectedVersion.id,
    })
  }


  function handleRenameVersion() {
    if (
      !selectedVersion
    ) {
      return
    }


    const proposedName =
      window.prompt(
        'Enter a name for this version:',
        selectedVersion.versionName
      )


    if (
      proposedName ===
      null
    ) {
      return
    }


    const versionName =
      proposedName
        .trim()


    if (
      !versionName
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Version name cannot be empty.',
      })


      return
    }


    if (
      versionName ===
      selectedVersion.versionName
    ) {
      return
    }


    runVersionAction({
      action:
        'rename_version',

      versionId:
        selectedVersion.id,

      versionName,
    })
  }


  function handleDeleteVersion() {
    if (
      !selectedVersion
    ) {
      return
    }


    if (
      selectedVersion.isCurrent
    ) {
      setNotice({
        type:
          'warning',

        text:
          'The current working version cannot be deleted. Make another version current first.',
      })


      return
    }


    const confirmed =
      window.confirm(
        `Delete ${selectedVersion.versionName}? This action cannot be undone.`
      )


    if (
      !confirmed
    ) {
      return
    }


    runVersionAction({
      action:
        'delete_version',

      versionId:
        selectedVersion.id,
    })
  }


  const saveDisabled =
    actionState !==
      'idle' ||
    !isViewingCurrentVersion ||
    (
      workingVersion &&
      !hasUnsavedSequenceChanges
    )


  const durationSaveDisabled =
    actionState !==
      'idle' ||
    !workingVersion ||
    !isViewingCurrentVersion ||
    !hasUnsavedDurationChanges


  const createVersionDisabled =
    actionState !==
      'idle' ||
    !workingVersion ||
    !isViewingCurrentVersion


  const applySequenceDisabled =
    actionState !==
      'idle' ||
    !isViewingCurrentVersion ||
    !hasExactSourceFilter ||
    filteredActivities.length ===
      0


  const versionManagementDisabled =
    actionState !==
    'idle'


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


        if (
          !body
        ) {
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


        if (
          !isViewingCurrentVersion ||
          activeTab !==
            'sequence'
        ) {
          rowDragRef.current =
            null


          setRowDrag(
            null
          )


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
      isViewingCurrentVersion,
      activeTab,
    ]
  )


  function beginRowDrag(
    event,
    activity,
    visibleIndex
  ) {
    if (
      !isViewingCurrentVersion ||
      activeTab !==
        'sequence'
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


  /* =========================================================
     DERIVED VALUES
     ========================================================= */

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


  const selectedDesiredDuration =
    selectedActivity
      ? desiredDurations[
          selectedActivity.id
        ] ||
        null
      : null


  const selectedResourceCalculation =
    selectedActivity
      ? calculateRequiredResource(
          selectedActivity,
          selectedDesiredDuration
        )
      : {
          exact: null,
          recommended: null,
          current: null,
          difference: null,
        }


  const dropIndicatorTop =
    rowDrag
      ? rowDrag.dropIndex *
        ROW_HEIGHT
      : null


  /* =========================================================
     RENDER
     ========================================================= */

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
            Define the preliminary production sequence and test duration-driven resource strategies.
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
            <button
              type="button"
              className={
                activeTab ===
                'sequence'
                  ? styles.filterSelectActive
                  : styles.toolbarButtonWide
              }
              onClick={() =>
                handleTabChange(
                  'sequence'
                )
              }
            >
              Sequence
            </button>


            <button
              type="button"
              className={
                activeTab ===
                'duration'
                  ? styles.filterSelectActive
                  : styles.toolbarButtonWide
              }
              onClick={() =>
                handleTabChange(
                  'duration'
                )
              }
            >
              Duration & Resources
            </button>


            {activeTab ===
            'sequence' ? (
              <>
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
                  {isViewingCurrentVersion
                    ? '⠿ DRAG TO REORDER'
                    : 'HISTORICAL VIEW · READ ONLY'}
                </span>
              </>
            ) : (
              <>
                <span
                  className={
                    styles.lockedBadge
                  }
                >
                  RAW DURATIONS LOCKED
                </span>


                <span
                  className={
                    styles.sequenceHint
                  }
                >
                  {isViewingCurrentVersion
                    ? 'ENTER DESIRED DURATION'
                    : 'HISTORICAL VIEW · READ ONLY'}
                </span>
              </>
            )}
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


          {normalizedVersions.length >
          0 ? (
            <select
              value={
                selectedVersion?.id ||
                ''
              }
              onChange={
                handleVersionSelection
              }
              disabled={
                actionState !==
                'idle'
              }
              className={
                styles.filterSelectActive
              }
            >
              {normalizedVersions.map(
                (version) => (
                  <option
                    key={
                      version.id
                    }
                    value={
                      version.id
                    }
                  >
                    {version.versionName}
                    {version.isCurrent
                      ? ' · Current'
                      : ''}
                  </option>
                )
              )}
            </select>
          ) : (
            <strong
              className={
                styles.versionName
              }
            >
              Not saved yet
            </strong>
          )}


          {selectedVersion?.isCurrent ? (
            <span
              className={
                styles.currentVersionBadge
              }
            >
              CURRENT
            </span>
          ) : selectedVersion ? (
            <span
              className={
                styles.savedBadge
              }
            >
              HISTORICAL
            </span>
          ) : null}


          {effectiveVersionCount >
          0 ? (
            <span
              className={
                styles.versionCount
              }
            >
              {
                effectiveVersionCount
              }{' '}
              {effectiveVersionCount ===
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
          ) : selectedVersion?.isCurrent ? (
            <span
              className={
                styles.savedBadge
              }
            >
              SAVED
            </span>
          ) : isHistoricalView ? (
            <span
              className={
                styles.savedBadge
              }
            >
              READ ONLY
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


          {isHistoricalView ? (
            <button
              type="button"
              className={
                styles.saveSequenceButton
              }
              disabled={
                versionManagementDisabled
              }
              onClick={
                handleWorkOnSelectedVersion
              }
            >
              {actionState ===
              'set_current'
                ? 'Switching...'
                : 'Work on This Version'}
            </button>
          ) : null}


          {selectedVersion ? (
            <>
              <button
                type="button"
                className={
                  styles.createVersionButton
                }
                disabled={
                  versionManagementDisabled
                }
                onClick={
                  handleDuplicateVersion
                }
              >
                {actionState ===
                'duplicate_version'
                  ? 'Duplicating...'
                  : 'Duplicate'}
              </button>


              <button
                type="button"
                className={
                  styles.createVersionButton
                }
                disabled={
                  versionManagementDisabled
                }
                onClick={
                  handleRenameVersion
                }
              >
                {actionState ===
                'rename_version'
                  ? 'Renaming...'
                  : 'Rename'}
              </button>


              <button
                type="button"
                className={
                  styles.createVersionButton
                }
                disabled={
                  versionManagementDisabled ||
                  selectedVersion.isCurrent
                }
                onClick={
                  handleDeleteVersion
                }
              >
                {actionState ===
                'delete_version'
                  ? 'Deleting...'
                  : 'Delete Version'}
              </button>
            </>
          ) : null}


          {activeTab ===
          'sequence' ? (
            <>
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
                  : workingVersion
                    ? 'Save Sequence'
                    : 'Save Sequence · Create V1'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={
                styles.saveSequenceButton
              }
              disabled={
                durationSaveDisabled
              }
              onClick={
                saveDurationStrategy
              }
            >
              {actionState ===
              'saving_duration'
                ? 'Saving...'
                : 'Save Duration & Resources'}
            </button>
          )}
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
              {activeTab ===
              'sequence'
                ? '⠿'
                : ''}
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
              {activeTab ===
              'sequence'
                ? 'Raw Dur.'
                : 'Desired Dur.'}
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


              {filteredActivities.map(
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


                  const hasRawDuration =
                    Number.isFinite(
                      rawDuration
                    ) &&
                    rawDuration > 0


                  const globalSequenceIndex =
                    sequenceIndexMap.get(
                      activity.id
                    )


                  const desiredDuration =
                    desiredDurations[
                      activity.id
                    ]


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
                        {activeTab ===
                        'sequence' ? (
                          <button
                            type="button"
                            className={
                              styles.sequenceHandle
                            }
                            disabled={
                              !isViewingCurrentVersion
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
                          >
                            <span
                              className={
                                styles.sequenceHandleIcon
                              }
                            >
                              ⠿
                            </span>
                          </button>
                        ) : null}
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


                      {activeTab ===
                      'sequence' ? (
                        <div
                          className={
                            hasRawDuration
                              ? styles.durationCell
                              : styles.missingDurationCell
                          }
                        >
                          {hasRawDuration
                            ? `${safeNumber(
                                rawDuration
                              )} d`
                            : '—'}
                        </div>
                      ) : (
                        <div
                          className={
                            styles.durationCell
                          }
                          onClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }
                        >
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={
                              desiredDuration ??
                              ''
                            }
                            placeholder={
                              hasRawDuration
                                ? safeNumber(
                                    rawDuration
                                  )
                                : '—'
                            }
                            disabled={
                              !isViewingCurrentVersion
                            }
                            onChange={(
                              event
                            ) =>
                              handleDesiredDurationChange(
                                activity.id,
                                event.target.value
                              )
                            }
                            style={{
                              width:
                                '64px',

                              height:
                                '28px',

                              padding:
                                '0 7px',

                              border:
                                '1px solid #cbd7e2',

                              borderRadius:
                                '6px',

                              background:
                                isViewingCurrentVersion
                                  ? '#ffffff'
                                  : '#f4f7f9',

                              color:
                                '#052c49',

                              fontSize:
                                '12px',

                              fontWeight:
                                800,

                              textAlign:
                                'right',
                            }}
                          />

                          <span
                            style={{
                              marginLeft:
                                '4px',
                            }}
                          >
                            d
                          </span>
                        </div>
                      )}
                    </div>
                  )
                }
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


              {filteredActivities.map(
                (
                  activity,
                  visibleIndex
                ) => {
                  const rawDuration =
                    Number(
                      activity.rawDuration
                    )


                  const desiredDuration =
                    Number(
                      desiredDurations[
                        activity.id
                      ]
                    )


                  const displayedDuration =
                    activeTab ===
                      'duration' &&
                    Number.isFinite(
                      desiredDuration
                    ) &&
                    desiredDuration >
                      0
                      ? desiredDuration
                      : rawDuration


                  const hasDuration =
                    Number.isFinite(
                      displayedDuration
                    ) &&
                    displayedDuration >
                      0


                  const resource =
                    calculateRequiredResource(
                      activity,
                      desiredDuration
                    )


                  const width =
                    hasDuration
                      ? Math.max(
                          displayedDuration *
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
                        selectedActivity?.id ===
                        activity.id
                          ? styles.ganttRowSelected
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
                            {activeTab ===
                              'duration' &&
                            resource.recommended
                              ? `${safeNumber(
                                  displayedDuration
                                )} d · ${resource.recommended} ${getResourceUnit(
                                  activity,
                                  resource.recommended
                                )}`
                              : `${safeNumber(
                                  displayedDuration
                                )} d`}
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


            {activeTab ===
            'sequence' ? (
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
                  detail={
                    isViewingCurrentVersion
                      ? 'Drag handle to reorder'
                      : 'Historical sequence'
                  }
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
            ) : (
              <div
                className={
                  styles.inspectorMetrics
                }
              >
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


                <InspectorMetric
                  label="Desired Duration"
                  value={
                    selectedDesiredDuration
                      ? `${safeNumber(
                          selectedDesiredDuration
                        )} d`
                      : '—'
                  }
                  detail="Planner input"
                  emphasized
                />


                <InspectorMetric
                  label="Current Resource"
                  value={
                    getResourceLabel(
                      selectedActivity
                    )
                  }
                />


                <InspectorMetric
                  label="Calculated Resource"
                  value={
                    selectedResourceCalculation.exact
                      ? `${safeNumber(
                          selectedResourceCalculation.exact
                        )} ${getResourceUnit(
                          selectedActivity,
                          selectedResourceCalculation.exact
                        )}`
                      : '—'
                  }
                  detail="Mathematical result"
                />


                <InspectorMetric
                  label="Required Resource"
                  value={
                    selectedResourceCalculation.recommended
                      ? `${selectedResourceCalculation.recommended} ${getResourceUnit(
                          selectedActivity,
                          selectedResourceCalculation.recommended
                        )}`
                      : '—'
                  }
                  detail="Rounded up"
                  emphasized
                />


                <InspectorMetric
                  label="Resource Difference"
                  value={
                    Number.isFinite(
                      selectedResourceCalculation.difference
                    )
                      ? `${
                          selectedResourceCalculation.difference >
                          0
                            ? '+'
                            : ''
                        }${safeNumber(
                          selectedResourceCalculation.difference
                        )} ${getResourceUnit(
                          selectedActivity,
                          Math.abs(
                            selectedResourceCalculation.difference
                          )
                        )}`
                      : '—'
                  }
                  detail={
                    Number.isFinite(
                      selectedResourceCalculation.difference
                    )
                      ? selectedResourceCalculation.difference >
                        0
                        ? 'Additional resource needed'
                        : selectedResourceCalculation.difference <
                            0
                          ? 'Resource reduction possible'
                          : 'Current resource matches requirement'
                      : ''
                  }
                />
              </div>
            )}
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


/* =========================================================
   INSPECTOR METRIC
   ========================================================= */

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
