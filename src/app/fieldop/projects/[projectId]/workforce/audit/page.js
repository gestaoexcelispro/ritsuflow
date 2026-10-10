'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../../lib/supabase/client'
import WorkforceFrame, { localDateKey, useWorkforceFormat } from '../WorkforceFrame'
import { ui } from '../../../../ui'

const supabase = createClient()
const auditAction = (event) => event?.metadata?.audit_action || null
const FILTERS = ['check_in', 'check_out', 'manual_adjustment', 'exception_reviewed', 'exception_resolved', 'session_cancelled']

export default function FieldOpProjectWorkforceAuditPage() {
  const { projectId } = useParams()
  const f = useWorkforceFormat()
  const { t } = f
  const [project, setProject] = useState(null)
  const [workers, setWorkers] = useState([])
  const [events, setEvents] = useState([])
  const [actors, setActors] = useState(new Map())
  const [date, setDate] = useState(localDateKey())
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (show = false) => {
    if (!projectId || !date) return
    if (show) setRefreshing(true)
    try {
      setError('')
      const start = new Date(`${date}T00:00:00`)
      const end = new Date(`${date}T00:00:00`)
      end.setDate(end.getDate() + 1)
      const [p, w, e] = await Promise.all([
        supabase.from('projects').select('id,code,name').eq('id', projectId).maybeSingle(),
        supabase.from('field_workers').select('id,field_id,first_name,middle_name,last_name'),
        supabase.from('field_attendance_events').select('id,session_id,assignment_id,worker_id,project_id,event_type,event_at,method,source,recorded_by,notes,metadata,latitude,longitude,gps_accuracy_m,distance_to_project_m,geofence_status,created_at').eq('project_id', projectId).gte('event_at', start.toISOString()).lt('event_at', end.toISOString()).order('event_at', { ascending: false }),
      ])
      if (p.error) throw p.error
      if (w.error) throw w.error
      if (e.error) throw e.error
      setProject(p.data || null); setWorkers(w.data || [])
      const list = e.data || []
      setEvents(list); setExpanded(null)
      const ids = [...new Set(list.map((x) => x.recorded_by).filter(Boolean))]
      const resolved = await Promise.all(ids.map(async (id) => {
        const { data } = await supabase.rpc('field_resolve_attendance_actor', { p_user_id: id })
        return [id, Array.isArray(data) ? data[0] : data]
      }))
      setActors(new Map(resolved))
    } catch (x) { setError(x?.message || t('audit.errLoad')) }
    finally { setLoading(false); if (show) setRefreshing(false) }
  }, [projectId, date, t])

  useEffect(() => { setLoading(true); load() }, [load])

  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])
  const shown = useMemo(() => {
    if (filter === 'all') return events
    if (filter === 'exception_reviewed' || filter === 'exception_resolved') return events.filter((e) => auditAction(e) === filter)
    return events.filter((e) => e.event_type === filter && !auditAction(e))
  }, [events, filter])
  const counts = useMemo(() => ({
    in: events.filter((e) => e.event_type === 'check_in').length,
    out: events.filter((e) => e.event_type === 'check_out').length,
    corrections: events.filter((e) => e.event_type === 'manual_adjustment' && !auditAction(e)).length,
    decisions: events.filter((e) => ['exception_reviewed', 'exception_resolved'].includes(auditAction(e))).length,
  }), [events])

  const columns = [t('audit.colTime'), t('col.fieldId'), t('col.worker'), t('audit.colEvent'), t('audit.colRecordedBy'), t('audit.colMethod'), t('audit.colSource'), t('audit.colNotes'), t('col.details')]

  return <WorkforceFrame projectId={projectId} active="audit">
    <div><h2 style={{ margin: 0 }}>{t('audit.title')}</h2><p style={{ color: 'var(--fo-muted)' }}>{t('audit.text')}</p></div>
    <section style={filters}>
      <div><small style={eyebrow}>{t('common.project')}</small><strong style={{ display: 'block', marginTop: 6 }}>{project ? [project.code, project.name].filter(Boolean).join(' · ') : t('common.loadingProject')}</strong></div>
      <label><small style={eyebrow}>{t('audit.eventDate')}</small><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></label>
      <label><small style={eyebrow}>{t('audit.eventType')}</small><select value={filter} onChange={(e) => setFilter(e.target.value)} style={input}><option value="all">{t('audit.allEvents')}</option>{FILTERS.map((key) => <option key={key} value={key}>{t(`event.${key}`)}</option>)}</select></label>
      <button onClick={() => load(true)} disabled={refreshing} style={button}>{refreshing ? t('common.refreshing') : t('common.refresh')}</button>
    </section>
    {error && <div style={err}>{error}</div>}
    <section style={metrics}>{[[t('audit.metricTotal'), events.length], [t('audit.metricCheckIns'), counts.in], [t('audit.metricCheckOuts'), counts.out], [t('audit.metricCorrections'), counts.corrections], [t('audit.metricDecisions'), counts.decisions]].map(([label, value]) => <article key={label} style={card}><small style={eyebrow}>{label}</small><strong style={{ fontSize: 25 }}>{value}</strong></article>)}</section>
    <section style={box}>
      <h3 style={{ padding: '0 16px' }}>{t('audit.tableTitle')}</h3>
      {loading
        ? <div style={msg}>{t('audit.loading')}</div>
        : !shown.length
          ? <div style={msg}>{t('audit.empty')}</div>
          : <div style={{ overflowX: 'auto' }}><table className={ui.phoneCards} style={table}>
            <thead><tr>{columns.map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
            <tbody>{shown.map((e) => {
              const isOpen = expanded === e.id
              return <AuditRows key={e.id} f={f} event={e} worker={workerMap.get(e.worker_id)} actor={e.recorded_by ? actors.get(e.recorded_by) : null} open={isOpen} toggle={() => setExpanded(isOpen ? null : e.id)} />
            })}</tbody>
          </table></div>}
    </section>
  </WorkforceFrame>
}

function eventLabel(f, event) {
  const action = auditAction(event)
  if (action === 'exception_reviewed') return f.t('event.exception_reviewed')
  if (action === 'exception_resolved') {
    const resolution = event?.metadata?.resolution_action
    return resolution ? `${f.t('event.exception_resolved')} · ${f.label('action', resolution)}` : f.t('event.exception_resolved')
  }
  return f.label('event', event.event_type)
}

function AuditRows({ f, event, worker, actor, open, toggle }) {
  const { t } = f
  const before = event.metadata?.before || null
  const after = event.metadata?.after || null
  return <>
    <tr>
      <td style={td} data-label={t('audit.colTime')}>{f.dateTime(event.event_at)}</td>
      <td style={td} data-label={t('col.fieldId')}>{worker?.field_id || '—'}</td>
      <td style={td} data-label=""><strong>{f.workerName(worker)}</strong></td>
      <td style={td} data-label={t('audit.colEvent')}>{eventLabel(f, event)}</td>
      <td style={td} data-label={t('audit.colRecordedBy')}>{actor?.display_name || actor?.full_name || actor?.email || (event.recorded_by ? t('audit.unknownUser') : t('audit.system'))}</td>
      <td style={td} data-label={t('audit.colMethod')}>{f.label('method', event.method)}</td>
      <td style={td} data-label={t('audit.colSource')}>{event.source || '—'}</td>
      <td style={td} data-label={t('audit.colNotes')}>{event.notes || '—'}</td>
      <td style={td} data-label=""><button onClick={toggle} style={button}>{open ? t('audit.hideDetails') : t('audit.viewDetails')}</button></td>
    </tr>
    {open && <tr><td colSpan={9} data-label="" style={{ ...td, background: 'var(--fo-sunken)' }}><div style={{ display: 'grid', gap: 12 }}>
      <div>
        <strong>{t('audit.evidence')}</strong>
        <div>{t('audit.evidenceLine', {
          geofence: f.label('geofence', event.geofence_status),
          distance: event.distance_to_project_m != null ? `${Math.round(event.distance_to_project_m)} m` : '—',
          accuracy: event.gps_accuracy_m != null ? `±${event.gps_accuracy_m} m` : '—',
        })}</div>
        {event.latitude != null && event.longitude != null && <div>{t('audit.coordinates', { lat: event.latitude, lng: event.longitude })}</div>}
      </div>
      {before && <pre style={pre}>{t('audit.before')}: {JSON.stringify(before, null, 2)}</pre>}
      {after && <pre style={pre}>{t('audit.after')}: {JSON.stringify(after, null, 2)}</pre>}
      {event.metadata && <pre style={pre}>{t('audit.metadata')}: {JSON.stringify(event.metadata, null, 2)}</pre>}
    </div></td></tr>}
  </>
}

const eyebrow = { fontSize: 13, fontWeight: 800, letterSpacing: '.07em', color: 'var(--fo-muted)' }
const input = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--fo-line)', borderRadius: 8, background: '#fff' }
const filters = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, alignItems: 'end', padding: 18, border: '1px solid var(--fo-line)', borderRadius: 14, background: '#fff' }
const metrics = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }
const card = { padding: 16, border: '1px solid var(--fo-line)', borderRadius: 12, background: '#fff', display: 'grid', gap: 7 }
const box = { border: '1px solid var(--fo-line)', borderRadius: 14, background: '#fff', overflow: 'hidden' }
const table = { width: '100%', minWidth: 1350, borderCollapse: 'collapse' }
const th = { padding: '11px 12px', textAlign: 'left', fontSize: 13, color: 'var(--fo-muted)', background: 'var(--fo-sunken)' }
const td = { padding: 12, borderTop: '1px solid var(--fo-line)', fontSize: 15, verticalAlign: 'top' }
const button = { padding: '8px 11px', border: '1px solid var(--fo-line)', borderRadius: 8, background: '#fff', fontWeight: 700, cursor: 'pointer' }
const msg = { padding: 28, textAlign: 'center', color: 'var(--fo-muted)' }
const err = { padding: 12, border: '1px solid transparent', background: 'var(--fo-bad-wash)', color: 'var(--fo-bad)', borderRadius: 9 }
const pre = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: 12, border: '1px solid var(--fo-line)', borderRadius: 8, background: '#fff', fontSize: 13 }
