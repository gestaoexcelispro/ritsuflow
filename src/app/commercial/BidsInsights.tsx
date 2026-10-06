'use client'

import { useMemo } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import type { BidRow, EstimateSummary } from '@/lib/commercial/bids'
import { formatMoney, formatPct } from '@/lib/commercial/format'
import { clientStats, markupStats } from '@/lib/commercial/insights'
import { ui } from './ui'

/** Win rate by client and the markup of won vs. lost bids. */
export default function BidsInsights({ bids, estimates }: { bids: BidRow[]; estimates: Map<string, EstimateSummary> }) {
  const t = useT('commercial')
  const { numberFormat } = useLanguage()
  const clients = useMemo(() => clientStats(bids, estimates, t('insights.noClient')), [bids, estimates, t])
  const markup = useMemo(() => markupStats(bids, estimates), [bids, estimates])
  const money = (m: Map<string, number>) => [...m.entries()].map(([c, v]) => formatMoney(v, c, numberFormat)).join(' · ') || '—'

  const tile = (label: string, value: string, hint: string) => (
    <div style={{ ...ui.card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={ui.small}>{label}</span>
      <strong style={{ fontSize: 20, color: '#173441', fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
      <span style={ui.small}>{hint}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {tile(t('insights.markupWon'), formatPct(markup.won, numberFormat), t('insights.basedOn', { count: markup.wonCount }))}
        {tile(t('insights.markupLost'), formatPct(markup.lost, numberFormat), t('insights.basedOn', { count: markup.lostCount }))}
      </div>
      {markup.won != null && markup.lost != null && (
        <p style={{ ...ui.small, margin: 0 }}>{markup.lost > markup.won ? t('insights.readHigher', { diff: formatPct(markup.lost - markup.won, numberFormat, 1) }) : t('insights.readNotPrice')}</p>
      )}
      {clients.length === 0 ? <div style={ui.empty}>{t('bids.emptyFirst')}</div> : (
        <div style={ui.tableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>{t('bids.col.client')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('insights.col.bids')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('insights.col.open')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('status.won')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('status.lost')}</th>
                <th style={{ ...ui.th, minWidth: 180 }}>{t('insights.col.winRate')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('insights.col.wonValue')}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.client}>
                  <td style={ui.td}><strong style={{ fontWeight: 600 }}>{c.client}</strong></td>
                  <td style={{ ...ui.td, ...ui.num }}>{c.bids}</td>
                  <td style={{ ...ui.td, ...ui.num }}>{c.open}</td>
                  <td style={{ ...ui.td, ...ui.num }}>{c.won}</td>
                  <td style={{ ...ui.td, ...ui.num }}>{c.lost}</td>
                  <td style={ui.td}>
                    {c.winRate == null ? <span style={ui.small}>{t('insights.noDecision')}</span> : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 3, background: '#edf1f2', overflow: 'hidden' }}>
                          <div style={{ width: `${c.winRate}%`, height: '100%', background: '#0b7f75' }} />
                        </div>
                        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>{formatPct(c.winRate, numberFormat, 0)}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ ...ui.td, ...ui.num }}>{money(c.wonValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ ...ui.small, margin: 0 }}>{t('insights.note')}</p>
    </div>
  )
}
