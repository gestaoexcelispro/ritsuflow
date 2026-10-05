'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from '../daily-reports.module.css'

const PPE = ['compliant', 'minor_issues', 'non_compliant', 'not_applicable']
const STATUS = ['normal', 'attention', 'critical']
const blank = {
  overall_status: 'normal', toolbox_talk_held: false, toolbox_talk_topic: '', toolbox_talk_attendees: '',
  safety_inspection_completed: false, inspector_name: '', ppe_compliance: 'compliant',
  incidents_count: 0, near_misses_count: 0, unsafe_conditions_count: 0,
  stop_work_event: false, stop_work_description: '', corrective_actions_summary: '', general_notes: '',
}
const int = (v) => (v === '' || v === null || v === undefined ? 0 : Math.max(0, parseInt(v, 10) || 0))

// Suggested overall status from what was recorded; the user can still choose another.
function suggest(f) {
  if (f.stop_work_event || int(f.incidents_count) > 0 || f.ppe_compliance === 'non_compliant') return 'critical'
  if (int(f.near_misses_count) > 0 || int(f.unsafe_conditions_count) > 0 || f.ppe_compliance === 'minor_issues') return 'attention'
  return 'normal'
}

export default function SafetySection({ report, supabase, t, locked }) {
  const [form, setForm] = useState(blank)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    supabase.from('daily_report_safety').select('*').eq('daily_report_id', report.id).maybeSingle().then(({ data, error: loadError }) => {
      if (!alive) return
      if (loadError) setError(t('common.error', { message: loadError.message }))
      if (data) {
        setExists(true)
        setForm(Object.fromEntries(Object.keys(blank).map((k) => [k, data[k] ?? blank[k]])))
      }
      setLoading(false)
    })
    return () => { alive = false }
  }, [report.id, supabase, t])

  const suggested = useMemo(() => suggest(form), [form])
  function set(key, value) { setForm((cur) => ({ ...cur, [key]: value })); setMessage('') }

  async function save() {
    setSaving(true); setMessage(''); setError('')
    if (form.stop_work_event && !form.stop_work_description.trim()) { setError(t('safety.errStopWork')); setSaving(false); return }
    const { data: auth } = await supabase.auth.getUser()
    const payload = {
      daily_report_id: report.id,
      overall_status: form.overall_status,
      toolbox_talk_held: form.toolbox_talk_held,
      toolbox_talk_topic: form.toolbox_talk_held ? form.toolbox_talk_topic.trim() || null : null,
      toolbox_talk_attendees: form.toolbox_talk_held && form.toolbox_talk_attendees !== '' ? int(form.toolbox_talk_attendees) : null,
      safety_inspection_completed: form.safety_inspection_completed,
      inspector_name: form.safety_inspection_completed ? form.inspector_name.trim() || null : null,
      ppe_compliance: form.ppe_compliance,
      incidents_count: int(form.incidents_count),
      near_misses_count: int(form.near_misses_count),
      unsafe_conditions_count: int(form.unsafe_conditions_count),
      stop_work_event: form.stop_work_event,
      stop_work_description: form.stop_work_event ? form.stop_work_description.trim() : null,
      corrective_actions_summary: form.corrective_actions_summary.trim() || null,
      general_notes: form.general_notes.trim() || null,
      ...(exists ? {} : { created_by: auth?.user?.id || null }),
    }
    const { error: saveError } = await supabase.from('daily_report_safety').upsert(payload, { onConflict: 'daily_report_id' })
    if (saveError) setError(t('common.error', { message: saveError.message }))
    else { setExists(true); setMessage(t('safety.saved')) }
    setSaving(false)
  }

  if (loading) return <section className={styles.panel}><div className={styles.empty}>{t('common.loading')}</div></section>

  const field = { display: 'grid', gap: 6 }
  const check = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }
  const box = { border: '1px solid #d6e0e5', borderRadius: 10, padding: 14, display: 'grid', gap: 10, margin: 0 }

  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.safety')}</h3><p>{t('safety.text')}</p></div><span className={styles.badge}>{t(`safety.status.${form.overall_status}`)}</span></div>
    <fieldset disabled={locked} style={{ border: 0, margin: 0, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
        <div style={box}>
          <label style={check}><input type="checkbox" checked={form.toolbox_talk_held} onChange={(e) => set('toolbox_talk_held', e.target.checked)} />{t('safety.toolbox')}</label>
          {form.toolbox_talk_held && <>
            <label style={field}><b>{t('safety.topic')}</b><input value={form.toolbox_talk_topic} onChange={(e) => set('toolbox_talk_topic', e.target.value)} placeholder={t('safety.topicPlaceholder')} /></label>
            <label style={field}><b>{t('safety.attendees')}</b><input type="number" min="0" value={form.toolbox_talk_attendees} onChange={(e) => set('toolbox_talk_attendees', e.target.value)} /></label>
          </>}
        </div>
        <div style={box}>
          <label style={check}><input type="checkbox" checked={form.safety_inspection_completed} onChange={(e) => set('safety_inspection_completed', e.target.checked)} />{t('safety.inspection')}</label>
          {form.safety_inspection_completed && <label style={field}><b>{t('safety.inspector')}</b><input value={form.inspector_name} onChange={(e) => set('inspector_name', e.target.value)} /></label>}
          <label style={field}><b>{t('safety.ppe')}</b><select value={form.ppe_compliance} onChange={(e) => set('ppe_compliance', e.target.value)}>{PPE.map((p) => <option key={p} value={p}>{t(`safety.ppeValue.${p}`)}</option>)}</select></label>
        </div>
        <div style={box}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <label style={field}><b>{t('safety.incidents')}</b><input type="number" min="0" value={form.incidents_count} onChange={(e) => set('incidents_count', e.target.value)} /></label>
            <label style={field}><b>{t('safety.nearMisses')}</b><input type="number" min="0" value={form.near_misses_count} onChange={(e) => set('near_misses_count', e.target.value)} /></label>
            <label style={field}><b>{t('safety.unsafe')}</b><input type="number" min="0" value={form.unsafe_conditions_count} onChange={(e) => set('unsafe_conditions_count', e.target.value)} /></label>
          </div>
          <label style={check}><input type="checkbox" checked={form.stop_work_event} onChange={(e) => set('stop_work_event', e.target.checked)} />{t('safety.stopWork')}</label>
          {form.stop_work_event && <label style={field}><b>{t('safety.stopWorkWhat')}</b><textarea rows={2} value={form.stop_work_description} onChange={(e) => set('stop_work_description', e.target.value)} /></label>}
        </div>
      </div>
      <label style={field}><b>{t('safety.corrective')}</b><textarea rows={3} value={form.corrective_actions_summary} onChange={(e) => set('corrective_actions_summary', e.target.value)} placeholder={t('safety.correctivePlaceholder')} /></label>
      <label style={field}><b>{t('safety.notes')}</b><textarea rows={3} value={form.general_notes} onChange={(e) => set('general_notes', e.target.value)} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,320px) 1fr', gap: 12, alignItems: 'end' }}>
        <label style={field}><b>{t('safety.overall')}</b><select value={form.overall_status} onChange={(e) => set('overall_status', e.target.value)}>{STATUS.map((s) => <option key={s} value={s}>{t(`safety.status.${s}`)}</option>)}</select></label>
        {suggested !== form.overall_status && <p style={{ margin: 0, color: '#986100', fontSize: 12 }}>
          {t('safety.suggested', { status: t(`safety.status.${suggested}`) })} <button type="button" className={styles.secondaryButton} style={{ minHeight: 30, marginLeft: 8 }} onClick={() => set('overall_status', suggested)}>{t('safety.useSuggested')}</button>
        </p>}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className={styles.successMessage}>{message}</span>
        <button className={styles.primaryButton} type="button" disabled={saving || locked} onClick={save}>{saving ? t('common.saving') : t('safety.save')}</button>
      </div>
    </fieldset>
  </section>
}
