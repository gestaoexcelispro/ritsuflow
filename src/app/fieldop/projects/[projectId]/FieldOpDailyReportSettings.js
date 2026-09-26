'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import styles from './setup.module.css'

const defaults = {
  capture_weather: true,
  capture_workforce: true,
  capture_progress: true,
  capture_equipment: true,
  capture_materials: true,
  capture_occurrences: true,
  capture_photos: true,
  capture_general_notes: true,
  require_signature: false,
  require_approval: false,
  report_cutoff_time: '17:00',
}

const contentOptions = [
  ['capture_weather', 'Weather', 'Record weather conditions affecting field production.'],
  ['capture_workforce', 'Workforce', 'Capture workers, crews and labor used during the day.'],
  ['capture_progress', 'Activities & Progress', 'Report work performed, quantities and production progress.'],
  ['capture_equipment', 'Equipment', 'Record equipment used, availability and relevant downtime.'],
  ['capture_materials', 'Materials', 'Capture material deliveries, use and field observations.'],
  ['capture_occurrences', 'Occurrences', 'Register safety, quality, delay and other field occurrences.'],
  ['capture_photos', 'Photos', 'Allow photographic evidence to be attached to the report.'],
  ['capture_general_notes', 'General Notes', 'Provide a project-level narrative for the reporting day.'],
]

function SettingToggle({ checked, onChange, title, description }) {
  return <label className={styles.settingToggle}>
    <span><strong>{title}</strong><small>{description}</small></span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <i aria-hidden="true" />
  </label>
}

export default function FieldOpDailyReportSettings({ projectId, onConfiguredChange }) {
  const [form, setForm] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    async function loadSettings() {
      if (!projectId) return
      setLoading(true); setError('')
      const { data, error } = await supabase.from('fieldop_daily_report_settings').select('*').eq('project_id', projectId).maybeSingle()
      if (!alive) return
      if (error) setError(error.message)
      else if (data) {
        setForm({ ...defaults, ...data, report_cutoff_time: (data.report_cutoff_time || '17:00').slice(0, 5) })
        setConfigured(true); onConfiguredChange?.(true)
      } else {
        setForm(defaults); setConfigured(false); onConfiguredChange?.(false)
      }
      setLoading(false)
    }
    loadSettings()
    return () => { alive = false }
  }, [projectId, onConfiguredChange])

  function setValue(key, value) { setForm((current) => ({ ...current, [key]: value })); setMessage('') }

  async function saveSettings() {
    if (saving || !projectId) return
    setSaving(true); setError(''); setMessage('')
    const payload = {
      project_id: projectId,
      ...Object.fromEntries(Object.keys(defaults).map((key) => [key, form[key]])),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('fieldop_daily_report_settings').upsert(payload, { onConflict: 'project_id' })
    if (error) setError(error.message)
    else {
      setConfigured(true); onConfiguredChange?.(true); setMessage('Daily Report settings saved successfully.')
    }
    setSaving(false)
  }

  if (loading) return <section className={styles.workspace}><div><h2>Daily Report Settings</h2><p>Configure project-specific Daily Report behavior without changing the canonical project record.</p></div><div className={styles.empty}><b>Loading Daily Report settings...</b></div></section>

  return <section className={styles.workspace}>
    <div className={styles.settingsHeader}>
      <div><h2>Daily Report Settings</h2><p>Define what this project's Daily Report captures and how reports move through the field workflow.</p></div>
      <span className={configured ? styles.configuredBadge : styles.pendingBadge}>{configured ? 'Configured' : 'Not configured'}</span>
    </div>

    {error && <div className={styles.error}>{error}</div>}
    {message && <div className={styles.success}>{message}</div>}

    <div className={styles.settingsGrid}>
      <article className={styles.settingsPanel}>
        <header><h3>Report Content</h3><p>Select the information available when a Daily Report is created.</p></header>
        <div className={styles.settingList}>{contentOptions.map(([key, title, description]) => <SettingToggle key={key} checked={form[key]} onChange={(value) => setValue(key, value)} title={title} description={description} />)}</div>
      </article>

      <div className={styles.settingsColumn}>
        <article className={styles.settingsPanel}>
          <header><h3>Workflow</h3><p>Define controls required before the report is considered complete.</p></header>
          <div className={styles.settingList}>
            <SettingToggle checked={form.require_signature} onChange={(value) => setValue('require_signature', value)} title="Require Signature" description="Require a field signature before the Daily Report is completed." />
            <SettingToggle checked={form.require_approval} onChange={(value) => setValue('require_approval', value)} title="Require Approval" description="Send submitted reports through an approval step." />
          </div>
        </article>

        <article className={styles.settingsPanel}>
          <header><h3>Reporting Rules</h3><p>Set the operational rule used for the reporting day.</p></header>
          <label className={styles.cutoffField}><span><strong>Daily Cutoff Time</strong><small>Default time used to close the field reporting day.</small></span><input type="time" value={form.report_cutoff_time} onChange={(event) => setValue('report_cutoff_time', event.target.value)} /></label>
        </article>

        <article className={styles.settingsSummary}>
          <strong>{contentOptions.filter(([key]) => form[key]).length} report sections enabled</strong>
          <span>{form.require_signature || form.require_approval ? 'Completion controls are enabled.' : 'No signature or approval required.'}</span>
        </article>
      </div>
    </div>

    <div className={styles.settingsFooter}><span>These settings apply only to this project in FieldOp.</span><button className={styles.saveSettingsButton} disabled={saving} onClick={saveSettings}>{saving ? 'Saving...' : configured ? 'Save Changes' : 'Save Daily Report Settings'}</button></div>
  </section>
}
