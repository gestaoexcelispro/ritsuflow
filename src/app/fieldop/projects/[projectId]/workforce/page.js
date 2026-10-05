'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase'
import WorkforceFrame, { localDateKey, useWorkforceFormat } from './WorkforceFrame'

function deviceLocation() {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) return resolve({ latitude: null, longitude: null, accuracy: null, available: false })
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, available: true }),
      () => resolve({ latitude: null, longitude: null, accuracy: null, available: false }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}

// Stored with the attendance event; kept in one language so the record reads the same for everyone.
const LOCATION_UNAVAILABLE_NOTE = 'Device location unavailable'

export default function FieldOpProjectWorkforcePage() {
  const { projectId } = useParams()
  const f = useWorkforceFormat()
  const { t } = f
  const [project, setProject] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [workers, setWorkers] = useState([])
  const [companies, setCompanies] = useState([])
  const [trades, setTrades] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    if (!projectId) return
    setError('')
    const today = localDateKey()
    const [p, a, w, c, tr, s] = await Promise.all([
      supabase.from('projects').select('id,code,name,standard_daily_minutes,geofence_enabled,geofence_radius_m,max_gps_accuracy_m').eq('id', projectId).maybeSingle(),
      supabase.from('field_project_assignments').select('*').eq('project_id', projectId).eq('status', 'active').order('start_date'),
      supabase.from('field_workers').select('id,field_id,company_employee_number,first_name,middle_name,last_name'),
      supabase.from('field_companies').select('id,name'),
      supabase.from('field_trades').select('id,name'),
      // Today's sessions plus any session still open from an earlier day (a forgotten check-out).
      supabase.from('field_attendance_sessions').select('*').eq('project_id', projectId).or(`work_date.eq.${today},status.eq.open`).order('check_in_at', { ascending: false }),
    ])
    const failure = [p, a, w, c, tr, s].find((result) => result.error)
    if (failure?.error) throw failure.error
    setProject(p.data || null)
    setAssignments(a.data || [])
    setWorkers(w.data || [])
    setCompanies(c.data || [])
    setTrades(tr.data || [])
    setSessions(s.data || [])
    setNow(Date.now())
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    load().catch((e) => setError(e?.message || t('live.errLoad'))).finally(() => setLoading(false))
  }, [load, t])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const workerMap = useMemo(() => new Map(workers.map((x) => [x.id, x])), [workers])
  const companyMap = useMemo(() => new Map(companies.map((x) => [x.id, x])), [companies])
  const tradeMap = useMemo(() => new Map(trades.map((x) => [x.id, x])), [trades])
  const openMap = useMemo(() => {
    const map = new Map()
    sessions.filter((s) => s.status === 'open').forEach((s) => { if (!map.has(s.worker_id)) map.set(s.worker_id, s) })
    return map
  }, [sessions])

  const rows = useMemo(() => {
    const today = localDateKey(new Date(now))
    const midnight = new Date(`${today}T00:00:00`).getTime()
    return assignments.map((assignment) => {
      const open = openMap.get(assignment.worker_id)
      const closedToday = sessions.filter((s) => s.worker_id === assignment.worker_id && s.status !== 'open' && s.work_date === today)
      const closedMinutes = closedToday.reduce((sum, s) => sum + (Number(s.worked_minutes) || 0), 0)
      const checkInAt = open?.check_in_at ? new Date(open.check_in_at).getTime() : null
      const currentMinutes = checkInAt ? Math.max(0, Math.floor((now - checkInAt) / 60000)) : 0
      // Only the part of an open session that falls on today counts as "worked today".
      const todayMinutes = checkInAt ? Math.max(0, Math.floor((now - Math.max(checkInAt, midnight)) / 60000)) : 0
      return {
        assignment,
        worker: workerMap.get(assignment.worker_id),
        company: companyMap.get(assignment.company_id),
        trade: tradeMap.get(assignment.trade_id),
        open,
        openFromEarlierDay: Boolean(open && open.work_date !== today),
        worked: closedMinutes + todayMinutes,
        currentMinutes,
        lastCheckIn: open?.check_in_at || closedToday[0]?.check_in_at || null,
      }
    }).sort((a, b) => f.workerName(a.worker).localeCompare(f.workerName(b.worker)))
  }, [assignments, openMap, sessions, workerMap, companyMap, tradeMap, now, f])

  async function checkIn(assignment) {
    setProcessing(assignment.id); setError(''); setMessage(t('live.capturing'))
    try {
      const location = await deviceLocation()
      const { error: rpcError } = await supabase.rpc('field_worker_check_in', { p_assignment_id: assignment.id, p_method: 'supervisor', p_latitude: location.latitude, p_longitude: location.longitude, p_gps_accuracy_m: location.accuracy, p_notes: location.available ? null : LOCATION_UNAVAILABLE_NOTE })
      if (rpcError) throw rpcError
      setMessage(t('live.checkedIn', { name: f.workerName(workerMap.get(assignment.worker_id)) }))
      await load()
    } catch (e) { setError(e?.message || t('live.errCheckIn')); setMessage('') }
    finally { setProcessing(null) }
  }

  async function checkOut(session) {
    setProcessing(session.id); setError(''); setMessage(t('live.capturing'))
    try {
      const location = await deviceLocation()
      const { error: rpcError } = await supabase.rpc('field_worker_check_out', { p_session_id: session.id, p_method: 'supervisor', p_latitude: location.latitude, p_longitude: location.longitude, p_gps_accuracy_m: location.accuracy, p_notes: location.available ? null : LOCATION_UNAVAILABLE_NOTE })
      if (rpcError) throw rpcError
      setMessage(t('live.checkedOut', { name: f.workerName(workerMap.get(session.worker_id)) }))
      await load()
    } catch (e) { setError(e?.message || t('live.errCheckOut')); setMessage('') }
    finally { setProcessing(null) }
  }

  const today = localDateKey(new Date(now))
  const allowed = project?.standard_daily_minutes ?? null
  const onSite = rows.filter((r) => r.open).length
  const checkedOut = new Set(sessions.filter((s) => s.status !== 'open' && s.work_date === today).map((s) => s.worker_id)).size
  const over = allowed === null ? 0 : rows.filter((r) => r.worked > Number(allowed)).length
  const columns = [t('col.fieldId'), t('col.worker'), t('col.company'), t('col.trade'), t('col.status'), t('col.checkIn'), t('live.colCurrent'), t('live.colWorked'), t('col.action')]

  return <WorkforceFrame projectId={projectId} active="live">
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => load().catch((e) => setError(e.message))} style={button(false)}>{t('common.refresh')}</button></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
      <Metric label={t('live.metricActive')} value={rows.length} />
      <Metric label={t('live.metricOnSite')} value={onSite} />
      <Metric label={t('live.metricCheckedOut')} value={checkedOut} />
      <Metric label={t('live.metricOver')} value={over} />
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 16, border: '1px solid var(--fo-line)', borderRadius: 12, background: '#fff' }}>
      <Info label={t('common.project')} value={project?.name || project?.code || '—'} />
      <Info label={t('live.infoDaily')} value={allowed === null ? t('common.notConfigured') : f.minutes(allowed)} />
      <Info label={t('live.infoGeofence')} value={project?.geofence_enabled ? t('live.geofenceOn', { radius: project?.geofence_radius_m || '—' }) : t('live.geofenceOff')} />
      <Info label={t('live.infoGps')} value={project?.max_gps_accuracy_m == null ? t('common.notConfigured') : `${project.max_gps_accuracy_m} m`} />
    </div>
    {error && <div style={{ padding: 12, border: '1px solid transparent', borderRadius: 9, background: 'var(--fo-bad-wash)', color: 'var(--fo-bad)' }}>{error}</div>}
    {message && <div style={{ padding: 12, border: '1px solid #bae6fd', borderRadius: 9, background: '#f0f9ff', color: '#075985' }}>{message}</div>}
    <section style={{ overflow: 'hidden', border: '1px solid var(--fo-line)', borderRadius: 14, background: '#fff' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--fo-line)' }}><strong>{t('live.tableTitle')}</strong></div>
      {loading
        ? <div style={empty}>{t('live.loading')}</div>
        : rows.length === 0
          ? <div style={empty}>{t('live.empty')}</div>
          : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--fo-sunken)' }}>{columns.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.assignment.id} style={{ borderTop: '1px solid var(--fo-line)' }}>
              <td style={td}>{row.worker?.field_id || row.worker?.company_employee_number || '—'}</td>
              <td style={td}><strong>{f.workerName(row.worker)}</strong></td>
              <td style={td}>{row.company?.name || '—'}</td>
              <td style={td}>{row.trade?.name || '—'}</td>
              <td style={td}><span style={{ fontWeight: 800, color: row.open ? '#047857' : 'var(--fo-muted)' }}>{row.open ? t('live.onSite') : t('live.offSite')}</span></td>
              <td style={td}>{row.openFromEarlierDay
                ? <span style={{ color: 'var(--fo-warn)', fontWeight: 700 }}>{f.time(row.lastCheckIn)} · {t('live.openSince', { date: f.date(row.open.work_date) })}</span>
                : f.time(row.lastCheckIn)}</td>
              <td style={td}>{row.open ? f.minutes(row.currentMinutes) : '—'}</td>
              <td style={td}><strong>{f.minutes(row.worked)}</strong></td>
              <td style={td}>{row.open
                ? <button disabled={processing === row.open.id} onClick={() => checkOut(row.open)} style={button(false)}>{processing === row.open.id ? t('live.checkingOut') : t('live.checkOut')}</button>
                : <button disabled={processing === row.assignment.id} onClick={() => checkIn(row.assignment)} style={button(true)}>{processing === row.assignment.id ? t('live.checkingIn') : t('live.checkIn')}</button>}</td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  </WorkforceFrame>
}

const th = { padding: '11px 14px', color: 'var(--fo-muted)', fontSize: 13, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }
const td = { padding: '13px 14px', color: 'var(--fo-ink)', fontSize: 15, whiteSpace: 'nowrap' }
const empty = { padding: 36, color: 'var(--fo-muted)', textAlign: 'center' }
function button(primary) { return { minHeight: 38, padding: '0 14px', border: `1px solid ${primary ? '#078c7c' : 'var(--fo-line)'}`, borderRadius: 9, background: primary ? '#08aa96' : '#fff', color: primary ? '#fff' : 'var(--fo-navy)', fontWeight: 800, cursor: 'pointer' } }
function Metric({ label, value }) { return <div style={{ padding: 17, border: '1px solid var(--fo-line)', borderRadius: 12, background: '#fff' }}><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fo-muted)' }}>{label}</div><div style={{ marginTop: 6, fontSize: 24, fontWeight: 850, color: '#061b2f' }}>{value}</div></div> }
function Info({ label, value }) { return <div style={{ minWidth: 180, flex: '1 1 180px' }}><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fo-muted)' }}>{label}</div><div style={{ marginTop: 5, fontWeight: 750, color: '#334155' }}>{value}</div></div> }
