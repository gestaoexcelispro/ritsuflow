'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { ESTIMATE_COLUMNS, ITEM_COLUMNS, totalsOf, type EstimateRow, type ItemRow } from '@/lib/commercial/estimates'
import { applyPricing } from '@/lib/commercial/pricing'
import { lines, readProposal, sellingFactor, type Proposal } from '@/lib/commercial/proposal'
import { formatDate, formatMoney, formatPct, formatQty } from '@/lib/commercial/format'
import type { BidRow } from '@/lib/commercial/bids'
import { ui } from '../ui'
import type { ProposalPdfData } from './ProposalPdf'

type Company = { name: string; legal_name: string | null; tax_id: string | null; email: string | null; phone: string | null; website: string | null; city: string | null; state_region: string | null; logo_url: string | null }

type Props = { bid: BidRow; editable: boolean }

/** Bid → Proposal: the text that goes with the price, and the PDF sent to the client. */
export default function ProposalTab({ bid, editable }: Props) {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const projectId = bid.project_id
  const [revisions, setRevisions] = useState<EstimateRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [draft, setDraft] = useState<Proposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const estimate = revisions.find(r => r.id === selectedId) || revisions[0] || null
  const canEdit = editable && estimate?.status === 'draft'

  useEffect(() => {
    let active = true
    const supabase = createClient()
    Promise.all([
      supabase.from('commercial_estimates').select(ESTIMATE_COLUMNS).eq('project_id', projectId).order('revision', { ascending: false }),
      bid.projects?.organization_id
        ? supabase.from('organizations').select('name, legal_name, tax_id, email, phone, website, city, state_region, logo_url').eq('id', bid.projects.organization_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]).then(([e, o]) => {
      if (!active) return
      if (e.error) { setError(t('error.load', { message: e.error.message })); return }
      const rows = (e.data || []) as EstimateRow[]
      setRevisions(rows)
      setSelectedId(s => s || rows[0]?.id || null)
      setCompany((o.data as Company | null) || null)
    })
    return () => { active = false }
  }, [projectId, bid.projects?.organization_id, t])

  useEffect(() => {
    if (!estimate) return
    setDraft(readProposal(estimate.proposal))
    createClient().from('commercial_estimate_items').select(ITEM_COLUMNS).eq('estimate_id', estimate.id).order('sort_order').order('created_at')
      .then(({ data, error: e }) => { if (e) setError(t('error.load', { message: e.message })); else setItems((data || []) as ItemRow[]) })
  }, [estimate?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (next: Proposal) => {
    if (!estimate || !canEdit) return
    setDraft(next)
    const { error: e } = await createClient().from('commercial_estimates').update({ proposal: next }).eq('id', estimate.id)
    if (e) { setError(t('error.save', { message: e.message })); return }
    setRevisions(rs => rs.map(r => (r.id === estimate.id ? { ...r, proposal: next } : r)))
  }, [estimate, canEdit, t])

  const cur = estimate?.currency_code || bid.projects?.currency_code || 'BRL'
  const totals = useMemo(() => totalsOf(items, estimate?.pricing_lines || []), [items, estimate?.pricing_lines])

  async function exportPdf() {
    if (!estimate || !draft) return
    setBusy(true); setError(''); setMessage('')
    try {
      const factor = sellingFactor(totals.row.direct_total, totals.row.price_total)
      let buildUp: ProposalPdfData['buildUp'] = null
      if (draft.showBuildUp) {
        const r = applyPricing(totals.direct, estimate.pricing_lines)
        buildUp = r.steps.filter(s => s.rate > 0).map(s => ({ label: s.label, rate: formatPct(s.rate, numberFormat), amount: formatMoney(s.amount, cur, numberFormat) }))
      }
      const created = new Date()
      const validUntil = draft.validityDays ? new Date(created.getTime() + draft.validityDays * 86400000) : null
      const iso = (d: Date) => d.toISOString().slice(0, 10)
      const L = (k: string) => t(`pdf.${k}`)
      const data: ProposalPdfData = {
        pageSize: bid.projects?.country_code === 'US' ? 'LETTER' : 'A4',
        language,
        labels: {
          date: L('date'), validUntil: L('validUntil'), client: L('client'), job: L('job'), price: L('price'), scope: L('scope'), items: L('items'),
          colItem: L('colItem'), colQty: L('colQty'), colUnit: L('colUnit'), colUnitPrice: L('colUnitPrice'), colTotal: L('colTotal'),
          unitPriceNote: L('unitPriceNote'), direct: L('direct'), markup: L('markup'), total: L('total'), inclusions: L('inclusions'),
          exclusions: L('exclusions'), paymentTerms: L('paymentTerms'), notes: L('notes'), accepted: L('accepted'),
        },
        company: {
          name: company?.name || '', legalName: company?.legal_name || null, taxId: company?.tax_id || null, logoUrl: company?.logo_url || null,
          contact: [company?.email, company?.phone, company?.website, [company?.city, company?.state_region].filter(Boolean).join(' - ')].filter(Boolean).join(' · '),
        },
        title: L('title'),
        bidNumber: bid.bid_number,
        revision: estimate.name,
        date: formatDate(iso(created), language),
        validUntil: validUntil ? formatDate(iso(validUntil), language) : null,
        client: bid.projects?.client_name || '',
        job: bid.projects?.name || '',
        scope: draft.scope.trim(),
        inclusions: lines(draft.inclusions),
        exclusions: lines(draft.exclusions),
        paymentTerms: draft.paymentTerms.trim(),
        notes: draft.notes.trim(),
        items: draft.showItems ? items.map(it => {
          const unitDirect = it.material_unit_cost + it.labor_unit_cost + it.equipment_unit_cost + it.subcontract_unit_cost
          return {
            description: it.description, qty: formatQty(it.quantity, numberFormat), unit: it.unit,
            unitPrice: formatMoney(unitDirect * factor, cur, numberFormat), total: formatMoney(it.quantity * unitDirect * factor, cur, numberFormat),
          }
        }) : null,
        buildUp,
        direct: formatMoney(totals.row.direct_total, cur, numberFormat),
        markup: draft.showBuildUp ? formatPct(totals.markupPct, numberFormat) : null,
        price: formatMoney(totals.row.price_total, cur, numberFormat),
      }
      const [{ pdf }, { default: ProposalPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./ProposalPdf')])
      const blob = await pdf(<ProposalPdf d={data} />).toBlob()
      const name = `${bid.bid_number} ${bid.projects?.name || ''} ${estimate.name}`.replace(/[\\/:*?"<>|]+/g, '_').trim()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${name}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(estimate.status === 'draft' ? t('proposal.exportedDraft') : t('proposal.exported'))
    } catch (e) {
      setError(t('proposal.errPdf', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }

  if (!estimate || !draft) return <div style={ui.muted}>{error || t('loading')}</div>

  const text = (k: 'scope' | 'inclusions' | 'exclusions' | 'paymentTerms' | 'notes', rows: number) => (
    <label style={ui.label}>{t(`proposal.${k}`)}
      <textarea key={`${estimate.id}-${k}`} rows={rows} defaultValue={draft[k]} disabled={!canEdit} placeholder={t(`proposal.${k}Hint`)}
        onBlur={e => { if (e.target.value !== draft[k]) void save({ ...draft, [k]: e.target.value }) }}
        style={{ ...ui.input, height: 'auto', padding: 10, fontFamily: 'inherit', lineHeight: 1.45, resize: 'vertical' }} />
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={ui.toolbar}>
        <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center' }}>{t('revisions.col.revision')}
          <select value={estimate.id} onChange={e => setSelectedId(e.target.value)} style={ui.input}>
            {revisions.map(r => <option key={r.id} value={r.id}>{r.name} · {t(`revisions.status.${r.status}`)}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 13, color: '#294955' }}>{t('templates.price')} <strong style={{ color: '#075a53' }}>{formatMoney(totals.row.price_total, cur, numberFormat)}</strong></span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={exportPdf} disabled={busy || items.length === 0} style={ui.button}>{busy ? t('proposal.generating') : t('proposal.export')}</button>
      </div>
      {estimate.status === 'draft' && <div style={ui.notice}>{t('proposal.draftNote')}</div>}
      {error && <div role="alert" style={ui.error}>{error}</div>}
      {message && <div role="status" style={ui.notice}>{message}</div>}

      <div style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {text('scope', 5)}
        <div style={ui.formGrid}>
          {text('inclusions', 5)}
          {text('exclusions', 5)}
        </div>
        <div style={ui.formGrid}>
          {text('paymentTerms', 3)}
          <label style={ui.label}>{t('proposal.validityDays')}
            <input key={`${estimate.id}-v`} inputMode="numeric" defaultValue={draft.validityDays ?? ''} disabled={!canEdit}
              onBlur={e => { const v = e.target.value.trim() ? Math.max(0, Math.round(parseLocaleNumber(e.target.value))) : null; if (v !== draft.validityDays && (v === null || Number.isFinite(v))) void save({ ...draft, validityDays: v }) }}
              style={ui.input} />
          </label>
        </div>
        {text('notes', 3)}
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          <legend style={{ ...ui.label, marginBottom: 6 }}>{t('proposal.pdfOptions')}</legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#294955', minHeight: 32 }}>
            <input type="checkbox" checked={draft.showItems} disabled={!canEdit} onChange={e => void save({ ...draft, showItems: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#0b7f75' }} />
            {t('proposal.showItems')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#294955', minHeight: 32 }}>
            <input type="checkbox" checked={draft.showBuildUp} disabled={!canEdit} onChange={e => void save({ ...draft, showBuildUp: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#0b7f75' }} />
            {t('proposal.showBuildUp')}
          </label>
        </fieldset>
      </div>
    </div>
  )
}
