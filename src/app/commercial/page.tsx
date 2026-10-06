'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { BID_COLUMNS, BID_STATUSES, ESTIMATE_SUMMARY_COLUMNS, OPEN_STATUSES, latestByProject, type BidRow, type BidStatus, type EstimateSummary } from '@/lib/commercial/bids'
import { formatDate, formatMoney } from '@/lib/commercial/format'
import { NEW_BID_EVENT, useCommercialAccess } from './license'
import NewBidDialog from './NewBidDialog'
import BidsCalendar from './BidsCalendar'
import BidsInsights from './BidsInsights'
import { statusStyle, ui } from './ui'

type Filter = 'open' | 'all' | BidStatus

const DAY = 86400000

/** Commercial home: every bid of the company, with the pipeline at a glance. */
export default function BidsPage() {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const { canCreateBids: licensed } = useCommercialAccess()
  const [bids, setBids] = useState<BidRow[]>([])
  const [estimates, setEstimates] = useState<Map<string, EstimateSummary>>(new Map())
  const [filter, setFilter] = useState<Filter>('open')
  const [view, setView] = useState<'list' | 'calendar' | 'insights'>('list')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [b, e] = await Promise.all([
      supabase.from('commercial_bids').select(BID_COLUMNS).order('due_at', { ascending: true, nullsFirst: false }),
      supabase.from('commercial_estimates').select(ESTIMATE_SUMMARY_COLUMNS),
    ])
    setLoading(false)
    if (b.error || e.error) { setError(t('error.load', { message: (b.error || e.error)!.message })); return }
    setBids((b.data || []) as unknown as BidRow[])
    setEstimates(latestByProject((e.data || []) as EstimateSummary[]))
  }, [t])

  useEffect(() => { void load() }, [load])

  // "New bid" lives in the header's tab bar; from another Commercial page it arrives as #new.
  useEffect(() => {
    const open = () => { if (licensed) setCreating(true) }
    if (window.location.hash === '#new') { open(); window.history.replaceState(null, '', window.location.pathname) }
    window.addEventListener(NEW_BID_EVENT, open)
    return () => window.removeEventListener(NEW_BID_EVENT, open)
  }, [licensed])

  const stats = useMemo(() => {
    const now = Date.now()
    const open = bids.filter(b => OPEN_STATUSES.includes(b.status))
    const submittedTotals = new Map<string, number>()
    for (const b of bids.filter(x => x.status === 'submitted')) {
      const est = estimates.get(b.project_id)
      if (est) submittedTotals.set(est.currency_code, (submittedTotals.get(est.currency_code) || 0) + Number(est.price_total || 0))
    }
    const decided = bids.filter(b => (b.status === 'won' || b.status === 'lost') && b.decided_at && now - Date.parse(b.decided_at) <= 365 * DAY)
    const won = decided.filter(b => b.status === 'won').length
    const dueSoon = open.filter(b => b.due_at && Date.parse(b.due_at) >= now - DAY && Date.parse(b.due_at) <= now + 7 * DAY).length
    return {
      open: open.length,
      submitted: [...submittedTotals.entries()].map(([c, v]) => formatMoney(v, c, numberFormat)).join(' · ') || '—',
      winRate: decided.length ? `${Math.round((won / decided.length) * 100)}%` : '—',
      dueSoon,
    }
  }, [bids, estimates, numberFormat])

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return bids.filter(b => {
      if (filter === 'open' && !OPEN_STATUSES.includes(b.status)) return false
      if (filter !== 'open' && filter !== 'all' && b.status !== filter) return false
      const p = b.projects
      return !s || b.bid_number.toLowerCase().includes(s) || (p?.name || '').toLowerCase().includes(s) || (p?.client_name || '').toLowerCase().includes(s)
    })
  }, [bids, filter, search])

  const tile = (label: string, value: string | number, warn = false) => (
    <div style={{ ...ui.card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={ui.small}>{label}</span>
      <strong style={{ fontSize: 20, color: warn ? '#a8521f' : '#173441', fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </div>
  )

  return (
    <section style={ui.page}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {tile(t('bids.stat.open'), stats.open)}
        {tile(t('bids.stat.submitted'), stats.submitted)}
        {tile(t('bids.stat.winRate'), stats.winRate)}
        {tile(t('bids.stat.dueSoon'), stats.dueSoon, stats.dueSoon > 0)}
      </div>

      <div role="tablist" aria-label={t('bids.views')} style={{ ...ui.tabs, alignSelf: 'flex-start' }}>
        {(['list', 'calendar', 'insights'] as const).map(v => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} style={view === v ? ui.tabOn : ui.tab}>{t(`bids.view.${v}`)}</button>
        ))}
      </div>

      {view === 'calendar' && !loading && <BidsCalendar bids={bids} />}
      {view === 'insights' && !loading && <BidsInsights bids={bids} estimates={estimates} />}

      {view === 'list' && <>
      <div style={ui.toolbar}>
        <div role="tablist" aria-label={t('bids.filter')} style={ui.tabs}>
          {(['open', 'all', ...BID_STATUSES] as Filter[]).map(f => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} style={filter === f ? ui.tabOn : ui.tab}>
              {f === 'open' || f === 'all' ? t(`bids.filter.${f}`) : t(`status.${f}`)}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('bids.search')} aria-label={t('bids.search')} style={{ ...ui.input, flex: '1 1 220px' }} />
      </div>

      {error && <div role="alert" style={ui.error}>{error}</div>}

      {loading ? <div style={ui.muted}>{t('loading')}</div> : rows.length === 0 ? (
        <div style={ui.empty}>{bids.length === 0 ? t('bids.emptyFirst') : t('bids.empty')}</div>
      ) : (
        <div style={ui.tableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>{t('bids.col.bid')}</th>
                <th style={ui.th}>{t('bids.col.client')}</th>
                <th style={ui.th}>{t('bids.col.due')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('bids.col.estimate')}</th>
                <th style={ui.th}>{t('bids.col.status')}</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {rows.map(b => {
                const est = estimates.get(b.project_id)
                const overdue = OPEN_STATUSES.includes(b.status) && b.due_at && Date.parse(b.due_at) < Date.now()
                return (
                  <tr key={b.project_id}>
                    <td style={ui.td}>
                      <Link href={`/commercial/${b.project_id}`} style={{ fontWeight: 700, color: '#173441', textDecoration: 'none' }}>{b.projects?.name || '—'}</Link>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={ui.chip}>{b.bid_number}</span>
                        {b.projects?.stage === 'contract' && <span style={ui.chipTeal}>{t('bids.converted')}</span>}
                      </div>
                    </td>
                    <td style={ui.td}>{b.projects?.client_name || '—'}</td>
                    <td style={{ ...ui.td, color: overdue ? '#a44343' : undefined, fontWeight: overdue ? 700 : undefined }}>{b.due_at ? formatDate(b.due_at, language) : '—'}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{est ? formatMoney(est.price_total, est.currency_code, numberFormat) : '—'}</td>
                    <td style={ui.td}><span style={statusStyle[b.status]}>{t(`status.${b.status}`)}</span></td>
                    <td style={{ ...ui.td, textAlign: 'right' }}>
                      <Link href={`/commercial/${b.project_id}`} style={{ ...ui.buttonSmall, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{t('bids.open')}</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </>}
      {creating && <NewBidDialog onClose={() => setCreating(false)} />}
    </section>
  )
}
