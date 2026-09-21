'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import styles from './standalone-location-workspace.module.css'

const TYPES = [
  { value: 'building', label: 'Building' },
  { value: 'floor', label: 'Division / Floor' },
  { value: 'zone', label: 'Zone / Area' },
  { value: 'area', label: 'Area' },
  { value: 'room', label: 'Room' },
  { value: 'custom', label: 'Custom' },
]

const emptyForm = { id: null, location_type: 'floor', name: '', parent_id: '', environment_type: '' }

function typeLabel(value) { return TYPES.find((item) => item.value === value)?.label || 'Location' }
function typeIcon(value) {
  if (value === 'building') return '▦'
  if (value === 'floor') return '▤'
  if (value === 'zone') return '▦'
  return '◇'
}

export default function StandaloneLocationWorkspace({ projectId, projectName, projectCode, userId, initialLocations = [], scopeItems = [], allocations = [] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [locations, setLocations] = useState(initialLocations)
  const [selectedId, setSelectedId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [collapsed, setCollapsed] = useState(new Set())
  const [form, setForm] = useState(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const locationMap = useMemo(() => new Map(locations.map((item) => [item.id, item])), [locations])
  const childrenMap = useMemo(() => {
    const map = new Map()
    locations.forEach((item) => {
      const key = item.parent_id || 'root'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })
    map.forEach((items) => items.sort((a, b) => (Number(a.sequence_number) || 0) - (Number(b.sequence_number) || 0) || String(a.name).localeCompare(String(b.name))))
    return map
  }, [locations])

  const selected = selectedId ? locationMap.get(selectedId) : null
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const divisions = locations.filter((item) => item.location_type === 'floor').length
  const zones = locations.filter((item) => item.location_type === 'zone').length
  const production = locations.filter((item) => !['building', 'floor', 'zone'].includes(item.location_type)).length

  const selectedScope = useMemo(() => {
    if (!selectedId) return []
    const byService = new Map()
    allocations.filter((item) => item.location_id === selectedId).forEach((item) => {
      byService.set(item.service_id, (byService.get(item.service_id) || 0) + Number(item.quantity || 0))
    })
    return scopeItems.filter((item) => byService.has(item.id)).map((item) => ({ ...item, allocatedQuantity: byService.get(item.id) }))
  }, [selectedId, allocations, scopeItems])

  async function history(actionType, actionLabel, description, entityId, metadata = {}) {
    const { data: { user } } = await supabase.auth.getUser()
    const actorId = user?.id || userId
    let actorName = user?.email || 'RitsuFlow User'
    if (actorId) {
      const { data: profile } = await supabase.from('user_profiles').select('full_name,display_name,email').eq('user_id', actorId).maybeSingle()
      actorName = profile?.full_name || profile?.display_name || profile?.email || actorName
    }
    const { error: historyError } = await supabase.from('project_history').insert({
      project_id: projectId,
      action_type: actionType,
      action_label: actionLabel,
      description,
      entity_type: 'location',
      entity_id: String(entityId),
      performed_by: actorId,
      performed_by_name: actorName,
      metadata,
    })
    if (historyError) throw new Error(`Location saved, but Project History could not be recorded: ${historyError.message}`)
  }

  function parentName(parentId) { return parentId ? locationMap.get(parentId)?.name || 'Unknown location' : 'Project root' }

  function descendants(id) {
    const result = []
    const queue = [id]
    while (queue.length) {
      const current = queue.shift()
      const children = childrenMap.get(current) || []
      children.forEach((child) => { result.push(child.id); queue.push(child.id) })
    }
    return result
  }

  function matchesBranch(item) {
    if (!normalizedSearch) return true
    if (`${item.name} ${item.location_type} ${item.environment_type || ''}`.toLowerCase().includes(normalizedSearch)) return true
    return descendants(item.id).some((id) => {
      const child = locationMap.get(id)
      return child && `${child.name} ${child.location_type} ${child.environment_type || ''}`.toLowerCase().includes(normalizedSearch)
    })
  }

  function nextSequence() { return locations.reduce((max, item) => Math.max(max, Number(item.sequence_number) || 0), 0) + 1 }
  function openAdd(parentId = '', locationType = 'floor') { setForm({ ...emptyForm, parent_id: parentId, location_type: locationType }); setError(''); setModalOpen(true) }
  function openEdit(item) { setForm({ id: item.id, location_type: item.location_type, name: item.name || '', parent_id: item.parent_id || '', environment_type: item.environment_type || '' }); setError(''); setModalOpen(true) }

  async function saveLocation(event) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return setError('Enter a location name.')
    if (form.id && form.parent_id === form.id) return setError('A location cannot be its own parent.')
    setSaving(true); setError('')

    const existing = form.id ? locationMap.get(form.id) : null
    const payload = { project_id: projectId, parent_id: form.parent_id || null, name, location_type: form.location_type, environment_type: form.environment_type.trim() || null, sequence_number: existing?.sequence_number ?? nextSequence() }
    const query = form.id
      ? supabase.from('locations').update(payload).eq('id', form.id).eq('project_id', projectId)
      : supabase.from('locations').insert({ ...payload, created_by: userId })
    const { data, error: saveError } = await query.select('id, project_id, parent_id, name, location_type, environment_type, sequence_number, created_at, updated_at').single()
    if (saveError) { setError(saveError.message || 'The location could not be saved.'); setSaving(false); return }

    try {
      if (existing) {
        const changes = {}
        if (existing.name !== data.name) changes.name = { from: existing.name, to: data.name }
        if (existing.location_type !== data.location_type) changes.location_type = { from: existing.location_type, to: data.location_type }
        if ((existing.parent_id || null) !== (data.parent_id || null)) changes.parent = { from: parentName(existing.parent_id), to: parentName(data.parent_id) }
        if ((existing.environment_type || null) !== (data.environment_type || null)) changes.environment_type = { from: existing.environment_type || null, to: data.environment_type || null }
        await history('location_updated', 'Location updated', `${existing.name} was updated in the Location Breakdown Structure`, data.id, { location_name: data.name, location_type: data.location_type, parent_id: data.parent_id, parent_name: parentName(data.parent_id), changes })
      } else {
        await history('location_added', 'Location added', `${data.name} was added under ${parentName(data.parent_id)}`, data.id, { location_name: data.name, location_type: data.location_type, parent_id: data.parent_id, parent_name: parentName(data.parent_id), environment_type: data.environment_type })
      }
    } catch (historyError) { setError(historyError.message) }

    setLocations((current) => form.id ? current.map((item) => item.id === data.id ? data : item) : [...current, data])
    setSelectedId(data.id); setSaving(false); setModalOpen(false); setForm(emptyForm)
    router.refresh()
  }

  async function removeLocation(item) {
    const childIds = descendants(item.id)
    const removedRecords = [item, ...childIds.map((id) => locationMap.get(id)).filter(Boolean)]
    const message = childIds.length ? `Delete ${item.name} and ${childIds.length} contained location${childIds.length === 1 ? '' : 's'}?` : `Delete ${item.name}?`
    if (!window.confirm(`${message} This action cannot be undone.`)) return
    setSaving(true); setError('')
    if (childIds.length) {
      const { data, error: rpcError } = await supabase.rpc('delete_project_location_tree', { target_location_id: item.id })
      if (rpcError || data?.deleted !== true) { setError(rpcError?.message || data?.message || 'The location could not be deleted.'); setSaving(false); return }
    } else {
      const { error: deleteError } = await supabase.from('locations').delete().eq('id', item.id).eq('project_id', projectId)
      if (deleteError) { setError(deleteError.message); setSaving(false); return }
    }
    try {
      await history('location_deleted', 'Location deleted', childIds.length ? `${item.name} and ${childIds.length} contained location${childIds.length === 1 ? '' : 's'} were deleted from the Location Breakdown Structure` : `${item.name} was deleted from the Location Breakdown Structure`, item.id, { location_name: item.name, location_type: item.location_type, parent_id: item.parent_id, parent_name: parentName(item.parent_id), descendant_count: childIds.length, deleted_locations: removedRecords.map((record) => ({ id: record.id, name: record.name, location_type: record.location_type, parent_id: record.parent_id })) })
    } catch (historyError) { setError(historyError.message) }
    const removed = new Set([item.id, ...childIds])
    setLocations((current) => current.filter((location) => !removed.has(location.id)))
    if (removed.has(selectedId)) setSelectedId('')
    setSaving(false)
    router.refresh()
  }

  function toggle(id) { setCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function suggestedChildType(type) { if (type === 'building') return 'floor'; if (type === 'floor') return 'zone'; return 'area' }

  function renderNode(item, depth = 0) {
    if (!matchesBranch(item)) return null
    const children = childrenMap.get(item.id) || []
    const isCollapsed = collapsed.has(item.id)
    const active = selectedId === item.id
    return <div key={item.id}>
      <div className={`${styles.treeRow} ${active ? styles.treeRowActive : ''}`} style={{ '--depth': depth }} onClick={() => setSelectedId(item.id)}>
        <button type="button" className={styles.chevron} onClick={(event) => { event.stopPropagation(); if (children.length) toggle(item.id) }}>{children.length ? (isCollapsed ? '›' : '⌄') : ''}</button>
        <span className={`${styles.nodeIcon} ${styles[`nodeIcon_${item.location_type}`] || ''}`}>{typeIcon(item.location_type)}</span>
        <div className={styles.nodeName}>{item.name}</div><span className={styles.typeBadge}>{typeLabel(item.location_type)}</span>
        <button type="button" className={styles.moreButton} onClick={(event) => { event.stopPropagation(); openEdit(item) }}>•••</button>
      </div>
      {!isCollapsed && children.map((child) => renderNode(child, depth + 1))}
    </div>
  }

  const roots = childrenMap.get('root') || []

  return <div className={styles.workspace}>
    <section className={styles.projectSummary}>
      <div className={styles.projectIdentity}><div className={styles.projectMark}>▦</div><div><span>{projectCode || 'Project'}</span><strong>{projectName}</strong></div></div>
      <Metric icon="⌖" value={locations.length} label="Total Locations" /><Metric icon="▤" value={divisions} label="Divisions" /><Metric icon="▦" value={zones} label="Zones" /><Metric icon="◇" value={production} label="Production locations" />
    </section>
    <section className={styles.toolbar}>
      <div className={styles.tabs}><button type="button" className={`${styles.tab} ${styles.tabActive}`}>☷ <span>Location Breakdown</span></button><button type="button" className={styles.tab} disabled>⌑ <span>Location Map (RitsuCAD)</span></button><button type="button" className={styles.tab} disabled>▤ <span>Location Report</span></button></div>
      <div className={styles.toolbarActions}><div className={styles.searchWrap}><span>⌕</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search locations..." /></div><button type="button" className={styles.addButton} onClick={() => openAdd('', 'floor')}>＋ Add location</button></div>
    </section>
    {error ? <div className={styles.error}>{error}</div> : null}
    <section className={styles.mainGrid}>
      <div className={styles.treePanel}>
        <div className={styles.treeHeader}><span>Name</span><span>Type</span><span>Actions</span></div>
        <div className={styles.projectRootRow}><span className={styles.chevron}>⌄</span><span className={styles.projectRootIcon}>▦</span><strong>{projectName}</strong><span className={styles.typeBadge}>Project root</span><button type="button" className={styles.rootAdd} onClick={() => openAdd('', 'floor')}>＋</button></div>
        <div className={styles.treeBody}>{roots.length ? roots.map((item) => renderNode(item, 0)) : <div className={styles.treeEmpty}><strong>No locations yet</strong><span>Start with the first Division / Floor.</span><button type="button" onClick={() => openAdd('', 'floor')}>＋ Add division</button></div>}</div>
      </div>
      <div className={styles.detailPanel}>{selected ? <div className={styles.selectedDetail}>
        <div className={styles.detailTop}><span className={styles.detailIcon}>{typeIcon(selected.location_type)}</span><div><small>{typeLabel(selected.location_type)}</small><h2>{selected.name}</h2></div></div>
        <dl className={styles.detailList}><div><dt>Parent</dt><dd>{selected.parent_id ? locationMap.get(selected.parent_id)?.name || 'Project' : projectName}</dd></div><div><dt>Environment</dt><dd>{selected.environment_type || 'Not specified'}</dd></div><div><dt>Linked scope</dt><dd>{selectedScope.length} item{selectedScope.length === 1 ? '' : 's'}</dd></div></dl>
        {selectedScope.length ? <div className={styles.scopeList}>{selectedScope.map((item) => <div key={item.id}><strong>{item.service_name}</strong><span>{item.allocatedQuantity} {item.unit || ''}</span></div>)}</div> : <div className={styles.noScope}>No scope is linked to this location yet.</div>}
        <div className={styles.detailActions}><button type="button" onClick={() => openAdd(selected.id, suggestedChildType(selected.location_type))}>＋ Add child</button><button type="button" onClick={() => openEdit(selected)}>Edit</button><button type="button" className={styles.deleteButton} disabled={saving} onClick={() => removeLocation(selected)}>Delete</button></div>
      </div> : <div className={styles.emptyDetail}><div className={styles.illustration}><Image src="/lbs-icon.png" alt="Location Breakdown Structure" fill sizes="(max-width: 1200px) 45vw, 620px" style={{ objectFit: 'contain' }} priority /></div><h2>Select a location</h2><p>Choose a location from the list to view details, linked scope and mapped elements.</p></div>}</div>
    </section>
    {modalOpen ? <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }}><form className={styles.modal} onSubmit={saveLocation}>
      <div className={styles.modalHeader}><div><span>LOCATION BREAKDOWN STRUCTURE</span><h2>{form.id ? 'Edit location' : 'Add location'}</h2><p>Define the physical hierarchy used to organize production.</p></div><button type="button" onClick={() => !saving && setModalOpen(false)}>×</button></div>
      <div className={styles.formGrid}>
        <label><span>Location type</span><select value={form.location_type} onChange={(event) => setForm((current) => ({ ...current, location_type: event.target.value }))}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>Name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoFocus /></label>
        <label><span>Parent location</span><select value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))}><option value="">Project root</option>{locations.filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name} · {typeLabel(item.location_type)}</option>)}</select></label>
        <label><span>Environment type</span><input value={form.environment_type} onChange={(event) => setForm((current) => ({ ...current, environment_type: event.target.value }))} placeholder="Optional" /></label>
      </div>
      {error ? <div className={styles.modalError}>{error}</div> : null}
      <div className={styles.modalActions}><button type="button" onClick={() => !saving && setModalOpen(false)}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving...' : form.id ? 'Save changes' : 'Add location'}</button></div>
    </form></div> : null}
  </div>
}

function Metric({ icon, value, label }) { return <div className={styles.metric}><span className={styles.metricIcon}>{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div> }