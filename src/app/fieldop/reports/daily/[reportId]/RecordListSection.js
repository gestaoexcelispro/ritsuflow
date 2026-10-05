'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from '../daily-reports.module.css'
import { useDirty } from './useDirty'

// Generic add / edit / delete list for the Daily Report sections that hold several rows
// (Materials, Equipment, Issues). Each section passes its table, fields and columns.
//
// field: { key, type: 'text'|'number'|'select'|'textarea'|'date'|'time'|'location', label, options?, required?, min?, step?, span?, showIf?(form) }
// column: { key, label, render?(row) }

const toForm = (fields, row) => Object.fromEntries(fields.map((f) => [f.key, row?.[f.key] ?? f.default ?? '']))

export default function RecordListSection({
  report, supabase, t, locked, table, select, order = 'created_at', tabKey, textKey,
  fields, columns, toPayload, validate, summary, emptyKey, addKey, saveKey, savedKey, deletedKey, confirmKey, onDirty,
}) {
  const [rows, setRows] = useState([])
  const [locations, setLocations] = useState([])
  const [form, setForm] = useState(() => toForm(fields))
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useDirty(onDirty, open && JSON.stringify(form) !== opened)
  const needsLocations = fields.some((f) => f.type === 'location')

  const load = useCallback(async () => {
    const projectId = report.projects?.id
    const [res, loc] = await Promise.all([
      supabase.from(table).select(select).eq('daily_report_id', report.id).order(order, { ascending: true }),
      needsLocations && projectId ? supabase.from('fieldop_project_locations').select('locations(id,name)').eq('project_id', projectId).eq('is_active', true) : Promise.resolve({ data: [] }),
    ])
    if (res.error) setError(t('common.error', { message: res.error.message }))
    setRows(res.data || [])
    setLocations((loc.data || []).map((l) => l.locations).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }, [report.id, report.projects?.id, supabase, t, table, select, order, needsLocations])

  useEffect(() => { load() }, [load])

  function set(key, value) { setForm((cur) => ({ ...cur, [key]: value })); setMessage('') }
  function startAdd() { setForm(toForm(fields)); setOpened(JSON.stringify(toForm(fields))); setEditingId(null); setOpen(true); setError(''); setMessage('') }
  function startEdit(row) { setForm(toForm(fields, row)); setOpened(JSON.stringify(toForm(fields, row))); setEditingId(row.id); setOpen(true); setError(''); setMessage('') }
  function cancel() { setOpen(false); setEditingId(null); setError('') }

  async function save(event) {
    event.preventDefault()
    for (const f of fields) {
      if (f.required && (!f.showIf || f.showIf(form)) && String(form[f.key] ?? '').trim() === '') { setError(t('list.errRequired', { field: t(f.label) })); return }
    }
    const problem = validate?.(form)
    if (problem) { setError(t(problem)); return }
    setSaving(true); setError(''); setMessage('')
    const location = locations.find((l) => l.id === form.location_id)
    const original = editingId ? rows.find((r) => r.id === editingId) : null
    const payload = { ...toPayload(form, { location, original }), updated_at: new Date().toISOString() }
    let saveError
    if (editingId) ({ error: saveError } = await supabase.from(table).update(payload).eq('id', editingId))
    else {
      const { data: auth } = await supabase.auth.getUser()
      ;({ error: saveError } = await supabase.from(table).insert({ ...payload, daily_report_id: report.id, created_by: auth?.user?.id || null }))
    }
    if (saveError) setError(t('common.error', { message: saveError.message }))
    else { setOpen(false); setEditingId(null); setMessage(t(savedKey)); await load() }
    setSaving(false)
  }

  async function remove(row) {
    if (!window.confirm(t(confirmKey))) return
    setBusyId(row.id); setError(''); setMessage('')
    const { error: delError } = await supabase.from(table).delete().eq('id', row.id)
    if (delError) setError(t('common.error', { message: delError.message }))
    else { setMessage(t(deletedKey)); await load() }
    setBusyId('')
  }

  const totals = useMemo(() => summary?.(rows) || [], [rows, summary])
  const field = { display: 'grid', gap: 6 }
  const input = (f) => {
    const common = { value: form[f.key] ?? '', onChange: (e) => set(f.key, e.target.value) }
    if (f.type === 'select') return <select {...common}>{!f.required && <option value="">—</option>}{f.options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}</select>
    if (f.type === 'location') return <select {...common}><option value="">{t('list.noLocation')}</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    if (f.type === 'textarea') return <textarea rows={2} {...common} />
    return <input type={f.type} min={f.min} step={f.step} {...common} />
  }

  return <section className={styles.panel}>
    <div className={styles.panelHead}>
      <div><h3>{t(tabKey)}</h3><p>{t(textKey)}</p></div>
      {!locked && !open && <button type="button" className={styles.primaryButton} onClick={startAdd}>{t(addKey)}</button>}
    </div>

    {totals.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 18px', borderBottom: '1px solid var(--fo-line-soft)' }}>
      {totals.map((s) => <div key={s.label} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--fo-sunken)' }}><small style={{ display: 'block', color: 'var(--fo-muted)', fontSize: 13, fontWeight: 800 }}>{s.label}</small><strong>{s.value}</strong></div>)}
    </div>}

    {open && !locked && <form onSubmit={save} style={{ display: 'grid', gap: 12, padding: 18, borderBottom: '1px solid var(--fo-line-soft)', background: 'var(--fo-sunken)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        {fields.filter((f) => !f.showIf || f.showIf(form)).map((f) => <label key={f.key} style={{ ...field, gridColumn: f.span ? '1 / -1' : undefined }}><b>{t(f.label)}{f.required ? ' *' : ''}</b>{input(f)}</label>)}
      </div>
      {error && <div className={styles.error} style={{ marginBottom: 0 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className={styles.secondaryButton} onClick={cancel}>{t('common.cancel')}</button>
        <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? t('common.saving') : t(editingId ? 'list.saveChanges' : saveKey)}</button>
      </div>
    </form>}

    {message && <div className={styles.successMessage} style={{ padding: '10px 18px' }}>{message}</div>}
    {error && !open && <div className={styles.error} style={{ margin: 18 }}>{error}</div>}

    {loading ? <div className={styles.empty}>{t('common.loading')}</div>
      : rows.length === 0 ? <div className={styles.empty}>{t(emptyKey)}</div>
        : <div style={{ overflowX: 'auto' }}><table className={`${styles.table} ${styles.cardsTable}`}>
          <thead><tr>{columns.map((c) => <th key={c.key}>{t(c.label)}</th>)}{!locked && <th />}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            {columns.map((c, i) => <td key={c.key} data-label={i === 0 ? '' : t(c.label)}>{c.render ? c.render(row) : row[c.key] ?? '—'}</td>)}
            {!locked && <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
              <button type="button" className={styles.secondaryButton} style={{ minHeight: 30, marginRight: 6 }} onClick={() => startEdit(row)}>{t('list.edit')}</button>
              <button type="button" className={styles.secondaryButton} style={{ minHeight: 30 }} disabled={busyId === row.id} onClick={() => remove(row)}>{t('list.delete')}</button>
            </td>}
          </tr>)}</tbody>
        </table></div>}
  </section>
}
