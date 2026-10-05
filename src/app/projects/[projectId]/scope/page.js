'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { AppShell, Badge, Empty, Icon, Notice, Segments, Stat, Stats, ui } from '../../../fieldop/ui'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import styles from './scope.module.css'

const UNITS = ['SF', 'LF', 'EA', 'CY', 'SY', 'TON', 'HR', 'm²', 'm', 'm³', 'kg', 'month', 'LS', 'unit']
const STATUSES = ['draft', 'defined', 'pending', 'on_hold']
const SOURCES = ['contract', 'ritsuscope', 'manual']
const SIDES = ['N/A', 'A', 'B']
const STATUS_TONE = { defined: 'ok', pending: 'warn', on_hold: 'bad' }
const BLANK = { item_type: 'scope', parent_scope_id: null, scope_code: '', scope_name: '', description: '', exclusions: '', quantity: '', unit: 'm²', unit_price: '', quantity_source: 'contract', status: 'defined', notes: '' }
const ACTIVITY_BLANK = { activity_name: '', wall_side: 'N/A', quantity: '', unit: 'm²', notes: '' }
const num = (v) => Number(v || 0)
const source = (v) => (v === 'takeoff' || v === 'ritsucad' ? 'ritsuscope' : v || 'contract')

/** Label + control. Module-level so inputs keep focus while typing. */
function Field({ label, wide, children }) {
  return <label className={`${ui.field} ${wide ? styles.wide : ''}`}><span className={ui.fieldLabel}>{label}</span>{children}</label>
}

export default function ScopeRegisterPage() {
  const t = useT('projects')
  const { language } = useLanguage()
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(new Set())
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(null) // form for the Add dialog
  const [draft, setDraft] = useState(null) // copy of the row being edited
  const [tab, setTab] = useState('general')
  const [activities, setActivities] = useState([])
  const [activityForm, setActivityForm] = useState(ACTIVITY_BLANK)
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')

  const currency = project?.currency_code || 'BRL'
  const cash = (v) => { try { return new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: 2 }).format(num(v)) } catch { return num(v).toFixed(2) } }
  const qty = (v) => (v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(num(v)))
  const pct = (v) => new Intl.NumberFormat(language, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(v)

  useEffect(() => { if (projectId) load() }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draft?.id) { setActivities([]); return }
    supabase.from('scope_activities').select('*').eq('scope_id', draft.id).order('sequence').then(({ data, error: e }) => { if (e) setDialogError(e.message); else setActivities(data || []) })
  }, [draft?.id])

  async function load() {
    setLoading(true); setError('')
    const [{ data: p, error: pe }, { data: s, error: se }] = await Promise.all([
      supabase.from('projects').select('id, name, contract_value, currency_code').eq('id', projectId).maybeSingle(),
      supabase.from('project_scopes').select('*').eq('project_id', projectId).order('scope_code').order('created_at'),
    ])
    if (pe || se) setError(t('scope.errLoad', { message: pe?.message || se?.message }))
    setProject(p); setRows(s || []); setLoading(false)
  }

  async function actor() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error(t('scope.errSignedOut'))
    const { data: p } = await supabase.from('user_profiles').select('full_name, display_name, email').eq('user_id', user.id).maybeSingle()
    return { user, name: p?.full_name || p?.display_name || p?.email || user.email || 'RitsuFlow User' }
  }
  async function history(a, type, label, description, entityId, metadata = {}) {
    await supabase.from('project_history').insert({ project_id: projectId, action_type: type, action_label: label, description, entity_type: 'scope', entity_id: String(entityId), performed_by: a.user.id, performed_by_name: a.name, metadata })
  }

  // ---------- Tree ----------
  const children = useMemo(() => { const m = {}; rows.forEach((r) => { const k = r.parent_scope_id || 'root'; (m[k] || (m[k] = [])).push(r) }); return m }, [rows])
  const byId = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows])
  function rollup(id, seen = new Set()) {
    if (seen.has(id)) return 0
    seen.add(id)
    const kids = children[id] || []
    if (kids.length) return kids.reduce((s, k) => s + rollup(k.id, new Set(seen)), 0)
    const r = byId[id]
    return r?.item_type === 'item' ? num(r.quantity) * num(r.unit_price) : 0
  }
  function depthOf(r) { let d = 0, p = r.parent_scope_id, guard = 0; while (p && guard++ < 10) { d++; p = byId[p]?.parent_scope_id } return d }
  const topRows = children.root || []
  const allocated = topRows.reduce((s, r) => s + rollup(r.id), 0)
  const contract = num(project?.contract_value)
  const remaining = contract - allocated
  const rawProgress = contract > 0 ? (allocated / contract) * 100 : 0
  const progress = Math.min(100, Math.max(0, rawProgress))
  const counts = rows.reduce((c, r) => ({ ...c, [r.item_type]: (c[r.item_type] || 0) + 1 }), {})

  const query = search.trim().toLowerCase()
  const visible = useMemo(() => {
    if (query) return rows.filter((r) => `${r.scope_code} ${r.scope_name}`.toLowerCase().includes(query))
    const out = []
    const walk = (parent) => (children[parent] || []).forEach((r) => { out.push(r); if (!collapsed.has(r.id)) walk(r.id) })
    walk('root')
    return out
  }, [rows, children, collapsed, query])

  // ---------- Add ----------
  function nextCode(type, parent) {
    if (type === 'scope') return String(topRows.length + 1)
    if (!parent) return ''
    return `${parent.scope_code || '1'}.${(children[parent.id] || []).length + 1}`
  }
  function validParent(type, parent) {
    if (!parent) return null
    if (type === 'group') return parent.item_type === 'scope' ? parent : (byId[parent.parent_scope_id]?.item_type === 'scope' ? byId[parent.parent_scope_id] : null)
    if (type === 'item') return ['scope', 'group'].includes(parent.item_type) ? parent : byId[parent.parent_scope_id] || null
    return null
  }
  const parentOptions = (type, selfId) => rows.filter((r) => r.id !== selfId && (type === 'group' ? r.item_type === 'scope' : type === 'item' ? ['scope', 'group'].includes(r.item_type) : false))
  function openAdd(type) {
    const parent = validParent(type, byId[selectedId])
    setDialogError('')
    setAdding({ ...BLANK, item_type: type, parent_scope_id: parent?.id || null, unit: parent?.unit || 'm²', scope_code: nextCode(type, parent) })
  }
  function changeParent(id) {
    const parent = byId[id] || null
    setAdding((f) => ({ ...f, parent_scope_id: parent?.id || null, unit: parent?.unit || f.unit || 'm²', scope_code: nextCode(f.item_type, parent) }))
  }
  async function create() {
    if (!adding.scope_name.trim() || saving) return
    if (adding.item_type !== 'scope' && !adding.parent_scope_id) { setDialogError(t(`scope.errParent.${adding.item_type}`)); return }
    setSaving(true); setDialogError('')
    try {
      const a = await actor()
      const isItem = adding.item_type === 'item'
      const payload = { ...adding, scope_name: adding.scope_name.trim(), quantity_source: source(adding.quantity_source), project_id: projectId, quantity: isItem && adding.quantity !== '' ? num(adding.quantity) : null, unit_price: isItem ? num(adding.unit_price) : 0, created_by: a.user.id }
      const { data, error: e } = await supabase.from('project_scopes').insert(payload).select('*').single()
      if (e) throw e
      await history(a, 'scope_added', 'Scope register item added', data.scope_name, data.id, { item_type: data.item_type, parent_scope_id: data.parent_scope_id, quantity: data.quantity, unit: data.unit, unit_price: data.unit_price })
      setRows((x) => [...x, data]); setSelectedId(data.id)
      if (data.parent_scope_id) setCollapsed((s) => { const n = new Set(s); n.delete(data.parent_scope_id); return n })
      setAdding(null)
    } catch (e) { setDialogError(e.message) } finally { setSaving(false) }
  }

  // ---------- Edit ----------
  function openEdit(r) { setSelectedId(r.id); setDialogError(''); setTab('general'); setActivityForm({ ...ACTIVITY_BLANK, unit: r.unit || 'm²' }); setDraft({ ...r }) }
  const patch = (p) => setDraft((d) => ({ ...d, ...p }))
  async function save() {
    if (!draft || saving) return
    if (!String(draft.scope_name || '').trim()) { setDialogError(t('scope.errName')); return }
    setSaving(true); setDialogError('')
    try {
      const a = await actor()
      const isItem = draft.item_type === 'item'
      const changes = { parent_scope_id: draft.item_type === 'scope' ? null : draft.parent_scope_id, scope_name: draft.scope_name.trim(), description: draft.description, exclusions: draft.exclusions, quantity: isItem && draft.quantity !== '' && draft.quantity != null ? num(draft.quantity) : null, unit: draft.unit, unit_price: isItem ? num(draft.unit_price) : 0, quantity_source: source(draft.quantity_source), status: draft.status, notes: draft.notes }
      const { data, error: e } = await supabase.from('project_scopes').update(changes).eq('id', draft.id).select('*').single()
      if (e) throw e
      await history(a, 'scope_updated', 'Scope register item updated', data.scope_name, data.id, { parent_scope_id: data.parent_scope_id, quantity: data.quantity, unit: data.unit, unit_price: data.unit_price, quantity_source: data.quantity_source })
      setRows((x) => x.map((r) => (r.id === data.id ? data : r)))
      setDraft(null)
    } catch (e) { setDialogError(e.message) } finally { setSaving(false) }
  }
  async function addActivity() {
    if (!draft || !activityForm.activity_name.trim() || saving) return
    setSaving(true); setDialogError('')
    try {
      const a = await actor()
      const payload = { ...activityForm, activity_name: activityForm.activity_name.trim(), scope_id: draft.id, sequence: activities.length + 1, quantity: activityForm.quantity === '' ? null : num(activityForm.quantity), created_by: a.user.id }
      const { data, error: e } = await supabase.from('scope_activities').insert(payload).select('*').single()
      if (e) throw e
      await history(a, 'scope_activity_added', 'Scope activity added', data.activity_name, data.id, { scope_id: draft.id })
      setActivities((x) => [...x, data]); setActivityForm({ ...ACTIVITY_BLANK, unit: draft.unit || 'm²' })
    } catch (e) { setDialogError(e.message) } finally { setSaving(false) }
  }

  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const typeLabel = (type) => t(`scope.type.${type}`)
  const draftTotal = draft ? (draft.item_type === 'item' ? num(draft.quantity) * num(draft.unit_price) : rollup(draft.id)) : 0
  const selected = byId[selectedId]

  return <AppShell module="projects" active="scope" projectId={projectId} bare action={<Link className={ui.btnPrimary} href={`/dashboard/planning/master-plan?projectId=${projectId}`}>{t('scope.continuePrecon')}</Link>}>
    <div className={styles.page}>
      {error && <Notice>{error}</Notice>}
      <div className={styles.kpis}><Stats>
        <Stat label={t('scope.statContract')} value={cash(contract)} hint={project?.name} />
        <Stat label={t('scope.statAllocated')} value={cash(allocated)} hint={t('scope.ofContract', { pct: pct(rawProgress) })} tone={contract > 0 && rawProgress >= 99.95 && rawProgress <= 100.05 ? 'ok' : undefined} />
        <Stat label={remaining < 0 ? t('scope.statOver') : t('scope.statRemaining')} value={cash(Math.abs(remaining))} hint={remaining < 0 ? t('scope.overHint') : t('scope.ofContract', { pct: pct(Math.max(0, 100 - rawProgress)) })} tone={remaining < 0 ? 'bad' : remaining > 0 ? 'warn' : undefined} />
        <Stat label={t('scope.statItems')} value={rows.length} hint={t('scope.itemsHint', { scopes: counts.scope || 0, groups: counts.group || 0, items: counts.item || 0 })} />
      </Stats></div>
      <div className={styles.progress} title={t('scope.ofContract', { pct: pct(rawProgress) })}><span style={{ width: `${progress}%` }} className={remaining < 0 ? styles.progressOver : ''} /></div>

      <section className={`${ui.panel} ${styles.register}`}>
        <div className={styles.toolbar}>
          <button type="button" className={ui.btnPrimary} onClick={() => openAdd('scope')}><Icon name="plus" size={16} strokeWidth={2.4} />{t('scope.addScope')}</button>
          <button type="button" className={ui.btn} onClick={() => openAdd('group')} disabled={!counts.scope}><Icon name="plus" size={16} />{t('scope.addGroup')}</button>
          <button type="button" className={ui.btn} onClick={() => openAdd('item')} disabled={!counts.scope && !counts.group}><Icon name="plus" size={16} />{t('scope.addItem')}</button>
          <span className={styles.sep} />
          <button type="button" className={`${ui.btnGhost} ${ui.small}`} onClick={() => setCollapsed(new Set())}>{t('scope.expandAll')}</button>
          <button type="button" className={`${ui.btnGhost} ${ui.small}`} onClick={() => setCollapsed(new Set(rows.filter((r) => children[r.id]).map((r) => r.id)))}>{t('scope.collapseAll')}</button>
          <label className={styles.search}><Icon name="search" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('scope.search')} aria-label={t('scope.search')} /></label>
        </div>
        {selected && <div className={styles.context}>{t('scope.selected')}: <b>{selected.scope_code} — {selected.scope_name}</b><span>{t('scope.selectedHint')}</span></div>}

        <div className={styles.tableArea}>
          {loading ? <p className={styles.muted}>{t('scope.loading')}</p>
            : !rows.length ? <Empty title={t('scope.emptyTitle')} text={t('scope.emptyText')} action={<button type="button" className={ui.btnPrimary} onClick={() => openAdd('scope')}>{t('scope.addScope')}</button>} />
            : !visible.length ? <p className={styles.muted}>{t('scope.noMatch')}</p>
            : <table className={`${ui.table} ${ui.phoneCards} ${styles.table}`}>
              <thead><tr><th>{t('scope.colId')}</th><th>{t('scope.colDescription')}</th><th>{t('scope.colType')}</th><th>{t('scope.colUnit')}</th><th className={styles.num}>{t('scope.colQuantity')}</th><th className={styles.num}>{t('scope.colUnitPrice')}</th><th className={styles.num}>{t('scope.colTotal')}</th><th>{t('scope.colStatus')}</th><th /></tr></thead>
              <tbody>{visible.map((r) => {
                const hasKids = !!children[r.id], d = query ? 0 : depthOf(r), isItem = r.item_type === 'item'
                return <tr key={r.id} className={`${styles[r.item_type] || ''} ${r.id === selectedId ? styles.on : ''}`} onClick={() => setSelectedId(r.id)}>
                  <td data-label={t('scope.colId')} className={styles.code}>{r.scope_code || '—'}</td>
                  <td data-label=""><div className={styles.desc} style={{ paddingLeft: d * 20 }}>
                    {hasKids && !query ? <button type="button" className={styles.toggle} onClick={(e) => { e.stopPropagation(); toggle(r.id) }} aria-label={collapsed.has(r.id) ? t('scope.expand') : t('scope.collapse')}><Icon name={collapsed.has(r.id) ? 'right' : 'down'} size={16} strokeWidth={2.2} /></button> : <span className={styles.toggleSpace} />}
                    <span>{r.scope_name}</span></div></td>
                  <td data-label={t('scope.colType')}><span className={`${styles.type} ${styles[`type_${r.item_type}`] || ''}`}>{typeLabel(r.item_type)}</span></td>
                  <td data-label={t('scope.colUnit')} className={isItem ? '' : styles.dash}>{isItem ? r.unit : '—'}</td>
                  <td data-label={t('scope.colQuantity')} className={`${styles.num} ${isItem ? '' : styles.dash}`}>{isItem ? qty(r.quantity) : '—'}</td>
                  <td data-label={t('scope.colUnitPrice')} className={`${styles.num} ${isItem ? '' : styles.dash}`}>{isItem ? cash(r.unit_price) : '—'}</td>
                  <td data-label={t('scope.colTotal')} className={`${styles.num} ${styles.total}`}>{cash(rollup(r.id))}</td>
                  <td data-label={t('scope.colStatus')}><Badge tone={STATUS_TONE[r.status]}>{t(`scope.status.${STATUSES.includes(r.status) ? r.status : 'defined'}`)}</Badge></td>
                  <td data-label=""><button type="button" className={`${ui.btn} ${ui.small}`} onClick={(e) => { e.stopPropagation(); openEdit(r) }}>{t('scope.edit')}</button></td>
                </tr>
              })}</tbody>
            </table>}
        </div>
        <footer className={styles.footer}><span>{t('scope.showing', { shown: visible.length, total: rows.length })}</span><span>{t('scope.footerAllocated', { value: cash(allocated), contract: cash(contract) })}</span></footer>
      </section>
    </div>

    {adding && <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setAdding(null) }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="scope-add-title">
        <header className={styles.dialogHead}><h2 id="scope-add-title">{t(`scope.addTitle.${adding.item_type}`)}</h2><button type="button" className={styles.close} onClick={() => setAdding(null)} aria-label={t('scope.close')}><Icon name="close" /></button></header>
        <div className={styles.dialogBody}>
          <p className={styles.help}>{t(`scope.addHelp.${adding.item_type}`)}</p>
          <div className={styles.grid}>
            {adding.item_type !== 'scope' && <Field wide label={t(`scope.parent.${adding.item_type}`)}><select value={adding.parent_scope_id || ''} onChange={(e) => changeParent(e.target.value)}><option value="">{t('scope.chooseParent')}</option>{parentOptions(adding.item_type).map((p) => <option key={p.id} value={p.id}>{p.scope_code} — {p.scope_name}</option>)}</select></Field>}
            <Field label={t('scope.colId')}><input value={adding.scope_code} readOnly disabled /></Field>
            <Field label={t('scope.colDescription')}><input value={adding.scope_name} onChange={(e) => setAdding({ ...adding, scope_name: e.target.value })} autoFocus /></Field>
            {adding.item_type === 'item' && <>
              <Field label={t('scope.colUnit')}><select value={adding.unit} onChange={(e) => setAdding({ ...adding, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
              <Field label={t('scope.contractQuantity')}><input type="number" min="0" step="any" value={adding.quantity} onChange={(e) => setAdding({ ...adding, quantity: e.target.value })} /></Field>
              <Field label={t('scope.unitPriceIn', { currency })}><input type="number" min="0" step="any" value={adding.unit_price} onChange={(e) => setAdding({ ...adding, unit_price: e.target.value })} /></Field>
              <Field label={t('scope.quantitySource')}><select value={source(adding.quantity_source)} onChange={(e) => setAdding({ ...adding, quantity_source: e.target.value })}>{SOURCES.map((s) => <option key={s} value={s}>{t(`scope.source.${s}`)}</option>)}</select></Field>
              <div className={`${styles.totalBox} ${styles.wide}`}><span>{t('scope.colTotal')}</span><b>{cash(num(adding.quantity) * num(adding.unit_price))}</b></div>
            </>}
            <Field wide label={t('scope.notes')}><textarea value={adding.notes} onChange={(e) => setAdding({ ...adding, notes: e.target.value })} /></Field>
          </div>
          {dialogError && <Notice>{dialogError}</Notice>}
        </div>
        <footer className={styles.dialogFoot}>
          <button type="button" className={ui.btn} onClick={() => setAdding(null)} disabled={saving}>{t('scope.cancel')}</button>
          <button type="button" className={ui.btnPrimary} onClick={create} disabled={saving || !adding.scope_name.trim() || (adding.item_type !== 'scope' && !adding.parent_scope_id)}>{saving ? t('scope.creating') : t('scope.create')}</button>
        </footer>
      </section>
    </div>}

    {draft && <div className={`${styles.overlay} ${styles.overlayRight}`} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setDraft(null) }}>
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="scope-edit-title">
        <header className={styles.drawerHead}>
          <div><span className={`${styles.type} ${styles[`type_${draft.item_type}`] || ''}`}>{typeLabel(draft.item_type)}</span><small>{draft.scope_code}</small></div>
          <h2 id="scope-edit-title">{draft.scope_name || '—'}</h2>
          <button type="button" className={styles.close} onClick={() => setDraft(null)} aria-label={t('scope.close')}><Icon name="close" /></button>
        </header>
        <div className={styles.drawerTabs}><Segments value={tab} onChange={setTab} items={[{ value: 'general', label: t('scope.tabGeneral') }, { value: 'spec', label: t('scope.tabSpec') }, { value: 'activities', label: `${t('scope.tabActivities')} · ${activities.length}` }]} /></div>
        <div className={styles.drawerBody}>
          {tab === 'general' && <div className={styles.grid}>
            {draft.item_type !== 'scope' && <Field wide label={t(`scope.parent.${draft.item_type}`)}><select value={draft.parent_scope_id || ''} onChange={(e) => patch({ parent_scope_id: e.target.value || null })}>{parentOptions(draft.item_type, draft.id).map((p) => <option key={p.id} value={p.id}>{p.scope_code} — {p.scope_name}</option>)}</select></Field>}
            <Field wide label={t('scope.colDescription')}><input value={draft.scope_name || ''} onChange={(e) => patch({ scope_name: e.target.value })} /></Field>
            {draft.item_type === 'item' && <>
              <Field label={t('scope.colUnit')}><select value={draft.unit || 'm²'} onChange={(e) => patch({ unit: e.target.value })}>{[...new Set([...UNITS, draft.unit || 'm²'])].map((u) => <option key={u}>{u}</option>)}</select></Field>
              <Field label={t('scope.quantitySource')}><select value={source(draft.quantity_source)} onChange={(e) => patch({ quantity_source: e.target.value })}>{SOURCES.map((s) => <option key={s} value={s}>{t(`scope.source.${s}`)}</option>)}</select></Field>
              <Field label={t('scope.contractQuantity')}><input type="number" min="0" step="any" value={draft.quantity ?? ''} onChange={(e) => patch({ quantity: e.target.value })} /></Field>
              <Field label={t('scope.unitPriceIn', { currency })}><input type="number" min="0" step="any" value={draft.unit_price ?? ''} onChange={(e) => patch({ unit_price: e.target.value })} /></Field>
            </>}
            <div className={`${styles.totalBox} ${styles.wide}`}><span>{t('scope.colTotal')}{draft.item_type !== 'item' && <small>{t('scope.rollupHint')}</small>}</span><b>{cash(draftTotal)}</b></div>
            <Field label={t('scope.colStatus')}><select value={STATUSES.includes(draft.status) ? draft.status : 'defined'} onChange={(e) => patch({ status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{t(`scope.status.${s}`)}</option>)}</select></Field>
            <Field wide label={t('scope.notes')}><textarea value={draft.notes || ''} onChange={(e) => patch({ notes: e.target.value })} /></Field>
          </div>}
          {tab === 'spec' && <div className={styles.grid}>
            <Field wide label={t('scope.definition')}><textarea rows={7} value={draft.description || ''} onChange={(e) => patch({ description: e.target.value })} placeholder={t('scope.definitionHint')} /></Field>
            <Field wide label={t('scope.exclusions')}><textarea rows={5} value={draft.exclusions || ''} onChange={(e) => patch({ exclusions: e.target.value })} placeholder={t('scope.exclusionsHint')} /></Field>
          </div>}
          {tab === 'activities' && <>
            <p className={styles.help}>{t('scope.activitiesHelp')}</p>
            {activities.length ? <ol className={styles.activities}>{activities.map((a) => <li key={a.id}><b>{a.activity_name}</b><span>{a.wall_side && a.wall_side !== 'N/A' ? `${t('scope.side', { side: a.wall_side })} · ` : ''}{qty(a.quantity)} {a.unit}</span></li>)}</ol> : <p className={styles.muted}>{t('scope.noActivities')}</p>}
            <div className={styles.activityForm}>
              <Field wide label={t('scope.activityName')}><input value={activityForm.activity_name} onChange={(e) => setActivityForm({ ...activityForm, activity_name: e.target.value })} /></Field>
              <Field label={t('scope.wallSide')}><select value={activityForm.wall_side} onChange={(e) => setActivityForm({ ...activityForm, wall_side: e.target.value })}>{SIDES.map((s) => <option key={s} value={s}>{s === 'N/A' ? t('scope.sideNone') : s}</option>)}</select></Field>
              <Field label={t('scope.colQuantity')}><input type="number" min="0" step="any" value={activityForm.quantity} onChange={(e) => setActivityForm({ ...activityForm, quantity: e.target.value })} /></Field>
              <Field label={t('scope.colUnit')}><select value={activityForm.unit} onChange={(e) => setActivityForm({ ...activityForm, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
              <button type="button" className={ui.btn} onClick={addActivity} disabled={saving || !activityForm.activity_name.trim()}><Icon name="plus" size={16} />{t('scope.addActivity')}</button>
            </div>
          </>}
          {dialogError && <Notice>{dialogError}</Notice>}
        </div>
        {tab !== 'activities' && <footer className={styles.dialogFoot}>
          <button type="button" className={ui.btn} onClick={() => setDraft(null)} disabled={saving}>{t('scope.cancel')}</button>
          <button type="button" className={ui.btnPrimary} onClick={save} disabled={saving}>{saving ? t('scope.saving') : t('scope.save')}</button>
        </footer>}
      </section>
    </div>}
  </AppShell>
}
