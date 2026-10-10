'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from '../daily-reports.module.css'

const minutesOf = (s) => s.worked_minutes ?? Math.max(0, Math.floor((new Date(s.check_out_at || Date.now()) - new Date(s.check_in_at)) / 60000))

export default function WorkforceSection({ report, supabase, t, language, reportDate }) {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [snapshot, setSnapshot] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [sessionsResult, snapshotResult] = await Promise.all([
      supabase.from('field_attendance_sessions')
        .select('id,worker_id,check_in_at,check_out_at,status,worked_minutes,field_workers(field_id,first_name,last_name),field_project_assignments(field_companies(name),field_roles(name))')
        .eq('project_id', report.projects.id).eq('work_date', report.report_date).neq('status', 'cancelled').order('check_in_at'),
      supabase.from('daily_report_workforce').select('id,company_name,crew_name,regular_hours,overtime_hours,notes,daily_report_workforce_roles(role_name,worker_count)').eq('daily_report_id', report.id).order('company_name'),
    ])
    const firstError = [sessionsResult, snapshotResult].find((r) => r.error)
    if (firstError) setError(t('common.error', { message: firstError.error.message }))
    setSessions(sessionsResult.data || [])
    setSnapshot(snapshotResult.data || [])
    setLoading(false)
  }, [report.id, report.projects.id, report.report_date, supabase, t])

  useEffect(() => { load() }, [load])

  const time = useMemo(() => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }), [language])
  const hours = (minutes) => (minutes / 60).toFixed(2)
  const totalMinutes = sessions.reduce((sum, s) => sum + minutesOf(s), 0)
  const workers = new Set(sessions.map((s) => s.worker_id)).size

  // Company breakdown of today's attendance.
  const byCompany = Object.values(sessions.reduce((acc, s) => {
    const name = s.field_project_assignments?.field_companies?.name || t('workforce.noCompany')
    const row = acc[name] || (acc[name] = { name, workers: new Set(), minutes: 0 })
    row.workers.add(s.worker_id); row.minutes += minutesOf(s)
    return acc
  }, {})).sort((a, b) => b.workers.size - a.workers.size)

  if (loading) return <section className={styles.panel}><div className={styles.empty}>{t('common.loading')}</div></section>

  return <section className={styles.panel}>
    <div className={styles.panelHead}>
      <div><h3>{t('tab.workforce')}</h3><p>{t('workforce.textAuto', { date: reportDate })}</p></div>
      <span className={styles.badge}>{t('workforce.total', { workers, hours: hours(totalMinutes) })}</span>
    </div>
    {error && <div className={styles.error} style={{ margin: '12px 18px 0' }}>{error}</div>}
    {byCompany.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 18px', borderBottom: '1px solid var(--fo-line-soft)' }}>
      {byCompany.map((c) => <div key={c.name} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--fo-sunken)', fontSize: 14 }}><strong>{c.name}</strong> <span style={{ color: 'var(--fo-muted)' }}>· {t('workforce.companyLine', { workers: c.workers.size, hours: hours(c.minutes) })}</span></div>)}
    </div>}
    {sessions.length === 0
      ? <div className={styles.empty}>{t('workforce.empty')}</div>
      : <table className={`${styles.table} ${styles.cardsTable}`}>
        <thead><tr><th>{t('workforce.colWorker')}</th><th>{t('workforce.colCompany')}</th><th>{t('workforce.colRole')}</th><th>{t('workforce.colIn')}</th><th>{t('workforce.colOut')}</th><th>{t('workforce.colHours')}</th></tr></thead>
        <tbody>{sessions.map((s) => <tr key={s.id}>
          <td data-label=""><strong>{[s.field_workers?.first_name, s.field_workers?.last_name].filter(Boolean).join(' ') || '—'}</strong> <small style={{ color: 'var(--fo-faint)' }}>{s.field_workers?.field_id || ''}</small></td>
          <td data-label={t('workforce.colCompany')}>{s.field_project_assignments?.field_companies?.name || '—'}</td>
          <td data-label={t('workforce.colRole')}>{s.field_project_assignments?.field_roles?.name || '—'}</td>
          <td data-label={t('workforce.colIn')}>{time.format(new Date(s.check_in_at))}</td>
          <td data-label={t('workforce.colOut')}>{s.check_out_at ? time.format(new Date(s.check_out_at)) : t('workforce.open')}</td>
          <td data-label={t('workforce.colHours')}>{hours(minutesOf(s))}</td>
        </tr>)}</tbody>
      </table>}
    {snapshot.length > 0 && report.status !== 'draft' && <div style={{ borderTop: '1px solid var(--fo-line-soft)' }}>
      <div style={{ padding: '14px 18px 4px' }}><strong>{t('workforce.snapshotTitle')}</strong><p style={{ margin: '2px 0 0', color: 'var(--fo-muted)', fontSize: 14 }}>{t('workforce.snapshotAuto')}</p></div>
      <table className={`${styles.table} ${styles.cardsTable}`}>
        <thead><tr><th>{t('workforce.colCompany')}</th><th>{t('workforce.colRoles')}</th><th>{t('workforce.colRegular')}</th><th>{t('workforce.colOvertime')}</th></tr></thead>
        <tbody>{snapshot.map((row) => <tr key={row.id}>
          <td data-label=""><strong>{row.company_name || '—'}</strong>{row.crew_name ? ` · ${row.crew_name}` : ''}</td>
          <td data-label={t('workforce.colRoles')}>{(row.daily_report_workforce_roles || []).map((r) => `${r.role_name} × ${r.worker_count}`).join(', ') || '—'}</td>
          <td data-label={t('workforce.colRegular')}>{Number(row.regular_hours || 0).toFixed(2)}</td>
          <td data-label={t('workforce.colOvertime')}>{Number(row.overtime_hours || 0).toFixed(2)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}
