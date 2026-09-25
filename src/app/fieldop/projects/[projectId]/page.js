'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import styles from './setup.module.css'

const tabs = ['Overview', 'Activities', 'Locations', 'Workforce', 'Daily Report Settings']

export default function FieldOpProjectSetupPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [activities, setActivities] = useState([])
  const [scopeActivities, setScopeActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [selectedScopeIds, setSelectedScopeIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState({ activity_name: '', unit: '', quantity: '', notes: '' })

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
    setActivitiesLoading(true)
    setActivityError('')
    const { data, error } = await supabase
      .from('fieldop_project_activities')
      .select('id,project_id,source,scope_activity_id,activity_name,unit,quantity,notes,is_active,created_at,scope_activity:scope_activities(id,activity_name,unit,quantity,notes,sequence,scope_id)')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) { setActivityError(error.message); setActivities([]) }
    else setActivities(data || [])
    setActivitiesLoading(false)
  }

  useEffect(() => { if (projectId) loadActivities() }, [projectId])

  async function openScopeImporter() {
    setActivityError('')
    const { data: scopes, error: scopeError } = await supabase.from('project_scopes').select('id').eq('project_id', projectId)
    if (scopeError) { setActivityError(scopeError.message); return }
    const scopeIds = (scopes || []).map((s) => s.id)
    if (!scopeIds.length) { setScopeActivities([]); setSelectedScopeIds([]); setScopeOpen(true); return }
    const { data, error } = await supabase.from('scope_activities').select('id,scope_id,sequence,activity_name,unit,quantity,notes').in('scope_id', scopeIds).order('sequence', { ascending: true })
    if (error) { setActivityError(error.message); return }
    const imported = new Set(activities.filter((a) => a.source === 'scope').map((a) => a.scope_activity_id))
    setScopeActivities(data || [])
    setSelectedScopeIds((data || []).filter((a) => imported.has(a.id)).map((a) => a.id))
    setScopeOpen(true)
  }

  function toggleScope(id) {
    setSelectedScopeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function saveScopeSelection() {
    setSaving(true); setActivityError('')
    const currentScope = activities.filter((a) => a.source === 'scope')
    const currentIds = new Set(currentScope.map((a) => a.scope_activity_id))
    const selected = new Set(selectedScopeIds)
    const toAdd = selectedScopeIds.filter((id) => !currentIds.has(id))
    const toRemove = currentScope.filter((a) => !selected.has(a.scope_activity_id)).map((a) => a.id)
    let error = null
    if (toAdd.length) {
      const result = await supabase.from('fieldop_project_activities').insert(toAdd.map((scope_activity_id) => ({ project_id: projectId, source: 'scope', scope_activity_id })))
      error = result.error
    }
    if (!error && toRemove.length) {
      const result = await supabase.from('fieldop_project_activities').delete().in('id', toRemove)
      error = result.error
    }
    if (error) setActivityError(error.message)
    else { setScopeOpen(false); await loadActivities() }
    setSaving(false)
  }

  async function addManualActivity(e) {
    e.preventDefault()
    if (!manual.activity_name.trim()) return
    setSaving(true); setActivityError('')
    const payload = { project_id: projectId, source: 'manual', activity_name: manual.activity_name.trim(), unit: manual.unit.trim() || null, quantity: manual.quantity === '' ? null : Number(manual.quantity), notes: manual.notes.trim() || null }
    const { error } = await supabase.from('fieldop_project_activities').insert(payload)
    if (error) setActivityError(error.message)
    else { setManual({ activity_name: '', unit: '', quantity: '', notes: '' }); setManualOpen(false); await loadActivities() }
    setSaving(false)
  }

  async function removeActivity(id) {
    if (!window.confirm('Remove this activity from FieldOp? The canonical Project Scope activity will not be deleted.')) return
    const { error } = await supabase.from('fieldop_project_activities').delete().eq('id', id)
    if (error) setActivityError(error.message)
    else await loadActivities()
  }

  const activityRows = useMemo(() => activities.map((item) => ({
    ...item,
    displayName: item.source === 'scope' ? item.scope_activity?.activity_name : item.activity_name,
    displayUnit: item.source === 'scope' ? item.scope_activity?.unit : item.unit,
    displayQuantity: item.source === 'scope' ? item.scope_activity?.quantity : item.quantity,
    displayNotes: item.source === 'scope' ? item.scope_activity?.notes : item.notes,
  })), [activities])

  const location = project ? [project.city, project.state_region].filter(Boolean).join(', ') || project.location || '—' : '—'
  const projectName = project?.name || project?.project_name || 'Project'

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/fieldop" className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={150} height={55} priority /></Link>
      <div className={styles.navTitle}>FIELD OPERATIONS</div>
      <nav><Link href="/fieldop"><i>⌂</i>Portfolio Overview</Link><Link href="/fieldop/projects" className={styles.active}><i>▣</i>Projects</Link><Link href="/dashboard/field-management/workforce"><i>♙</i>Workforce</Link><Link href="/dashboard/projects/operations"><i>⌖</i>Operations</Link><Link href="/dashboard/projects/constraints"><i>△</i>Occurrences</Link><Link href="/fieldop/reports/daily"><i>▤</i>Reports</Link><Link href="/settings"><i>⚙</i>Settings</Link></nav>
      <Link href="/workspaces" className={styles.workspaceReturn}>← <span>Workspaces</span></Link>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><div className={styles.crumb}><Link href="/fieldop/projects">Projects</Link><span>/</span>{loading ? 'Loading...' : projectName}</div><strong>Daily Report Setup</strong></div><div className={styles.search}>⌕ <span>Search project setup...</span><kbd>Ctrl K</kbd></div><div className={styles.user}><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div></div></header>

      <div className={styles.content}>
        <section className={styles.projectHeader}><div className={styles.projectIcon}>{projectName.charAt(0).toUpperCase()}</div><div><h1>{projectName}</h1><p>{project?.project_id || '—'} · {project?.client || project?.client_name || '—'} · {location}</p></div><span className={styles.status}>○ FieldOp setup in progress</span></section>
        <div className={styles.tabs}>{tabs.map(tab => <button key={tab} className={activeTab === tab ? styles.tabActive : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>

        {activeTab === 'Overview' && <section className={styles.grid}><article className={styles.card}><div className={styles.cardHead}><div><h2>Project Information</h2><p>Read-only information from the canonical RitsuFlow project.</p></div><span>RITSUFLOW</span></div><dl><div><dt>Project ID</dt><dd>{project?.project_id || '—'}</dd></div><div><dt>Client</dt><dd>{project?.client || project?.client_name || '—'}</dd></div><div><dt>Location</dt><dd>{location}</dd></div><div><dt>Phase</dt><dd>{project?.phase || project?.status || '—'}</dd></div></dl></article><article className={styles.card}><div className={styles.cardHead}><div><h2>Daily Report Readiness</h2><p>Configure the information FieldOp will use to structure daily reporting.</p></div></div><div className={styles.steps}><button onClick={() => setActiveTab('Activities')}><b>1</b><span><strong>Activities</strong><small>Bring activities from Project Scope or add field-specific activities manually.</small></span><em>{activities.length ? `${activities.length} configured →` : 'Configure →'}</em></button><button onClick={() => setActiveTab('Locations')}><b>2</b><span><strong>Locations</strong><small>Use the project Location Structure for field reporting.</small></span><em>Configure →</em></button><button onClick={() => setActiveTab('Workforce')}><b>3</b><span><strong>Workforce</strong><small>Define the people and crews available to the project.</small></span><em>Configure →</em></button><button onClick={() => setActiveTab('Daily Report Settings')}><b>4</b><span><strong>Daily Report Settings</strong><small>Define report behavior and project-specific requirements.</small></span><em>Configure →</em></button></div></article></section>}

        {activeTab === 'Activities' && <section className={styles.workspace}>
          <div><h2>Activities</h2><p>Choose which activities are available for field execution and Daily Reports.</p></div>
          <div className={styles.actions}><Link href={`/projects/${projectId}/scope`}>View Project Scope</Link><button onClick={() => setManualOpen(true)}>+ Add Manual Activity</button><button className={styles.primary} onClick={openScopeImporter}>Import from Project Scope</button></div>
          {activityError && <div className={styles.error}>{activityError}</div>}
          {activitiesLoading ? <div className={styles.empty}><b>Loading FieldOp activities...</b></div> : activityRows.length === 0 ? <div className={styles.empty}><b>No FieldOp activities configured yet.</b><span>Import existing activities from RitsuFlow Scope Management or add a field-specific activity manually.</span></div> : <div className={styles.activityTable}><table><thead><tr><th>Activity</th><th>Source</th><th>Quantity</th><th>Unit</th><th>Notes</th><th></th></tr></thead><tbody>{activityRows.map((item) => <tr key={item.id}><td><strong>{item.displayName || '—'}</strong></td><td><span className={item.source === 'scope' ? styles.scopeBadge : styles.manualBadge}>{item.source === 'scope' ? 'Project Scope' : 'Manual'}</span></td><td>{item.displayQuantity ?? '—'}</td><td>{item.displayUnit || '—'}</td><td>{item.displayNotes || '—'}</td><td><button className={styles.removeButton} onClick={() => removeActivity(item.id)}>Remove</button></td></tr>)}</tbody></table></div>}
        </section>}
        {activeTab === 'Locations' && <section className={styles.workspace}><div><h2>Locations</h2><p>FieldOp will use the canonical project Location Structure. Location selection will be configured here.</p></div><div className={styles.empty}><b>Location setup is next.</b><span>No duplicate location hierarchy will be created in FieldOp.</span></div></section>}
        {activeTab === 'Workforce' && <section className={styles.workspace}><div><h2>Workforce</h2><p>Configure project crews and workers available for Daily Reports and Operations.</p></div><div className={styles.empty}><b>Workforce setup is not configured yet.</b></div></section>}
        {activeTab === 'Daily Report Settings' && <section className={styles.workspace}><div><h2>Daily Report Settings</h2><p>Configure project-specific Daily Report behavior without changing the canonical project record.</p></div><div className={styles.empty}><b>Daily Report settings are not configured yet.</b></div></section>}
      </div>
    </section>

    {scopeOpen && <div className={styles.modalBackdrop}><section className={styles.modal}><header><div><h2>Import from Project Scope</h2><p>Select the canonical Scope activities that FieldOp should use.</p></div><button onClick={() => setScopeOpen(false)}>×</button></header><div className={styles.modalBody}>{scopeActivities.length === 0 ? <div className={styles.modalEmpty}>No activities were found in Project Scope.</div> : scopeActivities.map((item) => <label className={styles.scopeChoice} key={item.id}><input type="checkbox" checked={selectedScopeIds.includes(item.id)} onChange={() => toggleScope(item.id)} /><span><strong>{item.activity_name}</strong><small>{[item.quantity, item.unit].filter(v => v !== null && v !== '').join(' ') || 'No quantity defined'}</small></span></label>)}</div><footer><button onClick={() => setScopeOpen(false)}>Cancel</button><button className={styles.primaryAction} disabled={saving} onClick={saveScopeSelection}>{saving ? 'Saving...' : 'Save Selection'}</button></footer></section></div>}

    {manualOpen && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={addManualActivity}><header><div><h2>Add Manual Activity</h2><p>Create a field-specific activity without changing Project Scope.</p></div><button type="button" onClick={() => setManualOpen(false)}>×</button></header><div className={styles.formGrid}><label className={styles.full}>Activity Name<input required value={manual.activity_name} onChange={(e) => setManual({ ...manual, activity_name: e.target.value })} placeholder="e.g. Site cleanup" /></label><label>Quantity<input type="number" step="any" value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })} /></label><label>Unit<input value={manual.unit} onChange={(e) => setManual({ ...manual, unit: e.target.value })} placeholder="ea, m², hr..." /></label><label className={styles.full}>Notes<textarea rows="3" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} /></label></div><footer><button type="button" onClick={() => setManualOpen(false)}>Cancel</button><button className={styles.primaryAction} disabled={saving}>{saving ? 'Saving...' : 'Add Activity'}</button></footer></form></div>}
  </main>
}
