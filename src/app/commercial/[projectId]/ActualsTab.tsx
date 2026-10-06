'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { compare, loadActuals, type Comparison } from '@/lib/commercial/actuals'
import { ESTIMATE_COLUMNS, ITEM_COLUMNS, type EstimateRow, type ItemRow } from '@/lib/commercial/estimates'
import { formatMoney, formatPct, formatQty } from '@/lib/commercial/format'
import { ui } from '../ui'

/** Converted project → estimate vs. actual: the baseline revision against what FieldOp records. */
export default function ActualsTab({ projectId }: { projectId: string }) {
  const t = useT('commercial')
  const { numberFormat } = useLanguage()
  const [baseline, setBaseline] = useState<EstimateRow | null>(null)
  const [cmp, setCmp] = useState<Comparison | null>(null)
  const [reports, setReports] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error: e } = await supabase.from('commercial_estimates').select(ESTIMATE_COLUMNS).eq('project_id', projectId).order('revision', { ascending: false })
        if (e) throw new Error(e.message)
        const rows = (data || []) as EstimateRow[]
        const base = rows.find(r => r.is_baseline) || rows.find(r => r.status === 'issued') || rows[0] || null
        if (!base) { if (active) setLoading(false); return }
        const [items, actuals] = await Promise.all([
          supabase.from('commercial_estimate_items').select(ITEM_COLUMNS).eq('estimate_id', base.id),
          loadActuals(supabase, projectId),
        ])
        if (items.error) throw new Error(items.error.message)
        if (!active) return
        setBaseline(base)
        setReports(actuals.reportCount)
        setCmp(compare(((items.data || []) as ItemRow[]).map(i => ({ ...i, breakdown: i.breakdown || {} })), actuals))
      } catch (err) {
        if (active) setError(t('error.load', { message: err instanceof Error ? err.message : String(err) }))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [projectId, t])

  if (loading) return <div style={ui.muted}>{t('loading')}</div>
  if (error) return <div role="alert" style={ui.error}>{error}</div>
  if (!baseline || !cmp) return <div style={ui.empty}>{t('actuals.noBaseline')}</div>

  const cur = baseline.currency_code
  const h = (v: number) => `${formatQty(v, numberFormat, 1)} h`
  const tile = (label: string, value: string, hint: string, tone?: 'good' | 'bad') => (
    <div style={{ ...ui.card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={ui.small}>{label}</span>
      <strong style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums', color: tone === 'good' ? '#075a53' : tone === 'bad' ? '#a8521f' : '#173441' }}>{value}</strong>
      <span style={ui.small}>{hint}</span>
    </div>
  )
  const pi = cmp.productivity

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={ui.notice}>{t('actuals.baseline', { name: baseline.name })}</div>
      {reports === 0 && cmp.actualHours === 0 && (
        <div style={{ ...ui.notice, background: '#fff4e8', color: '#6e3610' }}>
          {t('actuals.noData')} <Link href={`/fieldop/projects/${projectId}`} style={{ fontWeight: 700 }}>{t('actuals.openFieldOp')}</Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {tile(t('actuals.progress'), cmp.progress == null ? '—' : formatPct(cmp.progress, numberFormat, 1), t('actuals.progressHint'))}
        {tile(t('actuals.earned'), formatMoney(cmp.earned, cur, numberFormat), t('actuals.earnedHint', { total: formatMoney(cmp.direct, cur, numberFormat) }))}
        {tile(t('actuals.hours'), `${h(cmp.earnedHours)} / ${h(cmp.actualHours)}`, t('actuals.hoursHint', { estimated: h(cmp.estimatedHours) }))}
        {tile(t('actuals.productivity'), pi == null ? '—' : formatQty(pi, numberFormat, 2), pi == null ? t('actuals.productivityNone') : pi >= 1 ? t('actuals.productivityGood') : t('actuals.productivityBad'), pi == null ? undefined : pi >= 1 ? 'good' : 'bad')}
      </div>
      {cmp.unlinked > 0 && <p style={{ ...ui.small, margin: 0 }}>{t('actuals.unlinked', { count: cmp.unlinked })}</p>}

      <div style={ui.tableWrap}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>{t('estimate.col.item')}</th>
              <th style={{ ...ui.th, ...ui.num }}>{t('actuals.col.estimated')}</th>
              <th style={{ ...ui.th, ...ui.num }}>{t('actuals.col.produced')}</th>
              <th style={{ ...ui.th, minWidth: 160 }}>{t('actuals.col.progress')}</th>
              <th style={{ ...ui.th, ...ui.num }}>{t('actuals.col.earned')}</th>
              <th style={{ ...ui.th, ...ui.num }}>{t('actuals.col.hours')}</th>
            </tr>
          </thead>
          <tbody>
            {cmp.items.map(r => (
              <tr key={r.id}>
                <td style={ui.td}>{r.description}</td>
                <td style={{ ...ui.td, ...ui.num }}>{formatQty(r.estimatedQty, numberFormat)} {r.unit}</td>
                <td style={{ ...ui.td, ...ui.num }}>{r.producedQty == null ? <span style={ui.small}>{t('actuals.notLinked')}</span> : `${formatQty(r.producedQty, numberFormat)} ${r.unit}`}</td>
                <td style={ui.td}>
                  {r.progress == null ? '—' : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 3, background: '#edf1f2', overflow: 'hidden' }}>
                        <div style={{ width: `${r.progress}%`, height: '100%', background: '#0b7f75' }} />
                      </div>
                      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>{formatPct(r.progress, numberFormat, 0)}</span>
                    </div>
                  )}
                </td>
                <td style={{ ...ui.td, ...ui.num }}>{formatMoney(r.earned, cur, numberFormat)}</td>
                <td style={{ ...ui.td, ...ui.num }}>{r.estimatedHours ? `${h(r.earnedHours)} / ${h(r.estimatedHours)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cmp.materials.length > 0 && (
        <section aria-labelledby="mat-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong id="mat-title" style={{ fontSize: 14, color: '#173441' }}>{t('actuals.materials')}</strong>
          <div style={ui.tableWrap}>
            <table style={{ ...ui.table, minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={ui.th}>{t('field.name')}</th>
                  <th style={{ ...ui.th, ...ui.num }}>{t('actuals.col.estimatedTotal')}</th>
                  <th style={{ ...ui.th, ...ui.num }}>{t('actuals.col.received')}</th>
                  <th style={{ ...ui.th, ...ui.num }}>{t('actuals.col.receivedPct')}</th>
                </tr>
              </thead>
              <tbody>
                {cmp.materials.map(m => (
                  <tr key={`${m.name}|${m.unit}`}>
                    <td style={ui.td}>{m.name}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{m.estimated ? `${formatQty(m.estimated, numberFormat)} ${m.unit}` : <span style={ui.small}>{t('actuals.notEstimated')}</span>}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{formatQty(m.received, numberFormat)} {m.unit}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{m.estimated ? formatPct((m.received / m.estimated) * 100, numberFormat, 0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p style={{ ...ui.small, margin: 0 }}>{t('actuals.note')}</p>
    </div>
  )
}
