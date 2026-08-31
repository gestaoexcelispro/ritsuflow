'use client'

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { supabase } from '../../../../lib/supabase'


// ============================================================
// RITSUFLOW™
// PULL PLANNING
//
// Route:
// /dashboard/projects/pullplanning
//
// CURRENT CAPABILITIES
// ------------------------------------------------------------
// - Project portfolio
// - Pull Planning sessions
// - Primary milestone
// - Session lifecycle
// - Organization Work Package catalog
// - Canonical Location Structure
// - Durable Production Activities
// - Session-specific Pull Planning Items
// - Structured date-based pull timeline
// - Location / area lanes
// - Backward-calculated activity dates
// - Zoom + weekend visibility
// - Legacy board positions remain persisted for compatibility
// - Backward predecessor creation
// - Production handoffs
// - Visual dependency arrows
//
// ARCHITECTURE
// ------------------------------------------------------------
//
// MASTER PLAN
//      ↓
// PRODUCTION ACTIVITY
//      ↓
// PULL PLANNING ITEM
//      ↓
// PRODUCTION HANDOFF
//
// Board position is visual only.
// Production handoffs contain the real relationship.
//
// NEXT PHASE
// ------------------------------------------------------------
// - Handoff editor
// - Handoff types
// - Validation workflow
// - Forward validation
// - Milestone feasibility
// ============================================================


// ============================================================
// SESSION LIFECYCLE
// ============================================================

const SESSION_STATUSES = [
  'draft',
  'in_session',
  'validation',
  'published',
  'archived',
]

const STATUS_LABELS = {
  draft: 'Draft',
  in_session: 'In Session',
  validation: 'Validation',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_STYLES = {
  draft: {
    background: '#f1f5f9',
    color: '#475569',
    border: '#cbd5e1',
  },

  in_session: {
    background: '#ecfeff',
    color: '#0e7490',
    border: '#a5f3fc',
  },

  validation: {
    background: '#fff7ed',
    color: '#c2410c',
    border: '#fed7aa',
  },

  published: {
    background: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0',
  },

  archived: {
    background: '#f8fafc',
    color: '#64748b',
    border: '#e2e8f0',
  },
}


// ============================================================
// BOARD CONSTANTS
// ============================================================

const BOARD_WIDTH = 1400
const BOARD_HEIGHT = 720

const NOTE_WIDTH = 180
const NOTE_HEIGHT = 145

const MILESTONE_X = 1130
const MILESTONE_Y = 275
const MILESTONE_WIDTH = 220


// ============================================================
// HELPERS
// ============================================================

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(
    `${value}T00:00:00`,
  )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return date.toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    },
  )
}


function parseDateOnly(value) {
  if (!value) {
    return null
  }

  const parts = String(value).split('-').map(Number)

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null
  }

  return new Date(parts[0], parts[1] - 1, parts[2])
}


function toDateOnlyString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}


function isWeekendDate(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}


function moveWorkingDays(dateValue, amount) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime()) || amount === 0) {
    return date
  }

  const direction = amount > 0 ? 1 : -1
  let remaining = Math.abs(amount)

  while (remaining > 0) {
    date.setDate(date.getDate() + direction)

    if (!isWeekendDate(date)) {
      remaining -= 1
    }
  }

  return date
}


function normalizeToWorkingDay(dateValue, direction = -1) {
  const date = new Date(dateValue)

  while (isWeekendDate(date)) {
    date.setDate(date.getDate() + direction)
  }

  return date
}


function enumerateTimelineDates(startValue, endValue, showWeekends) {
  const start = parseDateOnly(startValue)
  const end = parseDateOnly(endValue)

  if (!start || !end || start > end) {
    return []
  }

  const dates = []
  const cursor = new Date(start)

  while (cursor <= end) {
    if (showWeekends || !isWeekendDate(cursor)) {
      dates.push({
        key: toDateOnlyString(cursor),
        date: new Date(cursor),
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}


function calculateBackwardPullSchedule(items, handoffs, targetDateValue) {
  const targetDate = parseDateOnly(targetDateValue)

  if (!targetDate) {
    return new Map()
  }

  const targetWorkingDate = normalizeToWorkingDay(targetDate, -1)
  const itemByActivity = new Map()

  items.forEach((item) => {
    if (item.production_activity_id) {
      itemByActivity.set(item.production_activity_id, item)
    }
  })

  const successorsByActivity = new Map()

  handoffs.forEach((handoff) => {
    const predecessorId = handoff.predecessor_activity_id
    const successorId = handoff.successor_activity_id

    if (!itemByActivity.has(predecessorId) || !itemByActivity.has(successorId)) {
      return
    }

    if (!successorsByActivity.has(predecessorId)) {
      successorsByActivity.set(predecessorId, [])
    }

    successorsByActivity.get(predecessorId).push(successorId)
  })

  const schedule = new Map()
  const visiting = new Set()

  const calculate = (activityId) => {
    if (schedule.has(activityId)) {
      return schedule.get(activityId)
    }

    const item = itemByActivity.get(activityId)

    if (!item) {
      return null
    }

    if (visiting.has(activityId)) {
      const fallback = {
        start: targetWorkingDate,
        finish: targetWorkingDate,
        startKey: toDateOnlyString(targetWorkingDate),
        finishKey: toDateOnlyString(targetWorkingDate),
      }

      schedule.set(activityId, fallback)
      return fallback
    }

    visiting.add(activityId)

    const successorIds = successorsByActivity.get(activityId) || []
    let finish = new Date(targetWorkingDate)

    if (successorIds.length > 0) {
      const successorSchedules = successorIds
        .map((successorId) => calculate(successorId))
        .filter(Boolean)

      if (successorSchedules.length > 0) {
        const earliestSuccessorStart = successorSchedules
          .map((entry) => entry.start)
          .sort((a, b) => a - b)[0]

        finish = moveWorkingDays(earliestSuccessorStart, -1)
      }
    }

    const duration = Math.max(1, Number(item.duration_working_days || 1))
    const start = moveWorkingDays(finish, -(duration - 1))

    const result = {
      start,
      finish,
      startKey: toDateOnlyString(start),
      finishKey: toDateOnlyString(finish),
    }

    schedule.set(activityId, result)
    visiting.delete(activityId)

    return result
  }

  items.forEach((item) => {
    if (item.production_activity_id) {
      calculate(item.production_activity_id)
    }
  })

  return schedule
}


function getContrastText(background) {
  if (!background || typeof background !== 'string') {
    return '#0f172a'
  }

  const hex = background.replace('#', '')

  if (hex.length !== 6) {
    return '#0f172a'
  }

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance < 0.58 ? '#ffffff' : '#0f172a'
}


function getNextStatus(status) {
  const index =
    SESSION_STATUSES.indexOf(
      status,
    )

  if (
    index < 0 ||
    index >=
      SESSION_STATUSES.length - 1
  ) {
    return null
  }

  return SESSION_STATUSES[
    index + 1
  ]
}


function getPreviousStatus(status) {
  const index =
    SESSION_STATUSES.indexOf(
      status,
    )

  if (index <= 0) {
    return null
  }

  return SESSION_STATUSES[
    index - 1
  ]
}


function getContrastYIQ(hexColor) {
  const clean =
    String(
      hexColor ||
        '#64748b',
    )
      .replace('#', '')
      .padEnd(6, '0')
      .slice(0, 6)

  const r =
    parseInt(
      clean.substring(0, 2),
      16,
    )

  const g =
    parseInt(
      clean.substring(2, 4),
      16,
    )

  const b =
    parseInt(
      clean.substring(4, 6),
      16,
    )

  const yiq =
    (
      r * 299 +
      g * 587 +
      b * 114
    ) /
    1000

  return yiq >= 145
    ? '#071c31'
    : '#ffffff'
}


function buildLocationOptions(
  locations,
) {
  const map =
    new Map(
      locations.map(
        (location) => [
          location.id,
          location,
        ],
      ),
    )

  const childrenCount =
    new Map()

  locations.forEach(
    (location) => {
      if (
        !location.parent_id
      ) {
        return
      }

      childrenCount.set(
        location.parent_id,
        (
          childrenCount.get(
            location.parent_id,
          ) || 0
        ) + 1,
      )
    },
  )

  const buildPath = (
    location,
  ) => {
    if (!location) {
      return ''
    }

    const parts = []
    const visited =
      new Set()

    let current =
      location

    while (
      current &&
      !visited.has(
        current.id,
      )
    ) {
      visited.add(
        current.id,
      )

      if (
        current.name
      ) {
        parts.unshift(
          current.name,
        )
      }

      current =
        current.parent_id
          ? map.get(
              current.parent_id,
            )
          : null
    }

    return parts.join(
      ' / ',
    )
  }

  const leaves =
    locations.filter(
      (location) =>
        !childrenCount.has(
          location.id,
        ),
    )

  const source =
    leaves.length > 0
      ? leaves
      : locations

  return source
    .map(
      (location) => ({
        ...location,
        path:
          buildPath(
            location,
          ),
      }),
    )
    .sort(
      (a, b) =>
        String(
          a.path,
        ).localeCompare(
          String(
            b.path,
          ),
        ),
    )
}


// ============================================================
// MAIN PAGE
// ============================================================

export default function PullPlanningPage() {

  // ==========================================================
  // PROJECTS
  // ==========================================================

  const [
    projects,
    setProjects,
  ] = useState([])

  const [
    projectId,
    setProjectId,
  ] = useState('')

  const [
    projectCoverUrls,
    setProjectCoverUrls,
  ] = useState({})


  // ==========================================================
  // PROJECT CATALOGS
  // ==========================================================

  const [
    workPackages,
    setWorkPackages,
  ] = useState([])

  const [
    locations,
    setLocations,
  ] = useState([])


  // ==========================================================
  // SESSIONS
  // ==========================================================

  const [
    sessions,
    setSessions,
  ] = useState([])

  const [
    selectedSessionId,
    setSelectedSessionId,
  ] = useState(null)

  const [
    milestonesBySession,
    setMilestonesBySession,
  ] = useState({})


  // ==========================================================
  // BOARD DATA
  // ==========================================================

  const [
    pullItems,
    setPullItems,
  ] = useState([])

  const [
    productionActivities,
    setProductionActivities,
  ] = useState([])

  const [
    handoffs,
    setHandoffs,
  ] = useState([])

  const [
    loadingBoard,
    setLoadingBoard,
  ] = useState(false)


  // ==========================================================
  // SELECTED NOTE
  // ==========================================================

  const [
    selectedItemId,
    setSelectedItemId,
  ] = useState(null)


  const [
    dependencyView,
    setDependencyView,
  ] = useState('selected')

  const [
    showWeekends,
    setShowWeekends,
  ] = useState(false)

  const [
    timelineZoom,
    setTimelineZoom,
  ] = useState(1)


  // ==========================================================
  // SESSION MODAL
  // ==========================================================

  const [
    showSessionModal,
    setShowSessionModal,
  ] = useState(false)

  const [
    sessionName,
    setSessionName,
  ] = useState('')

  const [
    phaseName,
    setPhaseName,
  ] = useState('')

  const [
    sessionDescription,
    setSessionDescription,
  ] = useState('')

  const [
    sessionDate,
    setSessionDate,
  ] = useState('')

  const [
    horizonStart,
    setHorizonStart,
  ] = useState('')

  const [
    horizonEnd,
    setHorizonEnd,
  ] = useState('')

  const [
    milestoneName,
    setMilestoneName,
  ] = useState('')

  const [
    milestoneTargetDate,
    setMilestoneTargetDate,
  ] = useState('')


  // ==========================================================
  // ACTIVITY MODAL
  // ==========================================================

  const [
    showActivityModal,
    setShowActivityModal,
  ] = useState(false)

  const [
    activityMode,
    setActivityMode,
  ] = useState(
    'milestone',
  )

  const [
    successorItemId,
    setSuccessorItemId,
  ] = useState(null)

  const [
    activityWorkPackageId,
    setActivityWorkPackageId,
  ] = useState('')

  const [
    activityLocationId,
    setActivityLocationId,
  ] = useState('')

  const [
    activityDescription,
    setActivityDescription,
  ] = useState('')

  const [
    activityOperation,
    setActivityOperation,
  ] = useState('')

  const [
    activityDuration,
    setActivityDuration,
  ] = useState(1)

  const [
    activityQuantity,
    setActivityQuantity,
  ] = useState('')

  const [
    activityUnit,
    setActivityUnit,
  ] = useState('')

  const [
    activityCrew,
    setActivityCrew,
  ] = useState('')

  const [
    activityWorkers,
    setActivityWorkers,
  ] = useState('')

  const [
    activityRate,
    setActivityRate,
  ] = useState('')

  const [
    activityProductivity,
    setActivityProductivity,
  ] = useState('')

  const [
    handoffCondition,
    setHandoffCondition,
  ] = useState('')

  const [
    handoffResponsible,
    setHandoffResponsible,
  ] = useState('')


  // ==========================================================
  // SYSTEM STATE
  // ==========================================================

  const [
    loadingProjects,
    setLoadingProjects,
  ] = useState(true)

  const [
    loadingSessions,
    setLoadingSessions,
  ] = useState(false)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')


  // ==========================================================
  // DRAG STATE
  // ==========================================================

  const boardRef =
    useRef(null)

  const pullItemsRef =
    useRef([])

  const [
    dragState,
    setDragState,
  ] = useState(null)


  useEffect(
    () => {
      pullItemsRef.current =
        pullItems
    },
    [
      pullItems,
    ],
  )


  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const selectedProject =
    useMemo(
      () =>
        projects.find(
          (project) =>
            project.id ===
            projectId,
        ) ||
        null,
      [
        projects,
        projectId,
      ],
    )


  const selectedSession =
    useMemo(
      () =>
        sessions.find(
          (session) =>
            session.id ===
            selectedSessionId,
        ) ||
        null,
      [
        sessions,
        selectedSessionId,
      ],
    )


  const selectedMilestones =
    selectedSessionId
      ? (
          milestonesBySession[
            selectedSessionId
          ] || []
        )
      : []


  const primaryMilestone =
    selectedMilestones.find(
      (milestone) =>
        milestone.is_primary,
    ) ||
    selectedMilestones[0] ||
    null


  const locationOptions =
    useMemo(
      () =>
        buildLocationOptions(
          locations,
        ),
      [
        locations,
      ],
    )


  const workPackageMap =
    useMemo(
      () =>
        new Map(
          workPackages.map(
            (item) => [
              item.id,
              item,
            ],
          ),
        ),
      [
        workPackages,
      ],
    )


  const locationMap =
    useMemo(
      () =>
        new Map(
          locationOptions.map(
            (location) => [
              location.id,
              location,
            ],
          ),
        ),
      [
        locationOptions,
      ],
    )


  const productionActivityMap =
    useMemo(
      () =>
        new Map(
          productionActivities.map(
            (activity) => [
              activity.id,
              activity,
            ],
          ),
        ),
      [
        productionActivities,
      ],
    )


  const pullItemByActivityId =
    useMemo(
      () => {
        const map =
          new Map()

        pullItems.forEach(
          (item) => {
            if (
              item.production_activity_id
            ) {
              map.set(
                item.production_activity_id,
                item,
              )
            }
          },
        )

        return map
      },
      [
        pullItems,
      ],
    )


  const selectedItem =
    useMemo(
      () =>
        pullItems.find(
          (item) =>
            item.id ===
            selectedItemId,
        ) ||
        null,
      [
        pullItems,
        selectedItemId,
      ],
    )


  const boardLocked =
    selectedSession
      ? [
          'published',
          'archived',
        ].includes(
          selectedSession.status,
        )
      : true


  const backwardSchedule =
    useMemo(
      () =>
        calculateBackwardPullSchedule(
          pullItems,
          handoffs,
          primaryMilestone?.target_date,
        ),
      [
        pullItems,
        handoffs,
        primaryMilestone?.target_date,
      ],
    )


  const timelineRange =
    useMemo(
      () => {
        const scheduledDates = []

        backwardSchedule.forEach((entry) => {
          scheduledDates.push(entry.startKey, entry.finishKey)
        })

        const candidatesStart = [
          selectedSession?.planning_horizon_start,
          ...scheduledDates,
        ].filter(Boolean).sort()

        const candidatesEnd = [
          selectedSession?.planning_horizon_end,
          primaryMilestone?.target_date,
          ...scheduledDates,
        ].filter(Boolean).sort()

        return {
          start: candidatesStart[0] || primaryMilestone?.target_date || null,
          end: candidatesEnd[candidatesEnd.length - 1] || primaryMilestone?.target_date || null,
        }
      },
      [
        backwardSchedule,
        selectedSession?.planning_horizon_start,
        selectedSession?.planning_horizon_end,
        primaryMilestone?.target_date,
      ],
    )


  const timelineDates =
    useMemo(
      () =>
        enumerateTimelineDates(
          timelineRange.start,
          timelineRange.end,
          showWeekends,
        ),
      [
        timelineRange.start,
        timelineRange.end,
        showWeekends,
      ],
    )


  const timelineDateIndex =
    useMemo(
      () =>
        new Map(
          timelineDates.map((entry, index) => [entry.key, index]),
        ),
      [timelineDates],
    )


  const timelineLanes =
    useMemo(
      () => {
        const usedLocationIds = new Set(
          productionActivities
            .filter((activity) =>
              pullItemByActivityId.has(activity.id),
            )
            .map((activity) => activity.location_id)
            .filter(Boolean),
        )

        const lanes = locationOptions.filter((location) =>
          usedLocationIds.has(location.id),
        )

        if (lanes.length > 0) {
          return lanes
        }

        return [{
          id: '__unassigned__',
          name: 'Unassigned',
          path: 'Unassigned',
          depth: 0,
        }]
      },
      [
        productionActivities,
        pullItemByActivityId,
        locationOptions,
      ],
    )


  const visibleHandoffs =
    useMemo(
      () => {
        if (dependencyView === 'off') {
          return []
        }

        if (dependencyView === 'all') {
          return handoffs
        }

        if (!selectedItem) {
          return []
        }

        return handoffs.filter((handoff) =>
          handoff.predecessor_activity_id === selectedItem.production_activity_id ||
          handoff.successor_activity_id === selectedItem.production_activity_id,
        )
      },
      [
        dependencyView,
        handoffs,
        selectedItem,
      ],
    )


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  useEffect(
    () => {

      let mounted =
        true


      const loadProjects =
        async () => {

          setLoadingProjects(
            true,
          )

          setErrorMessage(
            '',
          )


          try {

            const {
              data,
              error,
            } =
              await supabase
                .from(
                  'projects',
                )
                .select(`
                  id,
                  organization_id,
                  code,
                  name,
                  client_name,
                  status,
                  city,
                  state_region,
                  country_code,
                  cover_image_path,
                  created_at
                `)
                .neq(
                  'status',
                  'archived',
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  },
                )


            if (
              error
            ) {
              throw error
            }


            const loadedProjects =
              data || []


            if (
              !mounted
            ) {
              return
            }


            setProjects(
              loadedProjects,
            )


            const params =
              new URLSearchParams(
                window.location.search,
              )


            const projectFromUrl =
              params.get(
                'projectId',
              )


            if (
              projectFromUrl &&
              loadedProjects.some(
                (project) =>
                  project.id ===
                  projectFromUrl,
              )
            ) {

              setProjectId(
                projectFromUrl,
              )

            }


            const coverEntries =
              await Promise.all(
                loadedProjects.map(
                  async (
                    project,
                  ) => {

                    if (
                      !project.cover_image_path
                    ) {
                      return [
                        project.id,
                        '',
                      ]
                    }


                    const {
                      data:
                        signedData,
                      error:
                        signedError,
                    } =
                      await supabase
                        .storage
                        .from(
                          'project-covers',
                        )
                        .createSignedUrl(
                          project.cover_image_path,
                          3600,
                        )


                    if (
                      signedError
                    ) {

                      console.warn(
                        'Pull Planning - project cover:',
                        signedError,
                      )


                      return [
                        project.id,
                        '',
                      ]

                    }


                    return [
                      project.id,
                      signedData?.signedUrl ||
                        '',
                    ]

                  },
                ),
              )


            if (
              !mounted
            ) {
              return
            }


            setProjectCoverUrls(
              Object.fromEntries(
                coverEntries,
              ),
            )

          } catch (
            error
          ) {

            console.error(
              'Pull Planning - projects:',
              error,
            )


            if (
              mounted
            ) {

              setProjects(
                [],
              )


              setErrorMessage(
                error?.message ||
                'Projects could not be loaded.',
              )

            }

          } finally {

            if (
              mounted
            ) {

              setLoadingProjects(
                false,
              )

            }

          }

        }


      loadProjects()


      return () => {

        mounted =
          false

      }

    },
    [],
  )


  // ==========================================================
  // LOAD WORK PACKAGE CATALOG + LOCATIONS
  // ==========================================================

  useEffect(
    () => {

      if (
        !selectedProject
      ) {
        setWorkPackages([])
        setLocations([])
        return
      }


      const loadCatalogs =
        async () => {

          try {

            const [
              workPackageResult,
              locationResult,
            ] =
              await Promise.all([

                supabase
                  .from(
                    'organization_work_packages',
                  )
                  .select(`
                    id,
                    organization_id,
                    code,
                    description,
                    color,
                    is_active,
                    created_at,
                    updated_at
                  `)
                  .eq(
                    'organization_id',
                    selectedProject.organization_id,
                  )
                  .eq(
                    'is_active',
                    true,
                  )
                  .order(
                    'code',
                    {
                      ascending:
                        true,
                    },
                  ),

                supabase
                  .from(
                    'locations',
                  )
                  .select(`
                    id,
                    project_id,
                    parent_id,
                    name,
                    location_type,
                    environment_type,
                    sequence_number
                  `)
                  .eq(
                    'project_id',
                    selectedProject.id,
                  )
                  .order(
                    'sequence_number',
                    {
                      ascending:
                        true,
                    },
                  )
                  .order(
                    'name',
                    {
                      ascending:
                        true,
                    },
                  ),

              ])


            if (
              workPackageResult.error
            ) {
              throw workPackageResult.error
            }


            if (
              locationResult.error
            ) {
              throw locationResult.error
            }


            setWorkPackages(
              workPackageResult.data ||
              [],
            )


            setLocations(
              locationResult.data ||
              [],
            )

          } catch (
            error
          ) {

            console.error(
              'Pull Planning - catalogs:',
              error,
            )

            setErrorMessage(
              error?.message ||
              'Planning catalogs could not be loaded.',
            )

          }

        }


      loadCatalogs()

    },
    [
      selectedProject,
    ],
  )


  // ==========================================================
  // LOAD SESSIONS + MILESTONES
  // ==========================================================

  useEffect(
    () => {

      if (
        !projectId
      ) {

        setSessions([])
        setMilestonesBySession({})
        setSelectedSessionId(null)

        return

      }


      const loadSessions =
        async () => {

          setLoadingSessions(
            true,
          )

          setErrorMessage(
            '',
          )


          try {

            const {
              data:
                sessionData,
              error:
                sessionError,
            } =
              await supabase
                .from(
                  'pull_planning_sessions',
                )
                .select(`
                  id,
                  organization_id,
                  project_id,
                  name,
                  phase_name,
                  description,
                  session_date,
                  planning_horizon_start,
                  planning_horizon_end,
                  status,
                  published_at,
                  archived_at,
                  created_by,
                  created_at,
                  updated_at
                `)
                .eq(
                  'project_id',
                  projectId,
                )
                .order(
                  'updated_at',
                  {
                    ascending:
                      false,
                  },
                )


            if (
              sessionError
            ) {
              throw sessionError
            }


            const loadedSessions =
              sessionData || []


            setSessions(
              loadedSessions,
            )


            if (
              loadedSessions.length ===
              0
            ) {

              setMilestonesBySession(
                {},
              )

              setSelectedSessionId(
                null,
              )

              return

            }


            const sessionIds =
              loadedSessions.map(
                (session) =>
                  session.id,
              )


            const {
              data:
                milestoneData,
              error:
                milestoneError,
            } =
              await supabase
                .from(
                  'pull_planning_milestones',
                )
                .select(`
                  id,
                  organization_id,
                  project_id,
                  pull_planning_session_id,
                  location_id,
                  name,
                  description,
                  target_date,
                  source_type,
                  source_entity_type,
                  source_entity_id,
                  source_name_snapshot,
                  source_target_date_snapshot,
                  is_primary,
                  sequence_number,
                  notes,
                  created_at,
                  updated_at
                `)
                .in(
                  'pull_planning_session_id',
                  sessionIds,
                )
                .order(
                  'sequence_number',
                  {
                    ascending:
                      true,
                  },
                )


            if (
              milestoneError
            ) {
              throw milestoneError
            }


            const grouped =
              {}


            ;(
              milestoneData ||
              []
            ).forEach(
              (milestone) => {

                const key =
                  milestone
                    .pull_planning_session_id


                if (
                  !grouped[
                    key
                  ]
                ) {
                  grouped[
                    key
                  ] = []
                }


                grouped[
                  key
                ].push(
                  milestone,
                )

              },
            )


            setMilestonesBySession(
              grouped,
            )


            const params =
              new URLSearchParams(
                window.location.search,
              )


            const sessionFromUrl =
              params.get(
                'sessionId',
              )


            if (
              sessionFromUrl &&
              loadedSessions.some(
                (session) =>
                  session.id ===
                  sessionFromUrl,
              )
            ) {

              setSelectedSessionId(
                sessionFromUrl,
              )

            }

          } catch (
            error
          ) {

            console.error(
              'Pull Planning - sessions:',
              error,
            )

            setErrorMessage(
              error?.message ||
              'Pull Planning sessions could not be loaded.',
            )

          } finally {

            setLoadingSessions(
              false,
            )

          }

        }


      loadSessions()

    },
    [
      projectId,
    ],
  )


  // ==========================================================
  // LOAD BOARD
  // ==========================================================

  useEffect(
    () => {

      if (
        !selectedSessionId ||
        !projectId
      ) {

        setPullItems([])
        setProductionActivities([])
        setHandoffs([])
        setSelectedItemId(null)

        return

      }


      const loadBoard =
        async () => {

          setLoadingBoard(
            true,
          )

          setErrorMessage(
            '',
          )


          try {

            const [
              itemResult,
              handoffResult,
            ] =
              await Promise.all([

                supabase
                  .from(
                    'pull_planning_items',
                  )
                  .select(`
                    id,
                    organization_id,
                    project_id,
                    pull_planning_session_id,
                    production_activity_id,
                    pull_planning_milestone_id,
                    description_snapshot,
                    duration_working_days,
                    quantity_snapshot,
                    unit_snapshot,
                    crew_code_snapshot,
                    planned_workers_snapshot,
                    expected_production_rate_snapshot,
                    expected_productivity_snapshot,
                    planned_start_date,
                    planned_finish_date,
                    board_x,
                    board_y,
                    board_lane,
                    board_order,
                    sequence_number,
                    item_status,
                    notes,
                    created_at,
                    updated_at
                  `)
                  .eq(
                    'pull_planning_session_id',
                    selectedSessionId,
                  )
                  .eq(
                    'project_id',
                    projectId,
                  )
                  .neq(
                    'item_status',
                    'removed',
                  )
                  .order(
                    'sequence_number',
                    {
                      ascending:
                        true,
                    },
                  ),

                supabase
                  .from(
                    'production_activity_handoffs',
                  )
                  .select(`
                    id,
                    organization_id,
                    project_id,
                    pull_planning_session_id,
                    predecessor_activity_id,
                    successor_activity_id,
                    release_condition,
                    handoff_type,
                    required_by_date,
                    planned_release_date,
                    actual_release_date,
                    responsible_party,
                    validation_status,
                    validated_at,
                    notes,
                    created_by,
                    created_at,
                    updated_at
                  `)
                  .eq(
                    'pull_planning_session_id',
                    selectedSessionId,
                  )
                  .eq(
                    'project_id',
                    projectId,
                  )
                  .neq(
                    'validation_status',
                    'superseded',
                  ),

              ])


            if (
              itemResult.error
            ) {
              throw itemResult.error
            }


            if (
              handoffResult.error
            ) {
              throw handoffResult.error
            }


            const items =
              itemResult.data ||
              []


            setPullItems(
              items,
            )


            setHandoffs(
              handoffResult.data ||
              [],
            )


            const activityIds =
              [
                ...new Set(
                  items
                    .map(
                      (item) =>
                        item.production_activity_id,
                    )
                    .filter(
                      Boolean,
                    ),
                ),
              ]


            if (
              activityIds.length ===
              0
            ) {

              setProductionActivities(
                [],
              )

              return

            }


            const {
              data:
                activityData,
              error:
                activityError,
            } =
              await supabase
                .from(
                  'production_activities',
                )
                .select(`
                  id,
                  organization_id,
                  project_id,
                  master_plan_package_id,
                  organization_work_package_id,
                  location_id,
                  activity_code,
                  description,
                  operation_description,
                  quantity,
                  unit,
                  planned_duration_working_days,
                  crew_code,
                  planned_workers,
                  expected_production_rate,
                  expected_productivity,
                  lifecycle_status,
                  notes,
                  created_by,
                  created_at,
                  updated_at
                `)
                .in(
                  'id',
                  activityIds,
                )


            if (
              activityError
            ) {
              throw activityError
            }


            setProductionActivities(
              activityData ||
              [],
            )

          } catch (
            error
          ) {

            console.error(
              'Pull Planning - board:',
              error,
            )

            setErrorMessage(
              error?.message ||
              'Pull Planning board could not be loaded.',
            )

          } finally {

            setLoadingBoard(
              false,
            )

          }

        }


      loadBoard()

    },
    [
      selectedSessionId,
      projectId,
    ],
  )


  // ==========================================================
  // SESSION FORM
  // ==========================================================

  const resetSessionForm =
    () => {

      const today =
        new Date()
          .toISOString()
          .slice(
            0,
            10,
          )


      setSessionName('')
      setPhaseName('')
      setSessionDescription('')
      setSessionDate(today)
      setHorizonStart('')
      setHorizonEnd('')
      setMilestoneName('')
      setMilestoneTargetDate('')

    }


  const openSessionModal =
    () => {

      resetSessionForm()

      setErrorMessage(
        '',
      )

      setShowSessionModal(
        true,
      )

    }


  // ==========================================================
  // ACTIVITY FORM
  // ==========================================================

  const resetActivityForm =
    () => {

      setActivityWorkPackageId('')
      setActivityLocationId('')
      setActivityDescription('')
      setActivityOperation('')
      setActivityDuration(1)
      setActivityQuantity('')
      setActivityUnit('')
      setActivityCrew('')
      setActivityWorkers('')
      setActivityRate('')
      setActivityProductivity('')
      setHandoffCondition('')
      setHandoffResponsible('')

    }


  const openMilestoneActivityModal =
    () => {

      resetActivityForm()

      setActivityMode(
        'milestone',
      )

      setSuccessorItemId(
        null,
      )

      setErrorMessage(
        '',
      )

      setShowActivityModal(
        true,
      )

    }


  const openPredecessorModal =
    (
      event,
      successor,
    ) => {

      event.stopPropagation()


      if (
        boardLocked
      ) {
        return
      }


      resetActivityForm()

      setActivityMode(
        'predecessor',
      )

      setSuccessorItemId(
        successor.id,
      )

      setErrorMessage(
        '',
      )

      setShowActivityModal(
        true,
      )

    }


  // ==========================================================
  // CREATE SESSION
  // ==========================================================

  const createSession =
    async (
      event,
    ) => {

      event.preventDefault()


      if (
        !selectedProject
      ) {
        return
      }


      if (
        !selectedProject.organization_id
      ) {
        setErrorMessage(
          'The organization associated with this project could not be identified. Pull Planning cannot create a session without organization context.',
        )

        return
      }


      if (
        !sessionName.trim() ||
        !phaseName.trim() ||
        !milestoneName.trim() ||
        !milestoneTargetDate
      ) {

        setErrorMessage(
          'Session name, phase, milestone and target date are required.',
        )

        return

      }


      if (
        horizonStart &&
        horizonEnd &&
        horizonEnd <
          horizonStart
      ) {

        setErrorMessage(
          'Planning horizon end cannot be before the start date.',
        )

        return

      }


      setSaving(
        true,
      )

      setErrorMessage(
        '',
      )


      try {

        const {
          data:
            userResult,
          error:
            userError,
        } =
          await supabase
            .auth
            .getUser()


        if (
          userError
        ) {
          throw userError
        }


        const currentUserId =
          userResult
            ?.user
            ?.id ||
          null


        const {
          data:
            createdSession,
          error:
            sessionError,
        } =
          await supabase
            .from(
              'pull_planning_sessions',
            )
            .insert({

              organization_id:
                selectedProject.organization_id,

              project_id:
                selectedProject.id,

              name:
                sessionName.trim(),

              phase_name:
                phaseName.trim(),

              description:
                sessionDescription.trim() ||
                null,

              session_date:
                sessionDate ||
                null,

              planning_horizon_start:
                horizonStart ||
                null,

              planning_horizon_end:
                horizonEnd ||
                null,

              status:
                'draft',

              created_by:
                currentUserId,

            })
            .select()
            .single()


        if (
          sessionError
        ) {
          throw sessionError
        }


        const {
          data:
            createdMilestone,
          error:
            milestoneError,
        } =
          await supabase
            .from(
              'pull_planning_milestones',
            )
            .insert({

              organization_id:
                selectedProject.organization_id,

              project_id:
                selectedProject.id,

              pull_planning_session_id:
                createdSession.id,

              name:
                milestoneName.trim(),

              target_date:
                milestoneTargetDate,

              source_type:
                'pull_planning',

              is_primary:
                true,

              sequence_number:
                1,

            })
            .select()
            .single()


        if (
          milestoneError
        ) {

          await supabase
            .from(
              'pull_planning_sessions',
            )
            .delete()
            .eq(
              'id',
              createdSession.id,
            )


          throw milestoneError

        }


        setSessions(
          (current) => [
            createdSession,
            ...current,
          ],
        )


        setMilestonesBySession(
          (current) => ({
            ...current,

            [
              createdSession.id
            ]: [
              createdMilestone,
            ],
          }),
        )


        setSelectedSessionId(
          createdSession.id,
        )


        setShowSessionModal(
          false,
        )


        window.history
          .replaceState(
            {},
            '',
            `/dashboard/projects/pullplanning?projectId=${projectId}&sessionId=${createdSession.id}`,
          )

      } catch (
        error
      ) {

        console.error(
          'Pull Planning - create session:',
          error,
        )

        setErrorMessage(
          error?.message ||
          'Session could not be created.',
        )

      } finally {

        setSaving(
          false,
        )

      }

    }


  // ==========================================================
  // CREATE ACTIVITY + ITEM + OPTIONAL HANDOFF
  // ==========================================================

  const createActivity =
    async (
      event,
    ) => {

      event.preventDefault()


      if (
        !selectedSession ||
        !selectedProject ||
        boardLocked
      ) {
        return
      }


      const selectedPackage =
        workPackageMap.get(
          activityWorkPackageId,
        ) ||
        null


      if (
        !selectedPackage ||
        !activityLocationId ||
        !activityDescription.trim()
      ) {

        setErrorMessage(
          'Work Package, Location and Activity Description are required.',
        )

        return

      }


      const successorItem =
        activityMode ===
        'predecessor'
          ? (
              pullItems.find(
                (item) =>
                  item.id ===
                  successorItemId,
              ) ||
              null
            )
          : null


      const successorActivity =
        successorItem
          ? (
              productionActivityMap.get(
                successorItem.production_activity_id,
              ) ||
              null
            )
          : null


      if (
        activityMode ===
          'predecessor' &&
        (
          !successorItem ||
          !successorActivity
        )
      ) {

        setErrorMessage(
          'The successor activity could not be found.',
        )

        return

      }


      setSaving(
        true,
      )

      setErrorMessage(
        '',
      )


      try {

        const {
          data:
            userResult,
          error:
            userError,
        } =
          await supabase
            .auth
            .getUser()


        if (
          userError
        ) {
          throw userError
        }


        const currentUserId =
          userResult
            ?.user
            ?.id ||
          null


        // ------------------------------------------------------
        // 1. DURABLE PRODUCTION ACTIVITY
        // ------------------------------------------------------

        const {
          data:
            createdActivity,
          error:
            activityError,
        } =
          await supabase
            .from(
              'production_activities',
            )
            .insert({

              organization_id:
                selectedProject.organization_id,

              project_id:
                selectedProject.id,

              master_plan_package_id:
                null,

              organization_work_package_id:
                selectedPackage.id,

              location_id:
                activityLocationId,

              activity_code:
                String(
                  selectedPackage.code ||
                  '',
                )
                  .trim()
                  .toUpperCase()
                  .slice(
                    0,
                    3,
                  ),

              description:
                activityDescription.trim(),

              operation_description:
                activityOperation.trim() ||
                null,

              quantity:
                activityQuantity ===
                ''
                  ? null
                  : Number(
                      activityQuantity,
                    ),

              unit:
                activityUnit.trim() ||
                null,

              planned_duration_working_days:
                Math.max(
                  1,
                  Number(
                    activityDuration ||
                    1,
                  ),
                ),

              crew_code:
                activityCrew.trim() ||
                null,

              planned_workers:
                activityWorkers ===
                ''
                  ? null
                  : Number(
                      activityWorkers,
                    ),

              expected_production_rate:
                activityRate ===
                ''
                  ? null
                  : Number(
                      activityRate,
                    ),

              expected_productivity:
                activityProductivity ===
                ''
                  ? null
                  : Number(
                      activityProductivity,
                    ),

              lifecycle_status:
                'active',

              created_by:
                currentUserId,

            })
            .select()
            .single()


        if (
          activityError
        ) {
          throw activityError
        }


        // ------------------------------------------------------
        // 2. INITIAL BOARD POSITION
        // ------------------------------------------------------

        let boardX =
          870

        let boardY =
          270


        if (
          activityMode ===
            'predecessor' &&
          successorItem
        ) {

          boardX =
            Math.max(
              40,
              Number(
                successorItem.board_x ||
                870,
              ) -
              230,
            )


          boardY =
            Math.max(
              70,
              Number(
                successorItem.board_y ||
                270,
              ),
            )

        } else {

          const rootCount =
            pullItems.filter(
              (item) =>
                !handoffs.some(
                  (handoff) =>
                    handoff.predecessor_activity_id ===
                    item.production_activity_id,
                ),
            ).length


          boardX =
            870 -
            (
              rootCount %
              3
            ) *
            20


          boardY =
            180 +
            (
              rootCount %
              4
            ) *
            140

        }


        // ------------------------------------------------------
        // 3. SESSION-SPECIFIC PULL ITEM
        // ------------------------------------------------------

        const {
          data:
            createdItem,
          error:
            itemError,
        } =
          await supabase
            .from(
              'pull_planning_items',
            )
            .insert({

              organization_id:
                selectedProject.organization_id,

              project_id:
                selectedProject.id,

              pull_planning_session_id:
                selectedSession.id,

              production_activity_id:
                createdActivity.id,

              pull_planning_milestone_id:
                primaryMilestone?.id ||
                null,

              description_snapshot:
                activityDescription.trim(),

              duration_working_days:
                Math.max(
                  1,
                  Number(
                    activityDuration ||
                    1,
                  ),
                ),

              quantity_snapshot:
                activityQuantity ===
                ''
                  ? null
                  : Number(
                      activityQuantity,
                    ),

              unit_snapshot:
                activityUnit.trim() ||
                null,

              crew_code_snapshot:
                activityCrew.trim() ||
                null,

              planned_workers_snapshot:
                activityWorkers ===
                ''
                  ? null
                  : Number(
                      activityWorkers,
                    ),

              expected_production_rate_snapshot:
                activityRate ===
                ''
                  ? null
                  : Number(
                      activityRate,
                    ),

              expected_productivity_snapshot:
                activityProductivity ===
                ''
                  ? null
                  : Number(
                      activityProductivity,
                    ),

              board_x:
                boardX,

              board_y:
                boardY,

              board_lane:
                null,

              board_order:
                pullItems.length +
                1,

              sequence_number:
                pullItems.length +
                1,

              item_status:
                'active',

            })
            .select()
            .single()


        if (
          itemError
        ) {

          await supabase
            .from(
              'production_activities',
            )
            .delete()
            .eq(
              'id',
              createdActivity.id,
            )


          throw itemError

        }


        // ------------------------------------------------------
        // 4. OPTIONAL BACKWARD HANDOFF
        // ------------------------------------------------------

        let createdHandoff =
          null


        if (
          activityMode ===
            'predecessor' &&
          successorActivity
        ) {

          const {
            data:
              handoffData,
            error:
              handoffError,
          } =
            await supabase
              .from(
                'production_activity_handoffs',
              )
              .insert({

                organization_id:
                  selectedProject.organization_id,

                project_id:
                  selectedProject.id,

                pull_planning_session_id:
                  selectedSession.id,

                predecessor_activity_id:
                  createdActivity.id,

                successor_activity_id:
                  successorActivity.id,

                release_condition:
                  handoffCondition.trim() ||
                  null,

                handoff_type:
                  'finish_to_start',

                responsible_party:
                  handoffResponsible.trim() ||
                  null,

                validation_status:
                  'proposed',

                created_by:
                  currentUserId,

              })
              .select()
              .single()


          if (
            handoffError
          ) {

            await supabase
              .from(
                'pull_planning_items',
              )
              .delete()
              .eq(
                'id',
                createdItem.id,
              )


            await supabase
              .from(
                'production_activities',
              )
              .delete()
              .eq(
                'id',
                createdActivity.id,
              )


            throw handoffError

          }


          createdHandoff =
            handoffData

        }


        // ------------------------------------------------------
        // 5. LOCAL STATE
        // ------------------------------------------------------

        setProductionActivities(
          (current) => [
            ...current,
            createdActivity,
          ],
        )


        setPullItems(
          (current) => [
            ...current,
            createdItem,
          ],
        )


        if (
          createdHandoff
        ) {

          setHandoffs(
            (current) => [
              ...current,
              createdHandoff,
            ],
          )

        }


        setSelectedItemId(
          createdItem.id,
        )


        setShowActivityModal(
          false,
        )


        resetActivityForm()

      } catch (
        error
      ) {

        console.error(
          'Pull Planning - create activity:',
          error,
        )

        setErrorMessage(
          error?.message ||
          'Activity could not be created.',
        )

      } finally {

        setSaving(
          false,
        )

      }

    }


  // ==========================================================
  // DRAGGING
  // ==========================================================

  const startDrag =
    (
      event,
      item,
    ) => {

      if (
        boardLocked
      ) {
        return
      }


      if (
        event.target.closest(
          '[data-no-drag="true"]',
        )
      ) {
        return
      }


      const board =
        boardRef.current


      if (
        !board
      ) {
        return
      }


      event.preventDefault()


      setSelectedItemId(
        item.id,
      )


      const rect =
        board.getBoundingClientRect()


      setDragState({

        itemId:
          item.id,

        offsetX:
          event.clientX -
          rect.left -
          Number(
            item.board_x ||
            0,
          ),

        offsetY:
          event.clientY -
          rect.top -
          Number(
            item.board_y ||
            0,
          ),

      })

    }


  useEffect(
    () => {

      if (
        !dragState
      ) {
        return
      }


      const handleMouseMove =
        (
          event,
        ) => {

          const board =
            boardRef.current


          if (
            !board
          ) {
            return
          }


          const rect =
            board.getBoundingClientRect()


          let x =
            event.clientX -
            rect.left -
            dragState.offsetX


          let y =
            event.clientY -
            rect.top -
            dragState.offsetY


          x =
            Math.max(
              10,
              Math.min(
                x,
                BOARD_WIDTH -
                NOTE_WIDTH -
                10,
              ),
            )


          y =
            Math.max(
              55,
              Math.min(
                y,
                BOARD_HEIGHT -
                NOTE_HEIGHT -
                10,
              ),
            )


          setPullItems(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  dragState.itemId
                    ? {
                        ...item,

                        board_x:
                          Math.round(
                            x,
                          ),

                        board_y:
                          Math.round(
                            y,
                          ),
                      }
                    : item,
              ),
          )

        }


      const handleMouseUp =
        async () => {

          const item =
            pullItemsRef
              .current
              .find(
                (candidate) =>
                  candidate.id ===
                  dragState.itemId,
              )


          setDragState(
            null,
          )


          if (
            !item
          ) {
            return
          }


          const {
            error,
          } =
            await supabase
              .from(
                'pull_planning_items',
              )
              .update({

                board_x:
                  Number(
                    item.board_x ||
                    0,
                  ),

                board_y:
                  Number(
                    item.board_y ||
                    0,
                  ),

              })
              .eq(
                'id',
                item.id,
              )
              .eq(
                'pull_planning_session_id',
                selectedSessionId,
              )


          if (
            error
          ) {

            console.error(
              'Pull Planning - save board position:',
              error,
            )

            setErrorMessage(
              error.message,
            )

          }

        }


      window.addEventListener(
        'mousemove',
        handleMouseMove,
      )


      window.addEventListener(
        'mouseup',
        handleMouseUp,
      )


      return () => {

        window.removeEventListener(
          'mousemove',
          handleMouseMove,
        )

        window.removeEventListener(
          'mouseup',
          handleMouseUp,
        )

      }

    },
    [
      dragState,
      selectedSessionId,
    ],
  )


  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const openSession =
    (
      sessionId,
    ) => {

      setSelectedSessionId(
        sessionId,
      )


      window.history
        .replaceState(
          {},
          '',
          `/dashboard/projects/pullplanning?projectId=${projectId}&sessionId=${sessionId}`,
        )

    }


  const closeSession =
    () => {

      setSelectedSessionId(
        null,
      )

      setSelectedItemId(
        null,
      )


      window.history
        .replaceState(
          {},
          '',
          `/dashboard/projects/pullplanning?projectId=${projectId}`,
        )

    }


  const changeProject =
    (
      newProjectId,
    ) => {

      setProjectId(
        newProjectId,
      )

      setSelectedSessionId(
        null,
      )

      setSelectedItemId(
        null,
      )


      if (
        newProjectId
      ) {

        window.history
          .replaceState(
            {},
            '',
            `/dashboard/projects/pullplanning?projectId=${newProjectId}`,
          )

      } else {

        window.history
          .replaceState(
            {},
            '',
            '/dashboard/projects/pullplanning',
          )

      }

    }


  // ==========================================================
  // SESSION STATUS
  // ==========================================================

  const updateSessionStatus =
    async (
      newStatus,
    ) => {

      if (
        !selectedSession ||
        !newStatus ||
        saving
      ) {
        return
      }


      const confirmed =
        window.confirm(
          `Change this session from "${STATUS_LABELS[selectedSession.status]}" to "${STATUS_LABELS[newStatus]}"?`,
        )


      if (
        !confirmed
      ) {
        return
      }


      setSaving(
        true,
      )

      setErrorMessage(
        '',
      )


      try {

        const payload =
          {
            status:
              newStatus,
          }


        if (
          newStatus ===
          'published'
        ) {

          payload.published_at =
            new Date()
              .toISOString()

        }


        if (
          newStatus ===
          'archived'
        ) {

          payload.archived_at =
            new Date()
              .toISOString()

        }


        const {
          data,
          error,
        } =
          await supabase
            .from(
              'pull_planning_sessions',
            )
            .update(
              payload,
            )
            .eq(
              'id',
              selectedSession.id,
            )
            .eq(
              'project_id',
              projectId,
            )
            .select()
            .single()


        if (
          error
        ) {
          throw error
        }


        setSessions(
          (current) =>
            current.map(
              (session) =>
                session.id ===
                data.id
                  ? data
                  : session,
            ),
        )

      } catch (
        error
      ) {

        console.error(
          'Pull Planning - status:',
          error,
        )

        setErrorMessage(
          error?.message ||
          'Session status could not be updated.',
        )

      } finally {

        setSaving(
          false,
        )

      }

    }


  // ==========================================================
  // PROJECT PORTFOLIO
  // ==========================================================

  if (
    !projectId
  ) {

    return (

      <main
        style={{
          minHeight:
            'calc(100vh - 80px)',

          padding:
            '24px 22px 50px',

          background:
            'radial-gradient(circle at top right, rgba(8,170,150,0.06), transparent 28%), #f8fafc',

          fontFamily:
            'sans-serif',
        }}
      >

        <section
          style={{
            marginBottom:
              '30px',
          }}
        >

          <p
            style={{
              margin:
                '0 0 10px',

              color:
                '#009f8e',

              fontSize:
                '0.78rem',

              fontWeight:
                900,

              letterSpacing:
                '0.13em',
            }}
          >
            LAST PLANNER SYSTEM
          </p>


          <h1
            style={{
              margin:
                0,

              color:
                '#061b2f',

              fontSize:
                '3.35rem',

              lineHeight:
                1,

              fontWeight:
                900,

              letterSpacing:
                '-0.04em',
            }}
          >
            Pull Planning
          </h1>


          <p
            style={{
              margin:
                '18px 0 0',

              color:
                '#536a86',

              fontSize:
                '0.95rem',
            }}
          >
            Select a project to access collaborative phase planning.
          </p>

        </section>


        {errorMessage && (

          <ErrorBox>
            {errorMessage}
          </ErrorBox>

        )}


        {loadingProjects ? (

          <p
            style={{
              color:
                '#64748b',
            }}
          >
            Loading projects...
          </p>

        ) : projects.length ===
            0 ? (

          <div
            style={{
              padding:
                '30px',

              border:
                '2px dashed #cbd5e1',

              borderRadius:
                '12px',

              background:
                '#fff',

              color:
                '#64748b',
            }}
          >
            No projects are available.
          </div>

        ) : (

          <section
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(auto-fill, minmax(330px,365px))',

              gap:
                '22px',
            }}
          >

            {projects.map(
              (
                project,
              ) => {

                const coverUrl =
                  projectCoverUrls[
                    project.id
                  ]


                return (

                  <article
                    key={
                      project.id
                    }
                    style={{
                      overflow:
                        'hidden',

                      border:
                        '1px solid #d9e2ec',

                      borderRadius:
                        '15px',

                      background:
                        '#fff',

                      boxShadow:
                        '0 14px 30px rgba(15,23,42,.05)',
                    }}
                  >

                    <div
                      style={{
                        position:
                          'relative',

                        height:
                          '210px',

                        background:
                          '#173b5f',

                        overflow:
                          'hidden',
                      }}
                    >

                      {coverUrl ? (

                        <img
                          src={
                            coverUrl
                          }
                          alt={
                            project.name
                          }
                          style={{
                            width:
                              '100%',

                            height:
                              '100%',

                            objectFit:
                              'cover',
                          }}
                        />

                      ) : (

                        <div
                          style={{
                            width:
                              '100%',

                            height:
                              '100%',

                            display:
                              'flex',

                            alignItems:
                              'center',

                            justifyContent:
                              'center',

                            color:
                              'rgba(255,255,255,.6)',

                            fontSize:
                              '.72rem',

                            fontWeight:
                              900,
                          }}
                        >
                          PROJECT COVER
                        </div>

                      )}


                      <div
                        style={{
                          position:
                            'absolute',

                          inset:
                            0,

                          background:
                            'linear-gradient(to top,rgba(4,24,43,.92),rgba(4,24,43,.03))',
                        }}
                      />


                      <div
                        style={{
                          position:
                            'absolute',

                          left:
                            '18px',

                          right:
                            '18px',

                          bottom:
                            '18px',

                          color:
                            '#fff',
                        }}
                      >

                        <span
                          style={{
                            display:
                              'block',

                            marginBottom:
                              '6px',

                            fontSize:
                              '.65rem',

                            fontWeight:
                              900,

                            letterSpacing:
                              '.1em',
                          }}
                        >
                          {project.code ||
                            'UNASSIGNED'}
                        </span>


                        <strong
                          style={{
                            fontSize:
                              '1rem',
                          }}
                        >
                          {project.name}
                        </strong>

                      </div>

                    </div>


                    <button
                      type="button"
                      onClick={() =>
                        changeProject(
                          project.id,
                        )
                      }
                      style={{
                        width:
                          '100%',

                        padding:
                          '15px 18px',

                        border:
                          'none',

                        background:
                          '#fff',

                        cursor:
                          'pointer',

                        textAlign:
                          'left',

                        fontWeight:
                          900,

                        color:
                          '#071c31',
                      }}
                    >
                      Open Pull Planning →
                    </button>

                  </article>

                )

              },
            )}

          </section>

        )}

      </main>

    )

  }


  // ==========================================================
  // PROJECT WORKSPACE
  // ==========================================================

  return (

    <main
      style={{
        minHeight:
          'calc(100vh - 80px)',

        padding:
          '22px',

        background:
          '#f6f8fa',

        fontFamily:
          'sans-serif',
      }}
    >

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div
        style={{
          display:
            'flex',

          justifyContent:
            'space-between',

          alignItems:
            'flex-end',

          gap:
            '14px',

          flexWrap:
            'wrap',

          marginBottom:
            '20px',
        }}
      >

        <div>

          <p
            style={{
              margin:
                '0 0 6px',

              color:
                '#008f80',

              fontSize:
                '0.68rem',

              fontWeight:
                900,

              letterSpacing:
                '0.12em',
            }}
          >
            LAST PLANNER SYSTEM
          </p>


          <h1
            style={{
              margin:
                0,

              color:
                '#071c31',

              fontSize:
                '2rem',

              fontWeight:
                900,
            }}
          >
            Pull Planning
          </h1>


          <p
            style={{
              margin:
                '7px 0 0',

              color:
                '#64748b',

              fontSize:
                '0.8rem',
            }}
          >
            {selectedProject?.code
              ? `${selectedProject.code} · `
              : ''}

            {selectedProject?.name}
          </p>

        </div>


        <div
          style={{
            display:
              'flex',

            gap:
              '9px',

            flexWrap:
              'wrap',
          }}
        >

          <select
            value={
              projectId
            }
            onChange={(
              event,
            ) =>
              changeProject(
                event.target.value,
              )
            }
            style={{
              minWidth:
                '250px',

              padding:
                '10px',

              border:
                '1px solid #cbd5e1',

              borderRadius:
                '8px',

              background:
                '#fff',
            }}
          >

            {projects.map(
              (
                project,
              ) => (

                <option
                  key={
                    project.id
                  }
                  value={
                    project.id
                  }
                >
                  {project.code
                    ? `${project.code} - `
                    : ''}

                  {project.name}
                </option>

              ),
            )}

          </select>


          {!selectedSession && (

            <button
              type="button"
              onClick={
                openSessionModal
              }
              style={
                primaryButton
              }
            >
              + New Pull Session
            </button>

          )}


          {selectedSession &&
            !boardLocked && (

              <button
                type="button"
                onClick={
                  openMilestoneActivityModal
                }
                style={
                  primaryButton
                }
              >
                + Add Activity Before Milestone
              </button>

            )}

        </div>

      </div>


      {errorMessage && (

        <ErrorBox>
          {errorMessage}
        </ErrorBox>

      )}


      {/* ====================================================
          SELECTED SESSION
      ==================================================== */}

      {selectedSession ? (

        <>

          <button
            type="button"
            onClick={
              closeSession
            }
            style={{
              marginBottom:
                '13px',

              border:
                'none',

              background:
                'transparent',

              color:
                '#008f80',

              cursor:
                'pointer',

              fontWeight:
                900,
            }}
          >
            ← Back to Sessions
          </button>


          {/* ==================================================
              SESSION BAR
          ================================================== */}

          <section
            style={{
              marginBottom:
                '14px',

              padding:
                '15px 17px',

              border:
                '1px solid #dce5ec',

              borderRadius:
                '10px',

              background:
                '#fff',

              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              gap:
                '15px',

              flexWrap:
                'wrap',
            }}
          >

            <div>

              <p
                style={{
                  margin:
                    '0 0 4px',

                  color:
                    '#008f80',

                  fontSize:
                    '0.62rem',

                  fontWeight:
                    900,

                  textTransform:
                    'uppercase',
                }}
              >
                {selectedSession.phase_name}
              </p>


              <h2
                style={{
                  margin:
                    0,

                  color:
                    '#071c31',

                  fontSize:
                    '1.15rem',
                }}
              >
                {selectedSession.name}
              </h2>

            </div>


            <div
              style={{
                display:
                  'flex',

                gap:
                  '8px',

                alignItems:
                  'center',

                flexWrap:
                  'wrap',
              }}
            >

              <SessionBadge
                status={
                  selectedSession.status
                }
              />


              <button
                type="button"
                disabled={
                  !getPreviousStatus(
                    selectedSession.status,
                  )
                }
                onClick={() =>
                  updateSessionStatus(
                    getPreviousStatus(
                      selectedSession.status,
                    ),
                  )
                }
                style={{
                  ...secondaryButton,

                  opacity:
                    getPreviousStatus(
                      selectedSession.status,
                    )
                      ? 1
                      : 0.45,
                }}
              >
                ← Previous
              </button>


              <button
                type="button"
                disabled={
                  !getNextStatus(
                    selectedSession.status,
                  )
                }
                onClick={() =>
                  updateSessionStatus(
                    getNextStatus(
                      selectedSession.status,
                    ),
                  )
                }
                style={{
                  ...secondaryButton,

                  opacity:
                    getNextStatus(
                      selectedSession.status,
                    )
                      ? 1
                      : 0.45,
                }}
              >
                Next →
              </button>

            </div>

          </section>


          {/* ==================================================
              STRUCTURED PULL PLANNING TIMELINE
          ================================================== */}

          <section
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              background: '#fff',
              overflow: 'hidden',
            }}
          >

            <div
              style={{
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '10px',
                }}
              >
                <strong
                  style={{
                    color: '#0f172a',
                    fontSize: '0.82rem',
                  }}
                >
                  Collaborative Pull Board
                </strong>

                <span
                  style={{
                    color: '#64748b',
                    fontSize: '0.68rem',
                  }}
                >
                  Plan backward from the target →
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <span
                  style={{
                    color: '#64748b',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                  }}
                >
                  Dependency view
                </span>

                {['off', 'selected', 'all'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDependencyView(mode)}
                    style={{
                      padding: '6px 10px',
                      border: dependencyView === mode
                        ? '1px solid #0f766e'
                        : '1px solid #cbd5e1',
                      borderRadius: '7px',
                      background: dependencyView === mode
                        ? '#ecfdf5'
                        : '#fff',
                      color: dependencyView === mode
                        ? '#0f766e'
                        : '#475569',
                      fontSize: '0.64rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {mode}
                  </button>
                ))}

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#475569',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginLeft: '4px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showWeekends}
                    onChange={(event) => setShowWeekends(event.target.checked)}
                  />
                  Show weekends
                </label>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTimelineZoom((value) => Math.max(0.7, Number((value - 0.1).toFixed(1))))}
                    style={{
                      width: '28px',
                      height: '28px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      background: '#fff',
                      cursor: 'pointer',
                      fontWeight: 900,
                    }}
                  >
                    −
                  </button>

                  <span
                    style={{
                      minWidth: '42px',
                      textAlign: 'center',
                      color: '#475569',
                      fontSize: '0.64rem',
                      fontWeight: 900,
                    }}
                  >
                    {Math.round(timelineZoom * 100)}%
                  </span>

                  <button
                    type="button"
                    onClick={() => setTimelineZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(1))))}
                    style={{
                      width: '28px',
                      height: '28px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      background: '#fff',
                      cursor: 'pointer',
                      fontWeight: 900,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {timelineDates.length === 0 ? (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                Define a session planning horizon and milestone target date to build the timeline.
              </div>
            ) : (
              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  background: '#f8fafc',
                }}
              >
                {(() => {
                  const laneLabelWidth = 178
                  const dayWidth = 72 * timelineZoom
                  const weekHeaderHeight = 38
                  const dayHeaderHeight = 46
                  const headerHeight = weekHeaderHeight + dayHeaderHeight
                  const laneHeight = 152
                  const activityHeight = 106
                  const milestoneWidth = 170
                  const milestoneGap = 34
                  const dateGridWidth = timelineDates.length * dayWidth
                  const canvasWidth = laneLabelWidth + dateGridWidth + milestoneGap + milestoneWidth + 28
                  const canvasHeight = headerHeight + Math.max(1, timelineLanes.length) * laneHeight
                  const milestoneX = laneLabelWidth + dateGridWidth + milestoneGap
                  const milestoneY = headerHeight + Math.max(0, (Math.max(1, timelineLanes.length) * laneHeight - 126) / 2)

                  const laneIndexByLocation = new Map(
                    timelineLanes.map((lane, index) => [lane.id, index]),
                  )

                  const itemGeometry = new Map()

                  pullItems.forEach((item) => {
                    const activity = productionActivityMap.get(item.production_activity_id)
                    const schedule = backwardSchedule.get(item.production_activity_id)

                    if (!activity || !schedule) {
                      return
                    }

                    let laneIndex = laneIndexByLocation.get(activity.location_id)

                    if (laneIndex === undefined) {
                      laneIndex = 0
                    }

                    const startIndex = timelineDateIndex.get(schedule.startKey)
                    const finishIndex = timelineDateIndex.get(schedule.finishKey)

                    if (startIndex === undefined || finishIndex === undefined) {
                      return
                    }

                    const x = laneLabelWidth + startIndex * dayWidth + 5
                    const width = Math.max(112, (finishIndex - startIndex + 1) * dayWidth - 10)
                    const y = headerHeight + laneIndex * laneHeight + 22

                    itemGeometry.set(item.production_activity_id, {
                      x,
                      y,
                      width,
                      height: activityHeight,
                      laneIndex,
                    })
                  })

                  const weeks = []

                  timelineDates.forEach((entry, index) => {
                    const date = entry.date
                    const monday = new Date(date)
                    const day = monday.getDay()
                    const offset = day === 0 ? -6 : 1 - day
                    monday.setDate(monday.getDate() + offset)
                    const weekKey = toDateOnlyString(monday)
                    const last = weeks[weeks.length - 1]

                    if (last && last.key === weekKey) {
                      last.count += 1
                      last.endDate = date
                    } else {
                      weeks.push({
                        key: weekKey,
                        startIndex: index,
                        count: 1,
                        startDate: date,
                        endDate: date,
                      })
                    }
                  })

                  const rootItems = pullItems.filter((item) =>
                    !handoffs.some((handoff) =>
                      handoff.predecessor_activity_id === item.production_activity_id,
                    ),
                  )

                  return (
                    <div
                      style={{
                        position: 'relative',
                        width: `${canvasWidth}px`,
                        minWidth: '100%',
                        height: `${canvasHeight}px`,
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: `${laneLabelWidth}px`,
                          height: `${headerHeight}px`,
                          display: 'flex',
                          alignItems: 'flex-end',
                          padding: '0 14px 13px',
                          borderRight: '1px solid #cbd5e1',
                          borderBottom: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#475569',
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          letterSpacing: '.04em',
                        }}
                      >
                        LOCATION / AREA
                      </div>

                      {weeks.map((week, weekIndex) => (
                        <div
                          key={week.key}
                          style={{
                            position: 'absolute',
                            left: `${laneLabelWidth + week.startIndex * dayWidth}px`,
                            top: 0,
                            width: `${week.count * dayWidth}px`,
                            height: `${weekHeaderHeight}px`,
                            borderRight: '1px solid #cbd5e1',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: weekIndex % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                            color: '#334155',
                          }}
                        >
                          <strong
                            style={{
                              fontSize: '0.62rem',
                              letterSpacing: '.03em',
                            }}
                          >
                            WEEK {weekIndex + 1}
                          </strong>
                          <span
                            style={{
                              marginTop: '2px',
                              fontSize: '0.56rem',
                              color: '#64748b',
                            }}
                          >
                            {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' – '}
                            {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}

                      {timelineDates.map((entry, index) => {
                        const weekend = isWeekendDate(entry.date)
                        const x = laneLabelWidth + index * dayWidth

                        return (
                          <React.Fragment key={entry.key}>
                            <div
                              style={{
                                position: 'absolute',
                                left: `${x}px`,
                                top: `${weekHeaderHeight}px`,
                                width: `${dayWidth}px`,
                                height: `${dayHeaderHeight}px`,
                                borderRight: '1px solid #e2e8f0',
                                borderBottom: '1px solid #cbd5e1',
                                background: weekend ? '#f1f5f9' : '#fff',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: '0.58rem',
                                  color: '#475569',
                                }}
                              >
                                {entry.date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2).toUpperCase()}
                              </strong>
                              <span
                                style={{
                                  marginTop: '2px',
                                  fontSize: '0.62rem',
                                  color: '#64748b',
                                }}
                              >
                                {entry.date.getDate()}
                              </span>
                            </div>

                            <div
                              style={{
                                position: 'absolute',
                                left: `${x}px`,
                                top: `${headerHeight}px`,
                                width: `${dayWidth}px`,
                                height: `${canvasHeight - headerHeight}px`,
                                borderRight: '1px solid #eef2f7',
                                background: weekend ? '#f8fafc' : 'transparent',
                                pointerEvents: 'none',
                              }}
                            />
                          </React.Fragment>
                        )
                      })}

                      {timelineLanes.map((lane, laneIndex) => (
                        <React.Fragment key={lane.id}>
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: `${headerHeight + laneIndex * laneHeight}px`,
                              width: `${laneLabelWidth}px`,
                              height: `${laneHeight}px`,
                              padding: '18px 14px',
                              borderRight: '1px solid #cbd5e1',
                              borderBottom: '1px solid #e2e8f0',
                              background: laneIndex % 2 === 0 ? '#fbfdff' : '#f8fafc',
                            }}
                          >
                            <strong
                              style={{
                                display: 'block',
                                color: '#0f172a',
                                fontSize: '0.78rem',
                              }}
                            >
                              {lane.name || 'Unassigned'}
                            </strong>
                            <span
                              title={lane.path || lane.name || ''}
                              style={{
                                display: 'block',
                                marginTop: '5px',
                                color: '#64748b',
                                fontSize: '0.6rem',
                                lineHeight: 1.35,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {lane.path || lane.name || 'Location not assigned'}
                            </span>
                          </div>

                          <div
                            style={{
                              position: 'absolute',
                              left: `${laneLabelWidth}px`,
                              top: `${headerHeight + laneIndex * laneHeight}px`,
                              width: `${dateGridWidth}px`,
                              height: `${laneHeight}px`,
                              borderBottom: '1px solid #e2e8f0',
                              background: laneIndex % 2 === 0
                                ? 'rgba(248,250,252,.18)'
                                : 'rgba(241,245,249,.22)',
                              pointerEvents: 'none',
                            }}
                          />
                        </React.Fragment>
                      ))}

                      <div
                        style={{
                          position: 'absolute',
                          left: `${laneLabelWidth + dateGridWidth}px`,
                          top: 0,
                          width: `${milestoneGap + milestoneWidth + 28}px`,
                          height: `${headerHeight}px`,
                          borderLeft: '1px solid #cbd5e1',
                          borderBottom: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'flex-end',
                          padding: '0 0 13px 18px',
                          color: '#0f766e',
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          letterSpacing: '.04em',
                        }}
                      >
                        TARGET
                      </div>

                      <svg
                        width={canvasWidth}
                        height={canvasHeight}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}
                      >
                        <defs>
                          <marker
                            id="pullTimelineArrow"
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                          </marker>
                          <marker
                            id="pullMilestoneArrow"
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f766e" />
                          </marker>
                        </defs>

                        {visibleHandoffs.map((handoff) => {
                          const from = itemGeometry.get(handoff.predecessor_activity_id)
                          const to = itemGeometry.get(handoff.successor_activity_id)

                          if (!from || !to) {
                            return null
                          }

                          const x1 = from.x + from.width
                          const y1 = from.y + from.height / 2
                          const x2 = to.x
                          const y2 = to.y + to.height / 2
                          const bend = Math.max(18, (x2 - x1) / 2)

                          return (
                            <path
                              key={handoff.id}
                              d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2 - 5} ${y2}`}
                              fill="none"
                              stroke="#64748b"
                              strokeWidth="2"
                              markerEnd="url(#pullTimelineArrow)"
                            />
                          )
                        })}

                        {rootItems.map((item) => {
                          const from = itemGeometry.get(item.production_activity_id)

                          if (!from) {
                            return null
                          }

                          const x1 = from.x + from.width
                          const y1 = from.y + from.height / 2
                          const x2 = milestoneX
                          const y2 = milestoneY + 63

                          return (
                            <path
                              key={`milestone-${item.id}`}
                              d={`M ${x1} ${y1} C ${x1 + 36} ${y1}, ${x2 - 38} ${y2}, ${x2 - 5} ${y2}`}
                              fill="none"
                              stroke="#0f766e"
                              strokeWidth="2"
                              strokeDasharray="5 5"
                              markerEnd="url(#pullMilestoneArrow)"
                            />
                          )
                        })}
                      </svg>

                      {pullItems.map((item) => {
                        const activity = productionActivityMap.get(item.production_activity_id)
                        const geometry = itemGeometry.get(item.production_activity_id)
                        const schedule = backwardSchedule.get(item.production_activity_id)

                        if (!activity || !geometry || !schedule) {
                          return null
                        }

                        const workPackage = workPackageMap.get(activity.organization_work_package_id)
                        const location = locationMap.get(activity.location_id)
                        const color = workPackage?.color || '#dbeafe'
                        const textColor = getContrastText(color)
                        const selected = selectedItemId === item.id
                        const predecessorCount = handoffs.filter((handoff) =>
                          handoff.successor_activity_id === item.production_activity_id,
                        ).length

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItemId(item.id)}
                            style={{
                              position: 'absolute',
                              left: `${geometry.x}px`,
                              top: `${geometry.y}px`,
                              width: `${geometry.width}px`,
                              minWidth: '112px',
                              height: `${geometry.height}px`,
                              padding: '9px 10px',
                              border: selected
                                ? '3px solid #0f172a'
                                : '1px solid rgba(15,23,42,.28)',
                              borderRadius: '7px',
                              background: color,
                              color: textColor,
                              boxShadow: selected
                                ? '0 8px 22px rgba(15,23,42,.18)'
                                : '0 3px 10px rgba(15,23,42,.10)',
                              cursor: 'pointer',
                              zIndex: selected ? 6 : 4,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: '0.66rem',
                                  letterSpacing: '.05em',
                                }}
                              >
                                {String(workPackage?.code || activity.activity_code || 'ACT').toUpperCase().slice(0, 3)}
                              </strong>
                              <strong
                                style={{
                                  fontSize: '0.62rem',
                                }}
                              >
                                {Math.max(1, Number(item.duration_working_days || 1))}d
                              </strong>
                            </div>

                            <div
                              style={{
                                marginTop: '5px',
                                fontSize: '0.66rem',
                                fontWeight: 900,
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={item.description_snapshot}
                            >
                              {item.description_snapshot}
                            </div>

                            <div
                              style={{
                                marginTop: '4px',
                                fontSize: '0.56rem',
                                opacity: 0.88,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={location?.path || location?.name || ''}
                            >
                              {location?.name || 'Location not assigned'}
                            </div>

                            <div
                              style={{
                                marginTop: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '6px',
                                fontSize: '0.54rem',
                                opacity: 0.9,
                              }}
                            >
                              <span>
                                {item.quantity_snapshot !== null && item.quantity_snapshot !== undefined
                                  ? `${item.quantity_snapshot}${item.unit_snapshot ? ` ${item.unit_snapshot}` : ''}`
                                  : `${formatDate(schedule.startKey)} → ${formatDate(schedule.finishKey)}`}
                              </span>

                              {predecessorCount > 0 && <span>← {predecessorCount}</span>}
                            </div>

                            {!boardLocked && (
                              <button
                                type="button"
                                onClick={(event) => openPredecessorModal(event, item)}
                                style={{
                                  width: '100%',
                                  marginTop: '6px',
                                  padding: '5px 6px',
                                  border: `1px solid ${textColor === '#ffffff' ? 'rgba(255,255,255,.65)' : 'rgba(15,23,42,.30)'}`,
                                  borderRadius: '5px',
                                  background: textColor === '#ffffff'
                                    ? 'rgba(255,255,255,.14)'
                                    : 'rgba(255,255,255,.38)',
                                  color: textColor,
                                  cursor: 'pointer',
                                  fontSize: '0.54rem',
                                  fontWeight: 900,
                                }}
                              >
                                + What must happen before this?
                              </button>
                            )}
                          </div>
                        )
                      })}

                      {primaryMilestone && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${milestoneX}px`,
                            top: `${milestoneY}px`,
                            width: `${milestoneWidth}px`,
                            minHeight: '126px',
                            padding: '14px',
                            border: '1.5px solid #0f766e',
                            borderRadius: '9px',
                            background: '#ecfdf5',
                            color: '#065f46',
                            boxShadow: '0 5px 14px rgba(15,118,110,.10)',
                            zIndex: 5,
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.56rem',
                              fontWeight: 900,
                              letterSpacing: '.08em',
                            }}
                          >
                            ◆ MILESTONE
                          </div>
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '0.84rem',
                              fontWeight: 900,
                              lineHeight: 1.2,
                            }}
                          >
                            {primaryMilestone.name}
                          </div>
                          <div
                            style={{
                              marginTop: '9px',
                              fontSize: '0.68rem',
                              fontWeight: 900,
                            }}
                          >
                            {formatDate(primaryMilestone.target_date)}
                          </div>
                          <div
                            style={{
                              marginTop: '10px',
                              paddingTop: '8px',
                              borderTop: '1px solid #a7f3d0',
                              fontSize: '0.56rem',
                              color: '#047857',
                              lineHeight: 1.35,
                            }}
                          >
                            Plan backward from this target condition.
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            <div
              style={{
                padding: '9px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  flexWrap: 'wrap',
                  color: '#64748b',
                  fontSize: '0.58rem',
                  fontWeight: 800,
                }}
              >
                <span>→ Handoff / dependency</span>
                <span style={{ color: '#0f766e' }}>┄→ Leads to milestone</span>
                <span>Timeline calculated backward from milestone</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                  color: '#475569',
                  fontSize: '0.6rem',
                  fontWeight: 900,
                }}
              >
                <span>Activities: {pullItems.length}</span>
                <span>Handoffs: {handoffs.length}</span>
                <span>Milestones: {selectedMilestones.length}</span>
              </div>
            </div>
          </section>

          {/* ==================================================
              SELECTED ACTIVITY PANEL
          ================================================== */}

          {selectedItem && (

            <SelectedActivityPanel
              item={
                selectedItem
              }
              activity={
                productionActivityMap.get(
                  selectedItem.production_activity_id,
                )
              }
              workPackage={
                workPackageMap.get(
                  productionActivityMap.get(
                    selectedItem.production_activity_id,
                  )?.organization_work_package_id,
                )
              }
              location={
                locationMap.get(
                  productionActivityMap.get(
                    selectedItem.production_activity_id,
                  )?.location_id,
                )
              }
              predecessors={
                handoffs.filter(
                  (
                    handoff,
                  ) =>
                    handoff.successor_activity_id ===
                    selectedItem.production_activity_id,
                )
              }
              successors={
                handoffs.filter(
                  (
                    handoff,
                  ) =>
                    handoff.predecessor_activity_id ===
                    selectedItem.production_activity_id,
                )
              }
            />

          )}

        </>

      ) : (

        /* ==================================================
           SESSION LIST
        ================================================== */

        <section>

          <h2
            style={{
              margin:
                '0 0 14px',

              color:
                '#172033',

              fontSize:
                '1.05rem',
            }}
          >
            Pull Planning Sessions
          </h2>


          {loadingSessions ? (

            <p>
              Loading sessions...
            </p>

          ) : sessions.length ===
            0 ? (

            <div
              style={{
                padding:
                  '35px',

                border:
                  '2px dashed #cbd5e1',

                borderRadius:
                  '12px',

                background:
                  '#fff',

                textAlign:
                  'center',
              }}
            >

              <strong>
                No Pull Planning sessions yet.
              </strong>


              <br />


              <button
                type="button"
                onClick={
                  openSessionModal
                }
                style={{
                  ...primaryButton,

                  marginTop:
                    '15px',
                }}
              >
                + New Pull Session
              </button>

            </div>

          ) : (

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  'repeat(auto-fill,minmax(300px,1fr))',

                gap:
                  '15px',
              }}
            >

              {sessions.map(
                (
                  session,
                ) => {

                  const milestone =
                    (
                      milestonesBySession[
                        session.id
                      ] || []
                    ).find(
                      (
                        item,
                      ) =>
                        item.is_primary,
                    ) ||
                    null


                  return (

                    <article
                      key={
                        session.id
                      }
                      style={{
                        border:
                          '1px solid #dce5ec',

                        borderRadius:
                          '11px',

                        background:
                          '#fff',

                        overflow:
                          'hidden',
                      }}
                    >

                      <div
                        style={{
                          padding:
                            '17px',
                        }}
                      >

                        <div
                          style={{
                            display:
                              'flex',

                            justifyContent:
                              'space-between',

                            gap:
                              '8px',
                          }}
                        >

                          <div>

                            <span
                              style={{
                                color:
                                  '#008f80',

                                fontSize:
                                  '0.62rem',

                                fontWeight:
                                  900,
                              }}
                            >
                              {session.phase_name}
                            </span>


                            <h3
                              style={{
                                margin:
                                  '5px 0 0',

                                color:
                                  '#071c31',
                              }}
                            >
                              {session.name}
                            </h3>

                          </div>


                          <SessionBadge
                            status={
                              session.status
                            }
                          />

                        </div>


                        <div
                          style={{
                            marginTop:
                              '14px',

                            color:
                              '#64748b',

                            fontSize:
                              '0.73rem',
                          }}
                        >
                          {milestone?.name ||
                            'No milestone'}

                          <br />

                          <strong>
                            {formatDate(
                              milestone?.target_date,
                            )}
                          </strong>
                        </div>

                      </div>


                      <button
                        type="button"
                        onClick={() =>
                          openSession(
                            session.id,
                          )
                        }
                        style={{
                          width:
                            '100%',

                          padding:
                            '12px 17px',

                          border:
                            'none',

                          borderTop:
                            '1px solid #e6edf3',

                          background:
                            '#fff',

                          cursor:
                            'pointer',

                          textAlign:
                            'left',

                          fontWeight:
                            900,
                        }}
                      >
                        Open Session →
                      </button>

                    </article>

                  )

                },
              )}

            </div>

          )}

        </section>

      )}


      {/* ====================================================
          SESSION MODAL
      ==================================================== */}

      {showSessionModal && (

        <ModalShell>

          <form
            onSubmit={
              createSession
            }
          >

            <ModalHeader
              title="New Pull Session"
              subtitle="SESSION FOUNDATION"
              onClose={() =>
                setShowSessionModal(
                  false,
                )
              }
            />


            <div
              style={
                modalGrid
              }
            >

              <Field
                label="Session Name *"
                full
              >

                <input
                  required
                  value={
                    sessionName
                  }
                  onChange={(
                    event,
                  ) =>
                    setSessionName(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Phase *"
              >

                <input
                  required
                  value={
                    phaseName
                  }
                  onChange={(
                    event,
                  ) =>
                    setPhaseName(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Session Date"
              >

                <input
                  type="date"
                  value={
                    sessionDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setSessionDate(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Planning Horizon Start"
              >

                <input
                  type="date"
                  value={
                    horizonStart
                  }
                  onChange={(
                    event,
                  ) =>
                    setHorizonStart(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Planning Horizon End"
              >

                <input
                  type="date"
                  value={
                    horizonEnd
                  }
                  onChange={(
                    event,
                  ) =>
                    setHorizonEnd(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Description"
                full
              >

                <textarea
                  rows={3}
                  value={
                    sessionDescription
                  }
                  onChange={(
                    event,
                  ) =>
                    setSessionDescription(
                      event.target.value,
                    )
                  }
                  style={{
                    ...inputStyle,

                    resize:
                      'vertical',
                  }}
                />

              </Field>


              <Field
                label="Primary Milestone *"
              >

                <input
                  required
                  value={
                    milestoneName
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneName(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Target Date *"
              >

                <input
                  required
                  type="date"
                  value={
                    milestoneTargetDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneTargetDate(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>

            </div>


            <ModalFooter
              saving={
                saving
              }
              onCancel={() =>
                setShowSessionModal(
                  false,
                )
              }
              actionLabel="Create Session"
            />

          </form>

        </ModalShell>

      )}


      {/* ====================================================
          ACTIVITY / PREDECESSOR MODAL
      ==================================================== */}

      {showActivityModal && (

        <ModalShell>

          <form
            onSubmit={
              createActivity
            }
          >

            <ModalHeader
              title={
                activityMode ===
                'predecessor'
                  ? 'Add Predecessor Activity'
                  : 'Add Activity Before Milestone'
              }
              subtitle={
                activityMode ===
                'predecessor'
                  ? 'BACKWARD PLANNING'
                  : 'MILESTONE PULL'
              }
              onClose={() =>
                setShowActivityModal(
                  false,
                )
              }
            />


            {activityMode ===
              'predecessor' && (

              <div
                style={{
                  margin:
                    '18px 22px 0',

                  padding:
                    '13px 15px',

                  border:
                    '1px solid #99f6e4',

                  borderRadius:
                    '8px',

                  background:
                    '#f0fdfa',
                }}
              >

                <span
                  style={{
                    display:
                      'block',

                    color:
                      '#0f766e',

                    fontSize:
                      '.62rem',

                    fontWeight:
                      900,

                    letterSpacing:
                      '.08em',
                  }}
                >
                  SUCCESSOR
                </span>


                <strong
                  style={{
                    display:
                      'block',

                    marginTop:
                      '4px',

                    color:
                      '#134e4a',

                    fontSize:
                      '.82rem',
                  }}
                >
                  {
                    pullItems.find(
                      (
                        item,
                      ) =>
                        item.id ===
                        successorItemId,
                    )
                      ?.description_snapshot
                  }
                </strong>


                <p
                  style={{
                    margin:
                      '6px 0 0',

                    color:
                      '#64748b',

                    fontSize:
                      '.7rem',
                  }}
                >
                  What must be released before this activity can start?
                </p>

              </div>

            )}


            <div
              style={
                modalGrid
              }
            >

              <Field
                label="Work Package *"
              >

                <select
                  required
                  value={
                    activityWorkPackageId
                  }
                  onChange={(
                    event,
                  ) => {

                    const id =
                      event.target.value


                    setActivityWorkPackageId(
                      id,
                    )


                    const workPackage =
                      workPackageMap.get(
                        id,
                      )


                    if (
                      workPackage &&
                      !activityDescription
                    ) {

                      setActivityDescription(
                        workPackage.description ||
                        '',
                      )

                    }

                  }}
                  style={
                    inputStyle
                  }
                >

                  <option value="">
                    Select Work Package
                  </option>


                  {workPackages.map(
                    (
                      item,
                    ) => (

                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.code} - {item.description}
                      </option>

                    ),
                  )}

                </select>

              </Field>


              <Field
                label="Location *"
              >

                <select
                  required
                  value={
                    activityLocationId
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityLocationId(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                >

                  <option value="">
                    Select Location
                  </option>


                  {locationOptions.map(
                    (
                      location,
                    ) => (

                      <option
                        key={
                          location.id
                        }
                        value={
                          location.id
                        }
                      >
                        {location.path}
                      </option>

                    ),
                  )}

                </select>

              </Field>


              <Field
                label="Activity Description *"
                full
              >

                <input
                  required
                  value={
                    activityDescription
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityDescription(
                      event.target.value,
                    )
                  }
                  placeholder="Example: Install metal framing - Zone A"
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Operation / Method"
                full
              >

                <textarea
                  rows={2}
                  value={
                    activityOperation
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityOperation(
                      event.target.value,
                    )
                  }
                  style={{
                    ...inputStyle,

                    resize:
                      'vertical',
                  }}
                />

              </Field>


              <Field
                label="Duration (workdays) *"
              >

                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={
                    activityDuration
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityDuration(
                      Math.max(
                        1,
                        Number(
                          event.target.value ||
                          1,
                        ),
                      ),
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Quantity"
              >

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    activityQuantity
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityQuantity(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Unit"
              >

                <input
                  value={
                    activityUnit
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityUnit(
                      event.target.value,
                    )
                  }
                  placeholder="SF, LF, EA..."
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Crew"
              >

                <input
                  value={
                    activityCrew
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityCrew(
                      event.target.value,
                    )
                  }
                  placeholder="Crew A"
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Workers"
              >

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    activityWorkers
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityWorkers(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Expected Production Rate"
              >

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    activityRate
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityRate(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              <Field
                label="Expected Productivity"
              >

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    activityProductivity
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityProductivity(
                      event.target.value,
                    )
                  }
                  style={
                    inputStyle
                  }
                />

              </Field>


              {activityMode ===
                'predecessor' && (

                <>

                  <Field
                    label="Handoff / Release Condition"
                    full
                  >

                    <textarea
                      rows={2}
                      value={
                        handoffCondition
                      }
                      onChange={(
                        event,
                      ) =>
                        setHandoffCondition(
                          event.target.value,
                        )
                      }
                      placeholder="Example: Framing complete, inspected and area released to drywall crew."
                      style={{
                        ...inputStyle,

                        resize:
                          'vertical',
                      }}
                    />

                  </Field>


                  <Field
                    label="Responsible Party"
                    full
                  >

                    <input
                      value={
                        handoffResponsible
                      }
                      onChange={(
                        event,
                      ) =>
                        setHandoffResponsible(
                          event.target.value,
                        )
                      }
                      placeholder="Trade, crew, foreman or responsible party"
                      style={
                        inputStyle
                      }
                    />

                  </Field>

                </>

              )}

            </div>


            <ModalFooter
              saving={
                saving
              }
              onCancel={() =>
                setShowActivityModal(
                  false,
                )
              }
              actionLabel={
                activityMode ===
                'predecessor'
                  ? 'Create Predecessor'
                  : 'Add Activity'
              }
            />

          </form>

        </ModalShell>

      )}

    </main>

  )

}


// ============================================================
// SELECTED ACTIVITY PANEL
// ============================================================

function SelectedActivityPanel({
  item,
  activity,
  workPackage,
  location,
  predecessors,
  successors,
}) {

  return (

    <section
      style={{
        marginTop:
          '14px',

        padding:
          '15px 17px',

        border:
          '1px solid #dce5ec',

        borderRadius:
          '10px',

        background:
          '#fff',
      }}
    >

      <div
        style={{
          display:
            'flex',

          justifyContent:
            'space-between',

          gap:
            '18px',

          flexWrap:
            'wrap',
        }}
      >

        <div>

          <span
            style={{
              color:
                '#008f80',

              fontSize:
                '.62rem',

              fontWeight:
                900,

              letterSpacing:
                '.08em',
            }}
          >
            SELECTED ACTIVITY
          </span>


          <h3
            style={{
              margin:
                '5px 0 0',

              color:
                '#071c31',

              fontSize:
                '.95rem',
            }}
          >
            {workPackage?.code
              ? `${workPackage.code} · `
              : ''}

            {item.description_snapshot}
          </h3>


          <p
            style={{
              margin:
                '5px 0 0',

              color:
                '#64748b',

              fontSize:
                '.72rem',
            }}
          >
            {location?.path ||
              location?.name ||
              'No location'}
          </p>

        </div>


        <div
          style={{
            display:
              'flex',

            gap:
              '22px',

            flexWrap:
              'wrap',
          }}
        >

          <Metric
            label="Duration"
            value={`${item.duration_working_days}d`}
          />


          <Metric
            label="Predecessors"
            value={
              predecessors.length
            }
          />


          <Metric
            label="Successors"
            value={
              successors.length
            }
          />


          <Metric
            label="Crew"
            value={
              activity?.crew_code ||
              '—'
            }
          />

        </div>

      </div>


      {predecessors.length >
        0 && (

        <div
          style={{
            marginTop:
              '13px',

            paddingTop:
              '12px',

            borderTop:
              '1px solid #edf2f7',
          }}
        >

          <strong
            style={{
              display:
                'block',

              marginBottom:
                '7px',

              color:
                '#475569',

              fontSize:
                '.66rem',
            }}
          >
            REQUIRED HANDOFFS
          </strong>


          {predecessors.map(
            (
              handoff,
            ) => (

              <div
                key={
                  handoff.id
                }
                style={{
                  marginTop:
                    '5px',

                  color:
                    '#64748b',

                  fontSize:
                    '.7rem',
                }}
              >

                <strong
                  style={{
                    color:
                      '#334155',
                  }}
                >
                  {handoff.validation_status}
                </strong>


                {handoff.release_condition
                  ? ` · ${handoff.release_condition}`
                  : ' · Finish-to-start handoff'}

              </div>

            ),
          )}

        </div>

      )}

    </section>

  )

}


// ============================================================
// SMALL COMPONENTS
// ============================================================

function Metric({
  label,
  value,
}) {

  return (

    <div
      style={{
        textAlign:
          'center',
      }}
    >

      <span
        style={{
          display:
            'block',

          color:
            '#94a3b8',

          fontSize:
            '.58rem',

          fontWeight:
            900,

          textTransform:
            'uppercase',
        }}
      >
        {label}
      </span>


      <strong
        style={{
          display:
            'block',

          marginTop:
            '3px',

          color:
            '#334155',

          fontSize:
            '.82rem',
        }}
      >
        {value}
      </strong>

    </div>

  )

}


function SessionBadge({
  status,
}) {

  const style =
    STATUS_STYLES[
      status
    ] ||
    STATUS_STYLES.draft


  return (

    <span
      style={{
        padding:
          '5px 8px',

        border:
          `1px solid ${style.border}`,

        borderRadius:
          '999px',

        background:
          style.background,

        color:
          style.color,

        fontSize:
          '0.6rem',

        fontWeight:
          900,

        textTransform:
          'uppercase',

        whiteSpace:
          'nowrap',
      }}
    >
      {STATUS_LABELS[
        status
      ] ||
        status}
    </span>

  )

}


function ErrorBox({
  children,
}) {

  return (

    <div
      style={{
        marginBottom:
          '15px',

        padding:
          '11px 14px',

        border:
          '1px solid #fecaca',

        borderRadius:
          '8px',

        background:
          '#fff1f2',

        color:
          '#be123c',

        fontSize:
          '0.78rem',

        fontWeight:
          700,
      }}
    >
      {children}
    </div>

  )

}


function ModalShell({
  children,
}) {

  return (

    <div
      style={{
        position:
          'fixed',

        inset:
          0,

        zIndex:
          5000,

        display:
          'flex',

        alignItems:
          'center',

        justifyContent:
          'center',

        padding:
          '20px',

        background:
          'rgba(3,17,30,.6)',
      }}
    >

      <div
        style={{
          width:
            'min(780px,96vw)',

          maxHeight:
            '92vh',

          overflowY:
            'auto',

          borderRadius:
            '13px',

          background:
            '#fff',

          boxShadow:
            '0 30px 90px rgba(0,0,0,.3)',
        }}
      >
        {children}
      </div>

    </div>

  )

}


function ModalHeader({
  title,
  subtitle,
  onClose,
}) {

  return (

    <div
      style={{
        padding:
          '18px 22px',

        borderBottom:
          '1px solid #e5eaf0',

        display:
          'flex',

        justifyContent:
          'space-between',

        alignItems:
          'center',
      }}
    >

      <div>

        <span
          style={{
            color:
              '#008f80',

            fontSize:
              '0.62rem',

            fontWeight:
              900,

            letterSpacing:
              '.08em',
          }}
        >
          {subtitle ||
            'PULL PLANNING'}
        </span>


        <h2
          style={{
            margin:
              '4px 0 0',

            color:
              '#071c31',

            fontSize:
              '1.25rem',
          }}
        >
          {title}
        </h2>

      </div>


      <button
        type="button"
        onClick={
          onClose
        }
        style={{
          border:
            'none',

          background:
            'transparent',

          fontSize:
            '1.4rem',

          cursor:
            'pointer',

          color:
            '#64748b',
        }}
      >
        ×
      </button>

    </div>

  )

}


function ModalFooter({
  saving,
  onCancel,
  actionLabel,
}) {

  return (

    <div
      style={{
        padding:
          '15px 22px',

        borderTop:
          '1px solid #e5eaf0',

        display:
          'flex',

        justifyContent:
          'flex-end',

        gap:
          '9px',
      }}
    >

      <button
        type="button"
        disabled={
          saving
        }
        onClick={
          onCancel
        }
        style={
          secondaryButton
        }
      >
        Cancel
      </button>


      <button
        type="submit"
        disabled={
          saving
        }
        style={{
          ...primaryButton,

          opacity:
            saving
              ? 0.65
              : 1,
        }}
      >
        {saving
          ? 'Saving...'
          : actionLabel}
      </button>

    </div>

  )

}


function Field({
  label,
  children,
  full = false,
}) {

  return (

    <div
      style={{
        gridColumn:
          full
            ? '1 / -1'
            : 'auto',
      }}
    >

      <label
        style={{
          display:
            'block',

          marginBottom:
            '5px',

          color:
            '#475569',

          fontSize:
            '0.68rem',

          fontWeight:
            900,

          textTransform:
            'uppercase',

          letterSpacing:
            '0.04em',
        }}
      >
        {label}
      </label>


      {children}

    </div>

  )

}


// ============================================================
// SHARED STYLES
// ============================================================

const inputStyle = {
  width:
    '100%',

  padding:
    '9px 10px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '7px',

  boxSizing:
    'border-box',

  outline:
    'none',

  background:
    '#fff',

  color:
    '#172033',

  fontSize:
    '0.8rem',
}


const modalGrid = {
  padding:
    '20px 22px',

  display:
    'grid',

  gridTemplateColumns:
    '1fr 1fr',

  gap:
    '14px',
}


const primaryButton = {
  padding:
    '10px 15px',

  border:
    'none',

  borderRadius:
    '7px',

  background:
    '#008f80',

  color:
    '#fff',

  fontWeight:
    900,

  cursor:
    'pointer',
}


const secondaryButton = {
  padding:
    '9px 12px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '7px',

  background:
    '#fff',

  color:
    '#475569',

  fontWeight:
    800,

  cursor:
    'pointer',
}
