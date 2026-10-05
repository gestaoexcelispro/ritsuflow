'use client'

import { useEffect, useState } from 'react'
import styles from '../daily-reports.module.css'
import { useLanguage } from '../../../../../lib/i18n/LanguageProvider'

const PERIODS = ['morning', 'afternoon', 'evening']
const CONDITIONS = ['clear', 'partly_cloudy', 'cloudy', 'rain', 'heavy_rain', 'storm', 'windy', 'fog', 'snow', 'extreme_heat']
const WIND = ['calm', 'light', 'moderate', 'strong']
const SITE = ['dry', 'wet', 'muddy', 'flooded', 'frozen']
const IMPACT = ['none', 'minor', 'moderate', 'severe']

const blank = (unit) => ({ id: null, condition: '', temperature_min: '', temperature_max: '', temperature_unit: unit, rainfall: '', wind_condition: '', site_condition: '', production_impact: 'none', impact_hours: '', notes: '' })
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const filled = (row) => Boolean(row.condition || row.temperature_min !== '' || row.temperature_max !== '' || row.rainfall !== '' || row.wind_condition || row.site_condition || row.production_impact !== 'none' || row.impact_hours !== '' || row.notes.trim())

export default function WeatherSection({ report, supabase, t, locked }) {
  const { unitSystem } = useLanguage()
  const defaultUnit = unitSystem === 'imperial' ? 'F' : 'C'
  const [rows, setRows] = useState(() => Object.fromEntries(PERIODS.map((p) => [p, blank(defaultUnit)])))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      const { data, error: loadError } = await supabase.from('daily_report_weather').select('*').eq('daily_report_id', report.id)
      if (!alive) return
      if (loadError) setError(t('common.error', { message: loadError.message }))
      const next = Object.fromEntries(PERIODS.map((p) => [p, blank(defaultUnit)]))
      for (const r of data || []) {
        if (!next[r.period]) continue
        next[r.period] = {
          id: r.id,
          condition: r.condition || r.weather_condition || '',
          temperature_min: r.temperature_min ?? '',
          temperature_max: r.temperature_max ?? r.temperature ?? '',
          temperature_unit: r.temperature_unit || defaultUnit,
          rainfall: r.rainfall ?? '',
          wind_condition: r.wind_condition || '',
          site_condition: r.site_condition || '',
          production_impact: r.production_impact || 'none',
          impact_hours: r.impact_hours ?? '',
          notes: r.notes || r.impact_notes || '',
        }
      }
      setRows(next)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [report.id, supabase, t, defaultUnit])

  function set(period, key, value) { setRows((cur) => ({ ...cur, [period]: { ...cur[period], [key]: value } })); setMessage('') }

  async function save() {
    setSaving(true); setMessage(''); setError('')
    for (const period of PERIODS) {
      const r = rows[period]
      if (num(r.temperature_min) !== null && num(r.temperature_max) !== null && num(r.temperature_max) < num(r.temperature_min)) {
        setError(t('weather.errRange', { period: t(`weather.period.${period}`) })); setSaving(false); return
      }
    }
    const upserts = PERIODS.filter((p) => filled(rows[p])).map((period) => {
      const r = rows[period]
      return {
        daily_report_id: report.id,
        project_id: report.projects?.id || null,
        organization_id: report.projects?.organization_id || null,
        period,
        condition: r.condition || null,
        weather_condition: r.condition || null,
        temperature_min: num(r.temperature_min),
        temperature_max: num(r.temperature_max),
        temperature_unit: r.temperature_unit,
        rainfall: num(r.rainfall),
        wind_condition: r.wind_condition || null,
        site_condition: r.site_condition || null,
        production_impact: r.production_impact,
        impact_hours: r.production_impact === 'none' ? null : num(r.impact_hours),
        notes: r.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }
    })
    const removals = PERIODS.filter((p) => !filled(rows[p]) && rows[p].id).map((p) => rows[p].id)
    if (upserts.length) {
      const { data, error: upError } = await supabase.from('daily_report_weather').upsert(upserts, { onConflict: 'daily_report_id,period' }).select('id,period')
      if (upError) { setError(t('common.error', { message: upError.message })); setSaving(false); return }
      setRows((cur) => { const next = { ...cur }; for (const d of data || []) next[d.period] = { ...next[d.period], id: d.id }; return next })
    }
    if (removals.length) {
      const { error: delError } = await supabase.from('daily_report_weather').delete().in('id', removals)
      if (delError) { setError(t('common.error', { message: delError.message })); setSaving(false); return }
      setRows((cur) => { const next = { ...cur }; for (const p of PERIODS) if (removals.includes(next[p].id)) next[p] = { ...next[p], id: null }; return next })
    }
    setMessage(t('weather.saved'))
    setSaving(false)
  }

  if (loading) return <section className={styles.panel}><div className={styles.empty}>{t('common.loading')}</div></section>

  const field = { display: 'grid', gap: 6 }
  const option = (group, value) => <option key={value} value={value}>{t(`weather.${group}.${value}`)}</option>

  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.weather')}</h3><p>{t('weather.text')}</p></div></div>
    <div style={{ display: 'grid', gap: 14, padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        {PERIODS.map((period) => {
          const r = rows[period]
          return <fieldset key={period} disabled={locked} style={{ border: '1px solid var(--fo-line)', borderRadius: 10, padding: 14, display: 'grid', gap: 10, margin: 0 }}>
            <legend style={{ fontWeight: 800, padding: '0 6px' }}>{t(`weather.period.${period}`)}{period === 'evening' ? ` · ${t('weather.optional')}` : ''}</legend>
            <label style={field}><b>{t('weather.condition')}</b>
              <select value={r.condition} onChange={(e) => set(period, 'condition', e.target.value)}><option value="">—</option>{CONDITIONS.map((c) => option('cond', c))}</select></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8 }}>
              <label style={field}><b>{t('weather.min')}</b><input type="number" step="0.1" value={r.temperature_min} onChange={(e) => set(period, 'temperature_min', e.target.value)} /></label>
              <label style={field}><b>{t('weather.max')}</b><input type="number" step="0.1" value={r.temperature_max} onChange={(e) => set(period, 'temperature_max', e.target.value)} /></label>
              <label style={field}><b>{t('weather.unit')}</b><select value={r.temperature_unit} onChange={(e) => set(period, 'temperature_unit', e.target.value)}><option value="C">°C</option><option value="F">°F</option></select></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={field}><b>{t(r.temperature_unit === 'F' ? 'weather.rainfallIn' : 'weather.rainfallMm')}</b><input type="number" min="0" step="0.1" value={r.rainfall} onChange={(e) => set(period, 'rainfall', e.target.value)} /></label>
              <label style={field}><b>{t('weather.wind')}</b><select value={r.wind_condition} onChange={(e) => set(period, 'wind_condition', e.target.value)}><option value="">—</option>{WIND.map((w) => option('windValue', w))}</select></label>
            </div>
            <label style={field}><b>{t('weather.site')}</b><select value={r.site_condition} onChange={(e) => set(period, 'site_condition', e.target.value)}><option value="">—</option>{SITE.map((s) => option('siteValue', s))}</select></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={field}><b>{t('weather.impact')}</b><select value={r.production_impact} onChange={(e) => set(period, 'production_impact', e.target.value)}>{IMPACT.map((i) => option('impactValue', i))}</select></label>
              <label style={field}><b>{t('weather.hoursLost')}</b><input type="number" min="0" step="0.25" value={r.production_impact === 'none' ? '' : r.impact_hours} disabled={locked || r.production_impact === 'none'} onChange={(e) => set(period, 'impact_hours', e.target.value)} /></label>
            </div>
            <label style={field}><b>{t('weather.notes')}</b><textarea rows={2} value={r.notes} onChange={(e) => set(period, 'notes', e.target.value)} placeholder={t('weather.notesPlaceholder')} /></label>
          </fieldset>
        })}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className={styles.successMessage}>{message}</span>
        <button className={styles.primaryButton} type="button" disabled={saving || locked} onClick={save}>{saving ? t('common.saving') : t('weather.save')}</button>
      </div>
    </div>
  </section>
}
