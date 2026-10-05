'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../../lib/supabase/client'
import WorkforceFrame, { localDateKey, useWorkforceFormat } from '../WorkforceFrame'

const supabase = createClient()
const DONE = ['closed', 'corrected']

const localValue = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const iso = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function FieldOpProjectTimecardsPage() {
  const { projectId } = useParams()
  const f = useWorkforceFormat()
  const { t } = f
  const [project, setProject] = useState(null)
  const [workers, setWorkers] = useState([])
  const [sessions, setSessions] = useState([])
  const [selectedDate, setSelectedDate] = useState(localDateKey())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [correction, setCorrection] = useState(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (show = false) => {
    if (!projectId || !selectedDate) return
    if (show) setRefreshing(true)
    try {
      setError('')
      const [p, w, s] = await Promise.all([
        supabase.from('projects').select('id,code,name,status,standard_daily_minutes').eq('id', projectId).maybeSingle(),
        supabase.from('field_workers').select('id,field_id,company_employee_number,first_name,middle_name,last_name,status').order('field_id'),
        supabase.from('field_attendance_sessions').select('id,worker_id,project_id,work_date,check_in_at,check_out_at,status,worked_minutes,has_exception,exception_code,exception_notes').eq('project_id', projectId).eq('work_date', selectedDate).order('check_in_at'),
      ])
      if (p.error) throw p.error
      if (w.error) throw w.error
      if (s.error) throw s.error
      setProject(p.data || null); setWorkers(w.data || []); setSessions(s.data || [])
    } catch (e) { setError(e?.message || t('timecards.errLoad')) }
    finally { setLoading(false); if (show) setRefreshing(false) }
  }, [projectId, selectedDate, t])

  useEffect(() => { setLoading(true); load() }, [load])

  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])
  const cards = useMemo(() => {
    const groups = new Map()
    sessions.forEach((s) => groups.set(s.worker_id, [...(groups.get(s.worker_id) || []), s]))
    const allowed = project?.standard_daily_minutes ?? null
    return [...groups].map(([workerId, list]) => {
      const sorted = [...list].sort((a, b) => new Date(a.check_in_at) - new Date(b.check_in_at))
      const completed = sorted.filter((s) => DONE.includes(s.status))
      const open = sorted.filter((s) => s.status === 'open')
      const worked = completed.reduce((n, s) => n + Number(s.worked_minutes || 0), 0)
      return {
        workerId,
        worker: workerMap.get(workerId),
        sessions: sorted,
        first: sorted[0]?.check_in_at,
        last: [...completed].reverse()[0]?.check_out_at || null,
        worked,
        allowed: allowed == null ? null : Number(allowed),
        variance: allowed == null ? null : worked - Number(allowed),
        open: open.length,
        exception: sorted.some((s) => s.has_exception),
      }
    }).sort((a, b) => f.workerName(a.worker).localeCompare(f.workerName(b.worker)))
  }, [sessions, project, workerMap, f])

  const total = cards.reduce((n, c) => n + c.worked, 0)
  const over = cards.filter((c) => c.variance > 0).length
  const exceptions = cards.filter((c) => c.exception || c.open).length

  function openCorrection(session, worker) {
    setError(''); setSuccess('')
    setCorrection({ session, worker })
    setCheckIn(localValue(session.check_in_at)); setCheckOut(localValue(session.check_out_at)); setReason('')
  }

  async function saveCorrection(event) {
    event.preventDefault()
    const session = correction?.session
    if (!session) return
    const why = reason.trim()
    const cin = iso(checkIn)
    const cout = checkOut ? iso(checkOut) : null
    if (why.length < 3) return setError(t('timecards.errReason'))
    if (!cin) return setError(t('timecards.errIn'))
    if (cout && new Date(cout) < new Date(cin)) return setError(t('timecards.errOrder'))
    setSaving(true)
    try {
      const { error: rpcError } = await supabase.rpc('field_correct_attendance_session', { p_session_id: session.id, p_new_check_in_at: cin, p_new_check_out_at: cout, p_reason: why })
      if (rpcError) throw rpcError
      const name = f.workerName(correction.worker)
      setCorrection(null)
      setSuccess(t('timecards.success', { name }))
      await load()
    } catch (e) { setError(e?.message || t('timecards.errSave')) }
    finally { setSaving(false) }
  }

  const columns = [t('col.fieldId'), t('col.worker'), t('timecards.colFirstIn'), t('timecards.colLastOut'), t('timecards.colSessions'), t('timecards.colWorked'), t('timecards.colAllowed'), t('timecards.colVariance'), t('col.status'), t('col.details')]

  return <WorkforceFrame projectId={projectId} active="timecards">
    <section style={filter}>
      <div><small style={lab}>{t('common.project')}</small><strong style={{ display: 'block', marginTop: 6 }}>{project ? [project.code, project.name].filter(Boolean).join(' · ') : t('common.loadingProject')}</strong></div>
      <label><small style={lab}>{t('common.workDate')}</small><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={input} /></label>
      <div><small style={lab}>{t('timecards.allowedToday')}</small><strong style={{ display: 'block', marginTop: 6 }}>{project?.standard_daily_minutes == null ? t('common.notConfigured') : f.minutes(project.standard_daily_minutes)}</strong></div>
      <button onClick={() => load(true)} disabled={refreshing} style={button}>{refreshing ? t('common.refreshing') : t('common.refresh')}</button>
    </section>
    {error && <div style={err}>{error}</div>}
    {success && <div style={ok}>{success}</div>}
    <section style={metrics}>{[[t('timecards.metricWorkers'), cards.length], [t('timecards.metricHours'), f.minutes(total)], [t('timecards.metricOver'), over], [t('timecards.metricExceptions'), exceptions]].map(([label, value]) => <article key={label} style={card}><small style={lab}>{label}</small><strong style={{ fontSize: 25 }}>{value}</strong></article>)}</section>
    <section style={box}>
      <h3 style={{ padding: '0 16px' }}>{t('timecards.title')}</h3>
      {loading
        ? <div style={msg}>{t('timecards.loading')}</div>
        : cards.length === 0
          ? <div style={msg}>{t('timecards.empty')}</div>
          : <div style={{ overflowX: 'auto' }}><table style={table}>
            <thead><tr>{columns.map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
            <tbody>{cards.map((c) => <Timecard key={c.workerId} c={c} f={f} expanded={expanded === c.workerId} toggle={() => setExpanded(expanded === c.workerId ? null : c.workerId)} correct={openCorrection} />)}</tbody>
          </table></div>}
    </section>
    {correction && <div style={overlay}><form onSubmit={saveCorrection} style={modal}>
      <h3>{correction.session.status === 'open' ? t('timecards.titleMissing') : t('timecards.titleCorrect')}</h3>
      <p><strong>{f.workerName(correction.worker)}</strong> · {correction.worker?.field_id || '—'}</p>
      <label style={field}>{t('timecards.correctedIn')}<input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={input} /></label>
      <label style={field}>{t('timecards.correctedOut')}<input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={input} /></label>
      <label style={field}>{t('timecards.reason')}<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} style={input} /></label>
      <small>{t('timecards.note')}</small>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={() => !saving && setCorrection(null)} style={button}>{t('common.cancel')}</button>
        <button type="submit" disabled={saving} style={primary}>{saving ? t('common.saving') : t('timecards.save')}</button>
      </div>
    </form></div>}
  </WorkforceFrame>
}

function Timecard({ c, f, expanded, toggle, correct }) {
  const { t } = f
  const status = c.open ? t('timecards.statusOpen') : c.allowed == null ? t('common.notConfigured') : c.variance > 0 ? t('timecards.statusOver') : t('timecards.statusWithin')
  return <>
    <tr>
      <td style={td}>{c.worker?.field_id || '—'}</td>
      <td style={td}><strong>{f.workerName(c.worker)}</strong></td>
      <td style={td}>{f.time(c.first)}</td>
      <td style={td}>{c.open ? t('common.open') : f.time(c.last)}</td>
      <td style={td}>{c.sessions.length}</td>
      <td style={td}>{f.minutes(c.worked)}</td>
      <td style={td}>{c.allowed == null ? '—' : f.minutes(c.allowed)}</td>
      <td style={td}>{c.variance == null ? '—' : `${c.variance > 0 ? '+' : c.variance < 0 ? '−' : ''}${f.minutes(Math.abs(c.variance))}`}</td>
      <td style={td}>{status}</td>
      <td style={td}><button onClick={toggle} style={button}>{expanded ? t('timecards.hideSessions') : t('timecards.viewSessions')}</button></td>
    </tr>
    {expanded && <tr><td colSpan={10} style={{ ...td, background: '#f8fafc' }}>{c.sessions.map((s, i) => <div key={s.id} style={session}>
      <strong>#{i + 1}</strong>
      <span>{t('timecards.sessionIn', { time: f.time(s.check_in_at) })}</span>
      <span>{t('timecards.sessionOut', { time: s.check_out_at ? f.time(s.check_out_at) : t('common.open') })}</span>
      <span>{DONE.includes(s.status) ? f.minutes(s.worked_minutes || 0) : t('timecards.inProgress')}</span>
      <span>{f.label('session', s.status)}</span>
      <button onClick={() => correct(s, c.worker)} style={button}>{s.status === 'open' ? t('timecards.addCheckOut') : t('timecards.correct')}</button>
    </div>)}</td></tr>}
  </>
}

const lab = { fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '.06em', textTransform: 'uppercase' }
const input = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' }
const filter = { display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) 190px 190px auto', gap: 14, alignItems: 'end', padding: 18, border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff' }
const metrics = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }
const card = { padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', display: 'grid', gap: 7 }
const box = { border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', overflow: 'hidden' }
const table = { width: '100%', minWidth: 1050, borderCollapse: 'collapse' }
const th = { padding: '11px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', background: '#f8fafc' }
const td = { padding: '12px', borderTop: '1px solid #e2e8f0', fontSize: 13 }
const button = { padding: '8px 11px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', fontWeight: 700, cursor: 'pointer' }
const primary = { ...button, background: '#082a4a', color: '#fff', borderColor: '#082a4a' }
const session = { display: 'grid', gridTemplateColumns: '50px repeat(4,minmax(100px,1fr)) auto', gap: 10, alignItems: 'center', padding: 8, borderBottom: '1px solid #e2e8f0' }
const msg = { padding: 28, textAlign: 'center', color: '#64748b' }
const err = { padding: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 9 }
const ok = { padding: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 9 }
const overlay = { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(2,6,23,.55)', display: 'grid', placeItems: 'center', padding: 20 }
const modal = { width: 'min(600px,100%)', background: '#fff', borderRadius: 14, padding: 22, display: 'grid', gap: 15 }
const field = { display: 'grid', gap: 6, fontSize: 12, fontWeight: 700 }
