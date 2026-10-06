'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { abcOfInputs, abcOfItems, type AbcRow } from '@/lib/commercial/abc'
import { ESTIMATE_COLUMNS, ITEM_COLUMNS, type EstimateRow, type ItemRow, inPrice } from '@/lib/commercial/estimates'
import { formatMoney, formatPct, formatQty } from '@/lib/commercial/format'
import { ui } from '../ui'

type View = 'inputs' | 'items'

const clsStyle: Record<AbcRow['cls'], CSSProperties> = {
  A: { ...ui.chip, background: '#173441', color: '#fff' },
  B: { ...ui.chip, background: '#d9e3e6', color: '#173441' },
  C: ui.chip,
}

/** Bid → ABC curve: what drives the direct cost, largest first (A ≤ 80%, B ≤ 95%, C the rest). */
export default function AbcTab({ projectId, bidNumber }: { projectId: string; bidNumber: string }) {
  const t = useT('commercial')
  const { numberFormat } = useLanguage()
  const [revisions, setRevisions] = useState<EstimateRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [view, setView] = useState<View>('inputs')
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().from('commercial_estimates').select(ESTIMATE_COLUMNS).eq('project_id', projectId).order('revision', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) { setError(t('error.load', { message: e.message })); return }
        const rows = (data || []) as EstimateRow[]
        setRevisions(rows); setSelectedId(s => s || rows[0]?.id || null)
      })
  }, [projectId, t])

  const estimate = revisions.find(r => r.id === selectedId) || null
  useEffect(() => {
    if (!estimate) return
    createClient().from('commercial_estimate_items').select(ITEM_COLUMNS).eq('estimate_id', estimate.id)
      .then(({ data, error: e }) => { if (e) setError(t('error.load', { message: e.message })); else setItems(((data || []) as ItemRow[]).map(i => ({ ...i, breakdown: i.breakdown || {} }))) })
  }, [estimate?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => { const base = inPrice(items); return view === 'inputs' ? abcOfInputs(base) : abcOfItems(base) }, [items, view])
  const cur = estimate?.currency_code || 'BRL'
  const summary = useMemo(() => (['A', 'B', 'C'] as const).map(c => {
    const list = rows.filter(r => r.cls === c)
    const amount = list.reduce((s, r) => s + r.amount, 0)
    const total = rows.reduce((s, r) => s + r.amount, 0)
    return { cls: c, count: list.length, amount, share: total ? (amount / total) * 100 : 0 }
  }), [rows])

  function exportCsv() {
    const sep = numberFormat === 'pt-BR' ? ';' : ','
    const n = (v: number, d = 2) => new Intl.NumberFormat(numberFormat, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }).format(v)
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`
    const head = [t('abc.col.class'), t('abc.col.item'), t('abc.col.bucket'), t('abc.col.qty'), t('field.unit'), `${t('abc.col.amount')} (${cur})`, t('abc.col.share'), t('abc.col.cumulative')]
    const body = rows.map(r => [r.cls, q(r.label), t(`abc.bucket.${r.bucket}`), r.qty == null ? '' : n(r.qty), r.unit, n(r.amount), n(r.share), n(r.cumulative)].join(sep))
    const blob = new Blob([`﻿${head.map(q).join(sep)}\n${body.join('\n')}\n`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${bidNumber} ${estimate?.name || ''} ${t(`abc.view.${view}`)}.csv`.replace(/[\\/:*?"<>|]+/g, '_')
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  if (!estimate) return <div style={ui.muted}>{error || t('loading')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={ui.toolbar}>
        <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center' }}>{t('revisions.col.revision')}
          <select value={estimate.id} onChange={e => setSelectedId(e.target.value)} style={ui.input}>
            {revisions.map(r => <option key={r.id} value={r.id}>{r.name} · {t(`revisions.status.${r.status}`)}</option>)}
          </select>
        </label>
        <div role="tablist" aria-label={t('abc.title')} style={ui.tabs}>
          {(['inputs', 'items'] as View[]).map(v => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} style={view === v ? ui.tabOn : ui.tab}>{t(`abc.view.${v}`)}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={exportCsv} disabled={!rows.length} style={ui.buttonGhost}>{t('abc.export')}</button>
      </div>
      {error && <div role="alert" style={ui.error}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {summary.map(s => (
          <div key={s.cls} style={{ ...ui.card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ ...clsStyle[s.cls], fontSize: 14, padding: '6px 10px' }}>{s.cls}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{formatPct(s.share, numberFormat, 1)} · {formatMoney(s.amount, cur, numberFormat)}</strong>
              <span style={ui.small}>{t('abc.count', { count: s.count })}</span>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? <div style={ui.empty}>{t('abc.empty')}</div> : (
        <div style={ui.tableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>{t('abc.col.class')}</th>
                <th style={ui.th}>{t('abc.col.item')}</th>
                {view === 'inputs' && <th style={ui.th}>{t('abc.col.bucket')}</th>}
                <th style={{ ...ui.th, ...ui.num }}>{t('abc.col.qty')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('abc.col.amount')}</th>
                <th style={{ ...ui.th, ...ui.num }}>{t('abc.col.share')}</th>
                <th style={{ ...ui.th, minWidth: 180 }}>{t('abc.col.cumulative')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td style={ui.td}><span style={clsStyle[r.cls]}>{r.cls}</span></td>
                  <td style={ui.td}>{r.label}</td>
                  {view === 'inputs' && <td style={ui.td}>{t(`abc.bucket.${r.bucket}`)}</td>}
                  <td style={{ ...ui.td, ...ui.num }}>{r.qty == null ? '—' : `${formatQty(r.qty, numberFormat)} ${r.unit}`}</td>
                  <td style={{ ...ui.td, ...ui.num, fontWeight: 600 }}>{formatMoney(r.amount, cur, numberFormat)}</td>
                  <td style={{ ...ui.td, ...ui.num }}>{formatPct(r.share, numberFormat)}</td>
                  <td style={ui.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 3, background: '#edf1f2', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, r.cumulative)}%`, height: '100%', background: r.cls === 'A' ? '#173441' : r.cls === 'B' ? '#7d97a1' : '#c3d1d5' }} />
                      </div>
                      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 58, textAlign: 'right' }}>{formatPct(r.cumulative, numberFormat)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ ...ui.small, margin: 0 }}>{t(`abc.note.${view}`)}</p>
    </div>
  )
}
