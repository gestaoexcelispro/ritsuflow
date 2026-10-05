'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/i18n/useT'
import { FieldOpSidebar, FieldOpUser } from '../../FieldOpChrome'
import FieldOpLocationsSetup from './FieldOpLocationsSetup'
import FieldOpWorkforceSetup from './FieldOpWorkforceSetup'
import FieldOpDailyReportSettings from './FieldOpDailyReportSettings'
import styles from './setup.module.css'

const TABS = ['overview', 'activities', 'locations', 'workforce', 'settings']
const STANDARD_UNITS = ['ea', 'm', 'm²', 'm³', 'kg', 't', 'L', 'hr', 'day', 'LS', '%']
const ACTIVITY_COLUMNS = 'id,project_id,source,scope_item_id,activity_name,unit,quantity,notes,is_active,created_at,scope_item:project_scopes(id,scope_code,scope_name,item_type,unit,quantity,notes)'
const BLANK_MANUAL = { activity_name: '', unit: '', customUnit: '', quantity: '', notes: '' }

function displayRow(item) {
  const fromScope = item.source === 'scope'
  return {
    ...item,
    displayCode: fromScope ? item.scope_item?.scope_code : null,
    displayName: fromScope ? item.scope_item?.scope_name : item.activity_name,
    displayUnit: fromScope ? item.scope_item?.unit : item.unit,
    displayQuantity: fromScope ? item.scope_item?.quantity : item.quantity,
    displayNotes: item.notes || '',
  }
}

/**
 * How much each activity is used. Deleting a used activity would also delete its location
 * allocations (cascade) and unlink its production, so used activities are deactivated instead.
 */
async function loadUsage(ids) {
  const usage = new Map(ids.map((id) => [id, { allocations: 0, production: 0, executions: 0 }]))
  if (!ids.length) return usage
  const [allocations, production, executions] = await Promise.all([
    supabase.from('location_service_quantities').select('service_id').in('service_id', ids),
    supabase.from('daily_report_production').select('fieldop_activity_id').in('fieldop_activity_id', ids),
    supabase.from('field_execution_events').select('fieldop_activity_id').in('fieldop_activity_id', ids),
  ])
  const firstError = [allocations, production, executions].find((result) => result.error)
  if (firstError) throw firstError.error
  for (const row of allocations.data || []) usage.get(row.service_id).allocations += 1
  for (const row of production.data || []) usage.get(row.fieldop_activity_id).production += 1
  for (const row of executions.data || []) usage.get(row.fieldop_activity_id).executions += 1
  return usage
}

const isUsed = (use) => use.allocations + use.production + use.executions > 0

export default function FieldOpProjectSetupPage() {
  const { projectId } = useParams()
  const t = useT('fieldopSetup')
  const tf = useT('fieldop')
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [activities, setActivities] = useState([])
  const [scopeItems, setScopeItems] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [selectedScopeIds, setSelectedScopeIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState(BLANK_MANUAL)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [locationCount, setLocationCount] = useState(0)
  const [workforceCount, setWorkforceCount] = useState(0)
  const [dailyReportConfigured, setDailyReportConfigured] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
      if (alive) { setProject(data || null); setLoading(false) }
    }
    if (projectId) load()
    return () => { alive = false }
  }, [projectId])

  async function loadActivities() {
    if (!projectId) return
    setActivitiesLoading(true); setActivityError('')
    try {
      const { data, error } = await supabase.from('fieldop_project_activities').select(ACTIVITY_COLUMNS).eq('project_id', projectId).order('created_at', { ascending: true })
      if (error) throw error
      setActivities(data || [])
    } catch (error) { setActivityError(error?.message || String(error)); setActivities([]) }
    finally { setActivitiesLoading(false) }
  }

  useEffect(() => { if (projectId) loadActivities() }, [projectId])

  useEffect(() => {
    let alive = true
    async function loadReadiness() {
      if (!projectId) return
      const [locationsResult, assignmentsResult, manualWorkersResult, settingsResult] = await Promise.all([
        supabase.from('fieldop_project_locations').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('is_active', true),
        supabase.from('field_project_assignments').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'active'),
        supabase.from('fieldop_manual_workers').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'active'),
        supabase.from('fieldop_daily_report_settings').select('id').eq('project_id', projectId).maybeSingle(),
      ])
      if (!alive) return
      if (!locationsResult.error) setLocationCount(locationsResult.count || 0)
      const registeredCount = assignmentsResult.error ? 0 : assignmentsResult.count || 0
      const manualCount = manualWorkersResult.error ? 0 : manualWorkersResult.count || 0
      setWorkforceCount(registeredCount + manualCount)
      setDailyReportConfigured(!settingsResult.error && Boolean(settingsResult.data))
    }
    loadReadiness()
    return () => { alive = false }
  }, [projectId])

  const activeRows = useMemo(() => activities.filter((item) => item.is_active).map(displayRow), [activities])
  const inactiveRows = useMemo(() => activities.filter((item) => !item.is_active).map(displayRow), [activities])

  function describeUses(use) {
    const parts = []
    if (use.allocations) parts.push(t('activities.usesAllocations', { count: use.allocations }))
    if (use.production) parts.push(t('activities.usesProduction', { count: use.production }))
    if (use.executions) parts.push(t('activities.usesExecutions', { count: use.executions }))
    return parts.join(', ')
  }

  async function openScopeImporter() {
    setActivityError('')
    try {
      const { data, error } = await supabase.from('project_scopes').select('id,scope_code,scope_name,item_type,quantity,unit,notes').eq('project_id', projectId).eq('item_type', 'item').order('scope_code', { ascending: true })
      if (error) throw error
      const imported = new Set(activities.filter((a) => a.source === 'scope' && a.is_active).map((a) => a.scope_item_id))
      setScopeItems(data || [])
      setSelectedScopeIds((data || []).filter((item) => imported.has(item.id)).map((item) => item.id))
      setScopeOpen(true)
    } catch (error) { setActivityError(error?.message || String(error)) }
  }

  function toggleScope(id) { setSelectedScopeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }

  async function saveScopeSelection() {
    if (saving) return
    setSaving(true); setActivityError('')
    try {
      const { data: currentRows, error: currentError } = await supabase.from('fieldop_project_activities').select('id,scope_item_id,is_active').eq('project_id', projectId).eq('source', 'scope')
      if (currentError) throw currentError
      const rows = currentRows || []
      const existing = new Map(rows.map((row) => [row.scope_item_id, row]))
      const selected = new Set(selectedScopeIds)

      const toAdd = selectedScopeIds.filter((id) => !existing.has(id))
      const toReactivate = rows.filter((row) => selected.has(row.scope_item_id) && !row.is_active).map((row) => row.id)
      const unticked = rows.filter((row) => !selected.has(row.scope_item_id) && row.is_active)

      const usage = await loadUsage(unticked.map((row) => row.id))
      const toDeactivate = unticked.filter((row) => isUsed(usage.get(row.id))).map((row) => row.id)
      const toDelete = unticked.filter((row) => !isUsed(usage.get(row.id))).map((row) => row.id)

      if (toDeactivate.length) {
        const names = activities.filter((a) => toDeactivate.includes(a.id)).map((a) => displayRow(a).displayName).join(', ')
        if (!window.confirm(t('import.confirmDeactivate', { count: toDeactivate.length, names }))) { setSaving(false); return }
      }

      // One request per kind of change, so a failure never leaves half an import behind.
      if (toAdd.length) {
        const { error } = await supabase.from('fieldop_project_activities').insert(toAdd.map((scope_item_id) => ({ project_id: projectId, source: 'scope', scope_item_id })))
        if (error) throw error
      }
      if (toReactivate.length) {
        const { error } = await supabase.from('fieldop_project_activities').update({ is_active: true, updated_at: new Date().toISOString() }).in('id', toReactivate)
        if (error) throw error
      }
      if (toDeactivate.length) {
        const { error } = await supabase.from('fieldop_project_activities').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', toDeactivate)
        if (error) throw error
      }
      if (toDelete.length) {
        const { error } = await supabase.from('fieldop_project_activities').delete().in('id', toDelete)
        if (error) throw error
      }
      setScopeOpen(false); await loadActivities()
    } catch (error) { setActivityError(error?.message || String(error)) }
    finally { setSaving(false) }
  }

  async function addManualActivity(event) {
    event.preventDefault()
    if (!manual.activity_name.trim() || saving) return
    const resolvedUnit = manual.unit === '__custom__' ? manual.customUnit.trim() : manual.unit
    setSaving(true); setActivityError('')
    try {
      const payload = { project_id: projectId, source: 'manual', activity_name: manual.activity_name.trim(), unit: resolvedUnit || null, quantity: manual.quantity === '' ? null : Number(manual.quantity), notes: manual.notes.trim() || null }
      const { error } = await supabase.from('fieldop_project_activities').insert(payload)
      if (error) throw error
      setManual(BLANK_MANUAL); setManualOpen(false); await loadActivities()
    } catch (error) { setActivityError(error?.message || String(error)) }
    finally { setSaving(false) }
  }

  function beginNoteEdit(item) { setEditingNoteId(item.id); setNoteDraft(item.notes || '') }

  async function saveNote(id) {
    if (saving) return
    setSaving(true); setActivityError('')
    try {
      const { error } = await supabase.from('fieldop_project_activities').update({ notes: noteDraft.trim() || null, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      setEditingNoteId(null); setNoteDraft(''); await loadActivities()
    } catch (error) { setActivityError(error?.message || String(error)) }
    finally { setSaving(false) }
  }

  async function removeActivity(item) {
    setActivityError('')
    try {
      const usage = (await loadUsage([item.id])).get(item.id)
      if (isUsed(usage)) {
        if (!window.confirm(t('activities.confirmDeactivate', { name: item.displayName || '—', uses: describeUses(usage) }))) return
        const { error } = await supabase.from('fieldop_project_activities').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', item.id)
        if (error) throw error
      } else {
        if (!window.confirm(t('activities.confirmDelete', { name: item.displayName || '—' }))) return
        const { error } = await supabase.from('fieldop_project_activities').delete().eq('id', item.id)
        if (error) throw error
      }
      await loadActivities()
    } catch (error) { setActivityError(error?.message || String(error)) }
  }

  async function reactivateActivity(id) {
    setActivityError('')
    const { error } = await supabase.from('fieldop_project_activities').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) setActivityError(error.message)
    else await loadActivities()
  }

  const location = project ? [project.city, project.state_region].filter(Boolean).join(', ') || '—' : '—'
  const projectName = project?.name || t('setup.projectFallback')
  const fieldOpReady = activeRows.length > 0 && locationCount > 0 && workforceCount > 0 && dailyReportConfigured
  const tabLabel = (tab) => t(`tab.${tab}`)

  const steps = [
    { tab: 'activities', text: t('overview.stepActivities'), status: activeRows.length ? t('overview.countConfigured', { count: activeRows.length }) : t('overview.configure') },
    { tab: 'locations', text: t('overview.stepLocations'), status: locationCount ? t('overview.countConfigured', { count: locationCount }) : t('overview.configure') },
    { tab: 'workforce', text: t('overview.stepWorkforce'), status: workforceCount ? t('overview.countActive', { count: workforceCount }) : t('overview.configure') },
    { tab: 'settings', text: t('overview.stepSettings'), status: dailyReportConfigured ? t('overview.configured') : t('overview.configure') },
  ]

  return <main className={styles.shell}>
    <FieldOpSidebar styles={styles} active="projects" projectId={projectId} />
    <section className={styles.main}>
      <header className={styles.topbar}>
        <div><div className={styles.crumb}><Link href="/fieldop/projects">{t('list.title')}</Link><span>/</span>{loading ? t('common.loading') : projectName}</div><strong>{t('setup.title')}</strong></div>
        <div className={styles.search}>⌕ <span>{t('setup.search')}</span><kbd>Ctrl K</kbd></div>
        <FieldOpUser styles={styles} />
      </header>
      <div className={styles.content}>
        <section className={styles.projectHeader}>
          <div className={styles.projectIcon}>{projectName.charAt(0).toUpperCase()}</div>
          <div><h1>{projectName}</h1><p>{project?.project_id || '—'} · {project?.client_name || '—'} · {location}</p></div>
          <span className={styles.status}>{fieldOpReady ? t('setup.ready') : t('setup.inProgress')}</span>
        </section>
        <div className={styles.tabs}>{TABS.map((tab) => <button key={tab} className={activeTab === tab ? styles.tabActive : ''} onClick={() => setActiveTab(tab)}>{tabLabel(tab)}</button>)}</div>

        {activeTab === 'overview' && <section className={styles.grid}>
          <article className={styles.card}>
            <div className={styles.cardHead}><div><h2>{t('overview.infoTitle')}</h2><p>{t('overview.infoText')}</p></div><span>RITSUFLOW</span></div>
            <dl>
              <div><dt>{t('overview.projectId')}</dt><dd>{project?.project_id || '—'}</dd></div>
              <div><dt>{t('overview.client')}</dt><dd>{project?.client_name || '—'}</dd></div>
              <div><dt>{t('overview.location')}</dt><dd>{location}</dd></div>
              <div><dt>{t('overview.status')}</dt><dd>{project?.status ? tf(`status.${project.status}`) : '—'}</dd></div>
            </dl>
          </article>
          <article className={styles.card}>
            <div className={styles.cardHead}><div><h2>{t('overview.readinessTitle')}</h2><p>{t('overview.readinessText')}</p></div></div>
            <div className={styles.steps}>{steps.map((step, index) => <button key={step.tab} onClick={() => setActiveTab(step.tab)}><b>{index + 1}</b><span><strong>{tabLabel(step.tab)}</strong><small>{step.text}</small></span><em>{step.status}</em></button>)}</div>
          </article>
        </section>}

        {activeTab === 'activities' && <section className={styles.workspace}>
          <div><h2>{tabLabel('activities')}</h2><p>{t('activities.text')}</p></div>
          <div className={styles.actions}>
            <Link href={`/projects/${projectId}/scope`}>{t('activities.viewScope')}</Link>
            <button onClick={() => setManualOpen(true)}>{t('activities.addManual')}</button>
            <button className={styles.primary} onClick={openScopeImporter}>{t('activities.import')}</button>
          </div>
          {activityError && <div className={styles.error}>{activityError}</div>}
          {activitiesLoading
            ? <div className={styles.empty}><b>{t('activities.loading')}</b></div>
            : activeRows.length === 0
              ? <div className={styles.empty}><b>{t('activities.emptyTitle')}</b><span>{t('activities.emptyText')}</span></div>
              : <ActivityTable t={t} styles={styles} rows={activeRows} editingNoteId={editingNoteId} noteDraft={noteDraft} setNoteDraft={setNoteDraft} saving={saving}
                  onEditNote={beginNoteEdit} onSaveNote={saveNote} onCancelNote={() => { setEditingNoteId(null); setNoteDraft('') }}
                  action={(item) => <button className={styles.removeButton} onClick={() => removeActivity(item)}>{t('common.remove')}</button>} />}
          {inactiveRows.length > 0 && <div style={{ marginTop: 22, opacity: 0.8 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('activities.deactivatedTitle')}</h3>
            <p style={{ margin: '0 0 10px', color: '#6b7e89' }}>{t('activities.deactivatedText')}</p>
            <ActivityTable t={t} styles={styles} rows={inactiveRows} readOnly
              action={(item) => <button className={styles.removeButton} style={{ color: '#0a8f80', borderColor: '#a8dcd4' }} onClick={() => reactivateActivity(item.id)}>{t('activities.reactivate')}</button>} />
          </div>}
        </section>}

        {activeTab === 'locations' && <FieldOpLocationsSetup projectId={projectId} onCountChange={setLocationCount} />}
        {activeTab === 'workforce' && <FieldOpWorkforceSetup projectId={projectId} onCountChange={setWorkforceCount} />}
        {activeTab === 'settings' && <FieldOpDailyReportSettings projectId={projectId} onConfiguredChange={setDailyReportConfigured} />}
      </div>
    </section>

    {scopeOpen && <div className={styles.modalBackdrop}><section className={styles.modal}>
      <header><div><h2>{t('activities.import')}</h2><p>{t('import.text')}</p></div><button onClick={() => setScopeOpen(false)}>×</button></header>
      <div className={styles.scopeList}>{scopeItems.length === 0
        ? <div className={styles.empty}>{t('import.empty')}</div>
        : scopeItems.map((item) => <label key={item.id}><input type="checkbox" checked={selectedScopeIds.includes(item.id)} onChange={() => toggleScope(item.id)} /><span><strong>{item.scope_code || '—'} · {item.scope_name}</strong><small>{item.quantity ?? '—'} {item.unit || ''}{item.notes ? ` · ${item.notes}` : ''}</small></span></label>)}
      </div>
      <footer><button onClick={() => setScopeOpen(false)}>{t('common.cancel')}</button><button className={styles.primary} onClick={saveScopeSelection} disabled={saving}>{saving ? t('common.saving') : t('import.save')}</button></footer>
    </section></div>}

    {manualOpen && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={addManualActivity}>
      <header><div><h2>{t('manual.title')}</h2><p>{t('manual.text')}</p></div><button type="button" onClick={() => setManualOpen(false)}>×</button></header>
      <div className={styles.formGrid}>
        <label className={styles.full}>{t('manual.name')}<input value={manual.activity_name} onChange={(e) => setManual({ ...manual, activity_name: e.target.value })} placeholder={t('manual.namePlaceholder')} required /></label>
        <label>{t('activities.colQuantity')}<input type="number" min="0" step="any" value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })} placeholder={t('common.optional')} /></label>
        <label>{t('manual.unit')}<select value={manual.unit} onChange={(e) => setManual({ ...manual, unit: e.target.value })}><option value="">{t('manual.selectUnit')}</option>{STANDARD_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}<option value="__custom__">{t('manual.customOption')}</option></select></label>
        {manual.unit === '__custom__' && <label className={styles.full}>{t('manual.customUnit')}<input value={manual.customUnit} onChange={(e) => setManual({ ...manual, customUnit: e.target.value })} placeholder={t('manual.customPlaceholder')} /></label>}
        <label className={styles.full}>{t('activities.colNotes')}<textarea rows="3" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} placeholder={t('manual.notesPlaceholder')} /></label>
      </div>
      <footer><button type="button" onClick={() => setManualOpen(false)}>{t('common.cancel')}</button><button className={styles.primary} type="submit" disabled={saving}>{saving ? t('manual.adding') : t('manual.submit')}</button></footer>
    </form></div>}
  </main>
}

function ActivityTable({ t, styles, rows, readOnly = false, editingNoteId, noteDraft, setNoteDraft, saving, onEditNote, onSaveNote, onCancelNote, action }) {
  return <div className={styles.activityTable}><table>
    <thead><tr><th>{t('activities.colId')}</th><th>{t('activities.colActivity')}</th><th>{t('activities.colSource')}</th><th>{t('activities.colQuantity')}</th><th>{t('activities.colUnit')}</th><th>{t('activities.colNotes')}</th><th></th></tr></thead>
    <tbody>{rows.map((item) => <tr key={item.id}>
      <td>{item.displayCode || '—'}</td>
      <td><strong>{item.displayName || '—'}</strong></td>
      <td><span className={item.source === 'scope' ? styles.scopeBadge : styles.manualBadge}>{item.source === 'scope' ? t('activities.sourceScope') : t('activities.sourceManual')}</span></td>
      <td>{item.displayQuantity ?? '—'}</td>
      <td>{item.displayUnit || '—'}</td>
      <td>{readOnly
        ? (item.displayNotes || '—')
        : editingNoteId === item.id
          ? <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input autoFocus value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} style={{ minWidth: 180, padding: '6px 8px', border: '1px solid #cad7dd', borderRadius: 6 }} /><button onClick={() => onSaveNote(item.id)} disabled={saving}>{t('common.save')}</button><button onClick={onCancelNote}>{t('common.cancel')}</button></div>
          : <button onClick={() => onEditNote(item)} style={{ border: 0, background: 'transparent', padding: 0, color: item.displayNotes ? '#17384a' : '#7b8b94', cursor: 'pointer', textAlign: 'left' }}>{item.displayNotes || t('activities.addNote')}</button>}
      </td>
      <td>{action(item)}</td>
    </tr>)}</tbody>
  </table></div>
}
