'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { ESTIMATE_COLUMNS, ITEM_COLUMNS, inPrice, sellingPrices, totalsOf, type EstimateRow, type ItemRow } from '@/lib/commercial/estimates'
import { CLAUSE_COLUMNS, appendClause, type ClauseRow } from '@/lib/commercial/clauses'
import { priceWithLines, sellingFactors } from '@/lib/commercial/pricing'
import { lines, readProposal, type Proposal } from '@/lib/commercial/proposal'
import { formatDate, formatMoney, formatPct, formatQty } from '@/lib/commercial/format'
import type { BidRow } from '@/lib/commercial/bids'
import { ui } from '../ui'
import type { ProposalPdfData } from './ProposalPdf'
import { appendPdfs, listAttachments, uploadAttachment, ATTACH_BUCKET, type AttachmentFile } from '@/lib/commercial/attachments'

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
  const [files, setFiles] = useState<AttachmentFile[]>([])
  const [attached, setAttached] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [clauses, setClauses] = useState<ClauseRow[]>([])

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
    const clauseQuery = (bid.projects?.organization_id
      ? supabase.from('commercial_clauses').select(CLAUSE_COLUMNS).eq('is_active', true).or(`organization_id.is.null,organization_id.eq.${bid.projects.organization_id}`)
      : supabase.from('commercial_clauses').select(CLAUSE_COLUMNS).eq('is_active', true).is('organization_id', null))
    clauseQuery.order('sort_order').order('created_at')
      .then(({ data }) => { if (active) setClauses(((data || []) as ClauseRow[]).filter(c => !c.country_code || c.country_code === bid.projects?.country_code)) })
    return () => { active = false }
  }, [projectId, bid.projects?.organization_id, bid.projects?.country_code, t])

  useEffect(() => {
    if (!estimate) return
    const prop = readProposal(estimate.proposal)
    setDraft(prop)
    listAttachments(createClient(), projectId).then(list => {
      setFiles(list)
      const exists = new Set(list.map(f => f.path))
      // First time: attach the full takeoff export when RitsuScope has made one.
      setAttached(prop.attachments ? prop.attachments.filter(p => exists.has(p)) : list.filter(f => f.path.endsWith('/exports/takeoff.pdf')).map(f => f.path))
    }).catch(e => setError(t('error.load', { message: e instanceof Error ? e.message : String(e) })))
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
  const selling = useMemo(() => sellingPrices(items, estimate?.pricing_lines || []), [items, estimate?.pricing_lines])

  async function exportPdf() {
    if (!estimate || !draft) return
    setBusy(true); setError(''); setMessage('')
    try {
      const factor = sellingFactors(totals.direct, estimate.pricing_lines)
      let buildUp: ProposalPdfData['buildUp'] = null
      if (draft.showBuildUp) {
        const r = priceWithLines(totals.direct, estimate.pricing_lines)
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
          allowances: L('allowances'), allowancesNote: L('allowancesNote'), alternates: L('alternates'), alternatesNote: L('alternatesNote'), alternate: L('alternate'),
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
        allowances: items.filter(i => i.kind === 'allowance').map(i => ({ description: i.description, amount: formatMoney(selling.get(i.id) || 0, cur, numberFormat) })),
        alternates: items.filter(i => i.kind === 'alternate').map(i => ({ description: i.description, amount: formatMoney(selling.get(i.id) || 0, cur, numberFormat) })),
        items: draft.showItems ? inPrice(items).map(it => {
          const unitPrice = it.material_unit_cost * factor.material + (it.labor_unit_cost + it.equipment_unit_cost + it.subcontract_unit_cost) * factor.services
          return {
            description: it.kind === 'allowance' ? `${it.description} (${t('estimate.kind.allowance')})` : it.description, qty: formatQty(it.quantity, numberFormat), unit: it.unit,
            unitPrice: formatMoney(unitPrice, cur, numberFormat), total: formatMoney(it.quantity * unitPrice, cur, numberFormat),
          }
        }) : null,
        buildUp,
        direct: formatMoney(totals.row.direct_total, cur, numberFormat),
        markup: draft.showBuildUp ? formatPct(totals.markupPct, numberFormat) : null,
        price: formatMoney(totals.row.price_total, cur, numberFormat),
      }
      const [{ pdf }, { default: ProposalPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./ProposalPdf')])
      const own = await pdf(<ProposalPdf d={data} />).toBlob()
      const { blob, missing } = await appendPdfs(createClient(), own, attached)
      const name = `${bid.bid_number} ${bid.projects?.name || ''} ${estimate.name}`.replace(/[\\/:*?"<>|]+/g, '_').trim()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${name}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage([estimate.status === 'draft' ? t('proposal.exportedDraft') : t('proposal.exported'), missing.length ? t('attach.missing', { names: missing.join(', ') }) : ''].filter(Boolean).join(' '))
    } catch (e) {
      setError(t('proposal.errPdf', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }

  if (!estimate || !draft) return <div style={ui.muted}>{error || t('loading')}</div>

  const kindFor = { inclusions: 'inclusion', exclusions: 'exclusion', notes: 'condition' } as const
  const picker = (k: 'inclusions' | 'exclusions' | 'notes') => {
    const options = clauses.filter(c => c.kind === kindFor[k])
    if (!canEdit || options.length === 0) return null
    return (
      <select aria-label={t('clauses.insert')} value="" onChange={e => {
        const c = options.find(x => x.id === e.target.value)
        if (c) void save({ ...draft, [k]: appendClause(draft[k], c.body) })
      }} style={{ ...ui.input, height: 30, fontSize: 12, marginTop: 4 }}>
        <option value="">{t('clauses.insert')}</option>
        {options.map(c => <option key={c.id} value={c.id}>{c.body.length > 90 ? `${c.body.slice(0, 90)}…` : c.body}</option>)}
      </select>
    )
  }
  const text = (k: 'scope' | 'inclusions' | 'exclusions' | 'paymentTerms' | 'notes', rows: number) => (
    <label style={ui.label}>{t(`proposal.${k}`)}
      <textarea key={`${estimate.id}-${k}-${draft[k].length}`} rows={rows} defaultValue={draft[k]} disabled={!canEdit} placeholder={t(`proposal.${k}Hint`)}
        onBlur={e => { if (e.target.value !== draft[k]) void save({ ...draft, [k]: e.target.value }) }}
        style={{ ...ui.input, height: 'auto', padding: 10, fontFamily: 'inherit', lineHeight: 1.45, resize: 'vertical' }} />
      {(k === 'inclusions' || k === 'exclusions' || k === 'notes') && picker(k)}
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
        <section aria-labelledby="attach-title" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid #edf1f2' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <strong id="attach-title" style={{ fontSize: 13, color: '#173441' }}>{t('attach.title')}</strong>
            <span style={ui.small}>{t('attach.hint')}</span>
            <span style={{ flex: 1 }} />
            {editable && (
              <label style={{ ...ui.buttonSmall, display: 'inline-flex', alignItems: 'center', cursor: uploading ? 'wait' : 'pointer' }}>
                {uploading ? t('attach.uploading') : t('attach.upload')}
                <input type="file" accept="application/pdf" disabled={uploading} style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; e.target.value = ''
                  if (!file) return
                  setUploading(true); setError('')
                  try {
                    const path = await uploadAttachment(createClient(), projectId, file)
                    setFiles(await listAttachments(createClient(), projectId))
                    const next = [...attached, path]; setAttached(next)
                    if (canEdit) void save({ ...draft, attachments: next })
                  } catch (err) { setError(t('error.save', { message: err instanceof Error ? err.message : String(err) })) } finally { setUploading(false) }
                }} />
              </label>
            )}
          </div>
          {files.length === 0 ? <div style={{ ...ui.small, padding: '6px 0' }}>{t('attach.none')}</div> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {files.map(f => {
                const what = f.kind === 'export' ? f.name.replace(/\.pdf$/i, '') : ''
                const label = f.kind === 'export' ? t('attach.export', { kind: t(`attach.kind.${what}`) }) : f.name.replace(/^[a-z0-9]+-/, '')
                const on = attached.includes(f.path)
                return (
                  <li key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #edf1f2', borderRadius: 8 }}>
                    <input type="checkbox" checked={on} aria-label={label} style={{ width: 18, height: 18, accentColor: '#0b7f75' }} onChange={() => {
                      const next = on ? attached.filter(x => x !== f.path) : [...attached, f.path]
                      setAttached(next)
                      if (canEdit) void save({ ...draft, attachments: next })
                    }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#294955' }}>
                      {label}
                      <small style={{ display: 'block', color: '#4f6670' }}>{f.kind === 'export' ? t('attach.fromRitsuScope') : t('attach.uploaded')}{f.updatedAt ? ` · ${formatDate(f.updatedAt.slice(0, 10), language)}` : ''}</small>
                    </span>
                    <button type="button" style={ui.buttonSmall} onClick={async () => {
                      const { data } = await createClient().storage.from(ATTACH_BUCKET).createSignedUrl(f.path, 300)
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
                    }}>{t('attach.view')}</button>
                  </li>
                )
              })}
            </ul>
          )}
          <span style={ui.small}>{t('attach.howTo')}</span>
        </section>
      </div>
    </div>
  )
}
