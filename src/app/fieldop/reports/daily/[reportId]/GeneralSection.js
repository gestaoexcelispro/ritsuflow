'use client'

import { useState } from 'react'
import styles from '../daily-reports.module.css'
import { useDirty } from './useDirty'

// Project, date, number and status are already in the report header; here only what the field team fills in.
export default function GeneralSection({ report, supabase, t, locked, onSaved, onDirty }) {
  const initial = { start: report.work_start_time?.slice(0, 5) || '', end: report.work_end_time?.slice(0, 5) || '', notes: report.general_notes || '' }
  const [form, setForm] = useState(initial)
  const [baseline, setBaseline] = useState(JSON.stringify(initial))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useDirty(onDirty, !locked && JSON.stringify(form) !== baseline)

  const set = (key, value) => { setForm((cur) => ({ ...cur, [key]: value })); setMessage('') }

  async function save(event) {
    event.preventDefault()
    if (form.start && form.end && form.end < form.start) { setError(t('general.errTimes')); return }
    setSaving(true); setMessage(''); setError('')
    const { data, error: saveError } = await supabase.from('daily_reports')
      .update({ work_start_time: form.start || null, work_end_time: form.end || null, general_notes: form.notes.trim() || null })
      .eq('id', report.id).select('id,work_start_time,work_end_time,general_notes').single()
    if (saveError) setError(t('common.error', { message: saveError.message }))
    else { setMessage(t('general.saved')); setBaseline(JSON.stringify(form)); onSaved?.(data) }
    setSaving(false)
  }

  const field = { display: 'grid', gap: 6 }
  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.general')}</h3><p>{t('general.text')}</p></div></div>
    <form onSubmit={save} style={{ display: 'grid', gap: 16, padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,220px))', gap: 14 }}>
        <label style={field}><b>{t('general.workStart')}</b><input type="time" value={form.start} onChange={(e) => set('start', e.target.value)} disabled={locked} /></label>
        <label style={field}><b>{t('general.workEnd')}</b><input type="time" value={form.end} onChange={(e) => set('end', e.target.value)} disabled={locked} /></label>
      </div>
      <label style={field}><b>{t('general.notes')}</b><textarea rows={6} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('general.notesPlaceholder')} disabled={locked} /></label>
      {error && <div className={styles.error} style={{ marginBottom: 0 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className={styles.successMessage}>{message}</span>
        {!locked && <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? t('common.saving') : t('general.save')}</button>}
      </div>
    </form>
  </section>
}
