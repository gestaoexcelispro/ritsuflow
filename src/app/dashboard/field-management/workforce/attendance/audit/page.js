'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { createClient } from '../../../../../../lib/supabase/client'

const supabase = createClient()

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
  ).format(new Date(value))
}

function formatMethod(value) {
  if (!value) {
    return '—'
  }

  return value
    .split('_')
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(' ')
}

function formatResolutionAction(value) {
  if (!value) {
    return null
  }

  const labels = {
    accepted: 'Accepted',
    rejected: 'Rejected',
    dismissed: 'Dismissed',
  }

  return (
    labels[value] ||
    value
      .split('_')
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(' ')
  )
}

function getAuditAction(event) {
  return (
    event?.metadata?.audit_action ||
    null
  )
}

function getEventPresentation(event) {
  const auditAction =
    getAuditAction(event)

  if (
    auditAction ===
    'exception_reviewed'
  ) {
    return {
      label: 'Exception Reviewed',
      tone: 'review',
    }
  }

  if (
    auditAction ===
    'exception_resolved'
  ) {
    const resolutionAction =
      formatResolutionAction(
        event?.metadata
          ?.resolution_action
      )

    return {
      label:
        resolutionAction
          ? `Exception Resolved · ${resolutionAction}`
          : 'Exception Resolved',
      tone: 'resolution',
    }
  }

  const labels = {
    check_in: 'Check-In',
    check_out: 'Check-Out',
    manual_adjustment:
      'Manual Adjustment',
    session_cancelled:
      'Session Cancelled',
  }

  return {
    label:
      labels[event?.event_type] ||
      event?.event_type
        ?.split('_')
        .map(
          (word) =>
            word
              .charAt(0)
              .toUpperCase() +
            word.slice(1)
        )
        .join(' ') ||
      'Unknown',
    tone:
      event?.event_type ||
      'default',
  }
}

function getBeforeAfter(metadata) {
  if (
    !metadata ||
    typeof metadata !== 'object'
  ) {
    return {
      before: null,
      after: null,
    }
  }

  return {
    before:
      metadata.before || null,

    after:
      metadata.after || null,
  }
}

function renderMetadataValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  if (typeof value === 'boolean') {
    return value
      ? 'Yes'
      : 'No'
  }

  if (
    typeof value === 'number'
  ) {
    return String(value)
  }

  if (
    typeof value === 'string'
  ) {
    if (
      value.includes('T') &&
      !Number.isNaN(
        new Date(value).getTime()
      )
    ) {
      return formatDateTime(value)
    }

    return value
  }

  return JSON.stringify(value)
}

export default function AttendanceAuditPage() {
  const [projects, setProjects] =
    useState([])

  const [workers, setWorkers] =
    useState([])

  const [events, setEvents] =
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
    eventFilter,
    setEventFilter,
  ] = useState('all')

  const [
    expandedEventId,
    setExpandedEventId,
  ] = useState(null)

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState('')

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
          name
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
          last_name
        `)

      if (workersError) {
        throw workersError
      }

      setWorkers(
        data || []
      )
    }, [])

  const resolveActors =
    useCallback(
      async (attendanceEvents) => {
        const actorIds = [
          ...new Set(
            attendanceEvents
              .map(
                (event) =>
                  event.recorded_by
              )
              .filter(Boolean)
          ),
        ]

        if (actorIds.length === 0) {
          setActorsById(
            new Map()
          )
          return
        }

        const resolvedActors =
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
                  console.error(
                    actorError
                  )

                  return [
                    userId,
                    {
                      user_id:
                        userId,
                      display_name:
                        'Unknown user',
                      email: null,
                      job_title:
                        null,
                    },
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
                  actor || {
                    user_id:
                      userId,
                    display_name:
                      'Unknown user',
                    email: null,
                    job_title:
                      null,
                  },
                ]
              }
            )
          )

        setActorsById(
          new Map(
            resolvedActors
          )
        )
      },
      []
    )

  const loadEvents =
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
          setEvents([])
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

          const startDate =
            new Date(
              `${workDate}T00:00:00`
            )

          const endDate =
            new Date(
              `${workDate}T00:00:00`
            )

          endDate.setDate(
            endDate.getDate() + 1
          )

          const {
            data,
            error: eventsError,
          } = await supabase
            .from(
              'field_attendance_events'
            )
            .select(`
              id,
              organization_id,
              session_id,
              assignment_id,
              worker_id,
              project_id,
              event_type,
              event_at,
              method,
              source,
              recorded_by,
              notes,
              metadata,
              latitude,
              longitude,
              gps_accuracy_m,
              distance_to_project_m,
              geofence_status,
              created_at
            `)
            .eq(
              'project_id',
              projectId
            )
            .gte(
              'event_at',
              startDate.toISOString()
            )
            .lt(
              'event_at',
              endDate.toISOString()
            )
            .order(
              'event_at',
              {
                ascending: false,
              }
            )

          if (eventsError) {
            throw eventsError
          }

          const loadedEvents =
            data || []

          setEvents(
            loadedEvents
          )

          setExpandedEventId(
            null
          )

          await resolveActors(
            loadedEvents
          )
        } catch (
          loadError
        ) {
          console.error(
            loadError
          )

          setError(
            loadError?.message ||
              'Unable to load attendance audit trail.'
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
            'Unable to initialize Attendance Audit Trail.'
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

    loadEvents(
      selectedProjectId,
      selectedDate
    )
  }, [
    selectedProjectId,
    selectedDate,
    loadEvents,
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

  const filteredEvents =
    useMemo(() => {
      if (
        eventFilter === 'all'
      ) {
        return events
      }

      if (
        eventFilter ===
        'exception_reviewed'
      ) {
        return events.filter(
          (event) =>
            getAuditAction(
              event
            ) ===
            'exception_reviewed'
        )
      }

      if (
        eventFilter ===
        'exception_resolved'
      ) {
        return events.filter(
          (event) =>
            getAuditAction(
              event
            ) ===
            'exception_resolved'
        )
      }

      return events.filter(
        (event) =>
          event.event_type ===
          eventFilter
      )
    }, [
      events,
      eventFilter,
    ])

  const checkInCount =
    useMemo(() => {
      return events.filter(
        (event) =>
          event.event_type ===
          'check_in'
      ).length
    }, [events])

  const checkOutCount =
    useMemo(() => {
      return events.filter(
        (event) =>
          event.event_type ===
          'check_out'
      ).length
    }, [events])

  const correctionCount =
    useMemo(() => {
      return events.filter(
        (event) =>
          event.event_type ===
            'manual_adjustment' &&
          !getAuditAction(event)
      ).length
    }, [events])

  const exceptionAuditCount =
    useMemo(() => {
      return events.filter(
        (event) =>
          [
            'exception_reviewed',
            'exception_resolved',
          ].includes(
            getAuditAction(
              event
            )
          )
      ).length
    }, [events])

  function toggleEvent(
    eventId
  ) {
    setExpandedEventId(
      (currentId) =>
        currentId === eventId
          ? null
          : eventId
    )
  }

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
            justifyContent:
              'space-between',
            alignItems:
              'flex-start',
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
              Attendance Audit Trail
            </h2>

            <p
              style={{
                margin: '8px 0 0',
                maxWidth: '860px',
                color: '#64748b',
                lineHeight: 1.55,
              }}
            >
              Review original attendance
              events, supervisor corrections,
              exception reviews, and final
              resolution decisions in one
              immutable history.
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
              loadEvents(
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
            'minmax(260px, 1fr) minmax(180px, 220px) minmax(200px, 260px)',
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
          label="Event Date"
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
          label="Event Type"
        >
          <select
            value={eventFilter}
            onChange={(event) =>
              setEventFilter(
                event.target.value
              )
            }
            style={inputStyle}
          >
            <option value="all">
              All Events
            </option>

            <option value="check_in">
              Check-In
            </option>

            <option value="check_out">
              Check-Out
            </option>

            <option value="manual_adjustment">
              Manual Adjustment
            </option>

            <option value="exception_reviewed">
              Exception Reviewed
            </option>

            <option value="exception_resolved">
              Exception Resolved
            </option>

            <option value="session_cancelled">
              Session Cancelled
            </option>
          </select>
        </FormField>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 14px',
            border:
              '1px solid #fecaca',
            borderRadius: '10px',
            background: '#fef2f2',
            color: '#991b1b',
            fontSize: '0.84rem',
          }}
        >
          {error}
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
          label="Total Events"
          value={events.length}
        />

        <MetricCard
          label="Check-Ins"
          value={checkInCount}
        />

        <MetricCard
          label="Check-Outs"
          value={checkOutCount}
        />

        <MetricCard
          label="Corrections"
          value={correctionCount}
          tone={
            correctionCount > 0
              ? 'info'
              : 'default'
          }
        />

        <MetricCard
          label="Exception Decisions"
          value={exceptionAuditCount}
          tone={
            exceptionAuditCount > 0
              ? 'review'
              : 'default'
          }
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
            Audit Events
          </h3>
        </div>

        {loading ? (
          <MessageArea>
            Loading Audit Trail...
          </MessageArea>
        ) : filteredEvents.length ===
          0 ? (
          <MessageArea>
            No attendance events
            were found for the
            selected filters.
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
                minWidth: '1400px',
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
                    Time
                  </TableHeader>

                  <TableHeader>
                    Field ID
                  </TableHeader>

                  <TableHeader>
                    Worker
                  </TableHeader>

                  <TableHeader>
                    Event
                  </TableHeader>

                  <TableHeader>
                    Recorded By
                  </TableHeader>

                  <TableHeader>
                    Method
                  </TableHeader>

                  <TableHeader>
                    Source
                  </TableHeader>

                  <TableHeader>
                    Notes
                  </TableHeader>

                  <TableHeader
                    align="right"
                  >
                    Details
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map(
                  (event) => {
                    const worker =
                      workerById.get(
                        event.worker_id
                      )

                    const actor =
                      event.recorded_by
                        ? actorsById.get(
                            event.recorded_by
                          )
                        : null

                    const isExpanded =
                      expandedEventId ===
                      event.id

                    return (
                      <AuditRows
                        key={event.id}
                        event={event}
                        worker={worker}
                        actor={actor}
                        isExpanded={
                          isExpanded
                        }
                        onToggle={() =>
                          toggleEvent(
                            event.id
                          )
                        }
                      />
                    )
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function AuditRows({
  event,
  worker,
  actor,
  isExpanded,
  onToggle,
}) {
  const presentation =
    getEventPresentation(
      event
    )

  return (
    <>
      <tr
        style={{
          borderTop:
            '1px solid #e2e8f0',
        }}
      >
        <TableCell>
          {formatDateTime(
            event.event_at
          )}
        </TableCell>

        <TableCell>
          <span
            style={{
              fontFamily:
                'monospace',
              fontWeight: 700,
            }}
          >
            {worker?.field_id ||
              '—'}
          </span>
        </TableCell>

        <TableCell>
          <strong
            style={{
              color: '#0f172a',
            }}
          >
            {formatWorkerName(
              worker
            )}
          </strong>
        </TableCell>

        <TableCell>
          <EventBadge
            label={
              presentation.label
            }
            tone={
              presentation.tone
            }
          />
        </TableCell>

        <TableCell>
          <ActorIdentity
            actor={actor}
            recordedBy={
              event.recorded_by
            }
          />
        </TableCell>

        <TableCell>
          {formatMethod(
            event.method
          )}
        </TableCell>

        <TableCell>
          {event.source || '—'}
        </TableCell>

        <TableCell>
          <span
            style={{
              display: 'block',
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow:
                'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.notes || '—'}
          </span>
        </TableCell>

        <TableCell
          align="right"
        >
          <button
            type="button"
            onClick={onToggle}
            style={
              secondaryButtonStyle
            }
          >
            {isExpanded
              ? 'Hide Details'
              : 'View Details'}
          </button>
        </TableCell>
      </tr>

      {isExpanded && (
        <tr>
          <td
            colSpan={9}
            style={{
              padding: 0,
              borderTop:
                '1px solid #e2e8f0',
              background:
                '#f8fafc',
            }}
          >
            <EventDetails
              event={event}
              actor={actor}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function ActorIdentity({
  actor,
  recordedBy,
}) {
  if (!recordedBy) {
    return (
      <span
        style={{
          color: '#94a3b8',
        }}
      >
        System / Unknown
      </span>
    )
  }

  if (!actor) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <strong
          style={{
            color: '#475569',
            fontSize: '0.78rem',
          }}
        >
          Unknown user
        </strong>

        <span
          style={{
            color: '#94a3b8',
            fontSize: '0.65rem',
          }}
        >
          Identity unavailable
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        maxWidth: '230px',
      }}
    >
      <strong
        style={{
          color: '#0f172a',
          fontSize: '0.78rem',
          whiteSpace: 'normal',
        }}
      >
        {actor.display_name ||
          actor.email ||
          'Unknown user'}
      </strong>

      {(actor.job_title ||
        actor.email) && (
        <span
          style={{
            color: '#64748b',
            fontSize: '0.66rem',
            lineHeight: 1.35,
            whiteSpace: 'normal',
          }}
        >
          {[
            actor.job_title,
            actor.email,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  )
}

function EventDetails({
  event,
  actor,
}) {
  const {
    before,
    after,
  } = getBeforeAfter(
    event.metadata
  )

  const auditAction =
    getAuditAction(event)

  const isExceptionAudit =
    [
      'exception_reviewed',
      'exception_resolved',
    ].includes(
      auditAction
    )

  const isCorrection =
    event.event_type ===
      'manual_adjustment' &&
    !isExceptionAudit

  if (isExceptionAudit) {
    return (
      <ExceptionAuditDetails
        event={event}
        actor={actor}
        before={before}
        after={after}
      />
    )
  }

  return (
    <div
      style={{
        padding: '18px 22px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(220px, 0.65fr) minmax(0, 1.35fr)',
          gap: '14px',
        }}
      >
        <AccountabilityPanel
          event={event}
          actor={actor}
        />

        <div>
          {isCorrection ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '14px',
              }}
            >
              <AuditPanel
                title="Before"
                data={before}
              />

              <AuditPanel
                title="After"
                data={after}
                tone="after"
              />
            </div>
          ) : (
            <OriginalEventPanel
              event={event}
            />
          )}
        </div>
      </div>

      {isCorrection && (
        <div
          style={{
            marginTop: '14px',
            padding:
              '12px 14px',
            border:
              '1px solid #bae6fd',
            borderRadius:
              '10px',
            background:
              '#f0f9ff',
          }}
        >
          <div
            style={{
              color: '#075985',
              fontSize:
                '0.68rem',
              fontWeight: 800,
              textTransform:
                'uppercase',
              marginBottom:
                '4px',
            }}
          >
            Correction Reason
          </div>

          <div
            style={{
              color: '#0c4a6e',
              fontSize:
                '0.82rem',
            }}
          >
            {event.notes ||
              event.metadata
                ?.correction_reason ||
              '—'}
          </div>
        </div>
      )}
    </div>
  )
}

function ExceptionAuditDetails({
  event,
  actor,
  before,
  after,
}) {
  const auditAction =
    getAuditAction(event)

  const resolutionAction =
    formatResolutionAction(
      event.metadata
        ?.resolution_action
    )

  const reviewed =
    auditAction ===
    'exception_reviewed'

  return (
    <div
      style={{
        padding: '18px 22px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(220px, 0.65fr) minmax(0, 1.35fr)',
          gap: '14px',
        }}
      >
        <AccountabilityPanel
          event={event}
          actor={actor}
        />

        <div
          style={{
            display: 'grid',
            gap: '14px',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              border: reviewed
                ? '1px solid #bae6fd'
                : '1px solid #bbf7d0',
              borderRadius: '10px',
              background: reviewed
                ? '#f0f9ff'
                : '#f0fdf4',
            }}
          >
            <div
              style={{
                marginBottom: '12px',
                color: reviewed
                  ? '#075985'
                  : '#166534',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform:
                  'uppercase',
                letterSpacing:
                  '0.05em',
              }}
            >
              {reviewed
                ? 'Exception Review'
                : 'Exception Resolution'}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '12px',
              }}
            >
              <AuditValue
                label="Exception Code"
                value={
                  event.metadata
                    ?.exception_code ||
                  '—'
                }
              />

              <AuditValue
                label="Decision"
                value={
                  resolutionAction ||
                  (
                    reviewed
                      ? 'Under Review'
                      : '—'
                  )
                }
              />

              <AuditValue
                label="Exception Notes"
                value={
                  event.metadata
                    ?.exception_notes ||
                  '—'
                }
              />

              <AuditValue
                label="Action Notes"
                value={
                  event.notes ||
                  after
                    ?.resolution_notes ||
                  '—'
                }
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: '14px',
            }}
          >
            <ResolutionStatePanel
              title="Before"
              data={before}
            />

            <ResolutionStatePanel
              title="After"
              data={after}
              tone="after"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function AccountabilityPanel({
  event,
  actor,
}) {
  return (
    <div
      style={{
        padding:
          '14px 16px',
        border:
          '1px solid #e2e8f0',
        borderRadius:
          '10px',
        background:
          '#ffffff',
      }}
    >
      <div
        style={{
          marginBottom:
            '12px',
          color: '#475569',
          fontSize:
            '0.72rem',
          fontWeight: 800,
          textTransform:
            'uppercase',
          letterSpacing:
            '0.05em',
        }}
      >
        Event Accountability
      </div>

      <AuditValue
        label="Recorded By"
        value={
          actor?.display_name ||
          actor?.email ||
          (
            event.recorded_by
              ? 'Unknown user'
              : 'System / Unknown'
          )
        }
      />

      <div
        style={{
          height: '9px',
        }}
      />

      <AuditValue
        label="Job Title"
        value={
          actor?.job_title ||
          '—'
        }
      />

      <div
        style={{
          height: '9px',
        }}
      />

      <AuditValue
        label="Account"
        value={
          actor?.email ||
          '—'
        }
      />

      <div
        style={{
          height: '9px',
        }}
      />

      <AuditValue
        label="Event Time"
        value={formatDateTime(
          event.event_at
        )}
      />
    </div>
  )
}

function OriginalEventPanel({
  event,
}) {
  const hasLocationEvidence =
    event.latitude !== null &&
    event.latitude !== undefined

  return (
    <div
      style={{
        height: '100%',
        padding:
          '14px 16px',
        border:
          '1px solid #e2e8f0',
        borderRadius:
          '10px',
        background:
          '#ffffff',
      }}
    >
      <strong
        style={{
          color: '#0f172a',
        }}
      >
        Original Attendance Event
      </strong>

      <p
        style={{
          margin:
            '8px 0 14px',
          color: '#64748b',
          fontSize:
            '0.8rem',
          lineHeight: 1.5,
        }}
      >
        This event is part of
        the original immutable
        attendance audit trail.
      </p>

      {hasLocationEvidence && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0, 1fr))',
            gap: '10px',
          }}
        >
          <AuditValue
            label="Geofence Status"
            value={
              event.geofence_status ||
              '—'
            }
          />

          <AuditValue
            label="Distance to Project"
            value={
              event.distance_to_project_m ===
                null ||
              event.distance_to_project_m ===
                undefined
                ? '—'
                : `${Number(
                    event.distance_to_project_m
                  ).toFixed(1)} m`
            }
          />

          <AuditValue
            label="GPS Accuracy"
            value={
              event.gps_accuracy_m ===
                null ||
              event.gps_accuracy_m ===
                undefined
                ? '—'
                : `${Number(
                    event.gps_accuracy_m
                  ).toFixed(0)} m`
            }
          />

          <AuditValue
            label="Coordinates"
            value={
              event.latitude !==
                null &&
              event.longitude !==
                null
                ? `${Number(
                    event.latitude
                  ).toFixed(
                    6
                  )}, ${Number(
                    event.longitude
                  ).toFixed(6)}`
                : '—'
            }
          />
        </div>
      )}
    </div>
  )
}

function ResolutionStatePanel({
  title,
  data,
  tone = 'before',
}) {
  const isAfter =
    tone === 'after'

  return (
    <div
      style={{
        padding: '14px 16px',
        border: `1px solid ${
          isAfter
            ? '#bae6fd'
            : '#e2e8f0'
        }`,
        borderRadius: '10px',
        background:
          isAfter
            ? '#f8fcff'
            : '#ffffff',
      }}
    >
      <div
        style={{
          marginBottom: '12px',
          color:
            isAfter
              ? '#0369a1'
              : '#475569',
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform:
            'uppercase',
          letterSpacing:
            '0.05em',
        }}
      >
        {title}
      </div>

      {!data ? (
        <span
          style={{
            color: '#94a3b8',
            fontSize: '0.8rem',
          }}
        >
          No values available.
        </span>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '9px',
          }}
        >
          <AuditValue
            label="Resolution Status"
            value={renderMetadataValue(
              data.resolution_status
            )}
          />

          <AuditValue
            label="Resolution Action"
            value={
              formatResolutionAction(
                data.resolution_action
              ) ||
              '—'
            }
          />

          <AuditValue
            label="Resolution Notes"
            value={renderMetadataValue(
              data.resolution_notes
            )}
          />

          <AuditValue
            label="Resolved At"
            value={renderMetadataValue(
              data.resolved_at
            )}
          />
        </div>
      )}
    </div>
  )
}

function AuditPanel({
  title,
  data,
  tone = 'before',
}) {
  const isAfter =
    tone === 'after'

  return (
    <div
      style={{
        padding: '14px 16px',
        border: `1px solid ${
          isAfter
            ? '#bae6fd'
            : '#e2e8f0'
        }`,
        borderRadius: '10px',
        background:
          isAfter
            ? '#f0f9ff'
            : '#ffffff',
      }}
    >
      <div
        style={{
          marginBottom: '12px',
          color:
            isAfter
              ? '#0369a1'
              : '#475569',
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform:
            'uppercase',
          letterSpacing:
            '0.05em',
        }}
      >
        {title}
      </div>

      {!data ? (
        <span
          style={{
            color: '#94a3b8',
            fontSize: '0.8rem',
          }}
        >
          No values available.
        </span>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '9px',
          }}
        >
          <AuditValue
            label="Check-In"
            value={formatDateTime(
              data.check_in_at
            )}
          />

          <AuditValue
            label="Check-Out"
            value={formatDateTime(
              data.check_out_at
            )}
          />

          <AuditValue
            label="Work Date"
            value={
              data.work_date ||
              '—'
            }
          />

          <AuditValue
            label="Status"
            value={
              data.status ||
              '—'
            }
          />

          <AuditValue
            label="Worked Minutes"
            value={
              data.worked_minutes ??
              '—'
            }
          />
        </div>
      )}
    </div>
  )
}

function AuditValue({
  label,
  value,
}) {
  return (
    <div>
      <div
        style={{
          color: '#94a3b8',
          fontSize: '0.64rem',
          fontWeight: 800,
          textTransform:
            'uppercase',
          marginBottom: '2px',
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: '#334155',
          fontSize: '0.8rem',
          fontWeight: 700,
          overflowWrap:
            'anywhere',
          whiteSpace: 'normal',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function EventBadge({
  label,
  tone,
}) {
  const map = {
    check_in: {
      background: '#f0fdf4',
      border: '#bbf7d0',
      color: '#166534',
    },

    check_out: {
      background: '#f8fafc',
      border: '#cbd5e1',
      color: '#475569',
    },

    manual_adjustment: {
      background: '#f0f9ff',
      border: '#bae6fd',
      color: '#0369a1',
    },

    session_cancelled: {
      background: '#fef2f2',
      border: '#fecaca',
      color: '#b91c1c',
    },

    review: {
      background: '#f0f9ff',
      border: '#bae6fd',
      color: '#075985',
    },

    resolution: {
      background: '#f0fdf4',
      border: '#bbf7d0',
      color: '#166534',
    },
  }

  const visual =
    map[tone] || {
      background: '#f8fafc',
      border: '#e2e8f0',
      color: '#475569',
    }

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
        whiteSpace: 'nowrap',
      }}
    >
      {label}
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

    info: {
      border: '#bae6fd',
      background: '#f0f9ff',
      value: '#0369a1',
    },

    review: {
      border: '#bbf7d0',
      background: '#f0fdf4',
      value: '#166534',
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

function TableHeader({
  children,
  align = 'left',
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
        textAlign: align,
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
  align = 'left',
}) {
  return (
    <td
      style={{
        padding: '13px 14px',
        color: '#475569',
        fontSize: '0.82rem',
        textAlign: align,
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

const secondaryButtonStyle = {
  minHeight: '36px',
  padding: '0 12px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#082a4a',
  cursor: 'pointer',
  fontWeight: 750,
}
