'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { COUNTRIES } from '@/lib/takeoff/wallTypes'
import { CURRENCIES, LABOR_RATE_COLUMNS, currencyOf, today, type LaborRateRow } from '@/lib/commercial/library'
import { effective, loadedRate } from '@/lib/commercial/pricing'
import { formatDate, formatPct, formatUnitCost, toInput } from '@/lib/commercial/format'
import { useCommercialAccess } from '../license'
import { ui } from '../ui'

type Form = { id: string | null; trade: string; name: string; currency: string; baseRate: string; burden: string; validFrom: string; notes: string }

/** Turns "Montador de drywall" into "montador_de_drywall" (the code recipes point at). */
function tradeCode(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
}

/** Library → Labor rates: hourly rates per trade, with burden (encargos sociais / labor burden). */
export default function LaborRates() {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const { canEditLibrary: licensed, organizationId } = useCommercialAccess()
  const [country, setCountry] = useState('BR')
  const [rows, setRows] = useState<LaborRateRow[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const onDate = today()

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().from('commercial_labor_rates').select(LABOR_RATE_COLUMNS).eq('country_code', country).order('name')
    setLoading(false)
    if (e) { setError(t('error.load', { message: e.message })); return }
    setError(''); setRows((data || []) as LaborRateRow[])
  }, [country, t])

  useEffect(() => { void load() }, [load])

  const trades = useMemo(() => {
    const byTrade = new Map<string, LaborRateRow[]>()
    for (const r of rows) byTrade.set(r.trade, [...(byTrade.get(r.trade) || []), r])
    return [...byTrade.entries()].map(([trade, list]) => ({
      trade,
      current: effective(list, onDate),
      latest: [...list].sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0],
      count: list.length,
    })).sort((a, b) => (a.latest.name > b.latest.name ? 1 : -1))
  }, [rows, onDate])

  function blank(): Form {
    return { id: null, trade: '', name: '', currency: currencyOf(country), baseRate: '', burden: '', validFrom: onDate, notes: '' }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const base = parseLocaleNumber(form.baseRate)
    const burden = form.burden.trim() ? parseLocaleNumber(form.burden) : 0
    const trade = form.trade.trim() || tradeCode(form.name)
    if (!form.name.trim() || !trade) { setError(t('labor.errRequired')); return }
    if (!(base >= 0) || !(burden >= 0)) { setError(t('labor.errNumbers')); return }
    if (!organizationId) { setError(t('error.noCompany')); return }
    setSaving(true); setError('')
    const payload = {
      organization_id: organizationId, country_code: country, currency_code: form.currency, trade, name: form.name.trim(),
      base_rate_hour: base, burden_pct: burden, valid_from: form.validFrom || onDate, notes: form.notes.trim() || null,
    }
    const supabase = createClient()
    const res = form.id
      ? await supabase.from('commercial_labor_rates').update(payload).eq('id', form.id)
      : await supabase.from('commercial_labor_rates').insert(payload)
    setSaving(false)
    if (res.error) {
      setError(/duplicate key/i.test(res.error.message) ? t('labor.errDuplicate') : t('error.save', { message: res.error.message }))
      return
    }
    setForm(null); setMessage(t('labor.saved')); void load()
  }

  async function remove() {
    if (!form?.id || !window.confirm(t('labor.confirmDelete'))) return
    const { error: e } = await createClient().from('commercial_labor_rates').delete().eq('id', form.id)
    if (e) { setError(t('error.save', { message: e.message })); return }
    setForm(null); setMessage(t('labor.deleted')); void load()
  }

  const preview = form ? parseLocaleNumber(form.baseRate) * (1 + (form.burden.trim() ? parseLocaleNumber(form.burden) : 0) / 100) : NaN

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={ui.toolbar}>
        <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center' }}>{t('field.country')}
          <select value={country} onChange={e => { setCountry(e.target.value); setForm(null) }} style={ui.input}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{language === 'pt-BR' ? c.name['pt-BR'] : c.name['en-US']}</option>)}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        {licensed && <button type="button" style={ui.button} onClick={() => { setForm(blank()); setMessage('') }}>{t('labor.add')}</button>}
      </div>

      {error && <div role="alert" style={ui.error}>{error}</div>}
      {message && <div role="status" style={ui.notice}>{message}</div>}

      {form && (
        <form onSubmit={save} style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong style={{ fontSize: 14, color: '#173441' }}>{form.id ? t('labor.editTitle') : t('labor.newTitle')}</strong>
          <div style={ui.formGrid}>
            <label style={{ ...ui.label, gridColumn: 'span 2' }}>{t('labor.trade')}
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={ui.input} />
            </label>
            <label style={ui.label}>{t('labor.code')}
              <input value={form.trade} onChange={e => setForm({ ...form, trade: e.target.value })} placeholder={tradeCode(form.name)} pattern="[a-z0-9_]+" disabled={!!form.id} style={ui.input} />
            </label>
            <label style={ui.label}>{t('field.currency')}
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} style={ui.input}>
                {[...new Set([...CURRENCIES, form.currency])].map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label style={ui.label}>{t('labor.baseRate')}<input inputMode="decimal" value={form.baseRate} onChange={e => setForm({ ...form, baseRate: e.target.value })} required style={ui.input} /></label>
            <label style={ui.label}>{t('labor.burden')}<input inputMode="decimal" value={form.burden} onChange={e => setForm({ ...form, burden: e.target.value })} placeholder="0" style={ui.input} /></label>
            <label style={ui.label}>{t('field.validFrom')}<input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} required style={ui.input} /></label>
            <label style={{ ...ui.label, gridColumn: '1 / -1' }}>{t('field.notes')}<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={ui.input} /></label>
          </div>
          <div style={ui.small}>{t('labor.loadedPreview', { value: formatUnitCost(preview, form.currency, numberFormat) })}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="submit" disabled={saving} style={ui.button}>{saving ? t('action.saving') : t('action.save')}</button>
            <button type="button" onClick={() => setForm(null)} style={ui.buttonGhost}>{t('action.cancel')}</button>
            <span style={{ flex: 1 }} />
            {form.id && <button type="button" onClick={remove} style={ui.buttonDanger}>{t('action.delete')}</button>}
          </div>
        </form>
      )}

      {loading ? <div style={ui.muted}>{t('loading')}</div> : trades.length === 0 ? (
        <div style={ui.empty}>{t('labor.empty')}</div>
      ) : (
        <div style={ui.tableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>{t('labor.trade')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('labor.baseRate')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('labor.burden')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('labor.loaded')}</th>
                <th style={ui.th}>{t('field.validFrom')}</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {trades.map(({ trade, current, latest, count }) => {
                const r = current || latest
                return (
                  <tr key={trade}>
                    <td style={ui.td}>
                      <strong style={{ fontWeight: 600 }}>{r.name}</strong>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={ui.chip}>{trade}</span>
                        {count > 1 && <span style={ui.chip}>{t('labor.versions', { count })}</span>}
                        {!current && <span style={ui.chipOrange}>{t('prices.notYet')}</span>}
                      </div>
                    </td>
                    <td style={{ ...ui.td, ...ui.num }}>{formatUnitCost(r.base_rate_hour, r.currency_code, numberFormat)}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{formatPct(r.burden_pct, numberFormat)}</td>
                    <td style={{ ...ui.td, ...ui.num, fontWeight: 700 }}>{formatUnitCost(loadedRate(r), r.currency_code, numberFormat)}</td>
                    <td style={ui.td}>{formatDate(r.valid_from, language)}</td>
                    <td style={{ ...ui.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {licensed && <>
                        <button type="button" style={{ ...ui.buttonSmall, marginRight: 6 }} onClick={() => setForm({ id: null, trade: r.trade, name: r.name, currency: r.currency_code, baseRate: '', burden: toInput(r.burden_pct, numberFormat), validFrom: onDate, notes: '' })}>{t('labor.newRate')}</button>
                        <button type="button" style={ui.buttonSmall} onClick={() => setForm({ id: r.id, trade: r.trade, name: r.name, currency: r.currency_code, baseRate: toInput(r.base_rate_hour, numberFormat), burden: toInput(r.burden_pct, numberFormat), validFrom: r.valid_from, notes: r.notes || '' })}>{t('action.edit')}</button>
                      </>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ ...ui.small, margin: 0 }}>{t('labor.footnote')}</p>
    </div>
  )
}
