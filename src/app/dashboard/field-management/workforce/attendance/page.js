'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '../../../../../lib/supabase/client'

const supabase = createClient()

const APPROACHING_LIMIT_MINUTES = 60

function formatWorkerName(worker) {
  if (!worker) {
    return 'Unknown worker'
  }

  const composedName = [
    worker.first_name,
    worker.middle_name,
    worker.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  return (
    composedName ||
    worker.full_name ||
    worker.name ||
    'Unnamed worker'
  )
}

function formatProjectName(project) {
  if (!project) {
    return 'Unknown project'
  }

  if (project.code && project.name) {
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

function formatMinutes(minutes) {
  if (
    minutes === null ||
    minutes === undefined
  ) {
    return '—'
  }

  const total = Math.max(
    0,
    Math.floor(Number(minutes))
  )

  if (!Number.isFinite(total)) {
    return '—'
  }

  const hours = Math.floor(total / 60)
  const remainingMinutes =
    total % 60

  return `${hours}h ${String(
    remainingMinutes
  ).padStart(2, '0')}m`
}

function getTodayKey() {
  const now = new Date()

  const year = now.getFullYear()

  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    now.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function calculateOpenSessionMinutes(
  session,
  currentTime
) {
  if (
    !session ||
    !session.check_in_at
  ) {
    return 0
  }

  const checkInTime =
    new Date(
      session.check_in_at
    ).getTime()

  if (
    !Number.isFinite(checkInTime)
  ) {
    return 0
  }

  const difference =
    currentTime - checkInTime

  if (difference <= 0) {
    return 0
  }

  return Math.floor(
    difference / 60000
  )
}

function getHoursControlStatus(
  workedMinutes,
  allowedMinutes
) {
  if (
    allowedMinutes === null ||
    allowedMinutes === undefined
  ) {
    return {
      key: 'not_configured',
      label: 'Not Configured',
      balanceMinutes: null,
    }
  }

  const worked =
    Number(workedMinutes) || 0

  const allowed =
    Number(allowedMinutes)

  const balance =
    allowed - worked

  if (worked > allowed) {
    return {
      key: 'over',
      label: 'Over Limit',
      balanceMinutes: balance,
    }
  }

  if (
    balance >= 0 &&
    balance <=
      APPROACHING_LIMIT_MINUTES
  ) {
    return {
      key: 'approaching',
      label: 'Approaching Limit',
      balanceMinutes: balance,
    }
  }

  return {
    key: 'normal',
    label: 'Normal',
    balanceMinutes: balance,
  }
}

function formatBalance(
  balanceMinutes
) {
  if (
    balanceMinutes === null ||
    balanceMinutes === undefined
  ) {
    return 'Not configured'
  }

  if (balanceMinutes < 0) {
    return `+${formatMinutes(
      Math.abs(balanceMinutes)
    )} over`
  }

  return `${formatMinutes(
    balanceMinutes
  )} remaining`
}

function getDeviceLocation() {
  return new Promise((resolve) => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      resolve({
        latitude: null,
        longitude: null,
        accuracy: null,
        available: false,
        message:
          'Geolocation is not supported by this device or browser.',
      })

      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
          accuracy:
            position.coords.accuracy,
          available: true,
          message: '',
        })
      },
      (locationError) => {
        const messages = {
          1: 'Location permission was denied.',
          2: 'The device location is currently unavailable.',
          3: 'The location request timed out.',
        }

        resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          available: false,
          message:
            messages[
              locationError?.code
            ] ||
            'The device location could not be captured.',
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    )
  })
}

function formatDistanceMeters(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const distance = Number(value)

  if (!Number.isFinite(distance)) {
    return null
  }

  if (distance < 1000) {
    return `${distance.toFixed(
      distance < 100 ? 1 : 0
    )} m`
  }

  return `${(
    distance / 1000
  ).toFixed(2)} km`
}

function formatGeofenceResult(event) {
  if (!event) {
    return ''
  }

  const distance =
    formatDistanceMeters(
      event.distance_to_project_m
    )

  if (
    event.geofence_status ===
    'inside'
  ) {
    return distance
      ? ` Inside geofence · ${distance} from project.`
      : ' Inside geofence.'
  }

  if (
    event.geofence_status ===
    'outside'
  ) {
    return distance
      ? ` Outside geofence · ${distance} from project.`
      : ' Outside geofence.'
  }

  if (
    event.geofence_status ===
    'uncertain'
  ) {
    return distance
      ? ` Geofence uncertain · ${distance} from project. GPS accuracy overlaps the configured boundary.`
      : ' Geofence uncertain · GPS accuracy overlaps the configured boundary.'
  }

  if (
    event.geofence_status ===
    'unavailable'
  ) {
    return ' Location could not be evaluated.'
  }

  if (
    event.geofence_status ===
    'not_evaluated'
  ) {
    return ' Project geofence is disabled.'
  }

  return ''
}

function formatGpsPolicyResult(event) {
  if (!event) {
    return ''
  }

  const maxGpsAccuracy =
    event?.metadata
      ?.max_gps_accuracy_m ??
    null

  if (
    maxGpsAccuracy === null ||
    maxGpsAccuracy === undefined
  ) {
    return ''
  }

  if (
    event.gps_accuracy_m === null ||
    event.gps_accuracy_m === undefined
  ) {
    return ` GPS accuracy unavailable · project maximum ${maxGpsAccuracy} m.`
  }

  const gpsAccuracy = Number(
    event.gps_accuracy_m
  )

  if (!Number.isFinite(gpsAccuracy)) {
    return ''
  }

  const policyExceeded =
    event?.metadata
      ?.gps_accuracy_policy_exceeded ===
      true ||
    gpsAccuracy >
      Number(maxGpsAccuracy)

  return policyExceeded
    ? ` GPS accuracy ${Math.round(gpsAccuracy)} m · exceeds project maximum of ${maxGpsAccuracy} m.`
    : ` GPS accuracy ${Math.round(gpsAccuracy)} m · within project limit of ${maxGpsAccuracy} m.`
}

export default function AttendancePage() {
  const [projects, setProjects] =
    useState([])

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState('')

  const [assignments, setAssignments] =
    useState([])

  const [workers, setWorkers] =
    useState([])

  const [companies, setCompanies] =
    useState([])

  const [trades, setTrades] =
    useState([])

  const [roles, setRoles] =
    useState([])

  const [sessions, setSessions] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [
    processingAssignmentId,
    setProcessingAssignmentId,
  ] = useState(null)

  const [
    processingSessionId,
    setProcessingSessionId,
  ] = useState(null)

  const [currentTime, setCurrentTime] =
    useState(() => Date.now())

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  const [
    locationNotice,
    setLocationNotice,
  ] = useState('')

  const todayKey = useMemo(
    () => getTodayKey(),
    []
  )

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
        .select(
          `
            id,
            code,
            name,
            status,
            standard_daily_minutes,
            latitude,
            longitude,
            geofence_radius_m,
            geofence_enabled,
            max_gps_accuracy_m
          `
        )
        .order('name')

      if (projectsError) {
        throw projectsError
      }

      const availableProjects =
        data || []

      setProjects(
        availableProjects
      )

      setSelectedProjectId(
        (currentProjectId) => {
          if (
            currentProjectId &&
            availableProjects.some(
              (project) =>
                project.id ===
                currentProjectId
            )
          ) {
            return currentProjectId
          }

          return (
            availableProjects[0]
              ?.id || ''
          )
        }
      )
    }, [])

  const loadReferenceData =
    useCallback(async () => {
      const [
        workersResult,
        companiesResult,
        tradesResult,
        rolesResult,
      ] = await Promise.all([
        supabase
          .from('field_workers')
          .select('*'),

        supabase
          .from('field_companies')
          .select('*'),

        supabase
          .from('field_trades')
          .select('*'),

        supabase
          .from('field_roles')
          .select('*'),
      ])

      if (workersResult.error) {
        throw workersResult.error
      }

      if (companiesResult.error) {
        throw companiesResult.error
      }

      if (tradesResult.error) {
        throw tradesResult.error
      }

      if (rolesResult.error) {
        throw rolesResult.error
      }

      setWorkers(
        workersResult.data || []
      )

      setCompanies(
        companiesResult.data ||
          []
      )

      setTrades(
        tradesResult.data || []
      )

      setRoles(
        rolesResult.data || []
      )
    }, [])

  const loadAttendance =
    useCallback(
      async (
        projectId,
        {
          showRefreshing = false,
        } = {}
      ) => {
        if (!projectId) {
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
              .select('*')
              .eq(
                'project_id',
                projectId
              )
              .eq(
                'status',
                'active'
              )
              .order(
                'start_date'
              ),

            supabase
              .from(
                'field_attendance_sessions'
              )
              .select('*')
              .eq(
                'project_id',
                projectId
              )
              .eq(
                'work_date',
                todayKey
              )
              .order(
                'check_in_at',
                {
                  ascending: false,
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

          setCurrentTime(
            Date.now()
          )
        } catch (loadError) {
          console.error(
            loadError
          )

          setError(
            loadError?.message ||
              'Unable to load attendance data.'
          )
        } finally {
          if (showRefreshing) {
            setRefreshing(false)
          }
        }
      },
      [todayKey]
    )

  useEffect(() => {
    async function initialize() {
      setLoading(true)

      try {
        setError('')

        await Promise.all([
          loadProjects(),
          loadReferenceData(),
        ])
      } catch (
        initializeError
      ) {
        console.error(
          initializeError
        )

        setError(
          initializeError?.message ||
            'Unable to load Attendance.'
        )
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [
    loadProjects,
    loadReferenceData,
  ])

  useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    loadAttendance(
      selectedProjectId
    )
  }, [
    selectedProjectId,
    loadAttendance,
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

  const companyById =
    useMemo(() => {
      return new Map(
        companies.map(
          (company) => [
            company.id,
            company,
          ]
        )
      )
    }, [companies])

  const tradeById =
    useMemo(() => {
      return new Map(
        trades.map(
          (trade) => [
            trade.id,
            trade,
          ]
        )
      )
    }, [trades])

  const roleById =
    useMemo(() => {
      return new Map(
        roles.map(
          (role) => [
            role.id,
            role,
          ]
        )
      )
    }, [roles])

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

  const allowedDailyMinutes =
    useMemo(() => {
      if (
        selectedProject
          ?.standard_daily_minutes ===
          null ||
        selectedProject
          ?.standard_daily_minutes ===
          undefined
      ) {
        return null
      }

      return Number(
        selectedProject
          .standard_daily_minutes
      )
    }, [selectedProject])

  const openSessionByWorkerId =
    useMemo(() => {
      const map = new Map()

      sessions.forEach(
        (session) => {
          if (
            session.status ===
              'open' &&
            !map.has(
              session.worker_id
            )
          ) {
            map.set(
              session.worker_id,
              session
            )
          }
        }
      )

      return map
    }, [sessions])

  const latestClosedSessionByWorkerId =
    useMemo(() => {
      const map = new Map()

      sessions.forEach(
        (session) => {
          if (
            session.status ===
              'closed' &&
            !map.has(
              session.worker_id
            )
          ) {
            map.set(
              session.worker_id,
              session
            )
          }
        }
      )

      return map
    }, [sessions])

  const closedMinutesByWorkerId =
    useMemo(() => {
      const totals = new Map()

      sessions
        .filter(
          (session) =>
            session.status ===
            'closed'
        )
        .forEach(
          (session) => {
            const current =
              totals.get(
                session.worker_id
              ) || 0

            const sessionMinutes =
              Number(
                session.worked_minutes ||
                  0
              )

            totals.set(
              session.worker_id,
              current +
                (Number.isFinite(
                  sessionMinutes
                )
                  ? sessionMinutes
                  : 0)
            )
          }
        )

      return totals
    }, [sessions])

  const boardRows =
    useMemo(() => {
      return assignments
        .map(
          (assignment) => {
            const worker =
              workerById.get(
                assignment.worker_id
              )

            const company =
              companyById.get(
                assignment.company_id
              )

            const trade =
              tradeById.get(
                assignment.trade_id
              )

            const role =
              roleById.get(
                assignment.role_id
              )

            const openSession =
              openSessionByWorkerId.get(
                assignment.worker_id
              )

            const latestClosedSession =
              latestClosedSessionByWorkerId.get(
                assignment.worker_id
              )

            const closedMinutes =
              closedMinutesByWorkerId.get(
                assignment.worker_id
              ) || 0

            const currentSessionMinutes =
              calculateOpenSessionMinutes(
                openSession,
                currentTime
              )

            const totalWorkedMinutes =
              closedMinutes +
              currentSessionMinutes

            const hoursControl =
              getHoursControlStatus(
                totalWorkedMinutes,
                allowedDailyMinutes
              )

            return {
              assignment,
              worker,
              company,
              trade,
              role,
              openSession,
              latestClosedSession,
              currentSessionMinutes,
              totalWorkedMinutes,
              hoursControl,
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
      assignments,
      workerById,
      companyById,
      tradeById,
      roleById,
      openSessionByWorkerId,
      latestClosedSessionByWorkerId,
      closedMinutesByWorkerId,
      currentTime,
      allowedDailyMinutes,
    ])

  const onSiteCount =
    useMemo(() => {
      return boardRows.filter(
        (row) =>
          Boolean(
            row.openSession
          )
      ).length
    }, [boardRows])

  const approachingLimitCount =
    useMemo(() => {
      return boardRows.filter(
        (row) =>
          row.hoursControl.key ===
          'approaching'
      ).length
    }, [boardRows])

  const overLimitCount =
    useMemo(() => {
      return boardRows.filter(
        (row) =>
          row.hoursControl.key ===
          'over'
      ).length
    }, [boardRows])

  const checkedOutCount =
    useMemo(() => {
      return new Set(
        sessions
          .filter(
            (session) =>
              session.status ===
              'closed'
          )
          .map(
            (session) =>
              session.worker_id
          )
      ).size
    }, [sessions])

  async function getLatestAttendanceEvent(
    sessionId,
    eventType
  ) {
    if (!sessionId) {
      return null
    }

    const {
      data,
      error: eventError,
    } = await supabase
      .from(
        'field_attendance_events'
      )
      .select(`
        id,
        event_type,
        latitude,
        longitude,
        gps_accuracy_m,
        distance_to_project_m,
        geofence_status,
        event_at,
        metadata
      `)
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'event_type',
        eventType
      )
      .order(
        'event_at',
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle()

    if (eventError) {
      console.warn(
        'Attendance location result could not be loaded.',
        eventError
      )

      return null
    }

    return data || null
  }

  async function handleCheckIn(
    assignment
  ) {
    if (!assignment?.id) {
      return
    }

    setProcessingAssignmentId(
      assignment.id
    )

    setError('')
    setSuccess('')
    setLocationNotice(
      'Requesting device location...'
    )

    try {
      const location =
        await getDeviceLocation()

      if (location.available) {
        setLocationNotice(
          `Location captured · GPS accuracy approximately ${Math.round(
            location.accuracy || 0
          )} m.`
        )
      } else {
        setLocationNotice(
          `${location.message} Attendance will still be recorded and marked as location unavailable when geofence evaluation is required.`
        )
      }

      const {
        data: checkInData,
        error: checkInError,
      } = await supabase.rpc(
        'field_worker_check_in',
        {
          p_assignment_id:
            assignment.id,

          p_method:
            'supervisor',

          p_latitude:
            location.latitude,

          p_longitude:
            location.longitude,

          p_gps_accuracy_m:
            location.accuracy,

          p_notes:
            location.available
              ? null
              : location.message,
        }
      )

      if (checkInError) {
        throw checkInError
      }

      const createdSession =
        Array.isArray(
          checkInData
        )
          ? checkInData[0]
          : checkInData

      const attendanceEvent =
        await getLatestAttendanceEvent(
          createdSession?.session_id,
          'check_in'
        )

      const worker =
        workerById.get(
          assignment.worker_id
        )

      setSuccess(
        `${formatWorkerName(
          worker
        )} checked in successfully.${formatGeofenceResult(
          attendanceEvent
        )}${formatGpsPolicyResult(
          attendanceEvent
        )}`
      )

      await loadAttendance(
        selectedProjectId
      )
    } catch (checkInError) {
      console.error(
        checkInError
      )

      setError(
        checkInError?.message ||
          'Unable to check worker in.'
      )
    } finally {
      setProcessingAssignmentId(
        null
      )
    }
  }

  async function handleCheckOut(
    session
  ) {
    if (!session?.id) {
      return
    }

    setProcessingSessionId(
      session.id
    )

    setError('')
    setSuccess('')
    setLocationNotice(
      'Requesting device location...'
    )

    try {
      const location =
        await getDeviceLocation()

      if (location.available) {
        setLocationNotice(
          `Location captured · GPS accuracy approximately ${Math.round(
            location.accuracy || 0
          )} m.`
        )
      } else {
        setLocationNotice(
          `${location.message} Attendance will still be recorded and marked as location unavailable when geofence evaluation is required.`
        )
      }

      const {
        data: checkOutData,
        error: checkOutError,
      } = await supabase.rpc(
        'field_worker_check_out',
        {
          p_session_id:
            session.id,

          p_method:
            'supervisor',

          p_latitude:
            location.latitude,

          p_longitude:
            location.longitude,

          p_gps_accuracy_m:
            location.accuracy,

          p_notes:
            location.available
              ? null
              : location.message,
        }
      )

      if (checkOutError) {
        throw checkOutError
      }

      const closedSession =
        Array.isArray(
          checkOutData
        )
          ? checkOutData[0]
          : checkOutData

      const attendanceEvent =
        await getLatestAttendanceEvent(
          closedSession?.session_id ||
            session.id,
          'check_out'
        )

      const worker =
        workerById.get(
          session.worker_id
        )

      setSuccess(
        `${formatWorkerName(
          worker
        )} checked out successfully.${formatGeofenceResult(
          attendanceEvent
        )}${formatGpsPolicyResult(
          attendanceEvent
        )}`
      )

      await loadAttendance(
        selectedProjectId
      )
    } catch (
      checkOutError
    ) {
      console.error(
        checkOutError
      )

      setError(
        checkOutError?.message ||
          'Unable to check worker out.'
      )
    } finally {
      setProcessingSessionId(
        null
      )
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
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
          }}
        >
          Field Management
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
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
              Attendance
            </h2>

            <p
              style={{
                margin: '8px 0 0',
                maxWidth: '820px',
                color: '#64748b',
                lineHeight: 1.55,
              }}
            >
              Monitor check-in,
              check-out, daily worked
              time, and workers
              approaching or exceeding
              their allowed hours.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadAttendance(
                selectedProjectId,
                {
                  showRefreshing:
                    true,
                }
              )
            }
            disabled={
              !selectedProjectId ||
              refreshing
            }
            style={{
              minHeight: '40px',
              padding: '0 15px',
              border:
                '1px solid #cbd5e1',
              borderRadius: '9px',
              color: '#082a4a',
              background: '#ffffff',
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
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          flexWrap: 'wrap',
          padding: '18px',
          border:
            '1px solid #e2e8f0',
          borderRadius: '14px',
          background: '#ffffff',
        }}
      >
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 360px',
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
            Project
          </span>

          <select
            value={
              selectedProjectId
            }
            onChange={(event) =>
              setSelectedProjectId(
                event.target.value
              )
            }
            style={{
              minHeight: '44px',
              width: '100%',
              padding: '0 12px',
              border:
                '1px solid #cbd5e1',
              borderRadius: '9px',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.9rem',
            }}
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
        </label>

        <InfoField
          label="Attendance Date"
          value={new Intl.DateTimeFormat(
            undefined,
            {
              dateStyle: 'medium',
            }
          ).format(new Date())}
        />

        <InfoField
          label="Standard Daily Hours"
          value={
            allowedDailyMinutes ===
            null
              ? 'Not configured'
              : formatMinutes(
                  allowedDailyMinutes
                )
          }
        />

        <InfoField
          label="Attendance Geofence"
          value={
            selectedProject
              ?.geofence_enabled
              ? selectedProject
                  ?.geofence_radius_m
                ? `Enabled · ${selectedProject.geofence_radius_m} m`
                : 'Enabled'
              : 'Disabled'
          }
        />

        <InfoField
          label="Maximum GPS Accuracy"
          value={
            selectedProject
              ?.max_gps_accuracy_m ===
              null ||
            selectedProject
              ?.max_gps_accuracy_m ===
              undefined
              ? 'Not configured'
              : `${selectedProject.max_gps_accuracy_m} m`
          }
        />
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

      {success && (
        <div
          role="status"
          style={{
            padding: '12px 14px',
            border:
              '1px solid #99f6e4',
            borderRadius: '10px',
            background: '#f0fdfa',
            color: '#115e59',
            fontSize: '0.84rem',
          }}
        >
          {success}
        </div>
      )}

      {locationNotice && (
        <div
          style={{
            padding: '11px 14px',
            border:
              '1px solid #bae6fd',
            borderRadius: '10px',
            background: '#f0f9ff',
            color: '#075985',
            fontSize: '0.78rem',
            lineHeight: 1.5,
          }}
        >
          {locationNotice}
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
          label="On Site"
          value={onSiteCount}
        />

        <MetricCard
          label="Approaching Limit"
          value={
            approachingLimitCount
          }
          tone={
            approachingLimitCount >
            0
              ? 'warning'
              : 'default'
          }
        />

        <MetricCard
          label="Over Allowed Hours"
          value={overLimitCount}
          tone={
            overLimitCount > 0
              ? 'danger'
              : 'default'
          }
        />

        <MetricCard
          label="Checked Out Today"
          value={checkedOutCount}
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
            Supervisor Attendance
          </h3>
        </div>

        {loading ? (
          <div
            style={{
              padding: '36px',
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            Loading Attendance...
          </div>
        ) : boardRows.length ===
          0 ? (
          <div
            style={{
              padding: '36px',
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            No active workers are
            assigned to this project.
          </div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '1420px',
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
                    Company
                  </TableHeader>

                  <TableHeader>
                    Trade
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Check-In
                  </TableHeader>

                  <TableHeader>
                    Current Session
                  </TableHeader>

                  <TableHeader>
                    Worked Today
                  </TableHeader>

                  <TableHeader>
                    Allowed Today
                  </TableHeader>

                  <TableHeader>
                    Balance
                  </TableHeader>

                  <TableHeader
                    align="right"
                  >
                    Action
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {boardRows.map(
                  ({
                    assignment,
                    worker,
                    company,
                    trade,
                    openSession,
                    latestClosedSession,
                    currentSessionMinutes,
                    totalWorkedMinutes,
                    hoursControl,
                  }) => {
                    const isOnSite =
                      Boolean(
                        openSession
                      )

                    const currentSession =
                      openSession ||
                      latestClosedSession

                    return (
                      <tr
                        key={
                          assignment.id
                        }
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
                              fontWeight:
                                700,
                            }}
                          >
                            {worker?.field_id ||
                              worker?.employee_number ||
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
                              worker
                            )}
                          </strong>
                        </TableCell>

                        <TableCell>
                          {company?.name ||
                            company?.company_name ||
                            '—'}
                        </TableCell>

                        <TableCell>
                          {trade?.name ||
                            trade?.trade_name ||
                            '—'}
                        </TableCell>

                        <TableCell>
                          <AttendanceStatus
                            isOnSite={
                              isOnSite
                            }
                            hasClosedSession={Boolean(
                              latestClosedSession
                            )}
                          />
                        </TableCell>

                        <TableCell>
                          {formatTime(
                            currentSession?.check_in_at
                          )}
                        </TableCell>

                        <TableCell>
                          {isOnSite
                            ? formatMinutes(
                                currentSessionMinutes
                              )
                            : '—'}
                        </TableCell>

                        <TableCell>
                          <strong
                            style={{
                              color:
                                '#0f172a',
                            }}
                          >
                            {formatMinutes(
                              totalWorkedMinutes
                            )}
                          </strong>
                        </TableCell>

                        <TableCell>
                          {allowedDailyMinutes ===
                          null
                            ? '—'
                            : formatMinutes(
                                allowedDailyMinutes
                              )}
                        </TableCell>

                        <TableCell>
                          <HoursBalance
                            hoursControl={
                              hoursControl
                            }
                          />
                        </TableCell>

                        <TableCell
                          align="right"
                        >
                          {isOnSite ? (
                            <button
                              type="button"
                              disabled={
                                processingSessionId ===
                                openSession.id
                              }
                              onClick={() =>
                                handleCheckOut(
                                  openSession
                                )
                              }
                              style={{
                                minHeight:
                                  '38px',
                                padding:
                                  '0 14px',
                                border:
                                  '1px solid #cbd5e1',
                                borderRadius:
                                  '9px',
                                background:
                                  '#ffffff',
                                color:
                                  '#082a4a',
                                cursor:
                                  processingSessionId ===
                                  openSession.id
                                    ? 'wait'
                                    : 'pointer',
                                fontWeight:
                                  800,
                              }}
                            >
                              {processingSessionId ===
                              openSession.id
                                ? 'Checking Out...'
                                : 'Check Out'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                processingAssignmentId ===
                                assignment.id
                              }
                              onClick={() =>
                                handleCheckIn(
                                  assignment
                                )
                              }
                              style={{
                                minHeight:
                                  '38px',
                                padding:
                                  '0 14px',
                                border:
                                  '1px solid #078c7c',
                                borderRadius:
                                  '9px',
                                background:
                                  '#08aa96',
                                color:
                                  '#ffffff',
                                cursor:
                                  processingAssignmentId ===
                                  assignment.id
                                    ? 'wait'
                                    : 'pointer',
                                fontWeight:
                                  800,
                              }}
                            >
                              {processingAssignmentId ===
                              assignment.id
                                ? 'Checking In...'
                                : 'Check In'}
                            </button>
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

      <p
        style={{
          margin: 0,
          color: '#94a3b8',
          fontSize: '0.72rem',
          lineHeight: 1.5,
        }}
      >
        Approaching Limit currently
        means 60 minutes or less
        remaining. This threshold will
        become configurable in the
        Work Schedule layer.
      </p>
    </div>
  )
}

function InfoField({
  label,
  value,
}) {
  return (
    <div
      style={{
        minWidth: '180px',
      }}
    >
      <div
        style={{
          marginBottom: '7px',
          color: '#334155',
          fontSize: '0.76rem',
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          border:
            '1px solid #e2e8f0',
          borderRadius: '9px',
          background: '#f8fafc',
          color: '#334155',
          fontWeight: 700,
        }}
      >
        {value}
      </div>
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

  const colors =
    tones[tone] ||
    tones.default

  return (
    <div
      style={{
        padding: '17px 18px',
        border: `1px solid ${colors.border}`,
        borderRadius: '13px',
        background:
          colors.background,
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
          color: colors.value,
          fontSize: '1.55rem',
          fontWeight: 850,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function AttendanceStatus({
  isOnSite,
  hasClosedSession,
}) {
  const label =
    isOnSite
      ? 'On Site'
      : hasClosedSession
        ? 'Checked Out'
        : 'Not On Site'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 9px',
        borderRadius: '999px',
        color:
          isOnSite
            ? '#047857'
            : '#475569',
        background:
          isOnSite
            ? '#d1fae5'
            : '#f1f5f9',
        fontSize: '0.72rem',
        fontWeight: 800,
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background:
            isOnSite
              ? '#10b981'
              : '#94a3b8',
        }}
      />

      {label}
    </span>
  )
}

function HoursBalance({
  hoursControl,
}) {
  const stylesByStatus = {
    normal: {
      color: '#166534',
      background: '#f0fdf4',
      border: '#bbf7d0',
    },

    approaching: {
      color: '#92400e',
      background: '#fffbeb',
      border: '#fde68a',
    },

    over: {
      color: '#b91c1c',
      background: '#fef2f2',
      border: '#fecaca',
    },

    not_configured: {
      color: '#475569',
      background: '#f8fafc',
      border: '#e2e8f0',
    },
  }

  const visual =
    stylesByStatus[
      hoursControl.key
    ] ||
    stylesByStatus
      .not_configured

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '2px',
        minWidth: '130px',
        padding: '6px 9px',
        border: `1px solid ${visual.border}`,
        borderRadius: '9px',
        background:
          visual.background,
      }}
    >
      <strong
        style={{
          color: visual.color,
          fontSize: '0.72rem',
        }}
      >
        {hoursControl.label}
      </strong>

      <span
        style={{
          color: visual.color,
          fontSize: '0.7rem',
        }}
      >
        {formatBalance(
          hoursControl.balanceMinutes
        )}
      </span>
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
