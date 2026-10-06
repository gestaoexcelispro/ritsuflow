'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { ESTIMATE_COLUMNS, ITEM_COLUMNS, newRevision, refreshFromTakeoff, totalsOf, type EstimateRow, type ItemRow } from '@/lib/commercial/estimates'
import { LABOR_RATE_COLUMNS, PRICE_ITEM_COLUMNS, today, type LaborRateRow, type PriceItemRow } from '@/lib/commercial/library'
import { priceWithLines, type AppliesTo, type PricingLine } from '@/lib/commercial/pricing'
import { readTakeoff } from '@/lib/commercial/takeoffEstimate'
import { formatDate, formatMoney, formatPct, formatQty, formatUnitCost, toInput } from '@/lib/commercial/format'
import { ui } from '../ui'

type Props = { projectId: string; country: string; editable: boolean; onChanged: () => void }

type CostField = 'material_unit_cost' | 'labor_unit_cost' | 'equipment_unit_cost' | 'subcontract_unit_cost'
const COST_FIELDS: CostField[] = ['material_unit_cost', 'labor_unit_cost', 'equipment_unit_cost', 'subcontract_unit_cost']

/** Bid → Estimate: items from the takeoff or typed in, priced from the library, and the price build-up. */
export default function EstimateTab({ projectId, country, editable, onChanged }: Props) {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const [revisions, setRevisions] = useState<EstimateRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const estimate = revisions.find(r => r.id === selectedId) || revisions[0] || null
  const canEdit = editable && !!estimate && estimate.status === 'draft'
  const cur = estimate?.currency_code || 'BRL'

  const loadRevisions = useCallback(async () => {
    const { data, error: e } = await createClient().from('commercial_estimates').select(ESTIMATE_COLUMNS).eq('project_id', projectId).order('revision', { ascending: false })
    if (e) { setError(t('error.load', { message: e.message })); return [] as EstimateRow[] }
    const rows = (data || []) as EstimateRow[]
    setRevisions(rows)
    return rows
  }, [projectId, t])

  const loadItems = useCallback(async (estimateId: string) => {
    const { data, error: e } = await createClient().from('commercial_estimate_items').select(ITEM_COLUMNS).eq('estimate_id', estimateId).order('sort_order').order('created_at')
    if (e) { setError(t('error.load', { message: e.message })); return }
    setItems(((data || []) as ItemRow[]).map(i => ({ ...i, breakdown: i.breakdown || {} })))
  }, [t])

  useEffect(() => {
    let active = true
    loadRevisions().then(rows => { if (active) { setSelectedId(s => s || rows[0]?.id || null); setLoading(false) } })
    return () => { active = false }
  }, [loadRevisions])

  useEffect(() => { if (estimate) void loadItems(estimate.id) }, [estimate?.id, loadItems]) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => totalsOf(items, estimate?.pricing_lines || []), [items, estimate?.pricing_lines])
  const steps = useMemo(() => {
    try { return priceWithLines(totals.direct, estimate?.pricing_lines || []) } catch { return null }
  }, [totals.direct, estimate?.pricing_lines])

  /** Saves the cached totals on the revision when they changed, then tells the bid header. */
  const saveTotals = useCallback(async (rows: ItemRow[], lines: PricingLine[]) => {
    if (!estimate || estimate.status !== 'draft') return
    const tt = totalsOf(rows, lines)
    if (tt.row.price_total === estimate.price_total && tt.row.direct_total === estimate.direct_total) return
    const { error: e } = await createClient().from('commercial_estimates').update(tt.row).eq('id', estimate.id)
    if (e) { setError(t('error.save', { message: e.message })); return }
    setRevisions(rs => rs.map(r => (r.id === estimate.id ? { ...r, ...tt.row } : r)))
    onChanged()
  }, [estimate, onChanged, t])

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setError(''); setMessage('')
    try { return await task() } catch (e) { setError(t('error.save', { message: e instanceof Error ? e.message : String(e) })); return undefined } finally { setBusy(false) }
  }

  async function refresh() {
    if (!estimate) return
    await run(async () => {
      const supabase = createClient()
      const [read, book, rates] = await Promise.all([
        readTakeoff(supabase, projectId),
        supabase.from('commercial_price_items').select(PRICE_ITEM_COLUMNS).eq('country_code', country).eq('currency_code', cur).limit(5000),
        supabase.from('commercial_labor_rates').select(LABOR_RATE_COLUMNS).eq('country_code', country).eq('currency_code', cur),
      ])
      if (book.error) throw new Error(book.error.message)
      if (rates.error) throw new Error(rates.error.message)
      const r = await refreshFromTakeoff(supabase, estimate, items, read.lines, (book.data || []) as PriceItemRow[], (rates.data || []) as LaborRateRow[])
      const { data } = await supabase.from('commercial_estimate_items').select(ITEM_COLUMNS).eq('estimate_id', estimate.id).order('sort_order').order('created_at')
      const rows = ((data || []) as ItemRow[]).map(i => ({ ...i, breakdown: i.breakdown || {} }))
      setItems(rows)
      await saveTotals(rows, estimate.pricing_lines)
      const notes = [t('estimate.refreshed', { added: r.added, updated: r.updated, removed: r.removed })]
      if (r.unpriced) notes.push(t('estimate.unpricedCount', { count: r.unpriced }))
      if (read.noRecipe) notes.push(t('estimate.noRecipe', { count: read.noRecipe }))
      if (read.uncalibrated) notes.push(t('estimate.uncalibrated', { count: read.uncalibrated }))
      if (!read.lines.length) notes.push(t('estimate.noTakeoff'))
      setMessage(notes.join(' '))
    })
  }

  async function patchItem(item: ItemRow, patch: Partial<ItemRow>) {
    const next = items.map(i => (i.id === item.id ? { ...i, ...patch } : i))
    setItems(next)
    await run(async () => {
      const { error: e } = await createClient().from('commercial_estimate_items').update(patch).eq('id', item.id)
      if (e) throw new Error(e.message)
      await saveTotals(next, estimate!.pricing_lines)
    })
  }

  function numberPatch(item: ItemRow, field: 'quantity' | CostField, raw: string) {
    const v = raw.trim() === '' ? 0 : parseLocaleNumber(raw)
    if (!(v >= 0) || v === item[field]) return
    const patch = { [field]: v } as Partial<ItemRow>
    if (field === 'quantity' && item.source === 'takeoff') patch.quantity_overridden = true
    void patchItem(item, patch)
  }

  async function addManual() {
    if (!estimate) return
    await run(async () => {
      const { data, error: e } = await createClient().from('commercial_estimate_items').insert({
        estimate_id: estimate.id, project_id: projectId, source: 'manual', description: t('estimate.newItem'), unit: 'un', quantity: 1,
        sort_order: items.reduce((m, i) => Math.max(m, i.sort_order), 0) + 1,
      }).select(ITEM_COLUMNS).single()
      if (e) throw new Error(e.message)
      setItems(list => [...list, { ...(data as ItemRow), breakdown: {} }])
    })
  }

  async function removeItem(item: ItemRow) {
    if (!window.confirm(t('estimate.confirmRemove'))) return
    const next = items.filter(i => i.id !== item.id)
    await run(async () => {
      const { error: e } = await createClient().from('commercial_estimate_items').delete().eq('id', item.id)
      if (e) throw new Error(e.message)
      setItems(next)
      await saveTotals(next, estimate!.pricing_lines)
    })
  }

  async function setRate(i: number, raw: string) {
    if (!estimate) return
    const v = raw.trim() === '' ? 0 : parseLocaleNumber(raw)
    if (!(v >= 0) || v === estimate.pricing_lines[i]?.rate) return
    const lines = estimate.pricing_lines.map((l, n) => (n === i ? { ...l, rate: v } : l))
    try { priceWithLines(totals.direct, lines) } catch { setError(t('templates.errTaxes')); return }
    await run(async () => {
      const { error: e } = await createClient().from('commercial_estimates').update({ pricing_lines: lines }).eq('id', estimate.id)
      if (e) throw new Error(e.message)
      setRevisions(rs => rs.map(r => (r.id === estimate.id ? { ...r, pricing_lines: lines } : r)))
      await saveTotals(items, lines)
    })
  }

  async function issue() {
    if (!estimate || !window.confirm(t('estimate.confirmIssue'))) return
    await run(async () => {
      await saveTotals(items, estimate.pricing_lines)
      const { error: e } = await createClient().from('commercial_estimates').update({ status: 'issued', issued_at: new Date().toISOString() }).eq('id', estimate.id)
      if (e) throw new Error(e.message)
      await loadRevisions(); onChanged()
      setMessage(t('estimate.issued'))
    })
  }

  async function revise() {
    if (!estimate) return
    await run(async () => {
      const id = await newRevision(createClient(), estimate, items, today())
      await loadRevisions(); setSelectedId(id); onChanged()
      setMessage(t('estimate.revised'))
    })
  }

  if (loading) return <div style={ui.muted}>{t('loading')}</div>
  if (!estimate) return <div style={ui.empty}>{t('revisions.empty')}</div>

  const latest = revisions[0]
  const currencySymbol = (() => {
    try { return new Intl.NumberFormat(numberFormat, { style: 'currency', currency: cur }).formatToParts(0).find(x => x.type === 'currency')?.value || cur } catch { return cur }
  })()
  const costInput = (item: ItemRow, field: CostField) => canEdit
    ? <input key={`${item.id}-${field}-${item[field]}`} aria-label={t(`estimate.col.${field}`, { currency: currencySymbol })} inputMode="decimal" defaultValue={toInput(Math.round(item[field] * 10000) / 10000, numberFormat)}
        onBlur={e => numberPatch(item, field, e.target.value)} style={{ ...ui.input, width: 96, height: 32, textAlign: 'right' }} />
    : <span>{item[field] ? formatUnitCost(item[field], cur, numberFormat) : '—'}</span>
  const label = (a: AppliesTo) => t(`applies.${a}`)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: '999 1 640px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={ui.toolbar}>
          <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center' }}>{t('revisions.col.revision')}
            <select value={estimate.id} onChange={e => setSelectedId(e.target.value)} style={ui.input}>
              {revisions.map(r => <option key={r.id} value={r.id}>{r.name} · {t(`revisions.status.${r.status}`)}</option>)}
            </select>
          </label>
          <span style={estimate.status === 'issued' ? ui.chipTeal : ui.chip}>{t(`revisions.status.${estimate.status}`)}</span>
          <span style={{ flex: 1 }} />
          {canEdit && <>
            <button type="button" disabled={busy} onClick={refresh} style={ui.button}>{busy ? t('estimate.working') : t('estimate.refresh')}</button>
            <button type="button" disabled={busy} onClick={addManual} style={ui.buttonGhost}>{t('estimate.addManual')}</button>
            <button type="button" disabled={busy || items.length === 0} onClick={issue} style={ui.buttonGhost}>{t('estimate.issue')}</button>
          </>}
          {editable && estimate.status === 'issued' && estimate.id === latest?.id && (
            <button type="button" disabled={busy} onClick={revise} style={ui.button}>{t('estimate.newRevision')}</button>
          )}
        </div>
        {estimate.status === 'issued' && <div style={ui.notice}>{t('estimate.frozen')}</div>}
        {error && <div role="alert" style={ui.error}>{error}</div>}
        {message && <div role="status" style={ui.notice}>{message}</div>}

        {items.length === 0 ? <div style={ui.empty}>{t('estimate.empty')}</div> : (
          <div style={ui.tableWrap}>
            <table style={{ ...ui.table, minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={ui.th}>{t('estimate.col.item')}</th>
                  <th style={{ ...ui.th, ...ui.num }}>{t('estimate.col.quantity')}</th>
                  <th style={ui.th}>{t('field.unit')}</th>
                  {COST_FIELDS.map(f => <th key={f} style={{ ...ui.th, ...ui.num }}>{t(`estimate.col.${f}`, { currency: currencySymbol })}</th>)}
                  <th style={{ ...ui.th, ...ui.num }}>{t('estimate.col.total', { currency: currencySymbol })}</th>
                  <th style={ui.th} />
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const unitTotal = COST_FIELDS.reduce((s, f) => s + (Number(item[f]) || 0), 0)
                  const missing = item.breakdown?.missing || []
                  const hasDetail = !!(item.breakdown?.materials?.length || item.breakdown?.labor?.length || item.breakdown?.equipment?.length || item.breakdown?.subcontract?.length || missing.length)
                  return [
                    <tr key={item.id}>
                      <td style={ui.td}>
                        {canEdit && item.source === 'manual'
                          ? <input key={`${item.id}-d`} aria-label={t('estimate.col.item')} defaultValue={item.description} onBlur={e => { const v = e.target.value.trim(); if (v && v !== item.description) void patchItem(item, { description: v }) }} style={{ ...ui.input, width: '100%', height: 32 }} />
                          : <strong style={{ fontWeight: 600 }}>{item.description}</strong>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                          <span style={item.source === 'takeoff' ? ui.chipTeal : ui.chip}>{t(`estimate.source.${item.source}`)}</span>
                          {item.quantity_overridden && <span style={ui.chipOrange}>{t('estimate.overridden')}</span>}
                          {missing.length > 0 && <span style={ui.chipOrange}>{t('estimate.unpriced', { count: missing.length })}</span>}
                          {hasDetail && <button type="button" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)} style={{ ...ui.chip, border: 0, cursor: 'pointer' }}>{open === item.id ? t('estimate.hideDetail') : t('estimate.showDetail')}</button>}
                        </div>
                      </td>
                      <td style={{ ...ui.td, ...ui.num }}>
                        {canEdit
                          ? <input key={`${item.id}-q-${item.quantity}`} aria-label={t('estimate.col.quantity')} inputMode="decimal" defaultValue={toInput(Math.round(item.quantity * 100) / 100, numberFormat)} onBlur={e => numberPatch(item, 'quantity', e.target.value)} style={{ ...ui.input, width: 96, height: 32, textAlign: 'right' }} />
                          : formatQty(item.quantity, numberFormat)}
                        {canEdit && item.quantity_overridden && (
                          <button type="button" onClick={() => patchItem(item, { quantity: item.breakdown?.takeoffQuantity ?? item.quantity, quantity_overridden: false })} style={{ ...ui.buttonSmall, display: 'block', marginTop: 4, marginLeft: 'auto', height: 24 }}>{t('estimate.useTakeoff')}</button>
                        )}
                      </td>
                      <td style={ui.td}>
                        {canEdit && item.source === 'manual'
                          ? <input key={`${item.id}-u`} aria-label={t('field.unit')} defaultValue={item.unit} onBlur={e => { const v = e.target.value.trim(); if (v && v !== item.unit) void patchItem(item, { unit: v }) }} style={{ ...ui.input, width: 64, height: 32 }} />
                          : item.unit}
                      </td>
                      {COST_FIELDS.map(f => <td key={f} style={{ ...ui.td, ...ui.num }}>{costInput(item, f)}</td>)}
                      <td style={{ ...ui.td, ...ui.num, fontWeight: 700 }}>{formatMoney(item.quantity * unitTotal, cur, numberFormat)}</td>
                      <td style={ui.td}>{canEdit && <button type="button" aria-label={t('action.delete')} onClick={() => removeItem(item)} style={ui.buttonSmall}>✕</button>}</td>
                    </tr>,
                    open === item.id && (
                      <tr key={`${item.id}-detail`} style={{ background: '#f9fbfc' }}>
                        <td colSpan={9} style={{ ...ui.td, paddingLeft: 24 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, fontSize: 12 }}>
                            {(['materials', 'labor', 'equipment', 'subcontract'] as const).filter(kind => kind === 'materials' || kind === 'labor' || (item.breakdown?.[kind] || []).length > 0).map(kind => (
                              <div key={kind}>
                                <strong style={{ display: 'block', marginBottom: 4 }}>{t(`estimate.detail.${kind}`)}</strong>
                                {(item.breakdown?.[kind] || []).length === 0 ? <span style={ui.small}>—</span> : (item.breakdown?.[kind] || []).map((l, n) => (
                                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
                                    <span>{l.label} · {formatQty(l.qty, numberFormat)} {l.unit} × {formatUnitCost(l.unitCost, cur, numberFormat)}</span>
                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(l.amount, cur, numberFormat)}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {missing.length > 0 && (
                              <div>
                                <strong style={{ display: 'block', marginBottom: 4, color: '#8a4413' }}>{t('estimate.detail.missing')}</strong>
                                {missing.map(m => <div key={m}>{m}</div>)}
                                <div style={{ ...ui.small, marginTop: 4 }}>{t('estimate.detail.missingHint')}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ ...ui.small, margin: 0 }}>{t('estimate.footnote')}</p>
      </div>

      <aside aria-label={t('estimate.buildUp')} style={{ flex: '1 1 320px', ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <strong style={{ fontSize: 15, color: '#173441' }}>{t('estimate.buildUp')}</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          {(['material', 'labor', 'equipment', 'subcontract'] as const).filter(k => totals.direct[k] > 0 || k === 'material' || k === 'labor').map(k => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t(`applies.${k}`)}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(totals.direct[k], cur, numberFormat)}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 6, borderTop: '1px solid #edf1f2' }}>
            <span>{t('applies.direct')}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(totals.row.direct_total, cur, numberFormat)}</span>
          </div>
        </div>
        <div style={{ padding: 12, borderRadius: 8, background: '#f2f7f8', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {estimate.pricing_lines.length === 0 && <span style={ui.small}>{t('estimate.noLines')}</span>}
          {estimate.pricing_lines.map((l, i) => {
            const step = steps?.steps[i]
            return (
              <div key={l.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 80px', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span title={`${label(l.applies_to)} · ${t(`method.${l.method}`)}`}>{l.label}<small style={{ display: 'block', color: '#4f6670' }}>{step ? formatMoney(step.amount, cur, numberFormat) : ''} · {l.method === 'divisor' ? t('method.divisor') : label(l.applies_to)}{l.group === 'material' ? ` · ${t('group.material')}` : ''}</small></span>
                {canEdit
                  ? <input key={`${estimate.id}-${l.key}-${l.rate}`} aria-label={`${l.label} %`} inputMode="decimal" defaultValue={toInput(l.rate, numberFormat)} onBlur={e => setRate(i, e.target.value)} style={{ ...ui.input, height: 32, textAlign: 'right', width: '100%' }} />
                  : <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPct(l.rate, numberFormat)}</span>}
              </div>
            )
          })}
        </div>
        {totals.problem && <div role="alert" style={ui.error}>{t('templates.errTaxes')}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('templates.markup')}</span><strong>{formatPct(totals.markupPct, numberFormat)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '1px solid #edf1f2' }}>
            <strong>{t('templates.price')}</strong>
            <strong style={{ fontSize: 20, color: '#075a53', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(totals.row.price_total, cur, numberFormat)}</strong>
          </div>
        </div>
        <span style={ui.small}>{t('estimate.pricedOn', { date: formatDate(estimate.priced_on, language) })}</span>
      </aside>
    </div>
  )
}
