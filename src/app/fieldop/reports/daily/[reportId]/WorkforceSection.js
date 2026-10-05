'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from '../daily-reports.module.css'

const minutesOf = (s) => s.worked_minutes ?? Math.max(0, Math.floor((new Date(s.check_out_at || Date.now()) - new Date(s.check_in_at)) / 60000))

export default function WorkforceSection({ report, supabase, t, language, locked, reportDate }) {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [snapshot, setSnapshot] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
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

  async function saveSnapshot() {
    setSaving(true); setMessage(''); setError('')
    const { data, error: rpcError } = await supabase.rpc('fieldop_snapshot_daily_workforce', { p_daily_report_id: report.id })
    if (rpcError) setError(t('common.error', { message: rpcError.message }))
    else { setMessage(t('workforce.saved', { count: data ?? 0 })); await load() }
    setSaving(false)
  }

  if (loading) return <section className={styles.panel}><div className={styles.empty}>{t('common.loading')}</div></section>

  return <>
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span className={styles.eyebrowDark}>{t('workforce.eyebrow')}</span><h3>{t('workforce.attendanceTitle')}</h3><p>{t('workforce.text', { date: reportDate })}</p></div>
        <span>{t('workforce.total', { workers, hours: hours(totalMinutes) })}</span>
      </div>
      {sessions.length === 0
        ? <div className={styles.empty}>{t('workforce.empty')}</div>
        : <table className={styles.table}>
          <thead><tr><th>{t('workforce.colWorker')}</th><th>{t('workforce.colCompany')}</th><th>{t('workforce.colRole')}</th><th>{t('workforce.colIn')}</th><th>{t('workforce.colOut')}</th><th>{t('workforce.colHours')}</th></tr></thead>
          <tbody>{sessions.map((s) => <tr key={s.id}>
            <td><strong>{[s.field_workers?.first_name, s.field_workers?.last_name].filter(Boolean).join(' ') || '—'}</strong> <small>{s.field_workers?.field_id || ''}</small></td>
            <td>{s.field_project_assignments?.field_companies?.name || '—'}</td>
            <td>{s.field_project_assignments?.field_roles?.name || '—'}</td>
            <td>{time.format(new Date(s.check_in_at))}</td>
            <td>{s.check_out_at ? time.format(new Date(s.check_out_at)) : t('workforce.open')}</td>
            <td>{hours(minutesOf(s))}</td>
          </tr>)}</tbody>
        </table>}
    </section>

    <section className={styles.panel} style={{ marginTop: 14 }}>
      <div className={styles.panelHead}>
        <div><h3>{t('workforce.snapshotTitle')}</h3><p>{t('workforce.snapshotText')}</p></div>
        <button type="button" className={styles.primaryButton} onClick={saveSnapshot} disabled={saving || locked || sessions.length === 0}>{saving ? t('common.saving') : t('workforce.save')}</button>
      </div>
      {error && <div className={styles.error} style={{ margin: '0 18px 12px' }}>{error}</div>}
      {message && <div className={styles.successMessage} style={{ padding: '0 18px 12px' }}>{message}</div>}
      {snapshot.length === 0
        ? <div className={styles.empty}>{t('workforce.snapshotEmpty')}</div>
        : <table className={styles.table}>
          <thead><tr><th>{t('workforce.colCompany')}</th><th>{t('workforce.colCrew')}</th><th>{t('workforce.colRoles')}</th><th>{t('workforce.colRegular')}</th><th>{t('workforce.colOvertime')}</th></tr></thead>
          <tbody>{snapshot.map((row) => <tr key={row.id}>
            <td><strong>{row.company_name || '—'}</strong></td>
            <td>{row.crew_name || '—'}</td>
            <td>{(row.daily_report_workforce_roles || []).map((r) => `${r.role_name} × ${r.worker_count}`).join(', ') || '—'}</td>
            <td>{Number(row.regular_hours || 0).toFixed(2)}</td>
            <td>{Number(row.overtime_hours || 0).toFixed(2)}</td>
          </tr>)}</tbody>
        </table>}
    </section>
  </>
}
