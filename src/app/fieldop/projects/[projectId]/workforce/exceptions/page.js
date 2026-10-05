'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../../lib/supabase/client'
import WorkforceFrame, { localDateKey, useWorkforceFormat } from '../WorkforceFrame'

const supabase = createClient()
const LONG_OPEN_SESSION_MINUTES = 720
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }
const openMinutes = (session, now) => (session?.check_in_at ? Math.max(0, Math.floor((now - new Date(session.check_in_at).getTime()) / 60000)) : 0)

export default function FieldOpProjectWorkforceExceptionsPage() {
  const { projectId } = useParams()
  const f = useWorkforceFormat()
  const { t } = f
  const [project, setProject] = useState(null)
  const [workers, setWorkers] = useState([])
  const [sessions, setSessions] = useState([])
  const [actors, setActors] = useState(new Map())
  const [date, setDate] = useState(localDateKey())
  const [queue, setQueue] = useState('open')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [evidence, setEvidence] = useState([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const resolveActors = useCallback(async (list) => {
    const ids = [...new Set(list.map((s) => s.exception_resolved_by).filter(Boolean))]
    if (!ids.length) { setActors(new Map()); return }
    const rows = await Promise.all(ids.map(async (id) => {
      const { data } = await supabase.rpc('field_resolve_attendance_actor', { p_user_id: id })
      return [id, Array.isArray(data) ? data[0] : data]
    }))
    setActors(new Map(rows))
  }, [])

  const load = useCallback(async (show = false) => {
    if (!projectId || !date) return
    if (show) setRefreshing(true)
    try {
      setError('')
      const [p, w, s] = await Promise.all([
        supabase.from('projects').select('id,code,name,standard_daily_minutes,geofence_radius_m,geofence_enabled,max_gps_accuracy_m').eq('id', projectId).maybeSingle(),
        supabase.from('field_workers').select('id,field_id,first_name,middle_name,last_name,status').order('field_id'),
        supabase.from('field_attendance_sessions').select('id,worker_id,project_id,work_date,check_in_at,check_out_at,status,worked_minutes,has_exception,exception_code,exception_notes,exception_resolution_status,exception_resolution_action,exception_resolution_notes,exception_resolved_by,exception_resolved_at').eq('project_id', projectId).eq('work_date', date).order('check_in_at'),
      ])
      if (p.error) throw p.error
      if (w.error) throw w.error
      if (s.error) throw s.error
      setProject(p.data || null); setWorkers(w.data || []); setSessions(s.data || [])
      await resolveActors(s.data || [])
      setNow(Date.now())
    } catch (e) { setError(e?.message || t('exceptions.errLoad')) }
    finally { setLoading(false); if (show) setRefreshing(false) }
  }, [projectId, date, resolveActors, t])

  useEffect(() => { setLoading(true); load() }, [load])

  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])
  const groups = useMemo(() => {
    const map = new Map()
    sessions.forEach((s) => map.set(s.worker_id, [...(map.get(s.worker_id) || []), s]))
    return map
  }, [sessions])

  // Exceptions are built from codes; titles and descriptions are translated when shown.
  const exceptions = useMemo(() => {
    const out = []
    const allowed = project?.standard_daily_minutes == null ? null : Number(project.standard_daily_minutes)
    groups.forEach((list, workerId) => {
      const worker = workerMap.get(workerId)
      const closed = list.filter((s) => ['closed', 'corrected'].includes(s.status))
      const opened = list.filter((s) => s.status === 'open')
      const worked = closed.reduce((n, s) => n + Number(s.worked_minutes || 0), 0) + opened.reduce((n, s) => n + openMinutes(s, now), 0)
      if (allowed != null && worked > allowed) {
        const session = list[list.length - 1]
        out.push({ id: `over-${session.id}`, type: 'over_allowed_hours', severity: 'critical', worker, session, minutesValue: worked - allowed, persisted: false })
      }
      opened.forEach((session) => {
        const minutes = openMinutes(session, now)
        out.push({ id: `open-${session.id}`, type: minutes >= LONG_OPEN_SESSION_MINUTES ? 'long_open_session' : 'open_session', severity: minutes >= LONG_OPEN_SESSION_MINUTES ? 'critical' : 'warning', worker, session, minutesValue: minutes, persisted: false })
      })
      list.filter((s) => s.has_exception).forEach((session) => out.push({ id: `recorded-${session.id}`, type: 'recorded_exception', severity: session.exception_code === 'MULTIPLE_ATTENDANCE_EXCEPTIONS' ? 'critical' : 'warning', worker, session, persisted: true }))
    })
    return out.sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || f.workerName(a.worker).localeCompare(f.workerName(b.worker)))
  }, [groups, workerMap, project, now, f])

  const isResolved = (x) => x.persisted && x.session.exception_resolution_status === 'resolved'
  const filtered = useMemo(() => (queue === 'all' ? exceptions : queue === 'resolved' ? exceptions.filter(isResolved) : exceptions.filter((x) => !isResolved(x))), [exceptions, queue])

  function title(x) {
    if (x.type === 'over_allowed_hours') return t('exceptions.overTitle')
    if (x.type === 'long_open_session') return t('exceptions.longTitle')
    if (x.type === 'open_session') return t('exceptions.openTitle')
    return f.label('code', x.session.exception_code, t('code.fallback'))
  }
  function description(x) {
    if (x.type === 'over_allowed_hours') return t('exceptions.overText')
    if (x.type === 'long_open_session') return t('exceptions.longText')
    if (x.type === 'open_session') return t('exceptions.openText')
    return x.session.exception_notes || t('exceptions.recordedText')
  }
  function value(x) {
    if (x.type === 'over_allowed_hours') return `+${f.minutes(x.minutesValue)}`
    if (!x.persisted) return f.minutes(x.minutesValue)
    return isResolved(x) ? t('exceptions.valueResolved') : t('exceptions.valueReview')
  }

  async function openReview(x) {
    if (!x.persisted) return
    setSelected(x); setNotes(x.session.exception_resolution_notes || ''); setEvidence([]); setLoadingEvidence(true)
    try {
      const { data, error: loadError } = await supabase.from('field_attendance_events').select('id,session_id,event_type,event_at,latitude,longitude,gps_accuracy_m,distance_to_project_m,geofence_status,method,source,metadata').eq('session_id', x.session.id).in('event_type', ['check_in', 'check_out']).order('event_at')
      if (loadError) throw loadError
      setEvidence((data || []).filter((e) => e.geofence_status || e.latitude != null || e.longitude != null || e.gps_accuracy_m != null || e.distance_to_project_m != null))
    } catch (e) { setError(e?.message || t('exceptions.errEvidence')) }
    finally { setLoadingEvidence(false) }
  }

  async function markReviewed() {
    if (!selected?.persisted) return
    setProcessing(true)
    try {
      const { error: rpcError } = await supabase.rpc('field_review_attendance_exception', { p_session_id: selected.session.id, p_review_notes: notes.trim() || null })
      if (rpcError) throw rpcError
      const name = f.workerName(selected.worker)
      setSelected(null); await load()
      setSuccess(t('exceptions.reviewedMsg', { name }))
    } catch (e) { setError(e?.message || t('exceptions.errReview')) }
    finally { setProcessing(false) }
  }

  async function resolve(action) {
    if (!selected?.persisted) return
    if (!notes.trim()) return setError(t('exceptions.errNotes'))
    setProcessing(true)
    try {
      const { error: rpcError } = await supabase.rpc('field_resolve_attendance_exception', { p_session_id: selected.session.id, p_resolution_action: action, p_resolution_notes: notes.trim() })
      if (rpcError) throw rpcError
      const name = f.workerName(selected.worker)
      setSelected(null); await load()
      setSuccess(t('exceptions.resolvedMsg', { name, action: f.label('action', action).toLowerCase() }))
    } catch (e) { setError(e?.message || t('exceptions.errResolve')) }
    finally { setProcessing(false) }
  }

  const critical = filtered.filter((x) => x.severity === 'critical').length
  const warnings = filtered.filter((x) => x.severity === 'warning').length
  const open = filtered.filter((x) => x.type === 'open_session' || x.type === 'long_open_session').length
  const recorded = filtered.filter((x) => x.persisted).length
  const resolved = exceptions.filter(isResolved).length
  const columns = [t('exceptions.colSeverity'), t('col.fieldId'), t('col.worker'), t('exceptions.colException'), t('col.checkIn'), t('col.checkOut'), t('exceptions.colValue'), t('exceptions.colDescription'), t('exceptions.colResolution'), t('col.action')]

  return <WorkforceFrame projectId={projectId} active="exceptions">
    <section style={filters}>
      <div><small style={lab}>{t('common.project')}</small><strong style={{ display: 'block', marginTop: 6 }}>{project ? [project.code, project.name].filter(Boolean).join(' · ') : t('common.loadingProject')}</strong></div>
      <label><small style={lab}>{t('common.workDate')}</small><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></label>
      <label><small style={lab}>{t('exceptions.queue')}</small><select value={queue} onChange={(e) => setQueue(e.target.value)} style={input}><option value="open">{t('exceptions.queueOpen')}</option><option value="resolved">{t('exceptions.queueResolved')}</option><option value="all">{t('exceptions.queueAll')}</option></select></label>
      <div><small style={lab}>{t('exceptions.dailyAllowance')}</small><strong style={{ display: 'block', marginTop: 6 }}>{project?.standard_daily_minutes == null ? t('common.notConfigured') : f.minutes(project.standard_daily_minutes)}</strong></div>
      <button onClick={() => load(true)} disabled={refreshing} style={button}>{refreshing ? t('common.refreshing') : t('common.refresh')}</button>
    </section>
    {error && <div style={err}>{error}</div>}
    {success && <div style={ok}>{success}</div>}
    <section style={metrics}>{[[t('exceptions.metricCritical'), critical], [t('exceptions.metricWarnings'), warnings], [t('exceptions.metricOpen'), open], [t('exceptions.metricRecorded'), recorded], [t('exceptions.metricResolved'), resolved]].map(([label, count]) => <article key={label} style={card}><small style={lab}>{label}</small><strong style={{ fontSize: 25 }}>{count}</strong></article>)}</section>
    <section style={box}>
      <h3 style={{ padding: '0 16px' }}>{t('exceptions.title', { count: filtered.length })}</h3>
      {loading
        ? <div style={msg}>{t('exceptions.loading')}</div>
        : !filtered.length
          ? <div style={msg}>{t('exceptions.empty')}</div>
          : <div style={{ overflowX: 'auto' }}><table style={table}>
            <thead><tr>{columns.map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
            <tbody>{filtered.map((x) => <tr key={x.id}>
              <td style={td}><strong style={{ color: x.severity === 'critical' ? 'var(--fo-bad)' : 'var(--fo-warn)' }}>{t(`severity.${x.severity}`)}</strong></td>
              <td style={td}>{x.worker?.field_id || '—'}</td>
              <td style={td}><strong>{f.workerName(x.worker)}</strong></td>
              <td style={td}>{title(x)}</td>
              <td style={td}>{f.time(x.session.check_in_at)}</td>
              <td style={td}>{x.session.check_out_at ? f.time(x.session.check_out_at) : t('common.open')}</td>
              <td style={td}>{value(x)}</td>
              <td style={td}>{description(x)}</td>
              <td style={td}>{x.persisted ? f.label('resolution', x.session.exception_resolution_status || 'open') : t('exceptions.operational')}</td>
              <td style={td}>{x.persisted ? <button onClick={() => openReview(x)} style={button}>{t('exceptions.review')}</button> : t('exceptions.monitor')}</td>
            </tr>)}</tbody>
          </table></div>}
    </section>
    {selected && <div style={overlay}><section style={modal}>
      <h3>{title(selected)}</h3>
      <p><strong>{f.workerName(selected.worker)}</strong> · {selected.worker?.field_id || '—'}</p>
      <p>{description(selected)}</p>
      <div style={evidenceBox}>
        <strong>{t('exceptions.evidence')}</strong>
        {loadingEvidence
          ? <p>{t('exceptions.loadingEvidence')}</p>
          : evidence.length
            ? evidence.map((e) => <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--fo-line)' }}>{f.label('event', e.event_type)} · {f.time(e.event_at)} · {f.label('geofence', e.geofence_status, t('exceptions.noGeofence'))} · {e.distance_to_project_m != null ? `${Math.round(e.distance_to_project_m)} m` : '—'} · GPS ±{e.gps_accuracy_m ?? '—'} m</div>)
            : <p>{t('exceptions.noEvidence')}</p>}
      </div>
      {selected.session.exception_resolved_by && <p><strong>{t('exceptions.resolver')}</strong> {actors.get(selected.session.exception_resolved_by)?.full_name || actors.get(selected.session.exception_resolved_by)?.email || selected.session.exception_resolved_by}</p>}
      <label style={{ display: 'grid', gap: 6 }}><strong>{t('exceptions.notes')}</strong><textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} style={input} /></label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button disabled={processing} onClick={() => setSelected(null)} style={button}>{t('common.cancel')}</button>
        <button disabled={processing} onClick={markReviewed} style={button}>{t('exceptions.markReviewed')}</button>
        <button disabled={processing} onClick={() => resolve('accepted')} style={primary}>{t('exceptions.accept')}</button>
        <button disabled={processing} onClick={() => resolve('rejected')} style={button}>{t('exceptions.reject')}</button>
        <button disabled={processing} onClick={() => resolve('dismissed')} style={button}>{t('exceptions.dismiss')}</button>
      </div>
    </section></div>}
  </WorkforceFrame>
}

const lab = { fontSize: 13, fontWeight: 800, color: 'var(--fo-muted)', letterSpacing: '.06em' }
const input = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--fo-line)', borderRadius: 8, background: '#fff' }
const filters = { display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) 180px 180px 180px auto', gap: 14, alignItems: 'end', padding: 18, border: '1px solid var(--fo-line)', borderRadius: 14, background: '#fff' }
const metrics = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }
const card = { padding: 16, border: '1px solid var(--fo-line)', borderRadius: 12, background: '#fff', display: 'grid', gap: 7 }
const box = { border: '1px solid var(--fo-line)', borderRadius: 14, background: '#fff', overflow: 'hidden' }
const table = { width: '100%', minWidth: 1300, borderCollapse: 'collapse' }
const th = { padding: '11px 12px', textAlign: 'left', fontSize: 13, color: 'var(--fo-muted)', background: 'var(--fo-sunken)' }
const td = { padding: 12, borderTop: '1px solid var(--fo-line)', fontSize: 15, verticalAlign: 'top' }
const button = { padding: '8px 11px', border: '1px solid var(--fo-line)', borderRadius: 8, background: '#fff', fontWeight: 700, cursor: 'pointer' }
const primary = { ...button, background: 'var(--fo-teal)', color: '#04312c', borderColor: 'var(--fo-teal)' }
const msg = { padding: 28, textAlign: 'center', color: 'var(--fo-muted)' }
const err = { padding: 12, border: '1px solid transparent', background: 'var(--fo-bad-wash)', color: 'var(--fo-bad)', borderRadius: 9 }
const ok = { padding: 12, border: '1px solid transparent', background: 'var(--fo-ok-wash)', color: 'var(--fo-ok)', borderRadius: 9 }
const overlay = { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(2,6,23,.55)', display: 'grid', placeItems: 'center', padding: 20 }
const modal = { width: 'min(760px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 14, padding: 22, display: 'grid', gap: 15 }
const evidenceBox = { padding: 14, border: '1px solid var(--fo-line)', borderRadius: 10, background: 'var(--fo-sunken)' }
