'use client'

import { FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { COST_CATEGORIES, costPerformance, costTemplateCsv, readCostCsv, type CostCategory, type CostImportResult, type CostRow, type CostVariance } from '@/lib/commercial/costs'
import type { ItemRow } from '@/lib/commercial/estimates'
import { today } from '@/lib/commercial/library'
import { formatDate, formatMoney, formatPct, formatQty, toInput } from '@/lib/commercial/format'
import { ui } from '../ui'

type Props = {
  projectId: string
  currency: string
  items: ItemRow[]
  costs: CostRow[]
  variance: CostVariance
  earned: number
  editable: boolean
  onChanged: () => void
}

type Form = { id: string | null; date: string; description: string; category: CostCategory; amount: string; supplier: string; document: string; itemId: string }

/** Converted project → actual costs in money: entries, CSV import, and cost against budget and earned value. */
export default function CostsSection({ projectId, currency, items, costs, variance, earned, editable, onChanged }: Props) {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const [form, setForm] = useState<Form | null>(null)
  const [imported, setImported] = useState<(CostImportResult & { fileName: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showAll, setShowAll] = useState(false)
  const money = (v: number) => formatMoney(v, currency, numberFormat)
  const itemName = useMemo(() => new Map(items.map(i => [i.id, i.description])), [items])
  const perf = costPerformance(earned, variance.actual)
  const lastBatch = costs.filter(c => c.import_batch).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]?.import_batch || null

  async function run(task: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('')
    try { await task() } catch (e) { setError(t('error.save', { message: e instanceof Error ? e.message : String(e) })) } finally { setBusy(false) }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const amount = parseLocaleNumber(form.amount)
    if (!form.description.trim()) { setError(t('costs.errDescription')); return }
    if (!Number.isFinite(amount)) { setError(t('costs.errAmount')); return }
    await run(async () => {
      const row = {
        project_id: projectId, incurred_on: form.date, description: form.description.trim(), category: form.category,
        amount: Math.round(amount * 100) / 100, supplier: form.supplier.trim() || null, document: form.document.trim() || null,
        estimate_item_id: form.itemId || null, currency_code: currency,
      }
      const supabase = createClient()
      const res = form.id ? await supabase.from('commercial_actual_costs').update(row).eq('id', form.id) : await supabase.from('commercial_actual_costs').insert(row)
      if (res.error) throw new Error(res.error.message)
      setForm(null); onChanged()
    })
  }

  async function remove(c: CostRow) {
    if (!window.confirm(t('costs.confirmRemove'))) return
    await run(async () => {
      const { error: e } = await createClient().from('commercial_actual_costs').delete().eq('id', c.id)
      if (e) throw new Error(e.message)
      onChanged()
    })
  }

  async function confirmImport() {
    if (!imported?.rows.length) return
    await run(async () => {
      const batch = crypto.randomUUID()
      const rows = imported.rows.map(r => ({
        project_id: projectId, incurred_on: r.incurredOn, description: r.description, category: r.category, amount: r.amount,
        supplier: r.supplier, document: r.document, quantity: r.quantity, unit: r.unit, estimate_item_id: r.itemId,
        currency_code: currency, source: 'import', import_batch: batch,
      }))
      for (let i = 0; i < rows.length; i += 500) {
        const { error: e } = await createClient().from('commercial_actual_costs').insert(rows.slice(i, i + 500))
        if (e) throw new Error(e.message)
      }
      setMessage(t('costs.imported', { count: rows.length })); setImported(null); onChanged()
    })
  }

  async function undoImport() {
    if (!lastBatch || !window.confirm(t('costs.confirmUndo', { count: costs.filter(c => c.import_batch === lastBatch).length }))) return
    await run(async () => {
      const { error: e } = await createClient().from('commercial_actual_costs').delete().eq('project_id', projectId).eq('import_batch', lastBatch)
      if (e) throw new Error(e.message)
      onChanged()
    })
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([costTemplateCsv(language)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = t('costs.templateFile')
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const tile = (label: string, value: string, hint: string, tone?: 'good' | 'bad') => (
    <div style={{ ...ui.card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={ui.small}>{label}</span>
      <strong style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums', color: tone === 'good' ? '#075a53' : tone === 'bad' ? '#a8521f' : '#173441' }}>{value}</strong>
      <span style={ui.small}>{hint}</span>
    </div>
  )
  const sorted = [...costs].sort((a, b) => (a.incurred_on < b.incurred_on ? 1 : a.incurred_on > b.incurred_on ? -1 : 0))
  const shown = showAll ? sorted : sorted.slice(0, 25)
  const tone = perf.cpi == null ? undefined : perf.cpi >= 1 ? 'good' : 'bad'

  return (
    <section aria-labelledby="costs-title" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8, borderTop: '1px solid #dfe7ea' }}>
      <div style={ui.toolbar}>
        <strong id="costs-title" style={{ fontSize: 16, color: '#173441' }}>{t('costs.title')}</strong>
        <span style={{ flex: 1 }} />
        {editable && <>
          <button type="button" style={ui.button} disabled={busy} onClick={() => setForm({ id: null, date: today(), description: '', category: 'material', amount: '', supplier: '', document: '', itemId: '' })}>{t('costs.add')}</button>
          <label style={{ ...ui.buttonGhost, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            {t('costs.import')}
            <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={async e => {
              const file = e.target.files?.[0]; e.target.value = ''
              if (!file) return
              setImported({ ...readCostCsv(await file.text(), language !== 'en-US', items), fileName: file.name })
            }} />
          </label>
          <button type="button" style={ui.buttonSmall} onClick={downloadTemplate}>{t('costs.template')}</button>
          {lastBatch && <button type="button" style={ui.buttonSmall} disabled={busy} onClick={undoImport}>{t('costs.undoImport')}</button>}
        </>}
      </div>
      {error && <div role="alert" style={ui.error}>{error}</div>}
      {message && <div role="status" style={ui.notice}>{message}</div>}

      {imported && (
        <div style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>{imported.fileName}</strong>
          {imported.missingColumns.length > 0 ? (
            <div role="alert" style={ui.error}>{t('costs.missingColumns', { columns: imported.missingColumns.map(c => t(`costs.col.${c}`)).join(', ') })}</div>
          ) : <>
            <span style={{ fontSize: 13 }}>{t('costs.preview', { count: imported.rows.length, total: money(imported.rows.reduce((s, r) => s + r.amount, 0)) })}</span>
            {imported.rows.some(r => r.itemUnmatched) && <span style={ui.small}>{t('costs.unmatched', { count: imported.rows.filter(r => r.itemUnmatched).length })}</span>}
            {imported.errors.length > 0 && <span style={{ ...ui.small, color: '#8a4413' }}>{t('costs.skipped', { lines: imported.errors.slice(0, 12).map(x => `${x.line} (${t(`costs.reason.${x.reason}`)})`).join(', ') })}</span>}
          </>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" style={ui.buttonGhost} onClick={() => setImported(null)}>{t('action.cancel')}</button>
            <button type="button" style={ui.button} disabled={busy || !imported.rows.length} onClick={confirmImport}>{t('costs.confirmImport', { count: imported.rows.length })}</button>
          </div>
        </div>
      )}

      {form && (
        <form onSubmit={save} style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={ui.formGrid}>
            <label style={ui.label}>{t('costs.col.incurredOn')}<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={ui.input} /></label>
            <label style={{ ...ui.label, gridColumn: 'span 2' }}>{t('costs.col.description')}<input required value={form.description} autoFocus onChange={e => setForm({ ...form, description: e.target.value })} style={ui.input} /></label>
            <label style={ui.label}>{t('costs.col.amount')} ({currency})<input inputMode="decimal" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...ui.input, textAlign: 'right' }} /></label>
            <label style={ui.label}>{t('costs.col.category')}
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as CostCategory })} style={ui.input}>
                {COST_CATEGORIES.map(c => <option key={c} value={c}>{t(`costs.category.${c}`)}</option>)}
              </select>
            </label>
            <label style={ui.label}>{t('costs.col.supplier')}<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={ui.input} /></label>
            <label style={ui.label}>{t('costs.col.document')}<input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} style={ui.input} /></label>
            <label style={{ ...ui.label, gridColumn: 'span 2' }}>{t('costs.col.item')}
              <select value={form.itemId} onChange={e => setForm({ ...form, itemId: e.target.value })} style={ui.input}>
                <option value="">{t('costs.noItem')}</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.description}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setForm(null)} style={ui.buttonGhost}>{t('action.cancel')}</button>
            <button type="submit" disabled={busy} style={ui.button}>{t('action.save')}</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {tile(t('costs.actual'), money(variance.actual), t('costs.actualHint', { budget: money(variance.estimated) }))}
        {tile(t('costs.used'), variance.estimated > 0 ? formatPct((variance.actual / variance.estimated) * 100, numberFormat, 1) : '—', t('costs.usedHint'))}
        {tile(t('costs.cpi'), perf.cpi == null ? '—' : formatQty(perf.cpi, numberFormat, 2), perf.cpi == null ? t('costs.cpiNone') : perf.cpi >= 1 ? t('costs.cpiGood') : t('costs.cpiBad'), tone)}
        {tile(t('costs.cv'), perf.cv == null ? '—' : money(perf.cv), t('costs.cvHint'), tone)}
      </div>

      {variance.byCategory.length > 0 && (
        <div style={ui.tableWrap}>
          <table style={{ ...ui.table, minWidth: 560 }}>
            <thead>
              <tr>
                <th style={ui.th}>{t('costs.col.category')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('costs.col.budget')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('costs.col.actual')}</th>
                <th style={{ ...ui.th, minWidth: 160 }}>{t('costs.col.used')}</th>
              </tr>
            </thead>
            <tbody>
              {variance.byCategory.map(c => {
                const pct = c.estimated > 0 ? (c.actual / c.estimated) * 100 : null
                return (
                  <tr key={c.category}>
                    <td style={ui.td}>{t(`costs.category.${c.category}`)}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{money(c.estimated)}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{money(c.actual)}</td>
                    <td style={ui.td}>
                      {pct == null ? <span style={ui.small}>{t('costs.notBudgeted')}</span> : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 3, background: '#edf1f2', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct > 100 ? '#a8521f' : '#0b7f75' }} />
                          </div>
                          <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>{formatPct(pct, numberFormat, 0)}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {costs.length === 0 ? <div style={ui.empty}>{t('costs.empty')}</div> : (
        <div style={ui.tableWrap}>
          <table style={{ ...ui.table, minWidth: 820 }}>
            <thead>
              <tr>
                <th style={ui.th}>{t('costs.col.incurredOn')}</th>
                <th style={ui.th}>{t('costs.col.description')}</th>
                <th style={ui.th}>{t('costs.col.category')}</th>
                <th style={ui.th}>{t('costs.col.item')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('costs.col.amount')}</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {shown.map(c => (
                <tr key={c.id}>
                  <td style={{ ...ui.td, whiteSpace: 'nowrap' }}>{formatDate(c.incurred_on, language)}</td>
                  <td style={ui.td}>{c.description}{(c.supplier || c.document) && <small style={{ display: 'block', color: '#4f6670' }}>{[c.supplier, c.document].filter(Boolean).join(' · ')}</small>}</td>
                  <td style={ui.td}>{t(`costs.category.${c.category}`)}</td>
                  <td style={ui.td}>{c.estimate_item_id ? itemName.get(c.estimate_item_id) || '—' : <span style={ui.small}>{t('costs.noItem')}</span>}</td>
                  <td style={{ ...ui.td, ...ui.num, color: c.amount < 0 ? '#075a53' : undefined }}>{money(c.amount)}</td>
                  <td style={{ ...ui.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {editable && <>
                      <button type="button" style={ui.buttonSmall} onClick={() => setForm({ id: c.id, date: c.incurred_on, description: c.description, category: c.category, amount: toInput(c.amount, numberFormat), supplier: c.supplier || '', document: c.document || '', itemId: c.estimate_item_id || '' })}>{t('action.edit')}</button>
                      <button type="button" style={{ ...ui.buttonSmall, marginLeft: 6 }} aria-label={t('action.delete')} onClick={() => void remove(c)}>✕</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sorted.length > shown.length && <button type="button" style={{ ...ui.buttonGhost, alignSelf: 'flex-start' }} onClick={() => setShowAll(true)}>{t('costs.showAll', { count: sorted.length })}</button>}
      {variance.unlinked !== 0 && <p style={{ ...ui.small, margin: 0 }}>{t('costs.unlinkedNote', { amount: money(variance.unlinked) })}</p>}
    </section>
  )
}
