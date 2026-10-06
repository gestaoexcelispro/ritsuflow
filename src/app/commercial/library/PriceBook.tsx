'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { COUNTRIES } from '@/lib/takeoff/wallTypes'
import { CURRENCIES, PRICE_ITEM_COLUMNS, PRICE_KINDS, currencyOf, groupPrices, today, type PriceItemRow, type PriceKind } from '@/lib/commercial/library'
import { formatDate, formatUnitCost, toInput } from '@/lib/commercial/format'
import { priceTemplateCsv, readPriceCsv, type ImportResult } from '@/lib/commercial/csvImport'
import { useCommercialAccess } from '../license'
import { ui } from '../ui'

type Material = { id: string; name: string; unit: string; code: string | null }

type Form = {
  id: string | null
  kind: PriceKind
  materialId: string | null
  code: string
  name: string
  unit: string
  currency: string
  unitCost: string
  supplier: string
  validFrom: string
  notes: string
}

/** Library → Price book: unit costs by product, with the date each price is valid from. */
export default function PriceBook() {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const { licensed, organizationId } = useCommercialAccess()
  const [country, setCountry] = useState('BR')
  const [kind, setKind] = useState<PriceKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<PriceItemRow[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [imported, setImported] = useState<(ImportResult & { fileName: string }) | null>(null)
  const onDate = today()

  const load = useCallback(async () => {
    const supabase = createClient()
    const [prices, catalog] = await Promise.all([
      supabase.from('commercial_price_items').select(PRICE_ITEM_COLUMNS).eq('country_code', country).order('name').limit(2000),
      supabase.from('takeoff_materials').select('id, name, unit, code').eq('country_code', country).order('name').limit(2000),
    ])
    setLoading(false)
    if (prices.error) { setError(t('error.load', { message: prices.error.message })); return }
    setError('')
    setRows((prices.data || []) as PriceItemRow[])
    setMaterials((catalog.data || []) as Material[])
  }, [country, t])

  useEffect(() => { void load() }, [load])

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase()
    return groupPrices(rows, onDate)
      .filter(g => {
        const r = g.current || g.history[0]
        if (kind !== 'all' && r.kind !== kind) return false
        return !s || r.name.toLowerCase().includes(s) || (r.code || '').toLowerCase().includes(s) || (r.supplier || '').toLowerCase().includes(s)
      })
      .sort((a, b) => (a.history[0].name > b.history[0].name ? 1 : -1))
  }, [rows, onDate, search, kind])

  const materialById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials])

  function blank(): Form {
    return { id: null, kind: 'material', materialId: null, code: '', name: '', unit: '', currency: currencyOf(country), unitCost: '', supplier: '', validFrom: onDate, notes: '' }
  }

  function fromRow(r: PriceItemRow, asNewPrice: boolean): Form {
    return {
      id: asNewPrice ? null : r.id, kind: r.kind, materialId: r.material_id, code: r.code || '', name: r.name, unit: r.unit,
      currency: r.currency_code, unitCost: asNewPrice ? '' : toInput(r.unit_cost, numberFormat), supplier: r.supplier || '',
      validFrom: asNewPrice ? onDate : r.valid_from, notes: asNewPrice ? '' : r.notes || '',
    }
  }

  function pickMaterial(name: string) {
    if (!form) return
    const hit = materials.find(m => m.name.toLowerCase() === name.trim().toLowerCase())
    setForm({ ...form, name, materialId: hit?.id ?? null, unit: hit ? hit.unit : form.unit, code: hit?.code ?? form.code })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const cost = parseLocaleNumber(form.unitCost)
    if (!form.name.trim() || !form.unit.trim()) { setError(t('prices.errRequired')); return }
    if (!(cost >= 0)) { setError(t('prices.errCost')); return }
    if (!organizationId) { setError(t('error.noCompany')); return }
    setSaving(true); setError('')
    const payload = {
      organization_id: organizationId, country_code: country, currency_code: form.currency, kind: form.kind,
      material_id: form.kind === 'material' ? form.materialId : null, code: form.code.trim() || null, name: form.name.trim(),
      unit: form.unit.trim(), unit_cost: cost, supplier: form.supplier.trim() || null, valid_from: form.validFrom || onDate, notes: form.notes.trim() || null,
    }
    const supabase = createClient()
    const res = form.id
      ? await supabase.from('commercial_price_items').update(payload).eq('id', form.id)
      : await supabase.from('commercial_price_items').insert(payload)
    setSaving(false)
    if (res.error) { setError(t('error.save', { message: res.error.message })); return }
    setForm(null); setMessage(t('prices.saved')); void load()
  }

  async function remove() {
    if (!form?.id || !window.confirm(t('prices.confirmDelete'))) return
    setSaving(true)
    const { error: e } = await createClient().from('commercial_price_items').delete().eq('id', form.id)
    setSaving(false)
    if (e) { setError(t('error.save', { message: e.message })); return }
    setForm(null); setMessage(t('prices.deleted')); void load()
  }

  async function pickCsv(file: File) {
    setError(''); setMessage('')
    const text = await file.text()
    setImported({ ...readPriceCsv(text, language !== 'en-US'), fileName: file.name })
  }

  function downloadTemplate() {
    const blob = new Blob([priceTemplateCsv(language)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${t('import.templateName')}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function runImport() {
    if (!imported || !organizationId) { if (!organizationId) setError(t('error.noCompany')); return }
    setSaving(true); setError('')
    const byName = new Map(materials.map(m => [`${m.name.trim().toLowerCase()}|${m.unit.trim().toLowerCase()}`, m.id]))
    const payload = imported.rows.map(r => ({
      organization_id: organizationId, country_code: country, currency_code: r.currency || currencyOf(country), kind: r.kind,
      material_id: r.kind === 'material' ? byName.get(`${r.name.trim().toLowerCase()}|${r.unit.trim().toLowerCase()}`) ?? null : null,
      code: r.code, name: r.name, unit: r.unit, unit_cost: r.unitCost, supplier: r.supplier, valid_from: r.validFrom || onDate,
    }))
    const supabase = createClient()
    for (let i = 0; i < payload.length; i += 500) {
      const { error: e } = await supabase.from('commercial_price_items').insert(payload.slice(i, i + 500))
      if (e) { setSaving(false); setError(t('import.failedAt', { done: i, message: e.message })); void load(); return }
    }
    setSaving(false)
    setMessage(t('import.done', { count: payload.length, linked: payload.filter(p => p.material_id).length }))
    setImported(null); void load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={ui.toolbar}>
        <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center' }}>{t('field.country')}
          <select value={country} onChange={e => { setCountry(e.target.value); setForm(null) }} style={ui.input}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{language === 'pt-BR' ? c.name['pt-BR'] : c.name['en-US']}</option>)}
          </select>
        </label>
        <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center' }}>{t('field.kind')}
          <select value={kind} onChange={e => setKind(e.target.value as PriceKind | 'all')} style={ui.input}>
            <option value="all">{t('prices.allKinds')}</option>
            {PRICE_KINDS.map(k => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
          </select>
        </label>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('prices.search')} aria-label={t('prices.search')} style={{ ...ui.input, flex: '1 1 220px' }} />
        {licensed && <>
          <button type="button" style={ui.buttonGhost} onClick={downloadTemplate}>{t('import.template')}</button>
          <label style={{ ...ui.buttonGhost, display: 'inline-flex', alignItems: 'center' }}>
            {t('import.button')}
            <input type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pickCsv(f) }} />
          </label>
          <button type="button" style={ui.button} onClick={() => { setForm(blank()); setMessage('') }}>{t('prices.add')}</button>
        </>}
      </div>

      {error && <div role="alert" style={ui.error}>{error}</div>}
      {message && <div role="status" style={ui.notice}>{message}</div>}

      {imported && (
        <div style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong style={{ fontSize: 14, color: '#173441' }}>{t('import.previewTitle', { file: imported.fileName })}</strong>
          {imported.missingColumns.length > 0 ? (
            <div role="alert" style={ui.error}>{t('import.missingColumns', { columns: imported.missingColumns.map(c => t(`import.col.${c}`)).join(', ') })}</div>
          ) : <>
            <span style={{ fontSize: 13, color: '#294955' }}>{t('import.summary', { ok: imported.rows.length, bad: imported.errors.length })}</span>
            {imported.errors.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#8a4413', maxHeight: 120, overflowY: 'auto' }}>
                {imported.errors.slice(0, 50).map(er => <li key={er.line}>{t('import.errLine', { line: er.line, reason: t(`import.reason.${er.reason}`) })}</li>)}
              </ul>
            )}
            {imported.rows.length > 0 && (
              <div style={{ ...ui.tableWrap, maxHeight: 220, overflowY: 'auto' }}>
                <table style={{ ...ui.table, minWidth: 560 }}>
                  <thead><tr><th style={ui.th}>{t('field.name')}</th><th style={ui.th}>{t('field.unit')}</th><th style={{ ...ui.th, ...ui.num }}>{t('field.unitCost')}</th><th style={ui.th}>{t('field.validFrom')}</th></tr></thead>
                  <tbody>{imported.rows.slice(0, 8).map(r => (
                    <tr key={r.line}><td style={ui.td}>{r.name}</td><td style={ui.td}>{r.unit}</td>
                      <td style={{ ...ui.td, ...ui.num }}>{formatUnitCost(r.unitCost, r.currency || currencyOf(country), numberFormat)}</td>
                      <td style={ui.td}>{formatDate(r.validFrom || onDate, language)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <span style={ui.small}>{t('import.note')}</span>
          </>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {imported.rows.length > 0 && imported.missingColumns.length === 0 && (
              <button type="button" disabled={saving} onClick={runImport} style={ui.button}>{saving ? t('action.saving') : t('import.confirm', { count: imported.rows.length })}</button>
            )}
            <button type="button" onClick={() => setImported(null)} style={ui.buttonGhost}>{t('action.cancel')}</button>
          </div>
        </div>
      )}

      {form && (
        <form onSubmit={save} style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong style={{ fontSize: 14, color: '#173441' }}>{form.id ? t('prices.editTitle') : t('prices.newTitle')}</strong>
          <div style={ui.formGrid}>
            <label style={ui.label}>{t('field.kind')}
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as PriceKind })} style={ui.input}>
                {PRICE_KINDS.map(k => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
              </select>
            </label>
            <label style={{ ...ui.label, gridColumn: 'span 2' }}>{t('field.name')}
              <input value={form.name} onChange={e => form.kind === 'material' ? pickMaterial(e.target.value) : setForm({ ...form, name: e.target.value })}
                list={form.kind === 'material' ? 'commercial-materials' : undefined} required style={ui.input} />
              <small style={{ fontWeight: 400, color: '#4f6670' }}>{form.materialId ? t('prices.linked') : form.kind === 'material' ? t('prices.notLinked') : ''}</small>
            </label>
            <label style={ui.label}>{t('field.code')}<input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={ui.input} /></label>
            <label style={ui.label}>{t('field.unit')}<input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} required style={ui.input} /></label>
            <label style={ui.label}>{t('field.currency')}
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} style={ui.input}>
                {[...new Set([...CURRENCIES, form.currency])].map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label style={ui.label}>{t('field.unitCost')}<input inputMode="decimal" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} required style={ui.input} /></label>
            <label style={ui.label}>{t('field.validFrom')}<input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} required style={ui.input} /></label>
            <label style={ui.label}>{t('field.supplier')}<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={ui.input} /></label>
            <label style={{ ...ui.label, gridColumn: '1 / -1' }}>{t('field.notes')}<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={ui.input} /></label>
          </div>
          <datalist id="commercial-materials">{materials.map(m => <option key={m.id} value={m.name}>{m.unit}</option>)}</datalist>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="submit" disabled={saving} style={ui.button}>{saving ? t('action.saving') : t('action.save')}</button>
            <button type="button" onClick={() => setForm(null)} style={ui.buttonGhost}>{t('action.cancel')}</button>
            <span style={{ flex: 1 }} />
            {form.id && <button type="button" onClick={remove} disabled={saving} style={ui.buttonDanger}>{t('action.delete')}</button>}
          </div>
        </form>
      )}

      {loading ? <div style={ui.muted}>{t('loading')}</div> : groups.length === 0 ? (
        <div style={ui.empty}>{t('prices.empty')}</div>
      ) : (
        <div style={ui.tableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>{t('field.name')}</th>
                <th style={ui.th}>{t('field.kind')}</th>
                <th style={ui.th}>{t('field.unit')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('prices.current')}</th>
                <th style={ui.th}>{t('field.validFrom')}</th>
                <th style={ui.th}>{t('field.supplier')}</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const r = g.current || g.history[0]
                const key = r.material_id || `${r.name}|${r.unit}|${r.currency_code}`
                const linked = r.material_id ? materialById.get(r.material_id) : null
                return [
                  <tr key={key}>
                    <td style={ui.td}>
                      <strong style={{ fontWeight: 600 }}>{r.name}</strong>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        {r.code && <span style={ui.chip}>{r.code}</span>}
                        {linked && <span style={ui.chipTeal}>{t('prices.catalog')}</span>}
                        {g.upcoming.length > 0 && <span style={ui.chipOrange}>{t('prices.upcoming', { date: formatDate(g.upcoming[g.upcoming.length - 1].valid_from, language) })}</span>}
                      </div>
                    </td>
                    <td style={ui.td}>{t(`kind.${r.kind}`)}</td>
                    <td style={ui.td}>{r.unit}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{g.current ? formatUnitCost(g.current.unit_cost, g.current.currency_code, numberFormat) : t('prices.notYet')}</td>
                    <td style={ui.td}>{formatDate(r.valid_from, language)}</td>
                    <td style={ui.td}>{r.supplier || '—'}</td>
                    <td style={{ ...ui.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {g.history.length > 1 && (
                        <button type="button" style={{ ...ui.buttonSmall, marginRight: 6 }} aria-expanded={openHistory === key} onClick={() => setOpenHistory(openHistory === key ? null : key)}>
                          {t('prices.history', { count: g.history.length })}
                        </button>
                      )}
                      {licensed && <>
                        <button type="button" style={{ ...ui.buttonSmall, marginRight: 6 }} onClick={() => { setForm(fromRow(r, true)); setMessage('') }}>{t('prices.newPrice')}</button>
                        <button type="button" style={ui.buttonSmall} onClick={() => { setForm(fromRow(r, false)); setMessage('') }}>{t('action.edit')}</button>
                      </>}
                    </td>
                  </tr>,
                  openHistory === key && g.history.map(h => (
                    <tr key={h.id} style={{ background: '#f9fbfc' }}>
                      <td style={{ ...ui.td, paddingLeft: 28, color: '#4f6670' }} colSpan={3}>{h.supplier || h.notes || ''}</td>
                      <td style={{ ...ui.td, ...ui.num }}>{formatUnitCost(h.unit_cost, h.currency_code, numberFormat)}</td>
                      <td style={ui.td}>{formatDate(h.valid_from, language)}</td>
                      <td style={ui.td} colSpan={2}>
                        {licensed && <button type="button" style={ui.buttonSmall} onClick={() => setForm(fromRow(h, false))}>{t('action.edit')}</button>}
                      </td>
                    </tr>
                  )),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ ...ui.small, margin: 0 }}>{t('prices.footnote')}</p>
    </div>
  )
}
