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
// - Draggable sticky notes
// - Persisted board positions
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
// - Dependency visibility: Off | Selected | All
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

  const [
    accessDiagnostic,
    setAccessDiagnostic,
  ] = useState({
    userId: '',
    email: '',
    projectCount: null,
    membershipCount: null,
    memberships: [],
    projectError: '',
    membershipError: '',
  })


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


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================
  //
  // IMPORTANT:
  // - Uses the same direct public.projects query pattern as
  //   the working Master Plan.
  // - Keeps organization_id in the original SELECT because
  //   Pull Planning requires organization context.
  // - If RLS returns zero rows, a small frontend diagnostic
  //   records the authenticated user and visible membership
  //   context. This is diagnostic only; it does not bypass RLS.
  // ==========================================================

  useEffect(() => {
    let mounted = true

    const loadProjects = async () => {
      setLoadingProjects(true)
      setErrorMessage('')

      setAccessDiagnostic({
        userId: '',
        email: '',
        projectCount: null,
        membershipCount: null,
        memberships: [],
        projectError: '',
        membershipError: '',
      })

      try {
        // ----------------------------------------------------
        // 1. AUTHENTICATED BROWSER IDENTITY
        // ----------------------------------------------------

        const {
          data: userResult,
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        const currentUser =
          userResult?.user || null

        if (!currentUser) {
          throw new Error(
            'Your authenticated session could not be found.',
          )
        }

        const diagnostic = {
          userId: currentUser.id || '',
          email: currentUser.email || '',
          projectCount: null,
          membershipCount: null,
          memberships: [],
          projectError: '',
          membershipError: '',
        }


        // ----------------------------------------------------
        // 2. LOAD PROJECTS
        //
        // This intentionally mirrors the proven Master Plan
        // access pattern and relies on existing project RLS.
        // ----------------------------------------------------

        const {
          data: projectData,
          error: projectError,
        } = await supabase
          .from('projects')
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
          .neq('status', 'archived')
          .order('created_at', {
            ascending: false,
          })

        if (projectError) {
          diagnostic.projectError =
            projectError.message || String(projectError)

          if (mounted) {
            setAccessDiagnostic(diagnostic)
          }

          throw projectError
        }

        const loadedProjects =
          projectData || []

        diagnostic.projectCount =
          loadedProjects.length


        // ----------------------------------------------------
        // 3. DIAGNOSTIC MEMBERSHIP CHECK
        //
        // This query does NOT grant access and does NOT replace
        // project RLS. It only helps us compare the browser's
        // auth.uid() with the organization membership visible
        // to that same authenticated session.
        // ----------------------------------------------------

        const {
          data: membershipData,
          error: membershipError,
        } = await supabase
          .from('organization_members')
          .select(`
            organization_id,
            user_id,
            role,
            status,
            project_access_mode
          `)
          .eq('user_id', currentUser.id)

        if (membershipError) {
          diagnostic.membershipError =
            membershipError.message ||
            String(membershipError)
        } else {
          diagnostic.memberships =
            membershipData || []

          diagnostic.membershipCount =
            diagnostic.memberships.length
        }

        if (!mounted) {
          return
        }

        setAccessDiagnostic(diagnostic)
        setProjects(loadedProjects)


        // ----------------------------------------------------
        // 4. RESTORE PROJECT FROM URL
        // ----------------------------------------------------

        const params =
          new URLSearchParams(
            window.location.search,
          )

        const projectFromUrl =
          params.get('projectId')

        if (
          projectFromUrl &&
          loadedProjects.some(
            (project) =>
              project.id === projectFromUrl,
          )
        ) {
          setProjectId(
            projectFromUrl,
          )
        }


        // ----------------------------------------------------
        // 5. PROJECT COVER IMAGES
        // ----------------------------------------------------

        const coverEntries =
          await Promise.all(
            loadedProjects.map(
              async (project) => {
                if (
                  !project.cover_image_path
                ) {
                  return [
                    project.id,
                    '',
                  ]
                }

                const {
                  data: signedData,
                  error: signedError,
                } = await supabase
                  .storage
                  .from(
                    'project-covers',
                  )
                  .createSignedUrl(
                    project.cover_image_path,
                    60 * 60,
                  )

                if (signedError) {
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
                  signedData?.signedUrl || '',
                ]
              },
            ),
          )

        if (!mounted) {
          return
        }

        setProjectCoverUrls(
          Object.fromEntries(
            coverEntries,
          ),
        )

      } catch (error) {
        console.error(
          'Pull Planning - projects:',
          error,
        )

        if (mounted) {
          setProjects([])

          setErrorMessage(
            error?.message ||
              'Projects could not be loaded.',
          )
        }

      } finally {
        if (mounted) {
          setLoadingProjects(false)
        }
      }
    }

    loadProjects()

    return () => {
      mounted = false
    }
  }, [])


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
            <strong
              style={{
                display:
                  'block',

                marginBottom:
                  '10px',

                color:
                  '#334155',
              }}
            >
              No projects are available.
            </strong>

            <div
              style={{
                fontSize:
                  '0.74rem',

                lineHeight:
                  1.7,
              }}
            >
              <div>
                <strong>Authenticated user:</strong>{' '}
                {accessDiagnostic.email ||
                  'Unknown'}
              </div>

              <div>
                <strong>User ID:</strong>{' '}
                <code>
                  {accessDiagnostic.userId ||
                    'Unavailable'}
                </code>
              </div>

              <div>
                <strong>Projects returned by RLS:</strong>{' '}
                {accessDiagnostic.projectCount ===
                null
                  ? 'Not checked'
                  : accessDiagnostic.projectCount}
              </div>

              <div>
                <strong>Visible organization memberships:</strong>{' '}
                {accessDiagnostic.membershipCount ===
                null
                  ? 'Not checked'
                  : accessDiagnostic.membershipCount}
              </div>

              {accessDiagnostic.memberships.map(
                (
                  membership,
                  index,
                ) => (
                  <div
                    key={`${membership.organization_id}-${index}`}
                    style={{
                      marginTop:
                        '7px',

                      padding:
                        '8px 10px',

                      border:
                        '1px solid #e2e8f0',

                      borderRadius:
                        '6px',

                      background:
                        '#f8fafc',
                    }}
                  >
                    Organization:{' '}
                    <code>
                      {membership.organization_id}
                    </code>
                    {' · '}
                    Role:{' '}
                    <strong>
                      {membership.role}
                    </strong>
                    {' · '}
                    Status:{' '}
                    <strong>
                      {membership.status}
                    </strong>
                    {' · '}
                    Access:{' '}
                    <strong>
                      {membership.project_access_mode}
                    </strong>
                  </div>
                ),
              )}

              {accessDiagnostic.membershipError && (
                <div
                  style={{
                    marginTop:
                      '8px',

                    color:
                      '#b45309',
                  }}
                >
                  Membership diagnostic:{' '}
                  {accessDiagnostic.membershipError}
                </div>
              )}

              {accessDiagnostic.projectError && (
                <div
                  style={{
                    marginTop:
                      '8px',

                    color:
                      '#be123c',
                  }}
                >
                  Project query:{' '}
                  {accessDiagnostic.projectError}
                </div>
              )}
            </div>
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
              BOARD
          ================================================== */}

          <section
            style={{
              border:
                '1px solid #cbd5e1',

              borderRadius:
                '12px',

              background:
                '#fff',

              overflow:
                'hidden',
            }}
          >

            {/* BOARD TOOLBAR */}

            <div
              style={{
                padding:
                  '10px 14px',

                display:
                  'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                gap:
                  '10px',

                borderBottom:
                  '1px solid #e2e8f0',

                background:
                  '#f8fafc',
              }}
            >

              <div>

                <strong
                  style={{
                    color:
                      '#334155',

                    fontSize:
                      '0.82rem',
                  }}
                >
                  Collaborative Pull Board
                </strong>


                <span
                  style={{
                    marginLeft:
                      '10px',

                    color:
                      '#94a3b8',

                    fontSize:
                      '0.7rem',
                  }}
                >
                  Time flows left → right
                </span>

              </div>


              <div
                style={{
                  color:
                    boardLocked
                      ? '#b45309'
                      : '#64748b',

                  fontSize:
                    '0.7rem',

                  fontWeight:
                    700,
                }}
              >
                {boardLocked
                  ? 'Read-only session'
                  : 'Choose a note and ask: What must happen before this?'}
              </div>

            </div>


            {/* BOARD CANVAS */}

            <div
              style={{
                overflow:
                  'auto',
              }}
            >

              <div
                ref={
                  boardRef
                }
                onMouseDown={(
                  event,
                ) => {

                  if (
                    event.target ===
                    boardRef.current
                  ) {

                    setSelectedItemId(
                      null,
                    )

                  }

                }}
                style={{
                  position:
                    'relative',

                  width:
                    `${BOARD_WIDTH}px`,

                  height:
                    `${BOARD_HEIGHT}px`,

                  backgroundColor:
                    '#fbfcfd',

                  backgroundImage:
                    `
                      linear-gradient(#edf2f7 1px, transparent 1px),
                      linear-gradient(90deg, #edf2f7 1px, transparent 1px)
                    `,

                  backgroundSize:
                    '40px 40px',

                  userSelect:
                    'none',
                }}
              >

                {/* TIME LABELS */}

                <div
                  style={{
                    position:
                      'absolute',

                    left:
                      '25px',

                    top:
                      '22px',

                    color:
                      '#94a3b8',

                    fontSize:
                      '0.64rem',

                    fontWeight:
                      900,

                    letterSpacing:
                      '.1em',
                  }}
                >
                  EARLIER WORK
                </div>


                <div
                  style={{
                    position:
                      'absolute',

                    right:
                      '42px',

                    top:
                      '22px',

                    color:
                      '#94a3b8',

                    fontSize:
                      '0.64rem',

                    fontWeight:
                      900,

                    letterSpacing:
                      '.1em',
                  }}
                >
                  TARGET
                </div>


                {/* =================================================
                    HANDOFF NETWORK
                ================================================= */}

                <svg
                  width={
                    BOARD_WIDTH
                  }
                  height={
                    BOARD_HEIGHT
                  }
                  style={{
                    position:
                      'absolute',

                    inset:
                      0,

                    zIndex:
                      2,

                    overflow:
                      'visible',

                    pointerEvents:
                      'none',
                  }}
                >

                  <defs>

                    <marker
                      id="pull-arrow"
                      markerWidth="9"
                      markerHeight="9"
                      refX="8"
                      refY="4.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path
                        d="M0,0 L9,4.5 L0,9 z"
                        fill="#48647c"
                      />
                    </marker>

                  </defs>


                  {handoffs.map(
                    (
                      handoff,
                    ) => {

                      const predecessorItem =
                        pullItemByActivityId.get(
                          handoff.predecessor_activity_id,
                        )


                      const successorItem =
                        pullItemByActivityId.get(
                          handoff.successor_activity_id,
                        )


                      if (
                        !predecessorItem ||
                        !successorItem
                      ) {
                        return null
                      }


                      const startX =
                        Number(
                          predecessorItem.board_x ||
                          0,
                        ) +
                        NOTE_WIDTH


                      const startY =
                        Number(
                          predecessorItem.board_y ||
                          0,
                        ) +
                        NOTE_HEIGHT /
                        2


                      const endX =
                        Number(
                          successorItem.board_x ||
                          0,
                        )


                      const endY =
                        Number(
                          successorItem.board_y ||
                          0,
                        ) +
                        NOTE_HEIGHT /
                        2


                      const distance =
                        Math.max(
                          40,
                          Math.abs(
                            endX -
                            startX,
                          ) /
                          2,
                        )


                      const path =
                        `M ${startX} ${startY}
                         C ${startX + distance} ${startY},
                           ${endX - distance} ${endY},
                           ${endX - 7} ${endY}`


                      return (

                        <g
                          key={
                            handoff.id
                          }
                        >

                          <path
                            d={
                              path
                            }
                            fill="none"
                            stroke="#48647c"
                            strokeWidth="2"
                            markerEnd="url(#pull-arrow)"
                          />


                          {handoff.validation_status ===
                            'proposed' && (

                            <circle
                              cx={
                                (
                                  startX +
                                  endX
                                ) /
                                2
                              }
                              cy={
                                (
                                  startY +
                                  endY
                                ) /
                                2
                              }
                              r="4"
                              fill="#f59e0b"
                            />

                          )}

                        </g>

                      )

                    },
                  )}


                  {/* ROOT ACTIVITIES TO MILESTONE */}

                  {pullItems
                    .filter(
                      (
                        item,
                      ) => {

                        const hasSuccessor =
                          handoffs.some(
                            (
                              handoff,
                            ) =>
                              handoff.predecessor_activity_id ===
                              item.production_activity_id,
                          )


                        return (
                          !hasSuccessor &&
                          item.pull_planning_milestone_id ===
                          primaryMilestone?.id
                        )

                      },
                    )
                    .map(
                      (
                        item,
                      ) => {

                        const startX =
                          Number(
                            item.board_x ||
                            0,
                          ) +
                          NOTE_WIDTH


                        const startY =
                          Number(
                            item.board_y ||
                            0,
                          ) +
                          NOTE_HEIGHT /
                          2


                        const endX =
                          MILESTONE_X


                        const endY =
                          MILESTONE_Y +
                          65


                        const distance =
                          Math.max(
                            40,
                            Math.abs(
                              endX -
                              startX,
                            ) /
                            2,
                          )


                        return (

                          <path
                            key={`milestone-${item.id}`}
                            d={
                              `M ${startX} ${startY}
                               C ${startX + distance} ${startY},
                                 ${endX - distance} ${endY},
                                 ${endX - 7} ${endY}`
                            }
                            fill="none"
                            stroke="#0f766e"
                            strokeWidth="2"
                            strokeDasharray="5 4"
                            markerEnd="url(#pull-arrow)"
                          />

                        )

                      },
                    )}

                </svg>


                {/* =================================================
                    PRIMARY MILESTONE
                ================================================= */}

                {primaryMilestone && (

                  <div
                    style={{
                      position:
                        'absolute',

                      left:
                        `${MILESTONE_X}px`,

                      top:
                        `${MILESTONE_Y}px`,

                      width:
                        `${MILESTONE_WIDTH}px`,

                      minHeight:
                        '130px',

                      padding:
                        '17px',

                      border:
                        '2px solid #0f766e',

                      borderRadius:
                        '10px',

                      background:
                        '#ecfdf5',

                      boxShadow:
                        '0 10px 25px rgba(15,118,110,.13)',

                      zIndex:
                        4,

                      boxSizing:
                        'border-box',
                    }}
                  >

                    <div
                      style={{
                        marginBottom:
                          '8px',

                        color:
                          '#0f766e',

                        fontSize:
                          '0.61rem',

                        fontWeight:
                          900,

                        letterSpacing:
                          '0.11em',
                      }}
                    >
                      MILESTONE
                    </div>


                    <strong
                      style={{
                        display:
                          'block',

                        color:
                          '#064e3b',

                        fontSize:
                          '0.9rem',

                        lineHeight:
                          1.35,
                      }}
                    >
                      {primaryMilestone.name}
                    </strong>


                    <div
                      style={{
                        marginTop:
                          '9px',

                        color:
                          '#047857',

                        fontSize:
                          '0.74rem',

                        fontWeight:
                          900,
                      }}
                    >
                      {formatDate(
                        primaryMilestone.target_date,
                      )}
                    </div>


                    <div
                      style={{
                        marginTop:
                          '10px',

                        paddingTop:
                          '9px',

                        borderTop:
                          '1px solid #a7f3d0',

                        color:
                          '#64748b',

                        fontSize:
                          '0.66rem',
                      }}
                    >
                      Plan backward from this target.
                    </div>

                  </div>

                )}


                {/* =================================================
                    EMPTY STATE
                ================================================= */}

                {!loadingBoard &&
                  pullItems.length ===
                  0 && (

                    <div
                      style={{
                        position:
                          'absolute',

                        left:
                          '52%',

                        top:
                          '50%',

                        transform:
                          'translate(-60%,-50%)',

                        textAlign:
                          'center',

                        color:
                          '#94a3b8',

                        zIndex:
                          3,
                      }}
                    >

                      <div
                        style={{
                          fontSize:
                            '2rem',

                          marginBottom:
                            '8px',
                        }}
                      >
                        ▧
                      </div>


                      <strong
                        style={{
                          display:
                            'block',

                          color:
                            '#64748b',

                          fontSize:
                            '0.85rem',
                        }}
                      >
                        Start at the milestone
                      </strong>


                      <p
                        style={{
                          margin:
                            '6px 0 14px',

                          fontSize:
                            '0.72rem',
                        }}
                      >
                        What must be completed immediately before the target?
                      </p>


                      {!boardLocked && (

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

                  )}


                {/* =================================================
                    STICKY NOTES
                ================================================= */}

                {pullItems.map(
                  (
                    item,
                  ) => {

                    const activity =
                      productionActivityMap.get(
                        item.production_activity_id,
                      ) ||
                      null


                    const packageData =
                      activity
                        ? workPackageMap.get(
                            activity.organization_work_package_id,
                          )
                        : null


                    const location =
                      activity
                        ? locationMap.get(
                            activity.location_id,
                          )
                        : null


                    const color =
                      packageData?.color ||
                      '#facc15'


                    const textColor =
                      getContrastYIQ(
                        color,
                      )


                    const selected =
                      selectedItemId ===
                      item.id


                    const predecessorCount =
                      handoffs.filter(
                        (
                          handoff,
                        ) =>
                          handoff.successor_activity_id ===
                          item.production_activity_id,
                      ).length


                    return (

                      <div
                        key={
                          item.id
                        }
                        onMouseDown={(
                          event,
                        ) =>
                          startDrag(
                            event,
                            item,
                          )
                        }
                        onClick={(
                          event,
                        ) => {

                          event.stopPropagation()

                          setSelectedItemId(
                            item.id,
                          )

                        }}
                        style={{
                          position:
                            'absolute',

                          left:
                            `${Number(item.board_x || 50)}px`,

                          top:
                            `${Number(item.board_y || 80)}px`,

                          width:
                            `${NOTE_WIDTH}px`,

                          minHeight:
                            `${NOTE_HEIGHT}px`,

                          padding:
                            '11px 12px',

                          border:
                            selected
                              ? '3px solid #071c31'
                              : '1px solid rgba(15,23,42,.18)',

                          borderRadius:
                            '4px',

                          background:
                            color,

                          color:
                            textColor,

                          boxShadow:
                            dragState?.itemId ===
                            item.id
                              ? '0 18px 35px rgba(15,23,42,.28)'
                              : selected
                                ? '0 10px 24px rgba(15,23,42,.22)'
                                : '0 6px 15px rgba(15,23,42,.14)',

                          transform:
                            dragState?.itemId ===
                            item.id
                              ? 'rotate(1.5deg) scale(1.03)'
                              : 'none',

                          cursor:
                            boardLocked
                              ? 'default'
                              : 'grab',

                          zIndex:
                            dragState?.itemId ===
                            item.id
                              ? 40
                              : selected
                                ? 12
                                : 8,

                          boxSizing:
                            'border-box',
                        }}
                      >

                        <div
                          style={{
                            display:
                              'flex',

                            justifyContent:
                              'space-between',

                            alignItems:
                              'center',

                            gap:
                              '8px',
                          }}
                        >

                          <strong
                            style={{
                              fontSize:
                                '0.78rem',

                              letterSpacing:
                                '0.08em',
                            }}
                          >
                            {packageData?.code ||
                              activity?.activity_code ||
                              'ACT'}
                          </strong>


                          <span
                            style={{
                              fontSize:
                                '0.62rem',

                              fontWeight:
                                900,
                            }}
                          >
                            {item.duration_working_days}d
                          </span>

                        </div>


                        <div
                          style={{
                            marginTop:
                              '7px',

                            fontSize:
                              '0.75rem',

                            fontWeight:
                              900,

                            lineHeight:
                              1.25,
                          }}
                        >
                          {item.description_snapshot}
                        </div>


                        <div
                          title={
                            location?.path ||
                            location?.name ||
                            ''
                          }
                          style={{
                            marginTop:
                              '7px',

                            fontSize:
                              '0.6rem',

                            lineHeight:
                              1.3,

                            opacity:
                              0.88,

                            overflow:
                              'hidden',

                            textOverflow:
                              'ellipsis',

                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {location?.path ||
                            location?.name ||
                            'Location not assigned'}
                        </div>


                        <div
                          style={{
                            marginTop:
                              '5px',

                            display:
                              'flex',

                            justifyContent:
                              'space-between',

                            gap:
                              '5px',

                            fontSize:
                              '0.58rem',

                            opacity:
                              0.88,
                          }}
                        >

                          <span>
                            {item.quantity_snapshot !==
                              null &&
                            item.quantity_snapshot !==
                              undefined
                              ? `${item.quantity_snapshot}${item.unit_snapshot ? ` ${item.unit_snapshot}` : ''}`
                              : ''}
                          </span>


                          {predecessorCount >
                            0 && (

                            <span>
                              ← {predecessorCount}
                            </span>

                          )}

                        </div>


                        {!boardLocked && (

                          <button
                            type="button"
                            data-no-drag="true"
                            onMouseDown={(
                              event,
                            ) =>
                              event.stopPropagation()
                            }
                            onClick={(
                              event,
                            ) =>
                              openPredecessorModal(
                                event,
                                item,
                              )
                            }
                            style={{
                              width:
                                '100%',

                              marginTop:
                                '9px',

                              padding:
                                '5px 6px',

                              border:
                                `1px solid ${
                                  textColor ===
                                  '#ffffff'
                                    ? 'rgba(255,255,255,.65)'
                                    : 'rgba(7,28,49,.35)'
                                }`,

                              borderRadius:
                                '4px',

                              background:
                                textColor ===
                                '#ffffff'
                                  ? 'rgba(255,255,255,.14)'
                                  : 'rgba(255,255,255,.35)',

                              color:
                                textColor,

                              cursor:
                                'pointer',

                              fontSize:
                                '0.58rem',

                              fontWeight:
                                900,
                            }}
                          >
                            + What must happen before this?
                          </button>

                        )}

                      </div>

                    )

                  },
                )}

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
