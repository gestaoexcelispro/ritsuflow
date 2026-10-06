'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { BID_COLUMNS, ESTIMATE_SUMMARY_COLUMNS, statusPatch, type BidRow, type BidStatus, type EstimateSummary } from '@/lib/commercial/bids'
import { formatDate, formatMoney } from '@/lib/commercial/format'
import { useCommercialAccess } from '../license'
import { statusStyle, ui } from '../ui'
import EstimateTab from './EstimateTab'

type Tab = 'estimate' | 'takeoff' | 'proposal' | 'revisions'
type Counts = { sheets: number; items: number; elements: number }

/** One bid: its status, the takeoff in RitsuScope, the estimate, the proposal and the revisions. */
export default function BidWorkspace() {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const { licensed } = useCommercialAccess()
  const { projectId } = useParams<{ projectId: string }>()
  const [bid, setBid] = useState<BidRow | null>(null)
  const [estimates, setEstimates] = useState<EstimateSummary[]>([])
  const [counts, setCounts] = useState<Counts>({ sheets: 0, items: 0, elements: 0 })
  const [tab, setTab] = useState<Tab>('estimate')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const count = (table: string) => supabase.from(table).select('id', { count: 'exact', head: true }).eq('project_id', projectId)
    const [b, e, s, l, el] = await Promise.all([
      supabase.from('commercial_bids').select(BID_COLUMNS).eq('project_id', projectId).maybeSingle(),
      supabase.from('commercial_estimates').select(ESTIMATE_SUMMARY_COLUMNS).eq('project_id', projectId).order('revision', { ascending: false }),
      count('takeoff_sources'), count('takeoff_layers'), count('takeoff_elements'),
    ])
    setLoading(false)
    if (b.error || e.error) { setError(t('error.load', { message: (b.error || e.error)!.message })); return }
    setBid((b.data as unknown as BidRow) || null)
    setEstimates((e.data || []) as EstimateSummary[])
    setCounts({ sheets: s.count || 0, items: l.count || 0, elements: el.count || 0 })
  }, [projectId, t])

  useEffect(() => { void load() }, [load])

  async function setStatus(status: BidStatus) {
    if (!bid) return
    let note: string | null = null
    if (status === 'won' || status === 'lost' || status === 'no_bid') {
      const answer = window.prompt(t('bid.notePrompt'), bid.outcome_note || '')
      if (answer === null) return
      note = answer.trim() || null
    }
    setBusy(true); setError('')
    const { error: e } = await createClient().from('commercial_bids').update(statusPatch(status, note)).eq('project_id', bid.project_id)
    setBusy(false)
    if (e) { setError(t('error.save', { message: e.message })); return }
    void load()
  }

  if (loading) return <section style={ui.page}><div style={ui.muted}>{t('loading')}</div></section>
  if (!bid) return (
    <section style={ui.page}>
      {error ? <div role="alert" style={ui.error}>{error}</div> : <div style={ui.empty}>{t('bid.notFound')}</div>}
      <Link href="/commercial" style={{ ...ui.buttonGhost, display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', textDecoration: 'none' }}>← {t('bid.back')}</Link>
    </section>
  )

  const p = bid.projects
  const latest = estimates[0] || null
  const converted = p?.stage === 'contract'
  const actions: { status: BidStatus; label: string; primary?: boolean }[] =
    converted ? [] :
    bid.status === 'draft' ? [{ status: 'submitted', label: t('bid.markSubmitted'), primary: true }, { status: 'no_bid', label: t('bid.markNoBid') }] :
    bid.status === 'submitted' ? [{ status: 'won', label: t('bid.markWon'), primary: true }, { status: 'lost', label: t('bid.markLost') }, { status: 'draft', label: t('bid.reopen') }] :
    [{ status: 'draft', label: t('bid.reopen') }]

  const tabs: Tab[] = ['estimate', 'takeoff', 'proposal', 'revisions']

  return (
    <>
      <div style={{ background: '#fff', borderBottom: '1px solid #dfe7ea' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/commercial" style={{ fontSize: 13, fontWeight: 700, color: '#0b7f75', textDecoration: 'none' }}>← {t('bid.back')}</Link>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={statusStyle[bid.status]}>{t(`status.${bid.status}`)}</span>
                {converted && <span style={ui.chipTeal}>{t('bids.converted')}</span>}
                <span style={ui.small}>{bid.bid_number}{bid.due_at ? ` · ${t('bid.due', { date: formatDate(bid.due_at, language) })}` : ''}</span>
              </div>
              <h1 style={{ ...ui.title, fontSize: 22 }}>{p?.name}</h1>
              <span style={ui.small}>{[p?.client_name, p?.country_code, p?.currency_code].filter(Boolean).join(' · ')}</span>
              {bid.outcome_note && <span style={ui.small}>{t('bid.note', { note: bid.outcome_note })}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {latest && <span style={{ fontSize: 13, color: '#294955' }}>{t('bid.latestPrice')} <strong style={{ fontSize: 18, color: '#075a53' }}>{formatMoney(latest.price_total, latest.currency_code, numberFormat)}</strong></span>}
              {licensed && actions.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {actions.map(a => (
                    <button key={a.status} type="button" disabled={busy} onClick={() => setStatus(a.status)} style={a.primary ? ui.button : ui.buttonGhost}>{a.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && <div role="alert" style={ui.error}>{error}</div>}
          <nav role="tablist" aria-label={t('bid.sections')} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tabs.map(k => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{
                padding: '10px 14px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 13,
                fontWeight: tab === k ? 800 : 500, color: tab === k ? '#173441' : '#3f5862', borderBottom: `3px solid ${tab === k ? '#0b7f75' : 'transparent'}`,
              }}>{t(`bid.tab.${k}`)}</button>
            ))}
          </nav>
        </div>
      </div>

      <section style={ui.page}>
        {tab === 'takeoff' && (
          <div style={{ ...ui.card, padding: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong style={{ fontSize: 15, color: '#173441' }}>{t('takeoff.title')}</strong>
              <span style={ui.small}>{t('takeoff.counts', { sheets: counts.sheets, items: counts.items, elements: counts.elements })}</span>
              <span style={ui.small}>{t('takeoff.hint')}</span>
            </div>
            <Link href={`/ritsuscope/${projectId}`} style={{ ...ui.button, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', height: 44 }}>{t('takeoff.open')}</Link>
          </div>
        )}

        {tab === 'estimate' && <EstimateTab projectId={projectId} country={p?.country_code || 'BR'} editable={licensed && !converted} onChanged={() => void load()} />}
        {tab === 'proposal' && <div style={ui.empty}>{t('proposal.comingNext')}</div>}

        {tab === 'revisions' && (
          estimates.length === 0 ? <div style={ui.empty}>{t('revisions.empty')}</div> : (
            <div style={ui.tableWrap}>
              <table style={ui.table}>
                <thead>
                  <tr>
                    <th style={ui.th}>{t('revisions.col.revision')}</th>
                    <th style={ui.th}>{t('revisions.col.status')}</th>
                    <th style={{ ...ui.th, ...ui.num }}>{t('revisions.col.direct')}</th>
                    <th style={{ ...ui.th, ...ui.num }}>{t('revisions.col.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map(r => (
                    <tr key={r.id}>
                      <td style={ui.td}><strong>{r.name}</strong>{r.is_baseline && <span style={{ ...ui.chipTeal, marginLeft: 8 }}>{t('revisions.baseline')}</span>}</td>
                      <td style={ui.td}><span style={r.status === 'issued' ? ui.chipTeal : ui.chip}>{t(`revisions.status.${r.status}`)}</span></td>
                      <td style={{ ...ui.td, ...ui.num }}>{formatMoney(r.direct_total, r.currency_code, numberFormat)}</td>
                      <td style={{ ...ui.td, ...ui.num }}>{formatMoney(r.price_total, r.currency_code, numberFormat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </>
  )
}
