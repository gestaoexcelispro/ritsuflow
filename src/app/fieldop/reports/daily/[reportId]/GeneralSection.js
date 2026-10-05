'use client'

import { useState } from 'react'
import styles from '../daily-reports.module.css'

export default function GeneralSection({ report, supabase, t, locked, reportDate, onSaved }) {
  const [start, setStart] = useState(report.work_start_time?.slice(0, 5) || '')
  const [end, setEnd] = useState(report.work_end_time?.slice(0, 5) || '')
  const [notes, setNotes] = useState(report.general_notes || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    setSaving(true); setMessage(''); setError('')
    const { data, error: saveError } = await supabase.from('daily_reports')
      .update({ work_start_time: start || null, work_end_time: end || null, general_notes: notes.trim() || null })
      .eq('id', report.id).select('id,work_start_time,work_end_time,general_notes').single()
    if (saveError) setError(t('common.error', { message: saveError.message }))
    else { setMessage(t('general.saved')); onSaved?.(data) }
    setSaving(false)
  }

  const field = { display: 'grid', gap: 7 }
  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.general')}</h3><p>{t('general.text')}</p></div><span>{t(`status.${report.status}`)}</span></div>
    <form onSubmit={save} style={{ display: 'grid', gap: 18, padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <label style={field}><b>{t('general.project')}</b><input value={report.projects?.name || ''} disabled /></label>
        <label style={field}><b>{t('general.projectCode')}</b><input value={report.projects?.code || '—'} disabled /></label>
        <label style={field}><b>{t('general.reportDate')}</b><input value={reportDate} disabled /></label>
        <label style={field}><b>{t('general.reportNumber')}</b><input value={`DR-${String(report.report_number || 0).padStart(4, '0')}`} disabled /></label>
        <label style={field}><b>{t('general.workStart')}</b><input type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={locked} /></label>
        <label style={field}><b>{t('general.workEnd')}</b><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={locked} /></label>
        <label style={field}><b>{t('general.client')}</b><input value={report.projects?.client_name || '—'} disabled /></label>
        <label style={field}><b>{t('general.status')}</b><input value={t(`status.${report.status}`)} disabled /></label>
      </div>
      <label style={field}><b>{t('general.notes')}</b><textarea rows={7} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('general.notesPlaceholder')} disabled={locked} /></label>
      {error && <div className={styles.error}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className={styles.successMessage}>{message}</span>
        <button className={styles.primaryButton} type="submit" disabled={saving || locked}>{saving ? t('common.saving') : t('general.save')}</button>
      </div>
    </form>
  </section>
}
