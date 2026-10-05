'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import styles from './setup.module.css'
import { useT } from '../../../../lib/i18n/useT'

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
  require_separate_approver: false,
  report_cutoff_time: '17:00',
}

// [field, message key] — titles and descriptions come from the fieldopSetup messages.
const contentOptions = [
  ['capture_weather', 'weather'],
  ['capture_workforce', 'workforce'],
  ['capture_progress', 'progress'],
  ['capture_equipment', 'equipment'],
  ['capture_materials', 'materials'],
  ['capture_occurrences', 'occurrences'],
  ['capture_photos', 'photos'],
  ['capture_general_notes', 'notes'],
]

function SettingToggle({ checked, onChange, title, description }) {
  return <label className={styles.settingToggle}>
    <span><strong>{title}</strong><small>{description}</small></span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <i aria-hidden="true" />
  </label>
}

export default function FieldOpDailyReportSettings({ projectId, onConfiguredChange }) {
  const t = useT('fieldopSetup')
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
      setConfigured(true); onConfiguredChange?.(true); setMessage(t('settings.saved'))
    }
    setSaving(false)
  }

  if (loading) return <section className={styles.workspace}><div><h2>{t('tab.settings')}</h2><p>{t('settings.loadingText')}</p></div><div className={styles.empty}><b>{t('settings.loading')}</b></div></section>

  return <section className={styles.workspace}>
    <div className={styles.settingsHeader}>
      <div><h2>{t('tab.settings')}</h2><p>{t('settings.text')}</p></div>
      <span className={configured ? styles.configuredBadge : styles.pendingBadge}>{configured ? t('settings.configured') : t('settings.notConfigured')}</span>
    </div>

    {error && <div className={styles.error}>{error}</div>}
    {message && <div className={styles.success}>{message}</div>}

    <div className={styles.settingsGrid}>
      <article className={styles.settingsPanel}>
        <header><h3>{t('settings.contentTitle')}</h3><p>{t('settings.contentText')}</p></header>
        <div className={styles.settingList}>{contentOptions.map(([key, label]) => <SettingToggle key={key} checked={form[key]} onChange={(value) => setValue(key, value)} title={t(`settings.${label}`)} description={t(`settings.${label}Text`)} />)}</div>
      </article>

      <div className={styles.settingsColumn}>
        <article className={styles.settingsPanel}>
          <header><h3>{t('settings.workflowTitle')}</h3><p>{t('settings.workflowText')}</p></header>
          <div className={styles.settingList}>
            <SettingToggle checked={form.require_signature} onChange={(value) => setValue('require_signature', value)} title={t('settings.signature')} description={t('settings.signatureText')} />
            <SettingToggle checked={form.require_approval} onChange={(value) => setValue('require_approval', value)} title={t('settings.approval')} description={t('settings.approvalText')} />
            <SettingToggle checked={form.require_separate_approver} onChange={(value) => setValue('require_separate_approver', value)} title={t('settings.separateApprover')} description={t('settings.separateApproverText')} />
          </div>
        </article>

        <article className={styles.settingsPanel}>
          <header><h3>{t('settings.rulesTitle')}</h3><p>{t('settings.rulesText')}</p></header>
          <label className={styles.cutoffField}><span><strong>{t('settings.cutoff')}</strong><small>{t('settings.cutoffText')}</small></span><input type="time" value={form.report_cutoff_time} onChange={(event) => setValue('report_cutoff_time', event.target.value)} /></label>
        </article>

        <article className={styles.settingsSummary}>
          <strong>{t('settings.sectionsEnabled', { count: contentOptions.filter(([key]) => form[key]).length })}</strong>
          <span>{form.require_signature || form.require_approval || form.require_separate_approver ? t('settings.controlsOn') : t('settings.controlsOff')}</span>
        </article>
      </div>
    </div>

    <div className={styles.settingsFooter}><span>{t('settings.footer')}</span><button className={styles.saveSettingsButton} disabled={saving} onClick={saveSettings}>{saving ? t('common.saving') : configured ? t('settings.saveChanges') : t('settings.saveFirst')}</button></div>
  </section>
}
