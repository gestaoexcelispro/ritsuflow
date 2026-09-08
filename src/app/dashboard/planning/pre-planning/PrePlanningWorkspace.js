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
  return basis ===
    'crew_day'
    ? 'Per crew / day'
    : 'Per worker / day'
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
      activity?.effectiveWorkforce
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
      exact: null,
      recommended: null,
      current:
        validCurrent,
      difference: null,
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

  return {
    exact,
    recommended,

    current:
      validCurrent,

    difference:
      validCurrent !==
        null
        ? recommended -
          validCurrent
        : null,
  }
}


/* =========================================================
   DURATION HELPERS
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
          Number(
            value
          )

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
    insertionIndex -=
      1
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
   VERSION ORDER
   ========================================================= */

function applyVersionSequence(
  activities,
  sequenceRows
) {
  if (
    !Array.isArray(
      activities
    )
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

  const used =
    new Set()

  const ordered = []

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
        !used.has(
          activity.id
        )
      ) {
        ordered.push(
          activity
        )
      }
    }
  )

  return ordered
}


/* =========================================================
   PRODUCTION GROUP HELPERS
   ========================================================= */

function getScopeSequenceKey(
  activity
) {
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


/* =========================================================
   APPLY SEQUENCE TEMPLATE
   ========================================================= */

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

  let targetGroups = 0
  let changedGroups = 0
  let matchedActivities = 0

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

      targetGroups += 1

      matchedActivities +=
        matchingEntries.length

      const sortedActivities =
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
            sortedActivities[
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
            sortedActivities[
              index
            ]
          )
        }
      )
    }
  )

  return {
    activities:
      fullOrder.map(
        (
          activity,
          index
        ) =>
          replacements.get(
            index
          ) ||
          activity
      ),

    targetGroups,
    changedGroups,
    matchedActivities,
  }
}


/* =========================================================
   APPLY DURATION TEMPLATE
   ========================================================= */

function applyDurationTemplate({
  fullOrder,
  desiredDurations,
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

  const sourceDurationMap =
    new Map()

  sourceActivities.forEach(
    (activity) => {
      const duration =
        Number(
          desiredDurations?.[
            activity.id
          ]
        )

      if (
        Number.isFinite(
          duration
        ) &&
        duration > 0
      ) {
        sourceDurationMap.set(
          getScopeSequenceKey(
            activity
          ),
          duration
        )
      }
    }
  )

  if (
    sourceDurationMap.size ===
    0
  ) {
    return {
      durations:
        desiredDurations,

      sourceDurations:
        0,

      targetGroups:
        0,

      changedGroups:
        0,

      matchedActivities:
        0,
    }
  }

  const groups =
    new Map()

  fullOrder.forEach(
    (activity) => {
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
        .push(
          activity
        )
    }
  )

  const nextDurations = {
    ...desiredDurations,
  }

  let targetGroups = 0
  let changedGroups = 0
  let matchedActivities = 0

  groups.forEach(
    (
      groupActivities,
      groupKey
    ) => {
      if (
        groupKey ===
        sourceGroupKey
      ) {
        return
      }

      const matchingActivities =
        groupActivities.filter(
          (activity) =>
            sourceDurationMap.has(
              getScopeSequenceKey(
                activity
              )
            )
        )

      if (
        matchingActivities.length ===
        0
      ) {
        return
      }

      targetGroups +=
        1

      let groupChanged =
        false

      matchingActivities.forEach(
        (activity) => {
          const sourceDuration =
            sourceDurationMap.get(
              getScopeSequenceKey(
                activity
              )
            )

          const currentDuration =
            Number(
              nextDurations[
                activity.id
              ]
            )

          matchedActivities +=
            1

          if (
            !Number.isFinite(
              currentDuration
            ) ||
            currentDuration !==
              sourceDuration
          ) {
            nextDurations[
              activity.id
            ] =
              sourceDuration

            groupChanged =
              true
          }
        }
      )

      if (
        groupChanged
      ) {
        changedGroups +=
          1
      }
    }
  )

  return {
    durations:
      nextDurations,

    sourceDurations:
      sourceDurationMap.size,

    targetGroups,
    changedGroups,
    matchedActivities,
  }
}


/* =========================================================
   WBS VIEW
   ========================================================= */

function buildWbsRows(
  activities,
  desiredDurations
) {
  const rows = []
  const locations = new Map()

  activities.forEach(
    (activity) => {
      const locationKey =
        activity.locationId ||
        activity.locationName ||
        '__no_location__'

      const divisionKey =
        activity.divisionId ||
        activity.divisionName ||
        '__no_division__'

      const workPackageKey =
        activity.workPackageCode ||
        '__no_work_package__'

      if (
        !locations.has(
          locationKey
        )
      ) {
        locations.set(
          locationKey,
          {
            name:
              activity.locationName ||
              'Unassigned Location',
            divisions:
              new Map(),
          }
        )
      }

      const location =
        locations.get(
          locationKey
        )

      if (
        !location.divisions.has(
          divisionKey
        )
      ) {
        location.divisions.set(
          divisionKey,
          {
            name:
              activity.divisionName &&
              activity.divisionName !==
                '—'
                ? activity.divisionName
                : 'Unassigned Division',
            workPackages:
              new Map(),
          }
        )
      }

      const division =
        location.divisions.get(
          divisionKey
        )

      if (
        !division.workPackages.has(
          workPackageKey
        )
      ) {
        division.workPackages.set(
          workPackageKey,
          {
            code:
              activity.workPackageCode ||
              'WP',
            color:
              activity.workPackageColor ||
              '#00998b',
            activities: [],
          }
        )
      }

      division.workPackages
        .get(
          workPackageKey
        )
        .activities.push(
          activity
        )
    }
  )

  let locationIndex = 0

  locations.forEach(
    (location) => {
      locationIndex += 1

      const locationCode =
        `${locationIndex}.0`

      rows.push({
        id:
          `wbs-location-${locationIndex}`,
        type:
          'location',
        wbs:
          locationCode,
        name:
          location.name,
        duration:
          null,
        predecessor:
          '—',
        relationship:
          '—',
        activity:
          null,
      })

      let divisionIndex = 0

      location.divisions.forEach(
        (division) => {
          divisionIndex += 1

          const divisionCode =
            `${locationIndex}.${divisionIndex}`

          rows.push({
            id:
              `wbs-division-${locationIndex}-${divisionIndex}`,
            type:
              'division',
            wbs:
              divisionCode,
            name:
              division.name,
            duration:
              null,
            predecessor:
              '—',
            relationship:
              '—',
            activity:
              null,
          })

          let workPackageIndex = 0

          division.workPackages.forEach(
            (workPackage) => {
              workPackageIndex += 1

              const workPackageCode =
                `${divisionCode}.${workPackageIndex}`

              rows.push({
                id:
                  `wbs-wp-${locationIndex}-${divisionIndex}-${workPackageIndex}`,
                type:
                  'workPackage',
                wbs:
                  workPackageCode,
                name:
                  workPackage.code,
                color:
                  workPackage.color,
                duration:
                  null,
                predecessor:
                  '—',
                relationship:
                  '—',
                activity:
                  null,
              })

              workPackage.activities.forEach(
                (
                  activity,
                  activityIndex
                ) => {
                  const desired =
                    Number(
                      desiredDurations?.[
                        activity.id
                      ]
                    )

                  const raw =
                    Number(
                      activity.rawDuration
                    )

                  const duration =
                    Number.isFinite(
                      desired
                    ) &&
                    desired > 0
                      ? desired
                      : Number.isFinite(
                            raw
                          ) &&
                          raw > 0
                        ? raw
                        : null

                  rows.push({
                    id:
                      `wbs-activity-${activity.id}`,
                    type:
                      'activity',
                    wbs:
                      `${workPackageCode}.${activityIndex + 1}`,
                    name:
                      activity.scopeItemName,
                    duration,
                    predecessor:
                      '—',
                    relationship:
                      '—',
                    color:
                      activity.workPackageColor ||
                      '#00998b',
                    activity,
                  })
                }
              )
            }
          )
        }
      )
    }
  )

  return rows
}


/* =========================================================
   RAIL BUTTON
   ========================================================= */

function RailButton({
  label,
  symbol,
  active = false,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`${styles.railButton} ${
        active
          ? styles.railButtonActive
          : ''
      }`}
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      title={
        label
      }
    >
      <span
        className={
          styles.railIcon
        }
      >
        {symbol}
      </span>

      <span
        className={
          styles.railTooltip
        }
      >
        {label}
      </span>
    </button>
  )
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

  standalone = false,
}) {
  const router =
    useRouter()

  const workingVersion =
    currentVersion ||
    activeVersion ||
    null


  /* =======================================================
     NORMALIZED INPUT
     ======================================================= */

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


  /* =======================================================
     UI STATE
     ======================================================= */

  const [
    activeTab,
    setActiveTab,
  ] =
    useState(
      'sequence'
    )

  const [
    openRailPanel,
    setOpenRailPanel,
  ] =
    useState(
      null
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


  /* =======================================================
     REFS
     ======================================================= */

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


  /* =======================================================
     VERSION STATE
     ======================================================= */

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


  /* =======================================================
     RESET FROM SERVER
     ======================================================= */

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

      setOpenRailPanel(
        null
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


  /* =======================================================
     DIRTY STATE
     ======================================================= */

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


  /* =======================================================
     VERSION SELECTION
     ======================================================= */

  function getVersionActivities(
    versionId
  ) {
    if (
      !versionId ||
      versionId ===
        workingVersion?.id
    ) {
      return [
        ...normalizedActivities,
      ]
    }

    return applyVersionSequence(
      normalizedActivities,
      versionSequences?.[
        versionId
      ] ||
      []
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

    setOpenRailPanel(
      null
    )

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
    }
  }


  /* =======================================================
     FILTER OPTIONS
     ======================================================= */

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

  const wbsRows =
    useMemo(
      () =>
        buildWbsRows(
          filteredActivities,
          desiredDurations
        ),
      [
        filteredActivities,
        desiredDurations,
      ]
    )

  const displayedRowCount =
    activeTab ===
      'wbs'
      ? wbsRows.length
      : filteredActivities.length


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

  const sourceHasDesiredDurations =
    useMemo(
      () => {
        if (
          !hasExactSourceFilter
        ) {
          return false
        }

        return filteredActivities.some(
          (activity) => {
            const duration =
              Number(
                desiredDurations[
                  activity.id
                ]
              )

            return (
              Number.isFinite(
                duration
              ) &&
              duration > 0
            )
          }
        )
      },
      [
        hasExactSourceFilter,
        filteredActivities,
        desiredDurations,
      ]
    )


  /* =======================================================
     TIMELINE
     ======================================================= */

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
                duration > 0
            )

        return durations.length
          ? Math.max(
              ...durations
            )
          : 0
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


  /* =======================================================
     MODE / FILTERS
     ======================================================= */

  function handleTabChange(
    tab
  ) {
    setActiveTab(
      tab
    )

    setOpenRailPanel(
      null
    )

    setRowDrag(
      null
    )

    rowDragRef.current =
      null
  }


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

    setOpenRailPanel(
      null
    )

    setRowDrag(
      null
    )

    rowDragRef.current =
      null
  }


  function toggleRailPanel(
    panel
  ) {
    setOpenRailPanel(
      (current) =>
        current === panel
          ? null
          : panel
    )
  }


  /* =======================================================
     DESIRED DURATION
     ======================================================= */

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

        [allocationId]:
          numeric,
      })
    )
  }


  /* =======================================================
     SAVE DURATION STRATEGY
     ======================================================= */

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


  /* =======================================================
     APPLY DURATION TO ALL
     ======================================================= */

  function handleApplyDurationToAll() {
    if (
      actionState !==
        'idle' ||
      !isViewingCurrentVersion
    ) {
      return
    }

    if (
      !hasExactSourceFilter
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Select one Location and one Division to use as the source duration strategy.',
      })

      return
    }

    const result =
      applyDurationTemplate({
        fullOrder:
          orderedActivities,

        desiredDurations,

        sourceLocationId:
          selectedLocation,

        sourceDivisionId:
          selectedDivision,
      })

    if (
      result.sourceDurations ===
      0
    ) {
      setNotice({
        type:
          'warning',

        text:
          'Enter at least one Desired Duration in the selected source area first.',
      })

      return
    }

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

    const beforeSignature =
      durationSignature(
        desiredDurations
      )

    const afterSignature =
      durationSignature(
        result.durations
      )

    if (
      beforeSignature ===
      afterSignature
    ) {
      setNotice({
        type:
          'success',

        text:
          'The target areas already follow this duration strategy.',
      })

      return
    }

    setDesiredDurations(
      result.durations
    )

    setNotice({
      type:
        'success',

      text:
        `Duration strategy applied to ${result.changedGroups} ${
          result.changedGroups ===
          1
            ? 'area'
            : 'areas'
        }. Required resources were recalculated automatically.`,
    })
  }


  /* =======================================================
     APPLY SEQUENCE TO ALL
     ======================================================= */

  function handleApplySequenceToAll() {
    if (
      actionState !==
        'idle' ||
      !isViewingCurrentVersion
    ) {
      return
    }

    if (
      !hasExactSourceFilter
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
          'The target areas already follow this sequence.',
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


  /* =======================================================
     SAVE / CREATE VERSION
     ======================================================= */

  async function runSequenceAction(
    action
  ) {
    if (
      actionState !==
        'idle' ||
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

      setNotice({
        type:
          'success',

        text:
          action ===
            'save'
            ? `${result.version.versionName} saved successfully.`
            : `${result.version.versionName} created from the current sequence.`,
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
          'Sequence could not be saved.',
      })
    } finally {
      setActionState(
        'idle'
      )
    }
  }


  /* =======================================================
     VERSION MANAGEMENT
     ======================================================= */

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
            `${result.version.versionName} created successfully.`,
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
        setNotice({
          type:
            'success',

          text:
            'Historical version deleted successfully.',
        })
      }

      setOpenRailPanel(
        null
      )

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
      proposedName.trim()

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


  /* =======================================================
     DISABLED STATES
     ======================================================= */

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

  const applyDurationDisabled =
    actionState !==
      'idle' ||
    !isViewingCurrentVersion ||
    !hasExactSourceFilter ||
    filteredActivities.length ===
      0 ||
    !sourceHasDesiredDurations

  const versionManagementDisabled =
    actionState !==
      'idle'


  /* =======================================================
     VERTICAL DRAG
     ======================================================= */

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
      activeTab !==
        'sequence' ||
      !isViewingCurrentVersion
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


  /* =======================================================
     SCROLL
     ======================================================= */

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


  /* =======================================================
     ZOOM
     ======================================================= */

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


  /* =======================================================
     DERIVED INSPECTOR VALUES
     ======================================================= */

  const targetTaktNumber =
    Number(
      targetTakt
    )

  const hasTargetTakt =
    Number.isFinite(
      targetTaktNumber
    ) &&
    targetTaktNumber > 0

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


  /* =======================================================
     HEADER
     ======================================================= */

  const header = (
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
        {standalone ? (
          <>
            <div
              className={
                styles.standaloneBrand
              }
            >
              RitsuFlow
            </div>

            <div
              className={
                styles.headerDivider
              }
            />

            <div
              className={
                styles.standaloneModule
              }
            >
              PLANNING / PRE-PLANNING
            </div>

            <div
              className={
                styles.headerDivider
              }
            />
          </>
        ) : (
          <div
            className={
              styles.eyebrow
            }
          >
            PRE-PLANNING
          </div>
        )}

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

        {!standalone ? (
          <p
            className={
              styles.projectDescription
            }
          >
            Define the preliminary production sequence and test duration-driven resource strategies.
          </p>
        ) : null}
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
            standalone
              ? '/dashboard'
              : changeProjectHref
          }
          className={
            styles.changeProjectButton
          }
        >
          {standalone
            ? '← RitsuFlow'
            : 'Change Project'}
        </Link>
      </div>
    </header>
  )


  /* =======================================================
     DASHBOARD TOOLBAR
     ======================================================= */

  const dashboardToolbar = (
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
                ? styles.tabButtonActive
                : styles.tabButton
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
                ? styles.tabButtonActive
                : styles.tabButton
            }
            onClick={() =>
              handleTabChange(
                'duration'
              )
            }
          >
            Duration & Resources
          </button>

          <button
            type="button"
            className={
              activeTab ===
              'wbs'
                ? styles.tabButtonActive
                : styles.tabButton
            }
            onClick={() =>
              handleTabChange(
                'wbs'
              )
            }
          >
            WBS
          </button>
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
  )


  /* =======================================================
     STANDALONE LEFT RAIL
     ======================================================= */

  const standaloneLeftRail = (
    <aside
      className={
        styles.leftRail
      }
    >
      <RailButton
        label="Sequence"
        symbol="≡"
        active={
          activeTab ===
          'sequence'
        }
        onClick={() =>
          handleTabChange(
            'sequence'
          )
        }
      />

      <RailButton
        label="Duration & Resources"
        symbol="◷"
        active={
          activeTab ===
          'duration'
        }
        onClick={() =>
          handleTabChange(
            'duration'
          )
        }
      />

      <RailButton
        label="WBS"
        symbol="W"
        active={
          activeTab ===
          'wbs'
        }
        onClick={() =>
          handleTabChange(
            'wbs'
          )
        }
      />

      <div
        className={
          styles.railDivider
        }
      />

      <div
        className={
          styles.railControl
        }
      >
        <RailButton
          label="Location"
          symbol="⌖"
          active={
            selectedLocation !==
            'all'
          }
          onClick={() =>
            toggleRailPanel(
              'location'
            )
          }
        />

        {openRailPanel ===
        'location' ? (
          <div
            className={
              styles.leftRailPopover
            }
          >
            <div
              className={
                styles.popoverHeader
              }
            >
              Location
            </div>

            <select
              value={
                selectedLocation
              }
              onChange={
                handleLocationChange
              }
              className={
                styles.popoverSelect
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
          </div>
        ) : null}
      </div>

      <div
        className={
          styles.railControl
        }
      >
        <RailButton
          label="Division"
          symbol="▦"
          active={
            selectedDivision !==
            'all'
          }
          onClick={() =>
            toggleRailPanel(
              'division'
            )
          }
        />

        {openRailPanel ===
        'division' ? (
          <div
            className={
              styles.leftRailPopover
            }
          >
            <div
              className={
                styles.popoverHeader
              }
            >
              Division
            </div>

            <select
              value={
                selectedDivision
              }
              onChange={
                handleDivisionChange
              }
              className={
                styles.popoverSelect
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
          </div>
        ) : null}
      </div>

      {hasFilters ? (
        <RailButton
          label="Clear Filters"
          symbol="×"
          onClick={
            clearFilters
          }
        />
      ) : null}

      <div
        className={
          styles.railDivider
        }
      />

      <RailButton
        label="Zoom Out"
        symbol="−"
        disabled={
          dayWidth <=
          MIN_DAY_WIDTH
        }
        onClick={
          zoomOut
        }
      />

      <RailButton
        label="Zoom In"
        symbol="+"
        disabled={
          dayWidth >=
          MAX_DAY_WIDTH
        }
        onClick={
          zoomIn
        }
      />

      <RailButton
        label="Fit Timeline"
        symbol="⤢"
        onClick={
          fitTimeline
        }
      />

      <div
        className={
          styles.railZoomValue
        }
      >
        {dayWidth}px
      </div>
    </aside>
  )


  /* =======================================================
     DASHBOARD VERSION BAR
     ======================================================= */

  const dashboardVersionBar = (
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
            styles.versionEyebrow
          }
        >
          Version
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
            className={
              styles.versionSelect
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
                  {
                    version.versionName
                  }
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
            Not saved
          </strong>
        )}

        {selectedVersion?.isCurrent ? (
          <span
            className={
              styles.versionBadge
            }
          >
            Current
          </span>
        ) : null}

        <span
          className={
            styles.versionCountBadge
          }
        >
          {effectiveVersionCount}{' '}
          {effectiveVersionCount ===
          1
            ? 'version'
            : 'versions'}
        </span>

        {hasUnsavedChanges ? (
          <span
            className={
              styles.dirtyBadge
            }
          >
            Unsaved
          </span>
        ) : workingVersion ? (
          <span
            className={
              styles.savedBadge
            }
          >
            Saved
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
            Work on This Version
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
              Duplicate
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
              Rename
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
              Delete Version
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
              Create Version
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
              {workingVersion
                ? 'Save Sequence'
                : 'Save Sequence · Create V1'}
            </button>
          </>
        ) : activeTab ===
        'duration' ? (
          <>
            <button
              type="button"
              className={
                styles.createVersionButton
              }
              disabled={
                applyDurationDisabled
              }
              onClick={
                handleApplyDurationToAll
              }
            >
              Apply Duration to All
            </button>

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
              Save Duration & Resources
            </button>
          </>
        ) : null}
      </div>
    </div>
  )


  /* =======================================================
     STANDALONE RIGHT RAIL
     ======================================================= */

  const standaloneRightRail = (
    <aside
      className={
        styles.rightRail
      }
    >
      <div
        className={
          styles.railControl
        }
      >
        <RailButton
          label="Versions"
          symbol="V"
          active={
            openRailPanel ===
            'version'
          }
          onClick={() =>
            toggleRailPanel(
              'version'
            )
          }
        />

        {openRailPanel ===
        'version' ? (
          <div
            className={
              styles.rightRailPopover
            }
          >
            <div
              className={
                styles.popoverHeader
              }
            >
              Versions
            </div>

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
                className={
                  styles.popoverSelect
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
                      {
                        version.versionName
                      }
                      {version.isCurrent
                        ? ' · Current'
                        : ''}
                    </option>
                  )
                )}
              </select>
            ) : (
              <div
                className={
                  styles.popoverMessage
                }
              >
                No saved versions yet.
              </div>
            )}

            <div
              className={
                styles.popoverStatusRow
              }
            >
              {selectedVersion?.isCurrent ? (
                <span
                  className={
                    styles.versionBadge
                  }
                >
                  Current
                </span>
              ) : null}

              {hasUnsavedChanges ? (
                <span
                  className={
                    styles.dirtyBadge
                  }
                >
                  Unsaved
                </span>
              ) : null}
            </div>

            {isHistoricalView ? (
              <button
                type="button"
                className={
                  styles.popoverPrimaryButton
                }
                disabled={
                  versionManagementDisabled
                }
                onClick={
                  handleWorkOnSelectedVersion
                }
              >
                Work on This Version
              </button>
            ) : null}

            {selectedVersion ? (
              <>
                <button
                  type="button"
                  className={
                    styles.popoverButton
                  }
                  disabled={
                    versionManagementDisabled
                  }
                  onClick={
                    handleDuplicateVersion
                  }
                >
                  Duplicate
                </button>

                <button
                  type="button"
                  className={
                    styles.popoverButton
                  }
                  disabled={
                    versionManagementDisabled
                  }
                  onClick={
                    handleRenameVersion
                  }
                >
                  Rename
                </button>

                <button
                  type="button"
                  className={
                    styles.popoverDangerButton
                  }
                  disabled={
                    versionManagementDisabled ||
                    selectedVersion.isCurrent
                  }
                  onClick={
                    handleDeleteVersion
                  }
                >
                  Delete Version
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={
          styles.railDivider
        }
      />

      {activeTab ===
      'sequence' ? (
        <>
          <RailButton
            label={
              workingVersion
                ? 'Save Sequence'
                : 'Save Sequence · Create V1'
            }
            symbol="✓"
            disabled={
              saveDisabled
            }
            onClick={() =>
              runSequenceAction(
                'save'
              )
            }
          />

          <RailButton
            label="Create Version"
            symbol="+V"
            disabled={
              createVersionDisabled
            }
            onClick={() =>
              runSequenceAction(
                'create_version'
              )
            }
          />

          <RailButton
            label="Apply Sequence to All"
            symbol="⇄"
            disabled={
              applySequenceDisabled
            }
            onClick={
              handleApplySequenceToAll
            }
          />
        </>
      ) : activeTab ===
      'duration' ? (
        <>
          <RailButton
            label="Save Duration & Resources"
            symbol="✓"
            disabled={
              durationSaveDisabled
            }
            onClick={
              saveDurationStrategy
            }
          />

          <RailButton
            label="Apply Duration to All"
            symbol="⇄"
            disabled={
              applyDurationDisabled
            }
            onClick={
              handleApplyDurationToAll
            }
          />
        </>
      ) : null}

      {notice ? (
        <div
          className={`${styles.railNotice} ${
            notice.type ===
              'success'
              ? styles.railNoticeSuccess
              : notice.type ===
                  'warning'
                ? styles.railNoticeWarning
                : styles.railNoticeError
          }`}
          title={
            notice.text
          }
        >
          !
        </div>
      ) : null}
    </aside>
  )


  /* =======================================================
     PLANNING GRID
     ======================================================= */

  const planningGrid = (
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
        {activeTab ===
        'wbs' ? (
          <div
            className={
              styles.activityHeader
            }
            style={{
              gridTemplateColumns:
                '92px minmax(250px, 1fr) 92px 118px 112px',
            }}
          >
            <div
              className={
                styles.activityHeaderCell
              }
            >
              WBS
            </div>

            <div
              className={
                styles.activityHeaderCell
              }
            >
              Name
            </div>

            <div
              className={
                styles.activityHeaderCellRight
              }
            >
              Duration
            </div>

            <div
              className={
                styles.activityHeaderCell
              }
            >
              Predecessor
            </div>

            <div
              className={
                styles.activityHeaderCell
              }
            >
              Relationship
            </div>
          </div>
        ) : (
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
        )}

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
                  displayedRowCount *
                    ROW_HEIGHT,
                  ROW_HEIGHT
                ),
            }}
          >
            {activeTab ===
              'sequence' &&
            rowDrag ? (
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

            {activeTab ===
            'wbs' ? (
              wbsRows.length >
              0 ? (
                wbsRows.map(
                  (
                    row,
                    rowIndex
                  ) => {
                    const isActivity =
                      row.type ===
                      'activity'

                    const selected =
                      isActivity &&
                      selectedActivity?.id ===
                        row.activity?.id

                    const level =
                      row.type ===
                        'location'
                        ? 0
                        : row.type ===
                            'division'
                          ? 1
                          : row.type ===
                              'workPackage'
                            ? 2
                            : 3

                    const background =
                      row.type ===
                        'location'
                        ? '#e8f1f4'
                        : row.type ===
                            'division'
                          ? '#f1f6f8'
                          : row.type ===
                              'workPackage'
                            ? '#f8fafb'
                            : undefined

                    return (
                      <div
                        key={
                          row.id
                        }
                        className={`${styles.activityRowShell} ${
                          selected
                            ? styles.activityRowShellSelected
                            : ''
                        }`}
                        style={{
                          top:
                            rowIndex *
                            ROW_HEIGHT,
                          gridTemplateColumns:
                            '92px minmax(250px, 1fr) 92px 118px 112px',
                          background,
                          cursor:
                            isActivity
                              ? 'pointer'
                              : 'default',
                          fontWeight:
                            isActivity
                              ? 500
                              : 700,
                        }}
                        onClick={() => {
                          if (
                            isActivity
                          ) {
                            setSelectedActivityId(
                              row.activity.id
                            )
                          }
                        }}
                      >
                        <div
                          className={
                            styles.activityId
                          }
                          style={{
                            paddingLeft:
                              `${10 + level * 8}px`,
                            fontWeight:
                              isActivity
                                ? 600
                                : 800,
                          }}
                        >
                          {
                            row.wbs
                          }
                        </div>

                        <div
                          className={
                            styles.scopeItemName
                          }
                          title={
                            row.name
                          }
                          style={{
                            paddingLeft:
                              `${8 + level * 14}px`,
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap:
                              '8px',
                          }}
                        >
                          {row.type ===
                          'workPackage' ? (
                            <span
                              className={
                                styles.workPackageIndicator
                              }
                              style={{
                                background:
                                  row.color ||
                                  '#00998b',
                              }}
                            />
                          ) : null}

                          <span>
                            {
                              row.name
                            }
                          </span>
                        </div>

                        <div
                          className={
                            styles.durationCell
                          }
                        >
                          {isActivity &&
                          Number.isFinite(
                            Number(
                              row.duration
                            )
                          )
                            ? `${safeNumber(
                                row.duration
                              )} d`
                            : '—'}
                        </div>

                        <div
                          className={
                            styles.divisionName
                          }
                          title={
                            isActivity
                              ? 'Predecessor logic will be connected in the next scheduling step.'
                              : ''
                          }
                        >
                          {
                            row.predecessor
                          }
                        </div>

                        <div
                          className={
                            styles.divisionName
                          }
                          title={
                            isActivity
                              ? 'Relationship types: FS, SS, FF, SF.'
                              : ''
                          }
                        >
                          {
                            row.relationship
                          }
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
                    No WBS rows found
                  </strong>

                  <span>
                    No activities match the selected Location and Division.
                  </span>

                  {hasFilters ? (
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
                  ) : null}
                </div>
              )
            ) : filteredActivities.length >
            0 ? (
              filteredActivities.map(
                (
                  activity,
                  visibleIndex
                ) => {
                  const fullIndex =
                    sequenceIndexMap.get(
                      activity.id
                    )

                  const selected =
                    selectedActivity?.id ===
                    activity.id

                  const dragging =
                    rowDrag?.activityId ===
                    activity.id

                  const desiredDuration =
                    desiredDurations[
                      activity.id
                    ] ||
                    ''

                  return (
                    <div
                      key={
                        activity.id
                      }
                      className={`${styles.activityRowShell} ${
                        selected
                          ? styles.activityRowShellSelected
                          : ''
                      } ${
                        dragging
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
                          fullIndex
                        )
                          ? getActivityCode(
                              fullIndex
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

                        {
                          activity.workPackageCode
                        }
                      </div>

                      <div
                        className={
                          styles.scopeItemName
                        }
                        title={
                          activity.scopeItemName
                        }
                      >
                        {
                          activity.scopeItemName
                        }
                      </div>

                      <div
                        className={
                          styles.locationName
                        }
                        title={
                          activity.locationName
                        }
                      >
                        {
                          activity.locationName
                        }
                      </div>

                      <div
                        className={
                          styles.divisionName
                        }
                        title={
                          activity.divisionName
                        }
                      >
                        {
                          activity.divisionName
                        }
                      </div>

                      {activeTab ===
                      'sequence' ? (
                        <div
                          className={
                            Number.isFinite(
                              Number(
                                activity.rawDuration
                              )
                            )
                              ? styles.durationCell
                              : styles.missingDurationCell
                          }
                        >
                          {Number.isFinite(
                            Number(
                              activity.rawDuration
                            )
                          )
                            ? `${safeNumber(
                                activity.rawDuration
                              )} d`
                            : 'Missing'}
                        </div>
                      ) : (
                        <div
                          className={
                            styles.durationInputCell
                          }
                        >
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={
                              desiredDuration
                            }
                            disabled={
                              !isViewingCurrentVersion
                            }
                            placeholder={
                              Number.isFinite(
                                Number(
                                  activity.rawDuration
                                )
                              )
                                ? safeNumber(
                                    activity.rawDuration
                                  )
                                : '—'
                            }
                            className={
                              styles.durationInput
                            }
                            onClick={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
                            onChange={(
                              event
                            ) =>
                              handleDesiredDurationChange(
                                activity.id,
                                event.target.value
                              )
                            }
                          />

                          <span
                            className={
                              styles.unitText
                            }
                          >
                            d
                          </span>
                        </div>
                      )}
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
                  No activities found
                </strong>

                <span>
                  No activities match the selected Location and Division.
                </span>

                {hasFilters ? (
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
                ) : null}
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
                    left:
                      day *
                      dayWidth,

                    width:
                      dayWidth,
                  }}
                >
                  {day %
                    5 ===
                  0
                    ? day
                    : ''}
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
                  displayedRowCount *
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
                backgroundSize:
                  `${dayWidth}px ${ROW_HEIGHT}px`,
              }}
            />

            {dayMarkers
              .filter(
                (day) =>
                  day %
                    5 ===
                  0
              )
              .map(
                (day) => (
                  <div
                    key={
                      `major-${day}`
                    }
                    className={
                      styles.majorGridLine
                    }
                    style={{
                      left:
                        day *
                        dayWidth,
                    }}
                  />
                )
              )}

            {activeTab ===
              'sequence' &&
            rowDrag ? (
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

            {activeTab ===
            'wbs'
              ? wbsRows.map(
                  (
                    row,
                    rowIndex
                  ) => {
                    const isActivity =
                      row.type ===
                      'activity'

                    const selected =
                      isActivity &&
                      selectedActivity?.id ===
                        row.activity?.id

                    const hasDuration =
                      isActivity &&
                      Number.isFinite(
                        Number(
                          row.duration
                        )
                      ) &&
                      Number(
                        row.duration
                      ) > 0

                    const barWidth =
                      hasDuration
                        ? Math.max(
                            4,
                            Number(
                              row.duration
                            ) *
                              dayWidth
                          )
                        : 0

                    return (
                      <button
                        key={
                          `gantt-${row.id}`
                        }
                        type="button"
                        className={`${styles.ganttRow} ${
                          selected
                            ? styles.ganttRowSelected
                            : ''
                        }`}
                        style={{
                          top:
                            rowIndex *
                            ROW_HEIGHT,
                          background:
                            row.type ===
                              'location'
                              ? 'rgba(220, 234, 239, 0.72)'
                              : row.type ===
                                  'division'
                                ? 'rgba(239, 246, 248, 0.72)'
                                : row.type ===
                                    'workPackage'
                                  ? 'rgba(248, 250, 251, 0.82)'
                                  : undefined,
                          cursor:
                            isActivity
                              ? 'pointer'
                              : 'default',
                        }}
                        onClick={() => {
                          if (
                            isActivity
                          ) {
                            setSelectedActivityId(
                              row.activity.id
                            )
                          }
                        }}
                      >
                        {hasDuration ? (
                          <div
                            className={
                              styles.ganttBar
                            }
                            style={{
                              left: 0,
                              width:
                                barWidth,
                              background:
                                row.color ||
                                '#00998b',
                            }}
                          >
                            <span
                              className={
                                styles.ganttBarLabel
                              }
                            >
                              {safeNumber(
                                row.duration
                              )}{' '}
                              d
                            </span>
                          </div>
                        ) : null}
                      </button>
                    )
                  }
                )
              : filteredActivities.map(
                  (
                    activity,
                    visibleIndex
                  ) => {
                    const desired =
                      Number(
                        desiredDurations[
                          activity.id
                        ]
                      )

                    const rawDuration =
                      Number(
                        activity.rawDuration
                      )

                    const displayedDuration =
                      activeTab ===
                        'duration' &&
                      Number.isFinite(
                        desired
                      ) &&
                      desired > 0
                        ? desired
                        : rawDuration

                    const hasDuration =
                      Number.isFinite(
                        displayedDuration
                      ) &&
                      displayedDuration > 0

                    const selected =
                      selectedActivity?.id ===
                      activity.id

                    const dragging =
                      rowDrag?.activityId ===
                      activity.id

                    const resource =
                      activeTab ===
                        'duration'
                        ? calculateRequiredResource(
                            activity,
                            desired
                          )
                        : null

                    const barWidth =
                      hasDuration
                        ? Math.max(
                            4,
                            displayedDuration *
                              dayWidth
                          )
                        : 0

                    let resourceClass =
                      styles.ganttBarWaiting

                    if (
                      resource &&
                      resource.recommended !==
                        null &&
                      resource.current !==
                        null
                    ) {
                      if (
                        resource.difference ===
                        0
                      ) {
                        resourceClass =
                          styles.ganttBarBalanced
                      } else if (
                        resource.difference >
                        0
                      ) {
                        resourceClass =
                          styles.ganttBarGap
                      } else {
                        resourceClass =
                          styles.ganttBarUnderloaded
                      }
                    }

                    return (
                      <button
                        key={
                          activity.id
                        }
                        type="button"
                        className={`${styles.ganttRow} ${
                          selected
                            ? styles.ganttRowSelected
                            : ''
                        } ${
                          dragging
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
                            className={`${styles.ganttBar} ${
                              activeTab ===
                              'duration'
                                ? resourceClass
                                : ''
                            }`}
                            style={{
                              left: 0,

                              width:
                                barWidth,

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
                                displayedDuration
                              )}{' '}
                              d

                              {activeTab ===
                                'duration' &&
                              resource?.recommended !==
                                null &&
                              resource?.recommended !==
                                undefined
                                ? ` · ${resource.recommended} ${getResourceUnit(
                                    activity,
                                    resource.recommended
                                  )}`
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={
                              styles.missingBar
                            }
                          >
                            Missing production data
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
  )


  /* =======================================================
     INSPECTOR
     ======================================================= */

  const inspector = (
    <section
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
                {
                  selectedActivity.workPackageCode
                }
              </span>

              <span>
                {
                  selectedActivity.scopeItemName
                }
              </span>
            </div>

            <div
              className={
                styles.inspectorLocation
              }
            >
              {
                selectedActivity.locationName
              }

              {' · '}

              {
                selectedActivity.divisionName
              }
            </div>
          </div>

          <div
            className={
              styles.inspectorMetrics
            }
          >
            <div
              className={
                styles.inspectorMetric
              }
            >
              <span
                className={
                  styles.inspectorMetricLabel
                }
              >
                Sequence
              </span>

              <strong
                className={
                  styles.inspectorMetricValue
                }
              >
                {
                  selectedSequence
                }
              </strong>
            </div>

            <div
              className={
                styles.inspectorMetric
              }
            >
              <span
                className={
                  styles.inspectorMetricLabel
                }
              >
                Productivity
              </span>

              <strong
                className={
                  styles.inspectorMetricValue
                }
              >
                {safeNumber(
                  selectedActivity.productivity
                )}
              </strong>

              <span
                className={
                  styles.inspectorMetricDetail
                }
              >
                {getBasisLabel(
                  selectedActivity.productivityBasis
                )}
              </span>
            </div>

            <div
              className={
                styles.inspectorMetric
              }
            >
              <span
                className={
                  styles.inspectorMetricLabel
                }
              >
                Current Resource
              </span>

              <strong
                className={
                  styles.inspectorMetricValue
                }
              >
                {getResourceLabel(
                  selectedActivity
                )}
              </strong>
            </div>

            <div
              className={
                styles.inspectorMetric
              }
            >
              <span
                className={
                  styles.inspectorMetricLabel
                }
              >
                Raw Duration
              </span>

              <strong
                className={
                  styles.inspectorMetricValue
                }
              >
                {Number.isFinite(
                  Number(
                    selectedActivity.rawDuration
                  )
                )
                  ? `${safeNumber(
                      selectedActivity.rawDuration
                    )} d`
                  : '—'}
              </strong>
            </div>

            <div
              className={
                activeTab ===
                  'duration'
                  ? styles.inspectorMetricEmphasized
                  : styles.inspectorMetric
              }
            >
              <span
                className={
                  styles.inspectorMetricLabel
                }
              >
                Desired Duration
              </span>

              <strong
                className={
                  styles.inspectorMetricValue
                }
              >
                {selectedDesiredDuration
                  ? `${safeNumber(
                      selectedDesiredDuration
                    )} d`
                  : '—'}
              </strong>
            </div>

            <div
              className={
                activeTab ===
                  'duration'
                  ? styles.inspectorMetricEmphasized
                  : styles.inspectorMetric
              }
            >
              <span
                className={
                  styles.inspectorMetricLabel
                }
              >
                Required Resource
              </span>

              <strong
                className={
                  styles.inspectorMetricValue
                }
              >
                {selectedResourceCalculation.recommended !==
                null
                  ? `${selectedResourceCalculation.recommended} ${getResourceUnit(
                      selectedActivity,
                      selectedResourceCalculation.recommended
                    )}`
                  : '—'}
              </strong>

              {selectedResourceCalculation.difference !==
              null ? (
                <span
                  className={
                    styles.inspectorMetricDetail
                  }
                >
                  Difference:{' '}
                  {selectedResourceCalculation.difference >
                  0
                    ? '+'
                    : ''}
                  {
                    selectedResourceCalculation.difference
                  }
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div
          className={
            styles.noSelection
          }
        >
          Select an activity to inspect its production assumptions.
        </div>
      )}
    </section>
  )


  /* =======================================================
     FINAL RENDER
     ======================================================= */

  return (
    <div
      className={`${styles.workspace} ${
        standalone
          ? styles.workspaceStandalone
          : ''
      }`}
    >
      {header}

      {standalone
        ? standaloneLeftRail
        : dashboardToolbar}

      {standalone
        ? standaloneRightRail
        : dashboardVersionBar}

      {planningGrid}

      {inspector}
    </div>
  )
}
