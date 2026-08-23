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
  ).format(new Date(value))
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

function formatMinutes(minutes) {
  const numeric = Number(minutes)

  if (!Number.isFinite(numeric)) {
    return '—'
  }

  const total = Math.max(
    0,
    Math.floor(numeric)
  )

  const hours = Math.floor(
    total / 60
  )

  const remainingMinutes =
    total % 60

  return `${hours}h ${String(
    remainingMinutes
  ).padStart(2, '0')}m`
}

function formatVariance(minutes) {
  if (
    minutes === null ||
    minutes === undefined
  ) {
    return '—'
  }

  const numeric = Number(minutes)

  if (!Number.isFinite(numeric)) {
    return '—'
  }

  if (numeric === 0) {
    return '0h 00m'
  }

  if (numeric > 0) {
    return `+${formatMinutes(
      numeric
    )}`
  }

  return `-${formatMinutes(
    Math.abs(numeric)
  )}`
}

function isCompletedSession(session) {
  return (
    session?.status === 'closed' ||
    session?.status === 'corrected'
  )
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    date.getDate()
  ).padStart(2, '0')

  const hours = String(
    date.getHours()
  ).padStart(2, '0')

  const minutes = String(
    date.getMinutes()
  ).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function dateTimeLocalToIso(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date.toISOString()
}

function normalizeTimestamp(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date.getTime()
}

function getTimecardStatus({
  hasOpenSession,
  totalWorkedMinutes,
  allowedMinutes,
}) {
  if (hasOpenSession) {
    return {
      key: 'open',
      label: 'Open Session',
    }
  }

  if (
    allowedMinutes === null ||
    allowedMinutes === undefined
  ) {
    return {
      key: 'not_configured',
      label: 'Not Configured',
    }
  }

  if (
    totalWorkedMinutes >
    allowedMinutes
  ) {
    return {
      key: 'over',
      label: 'Over Allowed',
    }
  }

  return {
    key: 'normal',
    label: 'Within Allowance',
  }
}

export default function AttendanceHistoryPage() {
  const [projects, setProjects] =
    useState([])

  const [workers, setWorkers] =
    useState([])

  const [assignments, setAssignments] =
    useState([])

  const [sessions, setSessions] =
    useState([])

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
    expandedWorkerId,
    setExpandedWorkerId,
  ] = useState(null)

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  const [
    correctionSession,
    setCorrectionSession,
  ] = useState(null)

  const [
    correctionWorker,
    setCorrectionWorker,
  ] = useState(null)

  const [
    correctionCheckIn,
    setCorrectionCheckIn,
  ] = useState('')

  const [
    correctionCheckOut,
    setCorrectionCheckOut,
  ] = useState('')

  const [
    correctionReason,
    setCorrectionReason,
  ] = useState('')

  const [
    savingCorrection,
    setSavingCorrection,
  ] = useState(false)

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
          status,
          standard_daily_minutes
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
          company_employee_number,
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

  const loadHistory =
    useCallback(
      async (
        projectId,
        workDate,
        {
          showRefreshing = false,
          preserveExpandedWorkerId = null,
        } = {}
      ) => {
        if (
          !projectId ||
          !workDate
        ) {
          setAssignments([])
          setSessions([])
          return
        }

        if (showRefreshing) {
          setRefreshing(true)
        }

        try {
          setError('')

          const [
            assignmentsResult,
            sessionsResult,
          ] = await Promise.all([
            supabase
              .from(
                'field_project_assignments'
              )
              .select(`
                id,
                project_id,
                worker_id,
                company_id,
                trade_id,
                role_id,
                crew_id,
                start_date,
                end_date,
                status
              `)
              .eq(
                'project_id',
                projectId
              ),

            supabase
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
              ),
          ])

          if (
            assignmentsResult.error
          ) {
            throw assignmentsResult.error
          }

          if (
            sessionsResult.error
          ) {
            throw sessionsResult.error
          }

          setAssignments(
            assignmentsResult.data ||
              []
          )

          setSessions(
            sessionsResult.data ||
              []
          )

          setExpandedWorkerId(
            preserveExpandedWorkerId
          )
        } catch (
          historyError
        ) {
          console.error(
            historyError
          )

          setError(
            historyError?.message ||
              'Unable to load attendance history.'
          )
        } finally {
          if (showRefreshing) {
            setRefreshing(false)
          }
        }
      },
      []
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
            'Unable to initialize Attendance History.'
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

    loadHistory(
      selectedProjectId,
      selectedDate
    )
  }, [
    selectedProjectId,
    selectedDate,
    loadHistory,
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

  const timecards =
    useMemo(() => {
      const allowedMinutes =
        selectedProject
          ?.standard_daily_minutes ??
        null

      return Array.from(
        sessionsByWorkerId.entries()
      )
        .map(
          ([
            workerId,
            workerSessions,
          ]) => {
            const worker =
              workerById.get(
                workerId
              )

            const sortedSessions =
              [...workerSessions].sort(
                (a, b) =>
                  new Date(
                    a.check_in_at
                  ).getTime() -
                  new Date(
                    b.check_in_at
                  ).getTime()
              )

            const completedSessions =
              sortedSessions.filter(
                isCompletedSession
              )

            const openSessions =
              sortedSessions.filter(
                (session) =>
                  session.status ===
                  'open'
              )

            const totalWorkedMinutes =
              completedSessions.reduce(
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

            const firstCheckIn =
              sortedSessions[0]
                ?.check_in_at ||
              null

            const lastCompletedSession =
              [...completedSessions]
                .reverse()[0] ||
              null

            const lastCheckOut =
              lastCompletedSession
                ?.check_out_at ||
              null

            const varianceMinutes =
              allowedMinutes ===
              null
                ? null
                : totalWorkedMinutes -
                  Number(
                    allowedMinutes
                  )

            const hasException =
              sortedSessions.some(
                (session) =>
                  session.has_exception
              )

            const hasCorrection =
              sortedSessions.some(
                (session) =>
                  session.status ===
                  'corrected'
              )

            const status =
              getTimecardStatus({
                hasOpenSession:
                  openSessions.length >
                  0,

                totalWorkedMinutes,

                allowedMinutes:
                  allowedMinutes ===
                  null
                    ? null
                    : Number(
                        allowedMinutes
                      ),
              })

            return {
              workerId,
              worker,
              sessions:
                sortedSessions,
              sessionCount:
                sortedSessions.length,
              openSessionCount:
                openSessions.length,
              firstCheckIn,
              lastCheckOut,
              totalWorkedMinutes,
              allowedMinutes:
                allowedMinutes ===
                null
                  ? null
                  : Number(
                      allowedMinutes
                    ),
              varianceMinutes,
              hasException,
              hasCorrection,
              status,
            }
          }
        )
        .sort((a, b) =>
          formatWorkerName(
            a.worker
          ).localeCompare(
            formatWorkerName(
              b.worker
            )
          )
        )
    }, [
      sessionsByWorkerId,
      workerById,
      selectedProject,
    ])

  const workersWithAttendance =
    timecards.length

  const totalLaborMinutes =
    useMemo(() => {
      return timecards.reduce(
        (
          total,
          timecard
        ) =>
          total +
          timecard.totalWorkedMinutes,
        0
      )
    }, [timecards])

  const overAllowedCount =
    useMemo(() => {
      return timecards.filter(
        (timecard) =>
          timecard.status.key ===
          'over'
      ).length
    }, [timecards])

  const exceptionCount =
    useMemo(() => {
      return timecards.filter(
        (timecard) =>
          timecard.hasException ||
          timecard.status.key ===
            'open'
      ).length
    }, [timecards])

  function toggleWorker(
    workerId
  ) {
    setExpandedWorkerId(
      (currentWorkerId) =>
        currentWorkerId ===
        workerId
          ? null
          : workerId
    )
  }

  function openCorrection(
    session,
    worker
  ) {
    setError('')
    setSuccess('')

    setCorrectionSession(
      session
    )

    setCorrectionWorker(
      worker
    )

    setCorrectionCheckIn(
      toDateTimeLocalValue(
        session.check_in_at
      )
    )

    setCorrectionCheckOut(
      toDateTimeLocalValue(
        session.check_out_at
      )
    )

    setCorrectionReason('')
  }

  function closeCorrection() {
    if (savingCorrection) {
      return
    }

    setCorrectionSession(null)
    setCorrectionWorker(null)
    setCorrectionCheckIn('')
    setCorrectionCheckOut('')
    setCorrectionReason('')
  }

  async function handleCorrectionSubmit(
    event
  ) {
    event.preventDefault()

    if (!correctionSession) {
      return
    }

    setError('')
    setSuccess('')

    const reason =
      correctionReason.trim()

    if (reason.length < 3) {
      setError(
        'Please enter a correction reason.'
      )
      return
    }

    if (!correctionCheckIn) {
      setError(
        'Check-In time is required.'
      )
      return
    }

    const newCheckInIso =
      dateTimeLocalToIso(
        correctionCheckIn
      )

    const newCheckOutIso =
      correctionCheckOut
        ? dateTimeLocalToIso(
            correctionCheckOut
          )
        : null

    if (!newCheckInIso) {
      setError(
        'The corrected Check-In time is invalid.'
      )
      return
    }

    if (
      correctionCheckOut &&
      !newCheckOutIso
    ) {
      setError(
        'The corrected Check-Out time is invalid.'
      )
      return
    }

    if (
      newCheckOutIso &&
      new Date(
        newCheckOutIso
      ).getTime() <
        new Date(
          newCheckInIso
        ).getTime()
    ) {
      setError(
        'Check-Out cannot occur before Check-In.'
      )
      return
    }

    const originalCheckIn =
      normalizeTimestamp(
        correctionSession.check_in_at
      )

    const originalCheckOut =
      normalizeTimestamp(
        correctionSession.check_out_at
      )

    const newCheckIn =
      normalizeTimestamp(
        newCheckInIso
      )

    const newCheckOut =
      normalizeTimestamp(
        newCheckOutIso
      )

    const checkInChanged =
      newCheckIn !==
      originalCheckIn

    const checkOutChanged =
      newCheckOut !==
      originalCheckOut

    if (
      !checkInChanged &&
      !checkOutChanged
    ) {
      setError(
        'Change at least one timestamp before saving the correction.'
      )
      return
    }

    if (
      !correctionSession.check_out_at &&
      !newCheckOutIso &&
      !checkInChanged
    ) {
      setError(
        'For an open session, add the missing Check-Out time or change the Check-In time.'
      )
      return
    }

    setSavingCorrection(true)

    try {
      const {
        error: correctionError,
      } = await supabase.rpc(
        'field_correct_attendance_session',
        {
          p_session_id:
            correctionSession.id,

          p_new_check_in_at:
            checkInChanged
              ? newCheckInIso
              : null,

          p_new_check_out_at:
            checkOutChanged
              ? newCheckOutIso
              : null,

          p_reason:
            reason,
        }
      )

      if (correctionError) {
        throw correctionError
      }

      const workerId =
        correctionSession.worker_id

      const workerName =
        formatWorkerName(
          correctionWorker
        )

      setCorrectionSession(null)
      setCorrectionWorker(null)
      setCorrectionCheckIn('')
      setCorrectionCheckOut('')
      setCorrectionReason('')

      await loadHistory(
        selectedProjectId,
        selectedDate,
        {
          preserveExpandedWorkerId:
            workerId,
        }
      )

      setSuccess(
        `${workerName}'s attendance session was corrected successfully. The original attendance events were preserved in the audit trail.`
      )
    } catch (
      correctionError
    ) {
      console.error(
        correctionError
      )

      setError(
        correctionError?.message ||
          'Unable to correct the attendance session.'
      )
    } finally {
      setSavingCorrection(false)
    }
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
              Attendance History
            </h2>

            <p
              style={{
                margin: '8px 0 0',
                maxWidth: '820px',
                color: '#64748b',
                lineHeight: 1.55,
              }}
            >
              Review daily
              timecards, individual
              attendance sessions,
              worked time, allowed
              hours, and audited
              supervisor corrections.
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
              loadHistory(
                selectedProjectId,
                selectedDate,
                {
                  showRefreshing:
                    true,
                }
              )
            }
            style={{
              minHeight: '40px',
              padding: '0 15px',
              border:
                '1px solid #cbd5e1',
              borderRadius: '9px',
              background: '#ffffff',
              color: '#082a4a',
              cursor:
                refreshing
                  ? 'wait'
                  : 'pointer',
              fontWeight: 750,
            }}
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
            'minmax(260px, 1fr) minmax(180px, 240px) minmax(180px, 240px)',
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

        <InfoField
          label="Allowed Today"
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
            'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '14px',
        }}
      >
        <MetricCard
          label="Workers With Attendance"
          value={
            workersWithAttendance
          }
        />

        <MetricCard
          label="Labor-Hours"
          value={formatMinutes(
            totalLaborMinutes
          )}
        />

        <MetricCard
          label="Over Allowed"
          value={overAllowedCount}
          tone={
            overAllowedCount > 0
              ? 'danger'
              : 'default'
          }
        />

        <MetricCard
          label="Exceptions"
          value={exceptionCount}
          tone={
            exceptionCount > 0
              ? 'warning'
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
            Daily Timecards
          </h3>
        </div>

        {loading ? (
          <MessageArea>
            Loading Attendance
            History...
          </MessageArea>
        ) : timecards.length ===
          0 ? (
          <MessageArea>
            No attendance records
            were found for this
            project and date.
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
                minWidth: '1200px',
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
                    Field ID
                  </TableHeader>

                  <TableHeader>
                    Worker
                  </TableHeader>

                  <TableHeader>
                    First In
                  </TableHeader>

                  <TableHeader>
                    Last Out
                  </TableHeader>

                  <TableHeader>
                    Sessions
                  </TableHeader>

                  <TableHeader>
                    Worked
                  </TableHeader>

                  <TableHeader>
                    Allowed
                  </TableHeader>

                  <TableHeader>
                    Variance
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader
                    align="right"
                  >
                    Details
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {timecards.map(
                  (timecard) => {
                    const isExpanded =
                      expandedWorkerId ===
                      timecard.workerId

                    return (
                      <TimecardRows
                        key={
                          timecard.workerId
                        }
                        timecard={
                          timecard
                        }
                        isExpanded={
                          isExpanded
                        }
                        onToggle={() =>
                          toggleWorker(
                            timecard.workerId
                          )
                        }
                        onCorrect={
                          openCorrection
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

      {correctionSession && (
        <CorrectionModal
          session={
            correctionSession
          }
          worker={
            correctionWorker
          }
          checkIn={
            correctionCheckIn
          }
          checkOut={
            correctionCheckOut
          }
          reason={
            correctionReason
          }
          saving={
            savingCorrection
          }
          onCheckInChange={
            setCorrectionCheckIn
          }
          onCheckOutChange={
            setCorrectionCheckOut
          }
          onReasonChange={
            setCorrectionReason
          }
          onClose={
            closeCorrection
          }
          onSubmit={
            handleCorrectionSubmit
          }
        />
      )}
    </div>
  )
}

function TimecardRows({
  timecard,
  isExpanded,
  onToggle,
  onCorrect,
}) {
  return (
    <>
      <tr
        style={{
          borderTop:
            '1px solid #e2e8f0',
        }}
      >
        <TableCell>
          <span
            style={{
              fontFamily:
                'monospace',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            {timecard.worker
              ?.field_id ||
              '—'}
          </span>
        </TableCell>

        <TableCell>
          <div
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: '3px',
            }}
          >
            <strong
              style={{
                color: '#0f172a',
              }}
            >
              {formatWorkerName(
                timecard.worker
              )}
            </strong>

            {timecard.hasCorrection && (
              <span
                style={{
                  color: '#0369a1',
                  fontSize:
                    '0.67rem',
                  fontWeight: 700,
                }}
              >
                Corrected record
              </span>
            )}
          </div>
        </TableCell>

        <TableCell>
          {formatTime(
            timecard.firstCheckIn
          )}
        </TableCell>

        <TableCell>
          {timecard.openSessionCount >
          0
            ? 'Open'
            : formatTime(
                timecard.lastCheckOut
              )}
        </TableCell>

        <TableCell>
          {timecard.sessionCount}
        </TableCell>

        <TableCell>
          <strong
            style={{
              color: '#0f172a',
            }}
          >
            {formatMinutes(
              timecard.totalWorkedMinutes
            )}
          </strong>
        </TableCell>

        <TableCell>
          {timecard.allowedMinutes ===
          null
            ? '—'
            : formatMinutes(
                timecard.allowedMinutes
              )}
        </TableCell>

        <TableCell>
          <VarianceValue
            value={
              timecard.varianceMinutes
            }
          />
        </TableCell>

        <TableCell>
          <TimecardStatus
            status={
              timecard.status
            }
            hasException={
              timecard.hasException
            }
          />
        </TableCell>

        <TableCell
          align="right"
        >
          <button
            type="button"
            onClick={onToggle}
            style={secondaryButtonStyle}
          >
            {isExpanded
              ? 'Hide Sessions'
              : 'View Sessions'}
          </button>
        </TableCell>
      </tr>

      {isExpanded && (
        <tr>
          <td
            colSpan={10}
            style={{
              padding: 0,
              background:
                '#f8fafc',
              borderTop:
                '1px solid #e2e8f0',
            }}
          >
            <SessionDetails
              sessions={
                timecard.sessions
              }
              worker={
                timecard.worker
              }
              onCorrect={
                onCorrect
              }
            />
          </td>
        </tr>
      )}
    </>
  )
}

function SessionDetails({
  sessions,
  worker,
  onCorrect,
}) {
  return (
    <div
      style={{
        padding: '18px 22px',
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
        <div
          style={{
            color: '#334155',
            fontSize: '0.78rem',
            fontWeight: 800,
            textTransform:
              'uppercase',
            letterSpacing:
              '0.05em',
          }}
        >
          Attendance Sessions
        </div>

        <div
          style={{
            color: '#64748b',
            fontSize: '0.72rem',
          }}
        >
          Corrections create an
          immutable audit event.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '8px',
        }}
      >
        {sessions.map(
          (
            session,
            index
          ) => {
            const isOpen =
              session.status ===
              'open'

            const isCorrected =
              session.status ===
              'corrected'

            return (
              <div
                key={session.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '60px minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(150px, auto)',
                  gap: '12px',
                  alignItems:
                    'center',
                  padding:
                    '10px 12px',
                  border:
                    isCorrected
                      ? '1px solid #bae6fd'
                      : '1px solid #e2e8f0',
                  borderRadius:
                    '9px',
                  background:
                    isCorrected
                      ? '#f0f9ff'
                      : '#ffffff',
                }}
              >
                <strong
                  style={{
                    color:
                      '#64748b',
                    fontSize:
                      '0.76rem',
                  }}
                >
                  #{index + 1}
                </strong>

                <SessionField
                  label="Check-In"
                  value={formatTime(
                    session.check_in_at
                  )}
                />

                <SessionField
                  label="Check-Out"
                  value={
                    session.check_out_at
                      ? formatTime(
                          session.check_out_at
                        )
                      : 'Open'
                  }
                />

                <SessionField
                  label="Worked"
                  value={
                    isCompletedSession(
                      session
                    )
                      ? formatMinutes(
                          session.worked_minutes ||
                            0
                        )
                      : 'In progress'
                  }
                />

                <SessionStatus
                  status={
                    session.status
                  }
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onCorrect(
                        session,
                        worker
                      )
                    }
                    style={
                      isOpen
                        ? primarySmallButtonStyle
                        : secondarySmallButtonStyle
                    }
                  >
                    {isOpen
                      ? 'Add Check-Out'
                      : 'Correct'}
                  </button>
                </div>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

function CorrectionModal({
  session,
  worker,
  checkIn,
  checkOut,
  reason,
  saving,
  onCheckInChange,
  onCheckOutChange,
  onReasonChange,
  onClose,
  onSubmit,
}) {
  const isOpen =
    session.status === 'open'

  return (
    <div
      role="presentation"
      style={modalOverlayStyle}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-correction-title"
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
              Supervisor Attendance
            </p>

            <h3
              id="attendance-correction-title"
              style={{
                margin: 0,
                color: '#061b2f',
                fontSize:
                  '1.25rem',
              }}
            >
              {isOpen
                ? 'Add Missing Check-Out'
                : 'Correct Attendance Session'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close correction"
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={onSubmit}
        >
          <div
            style={{
              padding:
                '20px 22px',
              display: 'grid',
              gap: '18px',
            }}
          >
            <div
              style={workerSummaryStyle}
            >
              <div>
                <div
                  style={summaryLabelStyle}
                >
                  Worker
                </div>

                <strong
                  style={{
                    color:
                      '#0f172a',
                  }}
                >
                  {formatWorkerName(
                    worker
                  )}
                </strong>
              </div>

              <div>
                <div
                  style={summaryLabelStyle}
                >
                  Field ID
                </div>

                <strong
                  style={{
                    color:
                      '#0f172a',
                    fontFamily:
                      'monospace',
                  }}
                >
                  {worker?.field_id ||
                    '—'}
                </strong>
              </div>

              <div>
                <div
                  style={summaryLabelStyle}
                >
                  Current Status
                </div>

                <SessionStatus
                  status={
                    session.status
                  }
                />
              </div>
            </div>

            <div
              style={{
                padding:
                  '13px 14px',
                border:
                  '1px solid #e2e8f0',
                borderRadius:
                  '10px',
                background:
                  '#f8fafc',
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '12px',
              }}
            >
              <ReadOnlyValue
                label="Original Check-In"
                value={formatDateTime(
                  session.check_in_at
                )}
              />

              <ReadOnlyValue
                label="Original Check-Out"
                value={
                  session.check_out_at
                    ? formatDateTime(
                        session.check_out_at
                      )
                    : 'Missing / Open'
                }
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '14px',
              }}
            >
              <FormField
                label="Corrected Check-In"
              >
                <input
                  type="datetime-local"
                  value={checkIn}
                  onChange={(
                    event
                  ) =>
                    onCheckInChange(
                      event.target.value
                    )
                  }
                  required
                  disabled={saving}
                  style={inputStyle}
                />
              </FormField>

              <FormField
                label={
                  isOpen
                    ? 'Missing Check-Out'
                    : 'Corrected Check-Out'
                }
              >
                <input
                  type="datetime-local"
                  value={checkOut}
                  onChange={(
                    event
                  ) =>
                    onCheckOutChange(
                      event.target.value
                    )
                  }
                  disabled={saving}
                  style={inputStyle}
                />
              </FormField>
            </div>

            <FormField
              label="Reason for Correction"
            >
              <textarea
                value={reason}
                onChange={(
                  event
                ) =>
                  onReasonChange(
                    event.target.value
                  )
                }
                disabled={saving}
                required
                minLength={3}
                rows={4}
                placeholder="Example: Worker forgot to check out at the end of the shift."
                style={{
                  ...inputStyle,
                  minHeight:
                    '100px',
                  padding:
                    '11px 12px',
                  resize:
                    'vertical',
                  fontFamily:
                    'inherit',
                  lineHeight: 1.5,
                }}
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
                color:
                  '#075985',
                fontSize:
                  '0.76rem',
                lineHeight: 1.5,
              }}
            >
              The operational
              timecard will be
              corrected, but the
              original Check-In and
              Check-Out events will
              remain unchanged. A new
              manual adjustment event
              will record the reason
              and the before/after
              values.
            </div>
          </div>

          <div
            style={modalFooterStyle}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={
                secondaryButtonStyle
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                opacity:
                  saving
                    ? 0.7
                    : 1,
                cursor:
                  saving
                    ? 'wait'
                    : 'pointer',
              }}
            >
              {saving
                ? 'Saving Correction...'
                : isOpen
                  ? 'Add Check-Out'
                  : 'Save Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SessionField({
  label,
  value,
}) {
  return (
    <div
      style={{
        minWidth: 0,
      }}
    >
      <div
        style={{
          marginBottom: '2px',
          color: '#94a3b8',
          fontSize: '0.65rem',
          fontWeight: 800,
          textTransform:
            'uppercase',
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: '#334155',
          fontSize: '0.8rem',
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SessionStatus({
  status,
}) {
  const visualMap = {
    open: {
      label: 'Open',
      color: '#92400e',
      background: '#fffbeb',
      border: '#fde68a',
    },

    closed: {
      label: 'Closed',
      color: '#166534',
      background: '#f0fdf4',
      border: '#bbf7d0',
    },

    corrected: {
      label: 'Corrected',
      color: '#0369a1',
      background: '#f0f9ff',
      border: '#bae6fd',
    },

    cancelled: {
      label: 'Cancelled',
      color: '#475569',
      background: '#f8fafc',
      border: '#e2e8f0',
    },
  }

  const visual =
    visualMap[status] || {
      label: status || 'Unknown',
      color: '#475569',
      background: '#f8fafc',
      border: '#e2e8f0',
    }

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
        fontSize: '0.68rem',
        fontWeight: 800,
        textTransform:
          'capitalize',
      }}
    >
      {visual.label}
    </span>
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
          fontSize: '0.82rem',
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function VarianceValue({
  value,
}) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—'
  }

  const over =
    value > 0

  return (
    <strong
      style={{
        color: over
          ? '#b91c1c'
          : '#475569',
      }}
    >
      {formatVariance(value)}
    </strong>
  )
}

function TimecardStatus({
  status,
  hasException,
}) {
  const visualMap = {
    normal: {
      color: '#166534',
      background: '#f0fdf4',
      border: '#bbf7d0',
    },

    over: {
      color: '#b91c1c',
      background: '#fef2f2',
      border: '#fecaca',
    },

    open: {
      color: '#92400e',
      background: '#fffbeb',
      border: '#fde68a',
    },

    not_configured: {
      color: '#475569',
      background: '#f8fafc',
      border: '#e2e8f0',
    },
  }

  const visual =
    visualMap[status.key] ||
    visualMap.not_configured

  return (
    <div
      style={{
        display:
          'inline-flex',
        flexDirection:
          'column',
        gap: '2px',
      }}
    >
      <span
        style={{
          display:
            'inline-flex',
          padding: '5px 8px',
          border: `1px solid ${visual.border}`,
          borderRadius:
            '999px',
          background:
            visual.background,
          color: visual.color,
          fontSize: '0.7rem',
          fontWeight: 800,
        }}
      >
        {status.label}
      </span>

      {hasException && (
        <span
          style={{
            color: '#b91c1c',
            fontSize:
              '0.66rem',
            fontWeight: 700,
          }}
        >
          Exception recorded
        </span>
      )}
    </div>
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

const primaryButtonStyle = {
  minHeight: '40px',
  padding: '0 15px',
  border:
    '1px solid #078c7c',
  borderRadius: '9px',
  background: '#08aa96',
  color: '#ffffff',
  fontWeight: 800,
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

const secondarySmallButtonStyle = {
  minHeight: '34px',
  padding: '0 11px',
  border:
    '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#082a4a',
  cursor: 'pointer',
  fontSize: '0.74rem',
  fontWeight: 800,
  whiteSpace: 'nowrap',
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
  maxWidth: '720px',
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
  gap: '10px',
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

const workerSummaryStyle = {
  display: 'grid',
  gridTemplateColumns:
    'minmax(0, 2fr) minmax(100px, 1fr) minmax(120px, 1fr)',
  gap: '14px',
  padding: '13px 14px',
  border:
    '1px solid #e2e8f0',
  borderRadius: '10px',
  background: '#ffffff',
}

const summaryLabelStyle = {
  marginBottom: '3px',
  color: '#94a3b8',
  fontSize: '0.64rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}
