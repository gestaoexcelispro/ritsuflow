'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from '../daily-reports.module.css'
import { useDirty } from './useDirty'

const CATEGORIES = ['general', 'safety', 'quality', 'coordination', 'inspection', 'visitor', 'other']
const empty = { category: 'general', title: '', content: '', location_id: '' }
const toForm = (n) => ({ category: n.category || 'general', title: n.title || '', content: n.content || '', location_id: n.location_id || '' })

export default function NotesSection({ report, supabase, t, language, locked, onDirty }) {
  const [notes, setNotes] = useState([])
  const [locations, setLocations] = useState([])
  const [people, setPeople] = useState(new Map())
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  useDirty(onDirty, !locked && JSON.stringify(form) !== JSON.stringify(editing ? toForm(editing) : empty))
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const projectId = report.projects?.id
    const [notesRes, locRes] = await Promise.all([
      supabase.from('daily_report_notes').select('id,category,title,content,location_id,location_name,created_by,created_at').eq('daily_report_id', report.id).order('created_at', { ascending: false }),
      projectId ? supabase.from('fieldop_project_locations').select('location_id,locations(id,name)').eq('project_id', projectId).eq('is_active', true) : Promise.resolve({ data: [] }),
    ])
    if (notesRes.error) setError(t('common.error', { message: notesRes.error.message }))
    const list = notesRes.data || []
    setNotes(list)
    setLocations((locRes.data || []).map((l) => l.locations).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)))
    const ids = [...new Set(list.map((n) => n.created_by).filter(Boolean))]
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('user_id,full_name,email').in('user_id', ids)
      setPeople(new Map((profiles || []).map((p) => [p.user_id, p.full_name || p.email])))
    }
    setLoading(false)
  }, [report.id, report.projects?.id, supabase, t])

  useEffect(() => { load() }, [load])

  const dateTime = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const shown = filter === 'all' ? notes : notes.filter((n) => n.category === filter)
  function set(key, value) { setForm((cur) => ({ ...cur, [key]: value })); setMessage('') }

  async function add(event) {
    event.preventDefault()
    if (!form.content.trim()) { setError(t('notes.errContent')); return }
    setSaving(true); setError(''); setMessage('')
    const { data: auth } = await supabase.auth.getUser()
    const location = locations.find((l) => l.id === form.location_id)
    const fields = {
      category: form.category,
      title: form.title.trim() || null,
      content: form.content.trim(),
      location_id: location?.id || null,
      location_name: location?.name || null,
    }
    const { error: saveError } = editing
      ? await supabase.from('daily_report_notes').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('daily_report_notes').insert({ ...fields, daily_report_id: report.id, created_by: auth?.user?.id || null })
    if (saveError) setError(t('common.error', { message: saveError.message }))
    else { setMessage(t(editing ? 'notes.updated' : 'notes.added')); setForm(empty); setEditing(null); await load() }
    setSaving(false)
  }

  async function remove(note) {
    if (!window.confirm(t('notes.confirmDelete'))) return
    setBusyId(note.id); setError(''); setMessage('')
    const { error: delError } = await supabase.from('daily_report_notes').delete().eq('id', note.id)
    if (delError) setError(t('common.error', { message: delError.message }))
    else { setMessage(t('notes.deleted')); await load() }
    setBusyId('')
  }

  const field = { display: 'grid', gap: 6 }

  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.notes')}</h3><p>{t('notes.text')}</p></div><span className={styles.badge}>{t('notes.count', { count: notes.length })}</span></div>
    {!locked && <form onSubmit={add} style={{ display: 'grid', gap: 12, padding: 18, borderBottom: '1px solid var(--fo-line-soft)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <label style={field}><b>{t('notes.category')}</b><select value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(`notes.cat.${c}`)}</option>)}</select></label>
        <label style={field}><b>{t('notes.title')}</b><input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={t('notes.titlePlaceholder')} /></label>
        <label style={field}><b>{t('notes.location')}</b><select value={form.location_id} onChange={(e) => set('location_id', e.target.value)}><option value="">{t('notes.noLocation')}</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      </div>
      <label style={field}><b>{t('notes.content')}</b><textarea rows={3} value={form.content} onChange={(e) => set('content', e.target.value)} placeholder={t('notes.contentPlaceholder')} /></label>
      {error && <div className={styles.error} style={{ marginBottom: 0 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className={styles.successMessage}>{message}</span>
        <span style={{ display: 'flex', gap: 8 }}>{editing && <button type="button" className={styles.secondaryButton} onClick={() => { setEditing(null); setForm(empty) }}>{t('common.cancel')}</button>}<button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? t('common.saving') : t(editing ? 'notes.saveEdit' : 'notes.add')}</button></span>
      </div>
    </form>}
    {locked && error && <div className={styles.error} style={{ margin: 18 }}>{error}</div>}
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 18px' }}>
      {['all', ...CATEGORIES].map((c) => <button key={c} type="button" onClick={() => setFilter(c)} className={filter === c ? styles.primaryButton : styles.secondaryButton} style={{ minHeight: 30 }}>{c === 'all' ? t('notes.all') : t(`notes.cat.${c}`)}</button>)}
    </div>
    {loading ? <div className={styles.empty}>{t('common.loading')}</div>
      : shown.length === 0 ? <div className={styles.empty}>{t('notes.empty')}</div>
        : <table className={`${styles.table} ${styles.cardsTable}`}><tbody>{shown.map((n) => <tr key={n.id}>
          <td data-label="" style={{ width: 120 }}><span className={styles.badge}>{t(`notes.cat.${n.category}`)}</span></td>
          <td data-label="">{n.title && <strong style={{ display: 'block', marginBottom: 4 }}>{n.title}</strong>}<span style={{ whiteSpace: 'pre-wrap' }}>{n.content}</span>{n.location_name && <small style={{ display: 'block', marginTop: 4, color: 'var(--fo-muted)' }}>📍 {n.location_name}</small>}</td>
          <td data-label="" style={{ whiteSpace: 'nowrap', color: 'var(--fo-muted)' }}>{people.get(n.created_by) || '—'}<br /><small>{n.created_at ? dateTime.format(new Date(n.created_at)) : ''}</small></td>
          <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{!locked && <><button type="button" className={styles.secondaryButton} style={{ minHeight: 30, marginRight: 6 }} onClick={() => { setEditing(n); setForm(toForm(n)); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{t('list.edit')}</button><button type="button" className={styles.secondaryButton} style={{ minHeight: 30 }} disabled={busyId === n.id} onClick={() => remove(n)}>{t('notes.delete')}</button></>}</td>
        </tr>)}</tbody></table>}
  </section>
}
