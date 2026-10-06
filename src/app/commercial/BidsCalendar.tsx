'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import type { BidRow } from '@/lib/commercial/bids'
import { localDay, monthGrid } from '@/lib/commercial/insights'
import { statusStyle, ui } from './ui'

/** Bids by due date, one month at a time (weeks start on Monday). */
export default function BidsCalendar({ bids }: { bids: BidRow[] }) {
  const t = useT('commercial')
  const { language } = useLanguage()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const today = localDay(now.toISOString())

  const byDay = useMemo(() => {
    const map = new Map<string, BidRow[]>()
    for (const b of bids) if (b.due_at) { const d = localDay(b.due_at); map.set(d, [...(map.get(d) || []), b]) }
    return map
  }, [bids])

  const weeks = monthGrid(ym.y, ym.m)
  const title = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(new Date(ym.y, ym.m, 15))
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(2026, 9, 5 + i)))
  const move = (by: number) => setYm(({ y, m }) => { const d = new Date(y, m + by, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const noDate = bids.filter(b => !b.due_at && (b.status === 'draft' || b.status === 'submitted')).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={ui.toolbar}>
        <button type="button" aria-label={t('calendar.prev')} onClick={() => move(-1)} style={ui.buttonSmall}>←</button>
        <strong style={{ fontSize: 16, color: '#173441', minWidth: 180, textAlign: 'center', textTransform: 'capitalize' }}>{title}</strong>
        <button type="button" aria-label={t('calendar.next')} onClick={() => move(1)} style={ui.buttonSmall}>→</button>
        <button type="button" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} style={ui.buttonSmall}>{t('calendar.today')}</button>
        <span style={{ flex: 1 }} />
        {noDate > 0 && <span style={ui.small}>{t('calendar.noDate', { count: noDate })}</span>}
      </div>
      <div style={{ ...ui.tableWrap }}>
        <div style={{ minWidth: 760, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {weekdays.map(w => <div key={w} style={{ ...ui.th, textAlign: 'center', textTransform: 'capitalize' }}>{w}</div>)}
          {weeks.flat().map((day, i) => {
            const list = day ? byDay.get(day) || [] : []
            return (
              <div key={day || `x${i}`} style={{ minHeight: 96, padding: 6, borderTop: '1px solid #edf1f2', borderLeft: i % 7 ? '1px solid #edf1f2' : 0, background: day ? (day === today ? '#f3fbfa' : '#fff') : '#f9fbfc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {day && <span style={{ fontSize: 12, fontWeight: day === today ? 800 : 600, color: day === today ? '#075a53' : '#3f5862' }}>{Number(day.slice(8))}</span>}
                {list.map(b => (
                  <Link key={b.project_id} href={`/commercial/${b.project_id}`} title={`${b.bid_number} · ${b.projects?.name || ''}`}
                    style={{ ...statusStyle[b.status], display: 'block', borderRadius: 6, padding: '3px 6px', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.projects?.name || b.bid_number}
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
