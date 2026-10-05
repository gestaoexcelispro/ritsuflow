'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from '../daily-reports.module.css'

/** Start and end of the report day in the browser's time zone, as ISO strings. */
function dayRange(reportDate) {
  const start = new Date(`${reportDate}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

export default function ProductionSection({ report, supabase, t, language, locked, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [values, setValues] = useState({})
  const [prefilled, setPrefilled] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(''); setMessage('')
      const projectId = report.projects.id
      const [allocationsResult, enabledResult, savedResult] = await Promise.all([
        supabase.from('location_service_quantities').select('id,location_id,service_id,quantity,locations(id,name,location_type),fieldop_activity:fieldop_project_activities!location_service_quantities_service_id_fkey(id,activity_name,unit,source,is_active,scope_item:project_scopes(scope_code,scope_name,unit))').eq('project_id', projectId).gt('quantity', 0).order('created_at', { ascending: true }),
        supabase.from('fieldop_project_locations').select('location_id').eq('project_id', projectId).eq('is_active', true),
        supabase.from('daily_report_production').select('id,location_service_quantity_id,actual_quantity').eq('daily_report_id', report.id),
      ])
      const firstError = [allocationsResult, enabledResult, savedResult].find((r) => r.error)
      if (firstError) { if (!cancelled) { setError(t('common.error', { message: firstError.error.message })); setLoading(false) } return }

      const enabled = new Set((enabledResult.data || []).map((r) => r.location_id))
      const savedBy = new Map((savedResult.data || []).map((r) => [r.location_service_quantity_id, r]))
      // Only enabled locations; activities that were deactivated stay visible if this report already has them.
      const allocations = (allocationsResult.data || []).filter((a) => enabled.has(a.location_id) && (a.fieldop_activity?.is_active || savedBy.has(a.id)))
      const ids = allocations.map((a) => a.id)

      let previousRows = []
      let fieldRows = []
      if (ids.length) {
        const [from, to] = dayRange(report.report_date)
        const [previousResult, fieldResult] = await Promise.all([
          supabase.from('daily_report_production').select('location_service_quantity_id,actual_quantity,daily_reports!inner(report_date,project_id)').in('location_service_quantity_id', ids).eq('daily_reports.project_id', projectId).lt('daily_reports.report_date', report.report_date),
          supabase.from('field_execution_events').select('location_service_quantity_id,actual_quantity').in('location_service_quantity_id', ids).eq('status', 'completed').gte('finished_at', from).lt('finished_at', to),
        ])
        previousRows = previousResult.data || []
        fieldRows = fieldResult.data || []
      }
      const sum = (list) => list.reduce((acc, r) => { acc[r.location_service_quantity_id] = (acc[r.location_service_quantity_id] || 0) + Number(r.actual_quantity || 0); return acc }, {})
      const previousBy = sum(previousRows)
      const fieldBy = sum(fieldRows)

      const initial = {}
      const fromField = new Set()
      const prepared = allocations.map((allocation) => {
        const saved = savedBy.get(allocation.id)
        const field = fieldBy[allocation.id] || 0
        if (saved) initial[allocation.id] = String(saved.actual_quantity ?? '')
        else if (field > 0) { initial[allocation.id] = String(field); fromField.add(allocation.id) }
        else initial[allocation.id] = ''
        const activity = allocation.fieldop_activity
        const scope = activity?.scope_item
        return {
          allocation,
          previous: previousBy[allocation.id] || 0,
          field,
          code: scope?.scope_code || '',
          name: scope?.scope_name || activity?.activity_name || '—',
          unit: scope?.unit || activity?.unit || '',
        }
      })
      if (!cancelled) { setRows(prepared); setValues(initial); setPrefilled(fromField); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [report.id, report.report_date, report.projects.id, supabase, t])

  const number = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }), [language])
  const parse = (value) => { const n = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

  const computed = rows.map((row) => {
    const allocated = Number(row.allocation.quantity || 0)
    const today = parse(values[row.allocation.id])
    const cumulative = row.previous + today
    const over = cumulative > allocated + 1e-9
    const status = cumulative >= allocated ? 'completed' : cumulative > 0 ? 'in_progress' : 'not_started'
    return { ...row, allocated, today, cumulative, remaining: Math.max(0, allocated - cumulative), over, status }
  })
  const totals = computed.reduce((acc, r) => ({ allocated: acc.allocated + r.allocated, previous: acc.previous + r.previous, today: acc.today + r.today }), { allocated: 0, previous: 0, today: 0 })
  const anyOver = computed.some((r) => r.over)

  function applyFieldQuantities() {
    setValues((current) => {
      const next = { ...current }
      rows.forEach((row) => { if (row.field > 0) next[row.allocation.id] = String(row.field) })
      return next
    })
    setPrefilled(new Set(rows.filter((r) => r.field > 0).map((r) => r.allocation.id)))
  }

  async function save() {
    setSaving(true); setMessage(''); setError('')
    const items = computed.map((r) => ({ location_service_quantity_id: r.allocation.id, actual_quantity: r.today }))
    const { data, error: rpcError } = await supabase.rpc('fieldop_save_daily_production', { p_daily_report_id: report.id, p_items: items })
    if (rpcError) setError(t('common.error', { message: rpcError.message }))
    else { setMessage(t('production.saved', { count: data ?? 0 })); setPrefilled(new Set()); onSaved?.() }
    setSaving(false)
  }

  if (loading) return <section className={styles.panel}><div className={styles.empty}>{t('common.loading')}</div></section>

  return <section className={styles.productionPanel}>
    <div className={styles.productionHead}>
      <div><span className={styles.eyebrowDark}>{t('production.eyebrow')}</span><h2>{t('production.title')}</h2><p>{t('production.text')}</p></div>
      <div className={styles.productionStats}>
        <div><span>{t('production.statAllocated')}</span><strong>{number.format(totals.allocated)}</strong></div>
        <div><span>{t('production.statPrevious')}</span><strong>{number.format(totals.previous)}</strong></div>
        <div><span>{t('production.statToday')}</span><strong>{number.format(totals.today)}</strong></div>
        <div><span>{t('production.statRemaining')}</span><strong>{number.format(Math.max(0, totals.allocated - totals.previous - totals.today))}</strong></div>
      </div>
    </div>
    {rows.length === 0
      ? <div className={styles.productionEmpty}><strong>{t('production.emptyTitle')}</strong><span>{t('production.emptyText')}</span></div>
      : <>
        {(prefilled.size > 0 || rows.some((r) => r.field > 0)) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 18px', background: '#effaf8', borderBottom: '1px solid #cbe9e4', color: '#0b4f4a', fontSize: 13 }}>
          <span>{prefilled.size > 0 ? t('production.prefilled') : ''}</span>
          <button type="button" className={styles.secondaryButton} onClick={applyFieldQuantities} disabled={locked}>{t('production.useField')}</button>
        </div>}
        <div className={styles.productionTableWrap}><table className={styles.productionTable}>
          <thead><tr>
            <th>{t('production.colLocation')}</th><th>{t('production.colActivity')}</th><th>{t('production.colAllocated')}</th><th>{t('production.colPrevious')}</th>
            <th>{t('production.colField')}</th><th>{t('production.colToday')}</th><th>{t('production.colCumulative')}</th><th>{t('production.colRemaining')}</th><th>{t('production.colStatus')}</th>
          </tr></thead>
          <tbody>{computed.map((r) => <tr key={r.allocation.id} style={r.over ? { background: '#fff4f2' } : undefined}>
            <td><strong>{r.allocation.locations?.name || '—'}</strong><small>{r.allocation.locations?.location_type || ''}</small></td>
            <td><strong>{r.code ? `${r.code} · ` : ''}{r.name}</strong><small>{r.unit}</small></td>
            <td>{number.format(r.allocated)}</td>
            <td>{number.format(r.previous)}</td>
            <td>{r.field > 0 ? number.format(r.field) : '—'}</td>
            <td>
              <input className={styles.productionInput} inputMode="decimal" value={values[r.allocation.id] ?? ''} disabled={locked}
                onChange={(e) => { const v = e.target.value; setValues((cur) => ({ ...cur, [r.allocation.id]: v })); setPrefilled((cur) => { const n = new Set(cur); n.delete(r.allocation.id); return n }) }}
                style={prefilled.has(r.allocation.id) ? { background: '#effaf8', borderColor: '#9fd6cf' } : undefined} />
              {r.over && <small style={{ color: '#b42318' }}>{t('production.overRow')}</small>}
            </td>
            <td>{number.format(r.cumulative)}</td>
            <td>{number.format(r.remaining)}</td>
            <td><span className={`${styles.productionStatus} ${r.status === 'completed' ? styles.statusComplete : r.status === 'in_progress' ? styles.statusProgress : ''}`}>{t(`production.status.${r.status}`)}</span></td>
          </tr>)}</tbody>
        </table></div>
      </>}
    {error && <div className={styles.error} style={{ margin: '12px 18px 0' }}>{error}</div>}
    <div className={styles.productionFooter}>
      <span className={message ? styles.successMessage : styles.productionMessage}>{message || t('production.footer')}</span>
      <button className={styles.primaryButton} type="button" disabled={saving || rows.length === 0 || anyOver || locked} onClick={save}>{saving ? t('common.saving') : t('production.save')}</button>
    </div>
  </section>
}
