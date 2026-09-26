'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import FieldOpLocationsSetup from './FieldOpLocationsSetup'
import FieldOpWorkforceSetup from './FieldOpWorkforceSetup'
import FieldOpDailyReportSettings from './FieldOpDailyReportSettings'
import styles from './setup.module.css'

const tabs = ['Overview', 'Activities', 'Locations', 'Workforce', 'Daily Report Settings']
const standardUnits = ['ea', 'm', 'm²', 'm³', 'kg', 't', 'L', 'hr', 'day', 'LS', '%']

export default function FieldOpProjectSetupPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [activities, setActivities] = useState([])
  const [scopeItems, setScopeItems] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [selectedScopeIds, setSelectedScopeIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState({ activity_name: '', unit: '', customUnit: '', quantity: '', notes: '' })
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
      const { data, error } = await supabase.from('fieldop_project_activities').select('id,project_id,source,scope_item_id,activity_name,unit,quantity,notes,is_active,created_at,scope_item:project_scopes(id,scope_code,scope_name,item_type,unit,quantity,notes)').eq('project_id', projectId).eq('is_active', true).order('created_at', { ascending: true })
      if (error) throw error
      setActivities(data || [])
    } catch (error) { setActivityError(error?.message || String(error)); setActivities([]) }
    finally { setActivitiesLoading(false) }
  }

  useEffect(() => { if (projectId) loadActivities() }, [projectId])

  useEffect(() => {
    let alive = true
    async function loadLocationCount() {
      if (!projectId) return
      const { count, error } = await supabase.from('fieldop_project_locations').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('is_active', true)
      if (alive && !error) setLocationCount(count || 0)
    }
    loadLocationCount()
    return () => { alive = false }
  }, [projectId])

  useEffect(() => {
    let alive = true
    async function loadWorkforceCount() {
      if (!projectId) return
      const { count, error } = await supabase.from('field_project_assignments').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'active')
      if (alive && !error) setWorkforceCount(count || 0)
    }
    loadWorkforceCount()
    return () => { alive = false }
  }, [projectId])

  async function openScopeImporter() {
    setActivityError('')
    try {
      const { data, error } = await supabase.from('project_scopes').select('id,scope_code,scope_name,item_type,quantity,unit,notes').eq('project_id', projectId).eq('item_type', 'item').order('scope_code', { ascending: true })
      if (error) throw error
      const imported = new Set(activities.filter((a) => a.source === 'scope').map((a) => a.scope_item_id))
      setScopeItems(data || []); setSelectedScopeIds((data || []).filter((item) => imported.has(item.id)).map((item) => item.id)); setScopeOpen(true)
    } catch (error) { setActivityError(error?.message || String(error)) }
  }

  function toggleScope(id) { setSelectedScopeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }

  async function saveScopeSelection() {
    if (saving) return
    setSaving(true); setActivityError('')
    try {
      const { data: currentRows, error: currentError } = await supabase.from('fieldop_project_activities').select('id,scope_item_id').eq('project_id', projectId).eq('source', 'scope')
      if (currentError) throw currentError
      const currentIds = new Set((currentRows || []).map((row) => row.scope_item_id)); const selected = new Set(selectedScopeIds)
      const toAdd = selectedScopeIds.filter((id) => !currentIds.has(id)); const toRemove = (currentRows || []).filter((row) => !selected.has(row.scope_item_id)).map((row) => row.id)
      for (const scope_item_id of toAdd) { const { error } = await supabase.from('fieldop_project_activities').insert({ project_id: projectId, source: 'scope', scope_item_id }); if (error) throw error }
      if (toRemove.length) { const { error } = await supabase.from('fieldop_project_activities').delete().in('id', toRemove); if (error) throw error }
      setScopeOpen(false); await loadActivities()
    } catch (error) { setActivityError(error?.message || String(error)) }
    finally { setSaving(false) }
  }

  async function addManualActivity(e) {
    e.preventDefault()
    if (!manual.activity_name.trim() || saving) return
    const resolvedUnit = manual.unit === '__custom__' ? manual.customUnit.trim() : manual.unit
    setSaving(true); setActivityError('')
    try {
      const payload = { project_id: projectId, source: 'manual', activity_name: manual.activity_name.trim(), unit: resolvedUnit || null, quantity: manual.quantity === '' ? null : Number(manual.quantity), notes: manual.notes.trim() || null }
      const { error } = await supabase.from('fieldop_project_activities').insert(payload)
      if (error) throw error
      setManual({ activity_name: '', unit: '', customUnit: '', quantity: '', notes: '' }); setManualOpen(false); await loadActivities()
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

  async function removeActivity(id) {
    if (!window.confirm('Remove this item from FieldOp? The canonical Project Scope item will not be deleted.')) return
    setActivityError('')
    try { const { error } = await supabase.from('fieldop_project_activities').delete().eq('id', id); if (error) throw error; await loadActivities() }
    catch (error) { setActivityError(error?.message || String(error)) }
  }

  const activityRows = useMemo(() => activities.map((item) => ({ ...item, displayCode: item.source === 'scope' ? item.scope_item?.scope_code : null, displayName: item.source === 'scope' ? item.scope_item?.scope_name : item.activity_name, displayUnit: item.source === 'scope' ? item.scope_item?.unit : item.unit, displayQuantity: item.source === 'scope' ? item.scope_item?.quantity : item.quantity, displayNotes: item.notes || '' })), [activities])
  const location = project ? [project.city, project.state_region].filter(Boolean).join(', ') || project.location || '—' : '—'
  const projectName = project?.name || project?.project_name || 'Project'

  return <main className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/fieldop" className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={150} height={55} priority /></Link><div className={styles.navTitle}>FIELD OPERATIONS</div><nav><Link href="/fieldop"><i>⌂</i>Portfolio Overview</Link><Link href="/fieldop/projects" className={styles.active}><i>▣</i>Projects</Link><Link href="/dashboard/field-management/workforce"><i>♙</i>Workforce</Link><Link href="/dashboard/projects/operations"><i>⌖</i>Operations</Link><Link href="/dashboard/projects/constraints"><i>△</i>Occurrences</Link><Link href="/fieldop/reports/daily"><i>▤</i>Reports</Link><Link href="/settings"><i>⚙</i>Settings</Link></nav><Link href="/workspaces" className={styles.workspaceReturn}>← <span>Workspaces</span></Link></aside>
    <section className={styles.main}><header className={styles.topbar}><div><div className={styles.crumb}><Link href="/fieldop/projects">Projects</Link><span>/</span>{loading ? 'Loading...' : projectName}</div><strong>Daily Report Setup</strong></div><div className={styles.search}>⌕ <span>Search project setup...</span><kbd>Ctrl K</kbd></div><div className={styles.user}><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div></div></header>
      <div className={styles.content}><section className={styles.projectHeader}><div className={styles.projectIcon}>{projectName.charAt(0).toUpperCase()}</div><div><h1>{projectName}</h1><p>{project?.project_id || '—'} · {project?.client || project?.client_name || '—'} · {location}</p></div><span className={styles.status}>○ FieldOp setup in progress</span></section><div className={styles.tabs}>{tabs.map(tab => <button key={tab} className={activeTab === tab ? styles.tabActive : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
        {activeTab === 'Overview' && <section className={styles.grid}><article className={styles.card}><div className={styles.cardHead}><div><h2>Project Information</h2><p>Read-only information from the canonical RitsuFlow project.</p></div><span>RITSUFLOW</span></div><dl><div><dt>Project ID</dt><dd>{project?.project_id || '—'}</dd></div><div><dt>Client</dt><dd>{project?.client || project?.client_name || '—'}</dd></div><div><dt>Location</dt><dd>{location}</dd></div><div><dt>Phase</dt><dd>{project?.phase || project?.status || '—'}</dd></div></dl></article><article className={styles.card}><div className={styles.cardHead}><div><h2>Daily Report Readiness</h2><p>Configure the information FieldOp will use to structure daily reporting.</p></div></div><div className={styles.steps}><button onClick={() => setActiveTab('Activities')}><b>1</b><span><strong>Activities</strong><small>Bring contracted Scope Items into FieldOp or add field-specific activities manually.</small></span><em>{activities.length ? `${activities.length} configured →` : 'Configure →'}</em></button><button onClick={() => setActiveTab('Locations')}><b>2</b><span><strong>Locations</strong><small>Use the project Location Structure for field reporting.</small></span><em>{locationCount ? `${locationCount} configured →` : 'Configure →'}</em></button><button onClick={() => setActiveTab('Workforce')}><b>3</b><span><strong>Workforce</strong><small>Define the people and crews available to the project.</small></span><em>{workforceCount ? `${workforceCount} active →` : 'Configure →'}</em></button><button onClick={() => setActiveTab('Daily Report Settings')}><b>4</b><span><strong>Daily Report Settings</strong><small>Define report behavior and project-specific requirements.</small></span><em>{dailyReportConfigured ? 'Configured →' : 'Configure →'}</em></button></div></article></section>}
        {activeTab === 'Activities' && <section className={styles.workspace}><div><h2>Activities</h2><p>Choose which contracted Scope Items are available for field execution and Daily Reports.</p></div><div className={styles.actions}><Link href={`/projects/${projectId}/scope`}>View Project Scope</Link><button onClick={() => setManualOpen(true)}>+ Add Manual Activity</button><button className={styles.primary} onClick={openScopeImporter}>Import from Project Scope</button></div>{activityError && <div className={styles.error}>{activityError}</div>}{activitiesLoading ? <div className={styles.empty}><b>Loading FieldOp activities...</b></div> : activityRows.length === 0 ? <div className={styles.empty}><b>No FieldOp activities configured yet.</b><span>Import contracted items from RitsuFlow Scope Management or add a field-specific activity manually.</span></div> : <div className={styles.activityTable}><table><thead><tr><th>ID</th><th>Activity</th><th>Source</th><th>Quantity</th><th>Unit</th><th>FieldOp Notes</th><th></th></tr></thead><tbody>{activityRows.map((item) => <tr key={item.id}><td>{item.displayCode || '—'}</td><td><strong>{item.displayName || '—'}</strong></td><td><span className={item.source === 'scope' ? styles.scopeBadge : styles.manualBadge}>{item.source === 'scope' ? 'Project Scope' : 'Manual'}</span></td><td>{item.displayQuantity ?? '—'}</td><td>{item.displayUnit || '—'}</td><td>{editingNoteId === item.id ? <div style={{display:'flex',gap:6,alignItems:'center'}}><input autoFocus value={noteDraft} onChange={(e)=>setNoteDraft(e.target.value)} style={{minWidth:180,padding:'6px 8px',border:'1px solid #cad7dd',borderRadius:6}}/><button onClick={()=>saveNote(item.id)} disabled={saving}>Save</button><button onClick={()=>{setEditingNoteId(null);setNoteDraft('')}}>Cancel</button></div> : <button onClick={()=>beginNoteEdit(item)} style={{border:0,background:'transparent',padding:0,color:item.displayNotes?'#17384a':'#7b8b94',cursor:'pointer',textAlign:'left'}}>{item.displayNotes || '+ Add note'}</button>}</td><td><button className={styles.removeButton} onClick={() => removeActivity(item.id)}>Remove</button></td></tr>)}</tbody></table></div>}</section>}
        {activeTab === 'Locations' && <FieldOpLocationsSetup projectId={projectId} onCountChange={setLocationCount} />}
        {activeTab === 'Workforce' && <FieldOpWorkforceSetup projectId={projectId} onCountChange={setWorkforceCount} />}
        {activeTab === 'Daily Report Settings' && <FieldOpDailyReportSettings projectId={projectId} onConfiguredChange={setDailyReportConfigured} />}
      </div>
    </section>
    {scopeOpen && <div className={styles.modalBackdrop}><section className={styles.modal}><header><div><h2>Import from Project Scope</h2><p>Select contracted Scope Items that FieldOp should use for field reporting.</p></div><button onClick={() => setScopeOpen(false)}>×</button></header><div className={styles.modalBody}>{scopeItems.length === 0 ? <div className={styles.modalEmpty}>No measurable Scope Items were found in Project Scope.</div> : scopeItems.map((item) => <label className={styles.scopeChoice} key={item.id}><input type="checkbox" checked={selectedScopeIds.includes(item.id)} onChange={() => toggleScope(item.id)} /><span><strong>{item.scope_code} · {item.scope_name}</strong><small>{[item.quantity, item.unit].filter(v => v !== null && v !== '').join(' ') || 'No quantity defined'}</small></span></label>)}</div><footer><button onClick={() => setScopeOpen(false)}>Cancel</button><button className={styles.primaryAction} disabled={saving} onClick={saveScopeSelection}>{saving ? 'Saving...' : 'Save Selection'}</button></footer></section></div>}
    {manualOpen && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={addManualActivity}><header><div><h2>Add Manual Activity</h2><p>Create a field-specific activity without changing Project Scope.</p></div><button type="button" onClick={() => setManualOpen(false)}>×</button></header><div className={styles.formGrid}><label className={styles.full}>Activity Name<input required value={manual.activity_name} onChange={(e) => setManual({ ...manual, activity_name: e.target.value })} placeholder="e.g. Site cleanup" /></label><label>Quantity<input type="number" step="any" value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })} /></label><label>Unit<select value={manual.unit} onChange={(e) => setManual({ ...manual, unit: e.target.value, customUnit: e.target.value === '__custom__' ? manual.customUnit : '' })}><option value="">Select unit...</option>{standardUnits.map(unit=><option key={unit} value={unit}>{unit}</option>)}<option value="__custom__">Other / Custom</option></select></label>{manual.unit === '__custom__' && <label className={styles.full}>Custom Unit<input required value={manual.customUnit} onChange={(e)=>setManual({...manual,customUnit:e.target.value})} placeholder="Enter custom unit" /></label>}<label className={styles.full}>Notes<textarea rows="3" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} /></label></div><footer><button type="button" onClick={() => setManualOpen(false)}>Cancel</button><button className={styles.primaryAction} disabled={saving}>{saving ? 'Saving...' : 'Add Activity'}</button></footer></form></div>}
  </main>
}