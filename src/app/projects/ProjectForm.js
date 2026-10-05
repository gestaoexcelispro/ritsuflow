'use client'

import { useMemo, useState } from 'react'
import { useT } from '../../lib/i18n/useT'
import { useLanguage } from '../../lib/i18n/LanguageProvider'
import { Icon, ui } from '../fieldop/ui'
import styles from './project-form.module.css'

export const EMPTY_PROJECT = {
  name: '', client_name: '', contract_number: '', status: 'planning',
  country_code: 'BR', postal_code: '', address_line: '', address_number: '', neighborhood: '', city: '', state_region: '', latitude: '', longitude: '',
  contract_value: '', currency_code: 'BRL', billing_method: 'progress_percent_complete', billing_cycle: 'monthly', billing_cutoff_day: '', payment_terms_days: '30',
  has_retainage: false, retainage_percent: '', retainage_payment_days: '', material_included: false, material_value: '',
  planned_start_date: '', contractual_term_days: '', success_criteria: '',
}

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived']
const COUNTRIES = ['BR', 'US', 'CA', 'MX', 'UY', 'AR', 'CL', 'PT', 'ES', 'GB', 'AU', 'OTHER']
const CURRENCIES = ['BRL', 'USD', 'CAD', 'EUR', 'MXN', 'GBP', 'AUD']
const BILLING = ['progress_percent_complete', 'milestone', 'unit_price', 'time_materials', 'fixed_schedule', 'other']
const CYCLES = ['weekly', 'biweekly', 'monthly', 'milestone', 'custom']
const STEPS = ['info', 'address', 'contract', 'schedule', 'review']

const addDays = (date, days) => { if (!date || days === '' || days == null) return ''; const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + Number(days)); return d.toISOString().slice(0, 10) }
const numOrNull = (v) => (v === '' || v == null ? null : Number(v))

/** Converts the form into the `projects` row (same columns for create and update). */
export function toProjectPayload(form) {
  const plannedEnd = addDays(form.planned_start_date, form.contractual_term_days)
  const retainageValue = form.has_retainage && form.contract_value && form.retainage_percent ? (Number(form.contract_value) * Number(form.retainage_percent)) / 100 : 0
  const retainageDate = form.has_retainage && plannedEnd && form.retainage_payment_days !== '' ? addDays(plannedEnd, form.retainage_payment_days) : ''
  return {
    name: form.name.trim(), client_name: form.client_name.trim() || null, contract_number: form.contract_number.trim() || null, status: form.status,
    country_code: form.country_code.trim().toUpperCase() || null, postal_code: form.postal_code.trim() || null,
    address_line: [form.address_line.trim(), String(form.address_number).trim()].filter(Boolean).join(', ') || null,
    neighborhood: form.neighborhood.trim() || null, city: form.city.trim() || null, state_region: form.state_region.trim() || null,
    latitude: numOrNull(form.latitude), longitude: numOrNull(form.longitude),
    contract_value: numOrNull(form.contract_value), currency_code: form.currency_code || 'BRL',
    billing_method: form.billing_method || null, billing_cycle: form.billing_cycle || null,
    billing_cutoff_day: numOrNull(form.billing_cutoff_day), payment_terms_days: numOrNull(form.payment_terms_days),
    has_retainage: form.has_retainage,
    retainage_percent: form.has_retainage ? numOrNull(form.retainage_percent) : null,
    retainage_value: form.has_retainage ? retainageValue : null,
    retainage_payment_days: form.has_retainage ? numOrNull(form.retainage_payment_days) : null,
    probable_retainage_payment_date: form.has_retainage && retainageDate ? retainageDate : null,
    material_included: form.material_included, material_value: form.material_included ? numOrNull(form.material_value) : null,
    planned_start_date: form.planned_start_date || null, planned_finish_date: plannedEnd || null,
    contractual_term_days: numOrNull(form.contractual_term_days), success_criteria: form.success_criteria.trim() || null,
  }
}

/** Labeled field. Module-level so inputs keep focus while typing. */
function Field({ t, k, wide, children, hint }) {
  return <label className={`${styles.field} ${wide ? styles.wide : ''}`}><span>{t(`form.${k}`)}</span>{children}{hint && <small>{hint}</small>}</label>
}

/** Five-step project form shared by New Project and Edit Project. */
export default function ProjectForm({ mode, initial, onSubmit }) {
  const t = useT('projects')
  const { language } = useLanguage()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initial || EMPTY_PROJECT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [addressStatus, setAddressStatus] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }))

  const plannedEnd = useMemo(() => addDays(form.planned_start_date, form.contractual_term_days), [form.planned_start_date, form.contractual_term_days])
  const retainageValue = form.has_retainage && form.contract_value && form.retainage_percent ? (Number(form.contract_value) * Number(form.retainage_percent)) / 100 : 0
  const retainageDate = form.has_retainage && plannedEnd && form.retainage_payment_days !== '' ? addDays(plannedEnd, form.retainage_payment_days) : ''
  const money = (v, c) => { if (v === '' || v == null) return '—'; try { return new Intl.NumberFormat(language, { style: 'currency', currency: c || 'BRL' }).format(Number(v) || 0) } catch { return String(v) } }
  const date = (v) => (v ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(`${v}T12:00:00`)) : '—')

  async function lookupPostal(raw) {
    if ((form.country_code || 'BR').toUpperCase() !== 'BR') { setAddressStatus(t('form.addressIntl')); return }
    const cep = String(raw || '').replace(/\D/g, '')
    if (!cep) { setAddressStatus(''); return }
    if (cep.length !== 8) { setAddressStatus(t('form.cepInvalid')); return }
    setAddressStatus(t('form.cepLooking'))
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`), d = await r.json()
      if (!r.ok || d.erro) throw new Error(t('form.cepNotFound'))
      setForm((v) => ({ ...v, postal_code: d.cep || raw, address_line: d.logradouro || v.address_line, neighborhood: d.bairro || v.neighborhood, city: d.localidade || v.city, state_region: d.uf || v.state_region, country_code: 'BR', latitude: '', longitude: '' }))
      setAddressStatus(t('form.cepFound'))
    } catch (e) { setAddressStatus(e.message || t('form.cepNotFound')) }
  }

  async function findCoordinates() {
    const q = [form.address_line, form.address_number, form.neighborhood, form.city, form.state_region, form.postal_code, form.country_code === 'OTHER' ? '' : form.country_code].filter(Boolean).join(', ')
    if (!form.city && !form.postal_code) { setAddressStatus(t('form.coordsNeedAddress')); return }
    setGeocoding(true); setAddressStatus(t('form.coordsFinding'))
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': language } }), d = await r.json()
      if (!r.ok || !d?.length) throw new Error(t('form.coordsNotFound'))
      setForm((v) => ({ ...v, latitude: d[0].lat, longitude: d[0].lon }))
      setAddressStatus(t('form.coordsFound'))
    } catch (e) { setAddressStatus(e.message || t('form.coordsNotFound')) } finally { setGeocoding(false) }
  }

  function goTo(next) {
    if (next > step && step === 0 && !form.name.trim()) { setError(t('form.errName')); return }
    setError(''); setStep(next)
  }

  async function submit() {
    if (!form.name.trim()) { setError(t('form.errName')); setStep(0); return }
    setSaving(true); setError('')
    const message = await onSubmit(toProjectPayload(form))
    if (message) { setError(message); setSaving(false) }
  }

  const last = STEPS.length - 1

  return <div className={styles.workspace}>
    <nav className={styles.steps} aria-label={t('form.stepsLabel')}>
      {STEPS.map((key, i) => <button key={key} type="button" className={`${styles.step} ${i === step ? styles.stepOn : ''}`} onClick={() => goTo(i)}>
        <span className={`${styles.mark} ${i < step ? styles.markDone : ''}`}>{i < step ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}</span>
        <span className={styles.stepText}>{t(`form.step.${key}`)}<small>{t(`form.step.${key}Hint`)}</small></span>
      </button>)}
    </nav>

    <div className={styles.area}>
      <div className={styles.scroll}>
        <div className={styles.heading}>
          <small>{t('form.stepOf', { current: step + 1, total: STEPS.length })}</small>
          <h1>{t(`form.step.${STEPS[step]}`)}</h1>
          <p>{t(`form.${mode}.${STEPS[step]}`)}</p>
        </div>
        <div className={styles.card}>
          {step === 0 && <div className={styles.grid}>
            <Field t={t} k="name" wide><input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
            <Field t={t} k="client"><input value={form.client_name} onChange={(e) => set('client_name', e.target.value)} /></Field>
            <Field t={t} k="contractNumber"><input value={form.contract_number} onChange={(e) => set('contract_number', e.target.value)} /></Field>
            <Field t={t} k="status"><select value={STATUSES.includes(form.status) ? form.status : 'planning'} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></Field>
            <div className={styles.note}><b>{t('form.sharedTitle')}</b><span>{t('form.sharedText')}</span></div>
          </div>}

          {step === 1 && <div className={styles.grid}>
            <Field t={t} k="country"><select value={form.country_code} onChange={(e) => { setForm((v) => ({ ...v, country_code: e.target.value, postal_code: '', latitude: '', longitude: '' })); setAddressStatus('') }}>{COUNTRIES.map((c) => <option key={c} value={c}>{t(`country.${c}`)}</option>)}</select></Field>
            <Field t={t} k={form.country_code === 'BR' ? 'cep' : 'postalCode'}><input value={form.postal_code} onChange={(e) => { set('postal_code', e.target.value); if (form.country_code === 'BR' && e.target.value.replace(/\D/g, '').length === 8) lookupPostal(e.target.value) }} onBlur={(e) => form.country_code === 'BR' && lookupPostal(e.target.value)} /></Field>
            <Field t={t} k="address" wide><input value={form.address_line} onChange={(e) => set('address_line', e.target.value)} /></Field>
            <Field t={t} k="number"><input value={form.address_number} onChange={(e) => set('address_number', e.target.value)} /></Field>
            <Field t={t} k="neighborhood"><input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} /></Field>
            <Field t={t} k="city"><input value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field t={t} k="state"><input value={form.state_region} onChange={(e) => set('state_region', e.target.value)} /></Field>
            <Field t={t} k="latitude"><input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} /></Field>
            <Field t={t} k="longitude"><input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} /></Field>
            <div className={styles.note}><b>{t('form.locationTitle')}</b><span>{addressStatus || t('form.locationText')}</span>
              <button type="button" className={ui.btn} style={{ marginTop: 10, justifySelf: 'start' }} onClick={findCoordinates} disabled={geocoding}>{geocoding ? t('form.coordsFindingShort') : t('form.findCoordinates')}</button></div>
          </div>}

          {step === 2 && <div className={styles.grid}>
            <Field t={t} k="contractValue"><input type="number" min="0" step="0.01" value={form.contract_value} onChange={(e) => set('contract_value', e.target.value)} /></Field>
            <Field t={t} k="currency"><select value={form.currency_code} onChange={(e) => set('currency_code', e.target.value)}>{[...new Set([...CURRENCIES, form.currency_code])].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field t={t} k="billingMethod"><select value={form.billing_method} onChange={(e) => set('billing_method', e.target.value)}>{BILLING.map((b) => <option key={b} value={b}>{t(`billing.${b}`)}</option>)}</select></Field>
            <Field t={t} k="billingCycle"><select value={form.billing_cycle} onChange={(e) => set('billing_cycle', e.target.value)}>{CYCLES.map((c) => <option key={c} value={c}>{t(`cycle.${c}`)}</option>)}</select></Field>
            <Field t={t} k="cutoffDay"><input type="number" min="1" max="31" value={form.billing_cutoff_day} onChange={(e) => set('billing_cutoff_day', e.target.value)} placeholder="25" /></Field>
            <Field t={t} k="paymentTerms" hint={form.payment_terms_days !== '' ? t('form.net', { days: form.payment_terms_days }) : ''}><input type="number" min="0" value={form.payment_terms_days} onChange={(e) => set('payment_terms_days', e.target.value)} placeholder="30" /></Field>
            <label className={`${styles.switchRow} ${styles.wide}`}><span><b>{t('form.hasRetainage')}</b><small>{t('form.hasRetainageHint')}</small></span><input type="checkbox" checked={form.has_retainage} onChange={(e) => set('has_retainage', e.target.checked)} /></label>
            {form.has_retainage && <>
              <Field t={t} k="retainagePercent"><input type="number" min="0" max="100" value={form.retainage_percent} onChange={(e) => set('retainage_percent', e.target.value)} /></Field>
              <Field t={t} k="retainageValue"><input value={money(retainageValue, form.currency_code)} readOnly disabled /></Field>
              <Field t={t} k="retainageDays"><input type="number" min="0" value={form.retainage_payment_days} onChange={(e) => set('retainage_payment_days', e.target.value)} /></Field>
            </>}
            <label className={`${styles.switchRow} ${styles.wide}`}><span><b>{t('form.materialIncluded')}</b><small>{t('form.materialIncludedHint')}</small></span><input type="checkbox" checked={form.material_included} onChange={(e) => set('material_included', e.target.checked)} /></label>
            {form.material_included && <Field t={t} k="materialValue"><input type="number" min="0" step="0.01" value={form.material_value} onChange={(e) => set('material_value', e.target.value)} /></Field>}
          </div>}

          {step === 3 && <div className={styles.grid}>
            <Field t={t} k="plannedStart"><input type="date" value={form.planned_start_date} onChange={(e) => set('planned_start_date', e.target.value)} /></Field>
            <Field t={t} k="term"><input type="number" min="0" value={form.contractual_term_days} onChange={(e) => set('contractual_term_days', e.target.value)} /></Field>
            <Field t={t} k="plannedFinish"><input type="date" value={plannedEnd} readOnly disabled /></Field>
            {form.has_retainage && <Field t={t} k="retainageDate"><input type="date" value={retainageDate} readOnly disabled /></Field>}
            <Field t={t} k="successCriteria" wide><textarea value={form.success_criteria} onChange={(e) => set('success_criteria', e.target.value)} rows={6} placeholder={t('form.successPlaceholder')} /></Field>
          </div>}

          {step === 4 && <dl className={styles.review}>
            <div><dt>{t('form.name')}</dt><dd>{form.name || '—'}</dd></div>
            <div><dt>{t('form.client')}</dt><dd>{form.client_name || '—'}</dd></div>
            <div><dt>{t('form.status')}</dt><dd>{t(`status.${STATUSES.includes(form.status) ? form.status : 'planning'}`)}</dd></div>
            <div><dt>{t('form.reviewLocation')}</dt><dd>{[form.city, form.state_region, form.country_code !== 'OTHER' ? t(`country.${form.country_code}`) : ''].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt>{t('form.contractValue')}</dt><dd>{money(form.contract_value, form.currency_code)}</dd></div>
            <div><dt>{t('form.billingMethod')}</dt><dd>{t(`billing.${form.billing_method}`)}<small>{t(`cycle.${form.billing_cycle}`)}{form.billing_cutoff_day ? ` · ${t('form.cutoffShort', { day: form.billing_cutoff_day })}` : ''}{form.payment_terms_days !== '' ? ` · ${t('form.net', { days: form.payment_terms_days })}` : ''}</small></dd></div>
            <div><dt>{t('form.reviewRetainage')}</dt><dd>{form.has_retainage ? `${form.retainage_percent || 0}% · ${money(retainageValue, form.currency_code)}` : t('form.noRetainage')}</dd></div>
            <div><dt>{t('form.reviewSchedule')}</dt><dd>{date(form.planned_start_date)} → {date(plannedEnd)}</dd></div>
            <div className={styles.wide}><dt>{t('form.successCriteria')}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{form.success_criteria || '—'}</dd></div>
          </dl>}

          {error && <div className={styles.error} role="alert">{error}</div>}
        </div>
      </div>
      <footer className={styles.footer}>
        <button type="button" className={ui.btn} disabled={step === 0 || saving} onClick={() => goTo(step - 1)}>{t('form.back')}</button>
        <span>{t('form.laterHint')}</span>
        {step < last
          ? <button type="button" className={ui.btnPrimary} onClick={() => goTo(step + 1)}>{t('form.continue')}</button>
          : <button type="button" className={ui.btnPrimary} disabled={saving} onClick={submit}>{saving ? t(`form.${mode}.saving`) : t(`form.${mode}.submit`)}</button>}
      </footer>
    </div>
  </div>
}
