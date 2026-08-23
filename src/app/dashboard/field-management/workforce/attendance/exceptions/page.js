'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { createClient } from '../../../../../../lib/supabase/client'

const supabase = createClient()

const LONG_OPEN_SESSION_MINUTES = 720

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    date.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatWorkerName(worker) {
  if (!worker) {
    return 'Unknown worker'
  }

  return (
    [
      worker.first_name,
      worker.middle_name,
      worker.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Unnamed worker'
  )
}

function formatProjectName(project) {
  if (!project) {
    return 'Unknown project'
  }

  if (
    project.code &&
    project.name
  ) {
    return `${project.code} · ${project.name}`
  }

  return (
    project.name ||
    project.code ||
    'Unnamed project'
  )
}

function formatTime(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(
    new Date(value)
  )
}

function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  ).format(
    new Date(value)
  )
}

function formatMinutes(minutes) {
  const numeric =
    Number(minutes)

  if (
    !Number.isFinite(numeric)
  ) {
    return '—'
  }

  const total =
    Math.max(
      0,
      Math.floor(numeric)
    )

  const hours =
    Math.floor(total / 60)

  const remainingMinutes =
    total % 60

  return `${hours}h ${String(
    remainingMinutes
  ).padStart(2, '0')}m`
}

function calculateOpenMinutes(
  session,
  currentTime
) {
  if (
    !session?.check_in_at
  ) {
    return 0
  }

  const start =
    new Date(
      session.check_in_at
    ).getTime()

  if (
    !Number.isFinite(start)
  ) {
    return 0
  }

  const difference =
    currentTime - start

  if (difference <= 0) {
    return 0
  }

  return Math.floor(
    difference / 60000
  )
}

function formatExceptionCode(code) {
  if (!code) {
    return 'Recorded Exception'
  }

  const labels = {
    GEOFENCE_OUTSIDE:
      'Outside Geofence',

    LOCATION_UNAVAILABLE:
      'Location Unavailable',

    GEOFENCE_UNCERTAIN:
      'Geofence Uncertain',

    GPS_LOW_ACCURACY:
      'GPS Low Accuracy',

    MULTIPLE_ATTENDANCE_EXCEPTIONS:
      'Multiple Attendance Exceptions',
  }

  return (
    labels[code] ||
    code
      .toLowerCase()
      .split('_')
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(' ')
  )
}

function buildException({
  type,
  severity,
  worker,
  session,
  title,
  description,
  value,
  persisted = false,
}) {
  return {
    id: `${type}-${session.id}`,
    type,
    severity,
    worker,
    session,
    title,
    description,
    value,
    persisted,
  }
}

export default function AttendanceExceptionsPage() {
  const [projects, setProjects] =
    useState([])

  const [workers, setWorkers] =
    useState([])

  const [sessions, setSessions] =
    useState([])

  const [actorsById, setActorsById] =
    useState(new Map())

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState('')

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    getLocalDateKey()
  )

  const [
    queueFilter,
    setQueueFilter,
  ] = useState('open')

  const [
    selectedException,
    setSelectedException,
  ] = useState(null)

  const [
    resolutionNotes,
    setResolutionNotes,
  ] = useState('')

  const [
    exceptionEvidence,
    setExceptionEvidence,
  ] = useState([])

  const [
    loadingEvidence,
    setLoadingEvidence,
  ] = useState(false)

  const [
    processingResolution,
    setProcessingResolution,
  ] = useState(false)

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [currentTime, setCurrentTime] =
    useState(() => Date.now())

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  useEffect(() => {
    const intervalId =
      window.setInterval(() => {
        setCurrentTime(Date.now())
      }, 30000)

    return () => {
      window.clearInterval(
        intervalId
      )
    }
  }, [])

  const loadProjects =
    useCallback(async () => {
      const {
        data,
        error: projectsError,
      } = await supabase
        .from('projects')
        .select(`
          id,
          code,
          name,
          standard_daily_minutes,
          geofence_radius_m,
          geofence_enabled,
          max_gps_accuracy_m
        `)
        .order('name')

      if (projectsError) {
        throw projectsError
      }

      const loadedProjects =
        data || []

      setProjects(
        loadedProjects
      )

      setSelectedProjectId(
        (currentProjectId) => {
          if (
            currentProjectId &&
            loadedProjects.some(
              (project) =>
                project.id ===
                currentProjectId
            )
          ) {
            return currentProjectId
          }

          return (
            loadedProjects[0]
              ?.id || ''
          )
        }
      )
    }, [])

  const loadWorkers =
    useCallback(async () => {
      const {
        data,
        error: workersError,
      } = await supabase
        .from('field_workers')
        .select(`
          id,
          field_id,
          first_name,
          middle_name,
          last_name,
          status
        `)
        .order(
          'field_id',
          {
            ascending: true,
          }
        )

      if (workersError) {
        throw workersError
      }

      setWorkers(
        data || []
      )
    }, [])

  const resolveActors =
    useCallback(
      async (
        attendanceSessions
      ) => {
        const actorIds = [
          ...new Set(
            attendanceSessions
              .map(
                (session) =>
                  session.exception_resolved_by
              )
              .filter(Boolean)
          ),
        ]

        if (
          actorIds.length === 0
        ) {
          setActorsById(
            new Map()
          )
          return
        }

        const resolved =
          await Promise.all(
            actorIds.map(
              async (userId) => {
                const {
                  data,
                  error:
                    actorError,
                } =
                  await supabase.rpc(
                    'field_resolve_attendance_actor',
                    {
                      p_user_id:
                        userId,
                    }
                  )

                if (actorError) {
                  console.warn(
                    'Exception resolver identity could not be loaded.',
                    actorError
                  )

                  return [
                    userId,
                    null,
                  ]
                }

                const actor =
                  Array.isArray(
                    data
                  )
                    ? data[0]
                    : data

                return [
                  userId,
                  actor || null,
                ]
              }
            )
          )

        setActorsById(
          new Map(resolved)
        )
      },
      []
    )

  const loadExceptionsData =
    useCallback(
      async (
        projectId,
        workDate,
        {
          showRefreshing = false,
        } = {}
      ) => {
        if (
          !projectId ||
          !workDate
        ) {
          setSessions([])
          setActorsById(
            new Map()
          )
          return
        }

        if (showRefreshing) {
          setRefreshing(true)
        }

        try {
          setError('')

          const {
            data,
            error: sessionsError,
          } = await supabase
            .from(
              'field_attendance_sessions'
            )
            .select(`
              id,
              organization_id,
              assignment_id,
              worker_id,
              project_id,
              work_date,
              check_in_at,
              check_out_at,
              status,
              worked_minutes,
              regular_minutes,
              overtime_minutes,
              has_exception,
              exception_code,
              exception_notes,
              exception_resolution_status,
              exception_resolution_action,
              exception_resolution_notes,
              exception_resolved_by,
              exception_resolved_at,
              created_at,
              updated_at
            `)
            .eq(
              'project_id',
              projectId
            )
            .eq(
              'work_date',
              workDate
            )
            .order(
              'check_in_at',
              {
                ascending: true,
              }
            )

          if (sessionsError) {
            throw sessionsError
          }

          const loadedSessions =
            data || []

          setSessions(
            loadedSessions
          )

          await resolveActors(
            loadedSessions
          )

          setCurrentTime(
            Date.now()
          )
        } catch (
          loadError
        ) {
          console.error(
            loadError
          )

          setError(
            loadError?.message ||
              'Unable to load Attendance Exceptions.'
          )
        } finally {
          if (showRefreshing) {
            setRefreshing(false)
          }
        }
      },
      [resolveActors]
    )

  useEffect(() => {
    async function initialize() {
      setLoading(true)

      try {
        setError('')

        await Promise.all([
          loadProjects(),
          loadWorkers(),
        ])
      } catch (
        initializeError
      ) {
        console.error(
          initializeError
        )

        setError(
          initializeError?.message ||
            'Unable to initialize Attendance Exceptions.'
        )
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [
    loadProjects,
    loadWorkers,
  ])

  useEffect(() => {
    if (
      !selectedProjectId ||
      !selectedDate
    ) {
      return
    }

    loadExceptionsData(
      selectedProjectId,
      selectedDate
    )
  }, [
    selectedProjectId,
    selectedDate,
    loadExceptionsData,
  ])

  const selectedProject =
    useMemo(() => {
      return (
        projects.find(
          (project) =>
            project.id ===
            selectedProjectId
        ) || null
      )
    }, [
      projects,
      selectedProjectId,
    ])

  const workerById =
    useMemo(() => {
      return new Map(
        workers.map(
          (worker) => [
            worker.id,
            worker,
          ]
        )
      )
    }, [workers])

  const sessionsByWorkerId =
    useMemo(() => {
      const grouped =
        new Map()

      sessions.forEach(
        (session) => {
          const existing =
            grouped.get(
              session.worker_id
            ) || []

          existing.push(
            session
          )

          grouped.set(
            session.worker_id,
            existing
          )
        }
      )

      return grouped
    }, [sessions])

  const exceptions =
    useMemo(() => {
      const items = []

      const allowedMinutes =
        selectedProject
          ?.standard_daily_minutes ===
          null ||
        selectedProject
          ?.standard_daily_minutes ===
          undefined
          ? null
          : Number(
              selectedProject
                .standard_daily_minutes
            )

      sessionsByWorkerId.forEach(
        (
          workerSessions,
          workerId
        ) => {
          const worker =
            workerById.get(
              workerId
            )

          const closedSessions =
            workerSessions.filter(
              (session) =>
                session.status ===
                'closed' ||
                session.status ===
                'corrected'
            )

          const openSessions =
            workerSessions.filter(
              (session) =>
                session.status ===
                'open'
            )

          const closedMinutes =
            closedSessions.reduce(
              (
                total,
                session
              ) => {
                const minutes =
                  Number(
                    session.worked_minutes ||
                      0
                  )

                return (
                  total +
                  (
                    Number.isFinite(
                      minutes
                    )
                      ? minutes
                      : 0
                  )
                )
              },
              0
            )

          const openMinutes =
            openSessions.reduce(
              (
                total,
                session
              ) =>
                total +
                calculateOpenMinutes(
                  session,
                  currentTime
                ),
              0
            )

          const totalWorkedMinutes =
            closedMinutes +
            openMinutes

          if (
            allowedMinutes !==
              null &&
            totalWorkedMinutes >
              allowedMinutes
          ) {
            const referenceSession =
              workerSessions[
                workerSessions.length -
                  1
              ]

            items.push(
              buildException({
                type:
                  'over_allowed_hours',

                severity:
                  'critical',

                worker,

                session:
                  referenceSession,

                title:
                  'Over Allowed Hours',

                description:
                  'Worker has exceeded the standard daily working allowance.',

                value: `+${formatMinutes(
                  totalWorkedMinutes -
                    allowedMinutes
                )}`,

                persisted:
                  false,
              })
            )
          }

          openSessions.forEach(
            (session) => {
              const minutesOpen =
                calculateOpenMinutes(
                  session,
                  currentTime
                )

              items.push(
                buildException({
                  type:
                    'open_session',

                  severity:
                    minutesOpen >=
                    LONG_OPEN_SESSION_MINUTES
                      ? 'critical'
                      : 'warning',

                  worker,

                  session,

                  title:
                    minutesOpen >=
                    LONG_OPEN_SESSION_MINUTES
                      ? 'Long Open Session'
                      : 'Open Session',

                  description:
                    minutesOpen >=
                    LONG_OPEN_SESSION_MINUTES
                      ? 'Worker has remained checked in for an unusually long period.'
                      : 'Worker currently has an open attendance session.',

                  value:
                    formatMinutes(
                      minutesOpen
                    ),

                  persisted:
                    false,
                })
              )
            }
          )

          workerSessions
            .filter(
              (session) =>
                session.has_exception
            )
            .forEach(
              (session) => {
                const code =
                  session.exception_code

                const severity =
                  code ===
                  'MULTIPLE_ATTENDANCE_EXCEPTIONS'
                    ? 'critical'
                    : 'warning'

                items.push(
                  buildException({
                    type:
                      'recorded_exception',

                    severity,

                    worker,

                    session,

                    title:
                      formatExceptionCode(
                        code
                      ),

                    description:
                      session.exception_notes ||
                      'This attendance session has been marked with an exception.',

                    value:
                      session.exception_resolution_status ===
                      'resolved'
                        ? 'Resolved'
                        : 'Review',

                    persisted:
                      true,
                  })
                )
              }
            )
        }
      )

      return items.sort(
        (a, b) => {
          const severityRank = {
            critical: 0,
            warning: 1,
            info: 2,
          }

          const severityDifference =
            (
              severityRank[
                a.severity
              ] ?? 99
            ) -
            (
              severityRank[
                b.severity
              ] ?? 99
            )

          if (
            severityDifference !==
            0
          ) {
            return severityDifference
          }

          return formatWorkerName(
            a.worker
          ).localeCompare(
            formatWorkerName(
              b.worker
            )
          )
        }
      )
    }, [
      sessionsByWorkerId,
      workerById,
      selectedProject,
      currentTime,
    ])

  const filteredExceptions =
    useMemo(() => {
      if (
        queueFilter === 'all'
      ) {
        return exceptions
      }

      if (
        queueFilter === 'resolved'
      ) {
        return exceptions.filter(
          (exception) =>
            exception.persisted &&
            exception.session
              .exception_resolution_status ===
              'resolved'
        )
      }

      return exceptions.filter(
        (exception) =>
          !exception.persisted ||
          exception.session
            .exception_resolution_status !==
            'resolved'
      )
    }, [
      exceptions,
      queueFilter,
    ])

  const criticalCount =
    useMemo(() => {
      return filteredExceptions.filter(
        (exception) =>
          exception.severity ===
          'critical'
      ).length
    }, [filteredExceptions])

  const warningCount =
    useMemo(() => {
      return filteredExceptions.filter(
        (exception) =>
          exception.severity ===
          'warning'
      ).length
    }, [filteredExceptions])

  const openSessionCount =
    useMemo(() => {
      return filteredExceptions.filter(
        (exception) =>
          exception.type ===
            'open_session'
      ).length
    }, [filteredExceptions])

  const recordedCount =
    useMemo(() => {
      return filteredExceptions.filter(
        (exception) =>
          exception.persisted
      ).length
    }, [filteredExceptions])

  const resolvedCount =
    useMemo(() => {
      return exceptions.filter(
        (exception) =>
          exception.persisted &&
          exception.session
            .exception_resolution_status ===
            'resolved'
      ).length
    }, [exceptions])

  async function loadExceptionEvidence(
    sessionId
  ) {
    if (!sessionId) {
      setExceptionEvidence([])
      return
    }

    setLoadingEvidence(true)

    try {
      const {
        data,
        error: evidenceError,
      } = await supabase
        .from(
          'field_attendance_events'
        )
        .select(`
          id,
          session_id,
          event_type,
          event_at,
          latitude,
          longitude,
          gps_accuracy_m,
          distance_to_project_m,
          geofence_status,
          method,
          source,
          metadata
        `)
        .eq(
          'session_id',
          sessionId
        )
        .in(
          'event_type',
          [
            'check_in',
            'check_out',
          ]
        )
        .order(
          'event_at',
          {
            ascending: true,
          }
        )

      if (evidenceError) {
        throw evidenceError
      }

      setExceptionEvidence(
        (data || []).filter(
          (event) =>
            event.geofence_status ||
            event.latitude !== null ||
            event.longitude !== null ||
            event.gps_accuracy_m !== null ||
            event.distance_to_project_m !== null
        )
      )
    } catch (
      evidenceError
    ) {
      console.error(
        evidenceError
      )

      setExceptionEvidence([])

      setError(
        evidenceError?.message ||
          'Unable to load geofence evidence for this exception.'
      )
    } finally {
      setLoadingEvidence(false)
    }
  }

  async function openExceptionReview(
    exception
  ) {
    if (!exception?.persisted) {
      return
    }

    setError('')
    setSuccess('')

    setSelectedException(
      exception
    )

    setResolutionNotes(
      exception.session
        .exception_resolution_notes ||
        ''
    )

    setExceptionEvidence([])

    await loadExceptionEvidence(
      exception.session.id
    )
  }

  function closeExceptionReview() {
    if (processingResolution) {
      return
    }

    setSelectedException(null)
    setResolutionNotes('')
    setExceptionEvidence([])
  }

  async function handleMarkReviewed() {
    if (
      !selectedException?.persisted
    ) {
      return
    }

    setProcessingResolution(true)
    setError('')
    setSuccess('')

    try {
      const {
        error: reviewError,
      } = await supabase.rpc(
        'field_review_attendance_exception',
        {
          p_session_id:
            selectedException
              .session.id,

          p_review_notes:
            resolutionNotes.trim() ||
            null,
        }
      )

      if (reviewError) {
        throw reviewError
      }

      const workerName =
        formatWorkerName(
          selectedException.worker
        )

      await loadExceptionsData(
        selectedProjectId,
        selectedDate
      )

      setSelectedException(
        null
      )

      setResolutionNotes('')

      setSuccess(
        `${workerName}'s attendance exception is now under review.`
      )
    } catch (
      reviewError
    ) {
      console.error(
        reviewError
      )

      setError(
        reviewError?.message ||
          'Unable to mark the exception as reviewed.'
      )
    } finally {
      setProcessingResolution(
        false
      )
    }
  }

  async function handleResolve(
    action
  ) {
    if (
      !selectedException?.persisted
    ) {
      return
    }

    const notes =
      resolutionNotes.trim()

    if (!notes) {
      setError(
        'Resolution notes are required before resolving an exception.'
      )
      return
    }

    setProcessingResolution(true)
    setError('')
    setSuccess('')

    try {
      const {
        error: resolutionError,
      } = await supabase.rpc(
        'field_resolve_attendance_exception',
        {
          p_session_id:
            selectedException
              .session.id,

          p_resolution_action:
            action,

          p_resolution_notes:
            notes,
        }
      )

      if (resolutionError) {
        throw resolutionError
      }

      const workerName =
        formatWorkerName(
          selectedException.worker
        )

      const actionLabels = {
        accepted:
          'accepted',

        rejected:
          'rejected',

        dismissed:
          'dismissed',
      }

      await loadExceptionsData(
        selectedProjectId,
        selectedDate
      )

      setSelectedException(
        null
      )

      setResolutionNotes('')

      setSuccess(
        `${workerName}'s attendance exception was ${actionLabels[action]}.`
      )
    } catch (
      resolutionError
    ) {
      console.error(
        resolutionError
      )

      setError(
        resolutionError?.message ||
          'Unable to resolve the attendance exception.'
      )
    } finally {
      setProcessingResolution(
        false
      )
    }
  }

  const selectedResolver =
    selectedException
      ?.session
      ?.exception_resolved_by
      ? actorsById.get(
          selectedException.session
            .exception_resolved_by
        )
      : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
      }}
    >
      <section>
        <p
          style={{
            margin: '0 0 6px',
            color: '#64748b',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing:
              '0.09em',
            textTransform:
              'uppercase',
          }}
        >
          Field Management
        </p>

        <div
          style={{
            display: 'flex',
            alignItems:
              'flex-start',
            justifyContent:
              'space-between',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: '#061b2f',
                fontSize: '2rem',
                lineHeight: 1.1,
              }}
            >
              Attendance Exceptions
            </h2>

            <p
              style={{
                margin: '8px 0 0',
                maxWidth: '860px',
                color: '#64748b',
                lineHeight: 1.55,
              }}
            >
              Monitor operational alerts,
              review recorded attendance
              exceptions, and document
              supervisor resolution decisions.
            </p>
          </div>

          <button
            type="button"
            disabled={
              refreshing ||
              !selectedProjectId ||
              !selectedDate
            }
            onClick={() =>
              loadExceptionsData(
                selectedProjectId,
                selectedDate,
                {
                  showRefreshing:
                    true,
                }
              )
            }
            style={
              secondaryButtonStyle
            }
          >
            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </button>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(260px, 1fr) minmax(180px, 220px) minmax(180px, 220px) minmax(180px, 220px)',
          gap: '14px',
          padding: '18px',
          border:
            '1px solid #e2e8f0',
          borderRadius: '14px',
          background: '#ffffff',
        }}
      >
        <FormField
          label="Project"
        >
          <select
            value={
              selectedProjectId
            }
            onChange={(event) =>
              setSelectedProjectId(
                event.target.value
              )
            }
            style={inputStyle}
          >
            {projects.length ===
              0 && (
              <option value="">
                No projects available
              </option>
            )}

            {projects.map(
              (project) => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {formatProjectName(
                    project
                  )}
                </option>
              )
            )}
          </select>
        </FormField>

        <FormField
          label="Work Date"
        >
          <input
            type="date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(
                event.target.value
              )
            }
            style={inputStyle}
          />
        </FormField>

        <FormField
          label="Queue"
        >
          <select
            value={queueFilter}
            onChange={(event) =>
              setQueueFilter(
                event.target.value
              )
            }
            style={inputStyle}
          >
            <option value="open">
              Open / Review
            </option>

            <option value="resolved">
              Resolved
            </option>

            <option value="all">
              All
            </option>
          </select>
        </FormField>

        <InfoField
          label="Daily Allowance"
          value={
            selectedProject
              ?.standard_daily_minutes ===
              null ||
            selectedProject
              ?.standard_daily_minutes ===
              undefined
              ? 'Not configured'
              : formatMinutes(
                  selectedProject
                    .standard_daily_minutes
                )
          }
        />
      </section>

      {error && (
        <div
          role="alert"
          style={errorMessageStyle}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={successMessageStyle}
        >
          {success}
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
        }}
      >
        <MetricCard
          label="Critical"
          value={criticalCount}
          tone={
            criticalCount > 0
              ? 'danger'
              : 'default'
          }
        />

        <MetricCard
          label="Warnings"
          value={warningCount}
          tone={
            warningCount > 0
              ? 'warning'
              : 'default'
          }
        />

        <MetricCard
          label="Open Sessions"
          value={openSessionCount}
        />

        <MetricCard
          label="Recorded Exceptions"
          value={recordedCount}
          tone={
            recordedCount > 0
              ? 'info'
              : 'default'
          }
        />

        <MetricCard
          label="Resolved Today"
          value={resolvedCount}
        />
      </section>

      <section
        style={{
          overflow: 'hidden',
          border:
            '1px solid #e2e8f0',
          borderRadius: '14px',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 18px',
            borderBottom:
              '1px solid #e2e8f0',
          }}
        >
          <h3
            style={{
              margin: 0,
              color: '#0f172a',
              fontSize: '1rem',
            }}
          >
            Exception Queue
          </h3>

          <span
            style={{
              color: '#64748b',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            {filteredExceptions.length}{' '}
            item
            {filteredExceptions.length ===
            1
              ? ''
              : 's'}
          </span>
        </div>

        {loading ? (
          <MessageArea>
            Loading Attendance
            Exceptions...
          </MessageArea>
        ) : filteredExceptions.length ===
          0 ? (
          <MessageArea>
            No attendance exceptions
            were found for the selected
            queue, project, and date.
          </MessageArea>
        ) : (
          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '1500px',
                borderCollapse:
                  'collapse',
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      '#f8fafc',
                  }}
                >
                  <TableHeader>
                    Severity
                  </TableHeader>

                  <TableHeader>
                    Field ID
                  </TableHeader>

                  <TableHeader>
                    Worker
                  </TableHeader>

                  <TableHeader>
                    Exception
                  </TableHeader>

                  <TableHeader>
                    Check-In
                  </TableHeader>

                  <TableHeader>
                    Check-Out
                  </TableHeader>

                  <TableHeader>
                    Value
                  </TableHeader>

                  <TableHeader>
                    Description
                  </TableHeader>

                  <TableHeader>
                    Resolution
                  </TableHeader>

                  <TableHeader>
                    Action
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {filteredExceptions.map(
                  (exception) => {
                    const resolutionStatus =
                      exception.persisted
                        ? exception
                            .session
                            .exception_resolution_status ||
                          'open'
                        : 'operational'

                    return (
                      <tr
                        key={
                          exception.id
                        }
                        style={{
                          borderTop:
                            '1px solid #e2e8f0',
                        }}
                      >
                        <TableCell>
                          <SeverityBadge
                            severity={
                              exception.severity
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <span
                            style={{
                              fontFamily:
                                'monospace',
                              fontWeight:
                                700,
                            }}
                          >
                            {exception
                              .worker
                              ?.field_id ||
                              '—'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <strong
                            style={{
                              color:
                                '#0f172a',
                            }}
                          >
                            {formatWorkerName(
                              exception.worker
                            )}
                          </strong>
                        </TableCell>

                        <TableCell>
                          <strong
                            style={{
                              color:
                                '#334155',
                            }}
                          >
                            {
                              exception.title
                            }
                          </strong>
                        </TableCell>

                        <TableCell>
                          {formatTime(
                            exception
                              .session
                              .check_in_at
                          )}
                        </TableCell>

                        <TableCell>
                          {exception
                            .session
                            .check_out_at
                            ? formatTime(
                                exception
                                  .session
                                  .check_out_at
                              )
                            : 'Open'}
                        </TableCell>

                        <TableCell>
                          <strong>
                            {
                              exception.value
                            }
                          </strong>
                        </TableCell>

                        <TableCell>
                          <span
                            style={{
                              display:
                                'block',
                              maxWidth:
                                '360px',
                              whiteSpace:
                                'normal',
                              lineHeight:
                                1.45,
                            }}
                          >
                            {
                              exception.description
                            }
                          </span>
                        </TableCell>

                        <TableCell>
                          <ResolutionStatusBadge
                            status={
                              resolutionStatus
                            }
                            action={
                              exception.persisted
                                ? exception
                                    .session
                                    .exception_resolution_action
                                : null
                            }
                          />
                        </TableCell>

                        <TableCell>
                          {exception.persisted ? (
                            <button
                              type="button"
                              onClick={() =>
                                openExceptionReview(
                                  exception
                                )
                              }
                              style={
                                exception
                                  .session
                                  .exception_resolution_status ===
                                'resolved'
                                  ? secondaryButtonStyle
                                  : primarySmallButtonStyle
                              }
                            >
                              {exception
                                .session
                                .exception_resolution_status ===
                              'resolved'
                                ? 'View Resolution'
                                : 'Review'}
                            </button>
                          ) : (
                            <span
                              style={{
                                color:
                                  '#94a3b8',
                                fontSize:
                                  '0.72rem',
                                fontWeight:
                                  700,
                              }}
                            >
                              Operational alert
                            </span>
                          )}
                        </TableCell>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div
        style={{
          padding: '14px 16px',
          border:
            '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#f8fafc',
          color: '#64748b',
          fontSize: '0.76rem',
          lineHeight: 1.55,
        }}
      >
        Operational alerts such as
        open sessions and excessive
        hours remain live monitoring
        indicators. Resolution actions
        apply only to persisted
        attendance exceptions recorded
        by the backend.
      </div>

      {selectedException && (
        <ExceptionReviewModal
          exception={
            selectedException
          }
          resolver={
            selectedResolver
          }
          resolutionNotes={
            resolutionNotes
          }
          evidence={
            exceptionEvidence
          }
          loadingEvidence={
            loadingEvidence
          }
          geofenceRadius={
            selectedProject
              ?.geofence_radius_m ??
            null
          }
          maxGpsAccuracy={
            selectedProject
              ?.max_gps_accuracy_m ??
            null
          }
          processing={
            processingResolution
          }
          onNotesChange={
            setResolutionNotes
          }
          onClose={
            closeExceptionReview
          }
          onMarkReviewed={
            handleMarkReviewed
          }
          onResolve={
            handleResolve
          }
        />
      )}
    </div>
  )
}

function ExceptionReviewModal({
  exception,
  resolver,
  resolutionNotes,
  evidence,
  loadingEvidence,
  geofenceRadius,
  maxGpsAccuracy,
  processing,
  onNotesChange,
  onClose,
  onMarkReviewed,
  onResolve,
}) {
  const session =
    exception.session

  const status =
    session.exception_resolution_status ||
    'open'

  const isResolved =
    status === 'resolved'

  return (
    <div
      style={modalOverlayStyle}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exception-review-title"
        style={modalStyle}
      >
        <div
          style={modalHeaderStyle}
        >
          <div>
            <p
              style={{
                margin: '0 0 5px',
                color: '#64748b',
                fontSize:
                  '0.68rem',
                fontWeight: 800,
                letterSpacing:
                  '0.08em',
                textTransform:
                  'uppercase',
              }}
            >
              Attendance Exception
            </p>

            <h3
              id="exception-review-title"
              style={{
                margin: 0,
                color: '#061b2f',
                fontSize:
                  '1.25rem',
              }}
            >
              {exception.title}
            </h3>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            style={closeButtonStyle}
            aria-label="Close exception review"
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '20px 22px',
            display: 'grid',
            gap: '16px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(0, 1.4fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr)',
              gap: '12px',
              padding: '13px 14px',
              border:
                '1px solid #e2e8f0',
              borderRadius:
                '10px',
              background:
                '#f8fafc',
            }}
          >
            <ReadOnlyValue
              label="Worker"
              value={formatWorkerName(
                exception.worker
              )}
            />

            <ReadOnlyValue
              label="Field ID"
              value={
                exception.worker
                  ?.field_id ||
                '—'
              }
            />

            <div>
              <div
                style={summaryLabelStyle}
              >
                Resolution
              </div>

              <ResolutionStatusBadge
                status={status}
                action={
                  session.exception_resolution_action
                }
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            }}
          >
            <ReadOnlyPanel
              title="Attendance Session"
            >
              <ReadOnlyValue
                label="Check-In"
                value={formatDateTime(
                  session.check_in_at
                )}
              />

              <ReadOnlyValue
                label="Check-Out"
                value={
                  session.check_out_at
                    ? formatDateTime(
                        session.check_out_at
                      )
                    : 'Open'
                }
              />

              <ReadOnlyValue
                label="Session Status"
                value={
                  session.status ||
                  '—'
                }
              />
            </ReadOnlyPanel>

            <ReadOnlyPanel
              title="Detected Exception"
            >
              <ReadOnlyValue
                label="Code"
                value={
                  session.exception_code ||
                  '—'
                }
              />

              <ReadOnlyValue
                label="Description"
                value={
                  session.exception_notes ||
                  exception.description ||
                  '—'
                }
              />
            </ReadOnlyPanel>
          </div>

          <GeofenceEvidencePanel
            evidence={evidence}
            loading={
              loadingEvidence
            }
            geofenceRadius={
              geofenceRadius
            }
            maxGpsAccuracy={
              maxGpsAccuracy
            }
          />

          {isResolved ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '12px',
              }}
            >
              <ReadOnlyPanel
                title="Resolution Decision"
                tone="success"
              >
                <ReadOnlyValue
                  label="Action"
                  value={
                    session.exception_resolution_action
                      ? session.exception_resolution_action
                          .charAt(0)
                          .toUpperCase() +
                        session.exception_resolution_action.slice(
                          1
                        )
                      : '—'
                  }
                />

                <ReadOnlyValue
                  label="Resolution Notes"
                  value={
                    session.exception_resolution_notes ||
                    '—'
                  }
                />
              </ReadOnlyPanel>

              <ReadOnlyPanel
                title="Accountability"
                tone="success"
              >
                <ReadOnlyValue
                  label="Resolved By"
                  value={
                    resolver?.display_name ||
                    resolver?.email ||
                    (
                      session.exception_resolved_by
                        ? 'Unknown user'
                        : '—'
                    )
                  }
                />

                <ReadOnlyValue
                  label="Job Title"
                  value={
                    resolver?.job_title ||
                    '—'
                  }
                />

                <ReadOnlyValue
                  label="Resolved At"
                  value={formatDateTime(
                    session.exception_resolved_at
                  )}
                />
              </ReadOnlyPanel>
            </div>
          ) : (
            <>
              <FormField
                label={
                  status === 'reviewed'
                    ? 'Review / Resolution Notes'
                    : 'Review Notes'
                }
              >
                <textarea
                  value={
                    resolutionNotes
                  }
                  onChange={(
                    event
                  ) =>
                    onNotesChange(
                      event.target.value
                    )
                  }
                  disabled={processing}
                  rows={5}
                  placeholder="Document the supervisor review, circumstances, and reason for the final decision."
                  style={textareaStyle}
                />
              </FormField>

              <div
                style={{
                  padding:
                    '12px 14px',
                  border:
                    '1px solid #bae6fd',
                  borderRadius:
                    '10px',
                  background:
                    '#f0f9ff',
                  color: '#075985',
                  fontSize:
                    '0.76rem',
                  lineHeight: 1.5,
                }}
              >
                Accept keeps the
                attendance punch valid
                while acknowledging the
                exception. Reject records
                that management action is
                required. Dismiss records
                that the exception was
                determined to be
                irrelevant or false.
              </div>
            </>
          )}
        </div>

        <div
          style={modalFooterStyle}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            style={
              secondaryButtonStyle
            }
          >
            {isResolved
              ? 'Close'
              : 'Cancel'}
          </button>

          {!isResolved && (
            <>
              {status === 'open' && (
                <button
                  type="button"
                  disabled={processing}
                  onClick={
                    onMarkReviewed
                  }
                  style={
                    secondaryButtonStyle
                  }
                >
                  {processing
                    ? 'Saving...'
                    : 'Mark Reviewed'}
                </button>
              )}

              <button
                type="button"
                disabled={processing}
                onClick={() =>
                  onResolve(
                    'dismissed'
                  )
                }
                style={
                  neutralActionButtonStyle
                }
              >
                Dismiss
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() =>
                  onResolve(
                    'rejected'
                  )
                }
                style={
                  dangerActionButtonStyle
                }
              >
                Reject
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() =>
                  onResolve(
                    'accepted'
                  )
                }
                style={
                  acceptActionButtonStyle
                }
              >
                {processing
                  ? 'Saving...'
                  : 'Accept Punch'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function GeofenceEvidencePanel({
  evidence,
  loading,
  geofenceRadius,
  maxGpsAccuracy,
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        border:
          '1px solid #bae6fd',
        borderRadius: '10px',
        background: '#f0f9ff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          gap: '12px',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              color: '#075985',
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform:
                'uppercase',
              letterSpacing:
                '0.05em',
            }}
          >
            Geofence Evidence
          </div>

          <div
            style={{
              marginTop: '3px',
              color: '#0c4a6e',
              fontSize: '0.76rem',
              lineHeight: 1.45,
            }}
          >
            Immutable GPS evidence recorded
            with the original attendance
            event.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              color: '#0369a1',
              fontSize: '0.72rem',
              fontWeight: 800,
            }}
          >
            Allowed radius:{' '}
            {geofenceRadius !== null &&
            geofenceRadius !== undefined
              ? `${geofenceRadius} m`
              : 'Not configured'}
          </span>

          <span
            style={{
              color: '#0369a1',
              fontSize: '0.72rem',
              fontWeight: 800,
            }}
          >
            Max GPS accuracy:{' '}
            {maxGpsAccuracy !== null &&
            maxGpsAccuracy !== undefined
              ? `${maxGpsAccuracy} m`
              : 'Not configured'}
          </span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: '16px 0',
            color: '#0369a1',
            fontSize: '0.8rem',
          }}
        >
          Loading geofence evidence...
        </div>
      ) : evidence.length === 0 ? (
        <div
          style={{
            padding: '12px 0',
            color: '#64748b',
            fontSize: '0.8rem',
          }}
        >
          No GPS evidence is available for
          this attendance session.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '10px',
          }}
        >
          {evidence.map(
            (event) => (
              <GeofenceEvidenceCard
                key={event.id}
                event={event}
                geofenceRadius={
                  geofenceRadius
                }
                maxGpsAccuracy={
                  maxGpsAccuracy
                }
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function GeofenceEvidenceCard({
  event,
  geofenceRadius,
  maxGpsAccuracy,
}) {
  const eventMaxGpsAccuracy =
    event?.metadata
      ?.max_gps_accuracy_m ??
    maxGpsAccuracy ??
    null

  const gpsPolicyExceeded =
    event?.metadata
      ?.gps_accuracy_policy_exceeded ===
      true ||
    (
      event?.metadata
        ?.gps_accuracy_policy_exceeded ===
        undefined &&
      eventMaxGpsAccuracy !== null &&
      eventMaxGpsAccuracy !== undefined &&
      event.gps_accuracy_m !== null &&
      event.gps_accuracy_m !== undefined &&
      Number(event.gps_accuracy_m) >
        Number(eventMaxGpsAccuracy)
    )

  const gpsPolicyStatus =
    eventMaxGpsAccuracy === null ||
    eventMaxGpsAccuracy === undefined
      ? 'Not Configured'
      : gpsPolicyExceeded
        ? 'Exceeded'
        : 'Acceptable'

  const gpsPolicyVisual =
    gpsPolicyStatus === 'Exceeded'
      ? {
          color: '#b91c1c',
          background: '#fef2f2',
          border: '#fecaca',
        }
      : gpsPolicyStatus === 'Acceptable'
        ? {
            color: '#166534',
            background: '#f0fdf4',
            border: '#bbf7d0',
          }
        : {
            color: '#475569',
            background: '#f8fafc',
            border: '#e2e8f0',
          }

  const statusVisual = {
    inside: {
      label: 'Inside',
      color: '#166534',
      background: '#f0fdf4',
      border: '#bbf7d0',
    },

    outside: {
      label: 'Outside',
      color: '#b91c1c',
      background: '#fef2f2',
      border: '#fecaca',
    },

    uncertain: {
      label: 'Uncertain',
      color: '#92400e',
      background: '#fffbeb',
      border: '#fde68a',
    },

    unavailable: {
      label: 'Unavailable',
      color: '#92400e',
      background: '#fffbeb',
      border: '#fde68a',
    },

    not_evaluated: {
      label: 'Not Evaluated',
      color: '#475569',
      background: '#f8fafc',
      border: '#e2e8f0',
    },
  }

  const visual =
    statusVisual[
      event.geofence_status
    ] ||
    statusVisual.not_evaluated

  const distance =
    event.distance_to_project_m ===
      null ||
    event.distance_to_project_m ===
      undefined
      ? '—'
      : Number(
          event.distance_to_project_m
        ) >= 1000
        ? `${(
            Number(
              event.distance_to_project_m
            ) / 1000
          ).toFixed(2)} km`
        : `${Number(
            event.distance_to_project_m
          ).toFixed(1)} m`

  const accuracy =
    event.gps_accuracy_m === null ||
    event.gps_accuracy_m === undefined
      ? '—'
      : `${Number(
          event.gps_accuracy_m
        ).toFixed(0)} m`

  const coordinates =
    event.latitude === null ||
    event.longitude === null
      ? '—'
      : `${Number(
          event.latitude
        ).toFixed(6)}, ${Number(
          event.longitude
        ).toFixed(6)}`

  return (
    <div
      style={{
        padding: '12px 13px',
        border:
          '1px solid #bae6fd',
        borderRadius: '9px',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '11px',
        }}
      >
        <strong
          style={{
            color: '#0f172a',
            fontSize: '0.8rem',
          }}
        >
          {event.event_type ===
          'check_in'
            ? 'Check-In'
            : 'Check-Out'}
        </strong>

        <span
          style={{
            display: 'inline-flex',
            padding: '4px 7px',
            border: `1px solid ${visual.border}`,
            borderRadius: '999px',
            background:
              visual.background,
            color: visual.color,
            fontSize: '0.66rem',
            fontWeight: 800,
          }}
        >
          {visual.label}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '8px',
        }}
      >
        <ReadOnlyValue
          label="Event Time"
          value={formatDateTime(
            event.event_at
          )}
        />

        <ReadOnlyValue
          label="Distance to Project"
          value={distance}
        />

        <ReadOnlyValue
          label="Allowed Radius"
          value={
            geofenceRadius !== null &&
            geofenceRadius !== undefined
              ? `${geofenceRadius} m`
              : '—'
          }
        />

        <ReadOnlyValue
          label="GPS Accuracy"
          value={accuracy}
        />

        <ReadOnlyValue
          label="Project Maximum GPS Accuracy"
          value={
            eventMaxGpsAccuracy !== null &&
            eventMaxGpsAccuracy !== undefined
              ? `${eventMaxGpsAccuracy} m`
              : 'Not configured'
          }
        />

        <div>
          <div
            style={summaryLabelStyle}
          >
            GPS Policy Status
          </div>

          <span
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              padding: '4px 7px',
              border: `1px solid ${gpsPolicyVisual.border}`,
              borderRadius: '999px',
              background:
                gpsPolicyVisual.background,
              color:
                gpsPolicyVisual.color,
              fontSize: '0.66rem',
              fontWeight: 800,
            }}
          >
            {gpsPolicyStatus}
          </span>
        </div>

        <ReadOnlyValue
          label="Captured Coordinates"
          value={coordinates}
        />

        <ReadOnlyValue
          label="Method / Source"
          value={[
            event.method,
            event.source,
          ]
            .filter(Boolean)
            .join(' · ') || '—'}
        />
      </div>
    </div>
  )
}

function ResolutionStatusBadge({
  status,
  action,
}) {
  const visualMap = {
    open: {
      label: 'Open',
      color: '#92400e',
      background: '#fffbeb',
      border: '#fde68a',
    },

    reviewed: {
      label: 'Under Review',
      color: '#075985',
      background: '#f0f9ff',
      border: '#bae6fd',
    },

    resolved: {
      label: action
        ? `Resolved · ${
            action
              .charAt(0)
              .toUpperCase() +
            action.slice(1)
          }`
        : 'Resolved',
      color: '#166534',
      background: '#f0fdf4',
      border: '#bbf7d0',
    },

    operational: {
      label: 'Live Alert',
      color: '#475569',
      background: '#f8fafc',
      border: '#e2e8f0',
    },
  }

  const visual =
    visualMap[status] ||
    visualMap.open

  return (
    <span
      style={{
        display: 'inline-flex',
        width: 'fit-content',
        padding: '5px 8px',
        border: `1px solid ${visual.border}`,
        borderRadius: '999px',
        background:
          visual.background,
        color: visual.color,
        fontSize: '0.69rem',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {visual.label}
    </span>
  )
}

function SeverityBadge({
  severity,
}) {
  const visualMap = {
    critical: {
      color: '#b91c1c',
      background: '#fef2f2',
      border: '#fecaca',
      label: 'Critical',
    },

    warning: {
      color: '#92400e',
      background: '#fffbeb',
      border: '#fde68a',
      label: 'Warning',
    },

    info: {
      color: '#1d4ed8',
      background: '#eff6ff',
      border: '#bfdbfe',
      label: 'Info',
    },
  }

  const visual =
    visualMap[severity] ||
    visualMap.info

  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '5px 8px',
        border: `1px solid ${visual.border}`,
        borderRadius: '999px',
        background:
          visual.background,
        color: visual.color,
        fontSize: '0.7rem',
        fontWeight: 800,
      }}
    >
      {visual.label}
    </span>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default',
}) {
  const tones = {
    default: {
      border: '#e2e8f0',
      background: '#ffffff',
      value: '#061b2f',
    },

    warning: {
      border: '#fde68a',
      background: '#fffbeb',
      value: '#92400e',
    },

    danger: {
      border: '#fecaca',
      background: '#fef2f2',
      value: '#b91c1c',
    },

    info: {
      border: '#bae6fd',
      background: '#f0f9ff',
      value: '#0369a1',
    },
  }

  const visual =
    tones[tone] ||
    tones.default

  return (
    <div
      style={{
        padding: '17px 18px',
        border: `1px solid ${visual.border}`,
        borderRadius: '13px',
        background:
          visual.background,
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform:
            'uppercase',
          letterSpacing:
            '0.05em',
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: '7px',
          color: visual.value,
          fontSize: '1.55rem',
          fontWeight: 850,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function FormField({
  label,
  children,
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: '#334155',
          fontSize: '0.76rem',
          fontWeight: 800,
        }}
      >
        {label}
      </span>

      {children}
    </label>
  )
}

function InfoField({
  label,
  value,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}
    >
      <span
        style={{
          color: '#334155',
          fontSize: '0.76rem',
          fontWeight: 800,
        }}
      >
        {label}
      </span>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: '44px',
          padding: '0 12px',
          border:
            '1px solid #e2e8f0',
          borderRadius: '9px',
          background: '#f8fafc',
          color: '#334155',
          fontSize: '0.9rem',
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ReadOnlyPanel({
  title,
  children,
  tone = 'default',
}) {
  const success =
    tone === 'success'

  return (
    <div
      style={{
        display: 'grid',
        gap: '11px',
        padding: '14px 16px',
        border: `1px solid ${
          success
            ? '#bbf7d0'
            : '#e2e8f0'
        }`,
        borderRadius: '10px',
        background:
          success
            ? '#f0fdf4'
            : '#ffffff',
      }}
    >
      <div
        style={{
          color:
            success
              ? '#166534'
              : '#475569',
          fontSize: '0.7rem',
          fontWeight: 800,
          letterSpacing:
            '0.05em',
          textTransform:
            'uppercase',
        }}
      >
        {title}
      </div>

      {children}
    </div>
  )
}

function ReadOnlyValue({
  label,
  value,
}) {
  return (
    <div>
      <div
        style={summaryLabelStyle}
      >
        {label}
      </div>

      <div
        style={{
          color: '#334155',
          fontSize: '0.8rem',
          fontWeight: 700,
          lineHeight: 1.45,
          whiteSpace: 'normal',
          overflowWrap:
            'anywhere',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function TableHeader({
  children,
}) {
  return (
    <th
      style={{
        padding: '11px 14px',
        color: '#64748b',
        fontSize: '0.68rem',
        fontWeight: 800,
        letterSpacing:
          '0.04em',
        textAlign: 'left',
        textTransform:
          'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function TableCell({
  children,
}) {
  return (
    <td
      style={{
        padding: '13px 14px',
        color: '#475569',
        fontSize: '0.82rem',
        verticalAlign:
          'middle',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}

function MessageArea({
  children,
}) {
  return (
    <div
      style={{
        padding: '38px 20px',
        color: '#64748b',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  minHeight: '44px',
  boxSizing: 'border-box',
  padding: '0 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '9px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '0.9rem',
}

const textareaStyle = {
  width: '100%',
  minHeight: '118px',
  boxSizing: 'border-box',
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '9px',
  background: '#ffffff',
  color: '#0f172a',
  fontFamily: 'inherit',
  fontSize: '0.86rem',
  lineHeight: 1.5,
  resize: 'vertical',
}

const errorMessageStyle = {
  padding: '12px 14px',
  border:
    '1px solid #fecaca',
  borderRadius: '10px',
  background: '#fef2f2',
  color: '#991b1b',
  fontSize: '0.84rem',
}

const successMessageStyle = {
  padding: '12px 14px',
  border:
    '1px solid #99f6e4',
  borderRadius: '10px',
  background: '#f0fdfa',
  color: '#115e59',
  fontSize: '0.84rem',
}

const secondaryButtonStyle = {
  minHeight: '38px',
  padding: '0 13px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '9px',
  background: '#ffffff',
  color: '#082a4a',
  cursor: 'pointer',
  fontWeight: 750,
}

const primarySmallButtonStyle = {
  minHeight: '34px',
  padding: '0 11px',
  border:
    '1px solid #078c7c',
  borderRadius: '8px',
  background: '#08aa96',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '0.74rem',
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const neutralActionButtonStyle = {
  minHeight: '38px',
  padding: '0 13px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '9px',
  background: '#f8fafc',
  color: '#475569',
  cursor: 'pointer',
  fontWeight: 800,
}

const dangerActionButtonStyle = {
  minHeight: '38px',
  padding: '0 13px',
  border:
    '1px solid #fecaca',
  borderRadius: '9px',
  background: '#fef2f2',
  color: '#b91c1c',
  cursor: 'pointer',
  fontWeight: 800,
}

const acceptActionButtonStyle = {
  minHeight: '38px',
  padding: '0 13px',
  border:
    '1px solid #078c7c',
  borderRadius: '9px',
  background: '#08aa96',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 800,
}

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background:
    'rgba(6, 27, 47, 0.58)',
  overflowY: 'auto',
}

const modalStyle = {
  width: '100%',
  maxWidth: '820px',
  border:
    '1px solid #e2e8f0',
  borderRadius: '16px',
  background: '#ffffff',
  boxShadow:
    '0 24px 70px rgba(15, 23, 42, 0.24)',
  overflow: 'hidden',
}

const modalHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent:
    'space-between',
  gap: '18px',
  padding: '18px 22px',
  borderBottom:
    '1px solid #e2e8f0',
}

const modalFooterStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent:
    'flex-end',
  gap: '9px',
  flexWrap: 'wrap',
  padding: '16px 22px',
  borderTop:
    '1px solid #e2e8f0',
  background: '#f8fafc',
}

const closeButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  padding: 0,
  border:
    '1px solid #e2e8f0',
  borderRadius: '9px',
  background: '#ffffff',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '1.35rem',
  lineHeight: 1,
}

const summaryLabelStyle = {
  marginBottom: '3px',
  color: '#94a3b8',
  fontSize: '0.64rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}
