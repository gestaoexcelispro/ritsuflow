'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import LocationQrCard from './LocationQrCard'
import { isQrEligibleLocation } from './locationQr'
import styles from './standalone-location-workspace.module.css'
import { allocateFromTakeoff, loadTakeoffData } from '../../../../lib/takeoff/scopeAllocation'

const TYPES = [
  { value: 'building', label: 'Building' },
  { value: 'floor', label: 'Division / Floor' },
  { value: 'zone', label: 'Zone / Area' },
  { value: 'area', label: 'Area' },
  { value: 'room', label: 'Room' },
  { value: 'custom', label: 'Custom' },
]

const emptyForm = { id: null, location_type: 'floor', name: '', parent_id: '', environment_type: '' }
const nonProductionTypes = new Set(['building', 'floor', 'zone'])

function typeLabel(value) { return TYPES.find((item) => item.value === value)?.label || 'Location' }
function typeIcon(value) { if (value === 'building') return '▦'; if (value === 'floor') return '▤'; if (value === 'zone') return '▦'; return '◇' }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function formatQuantity(value) { return number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

const KIND_LABEL = { block: 'Block', zone: 'Zone', area: 'Area', room: 'Room' }

export default function StandaloneLocationWorkspace({ projectId, projectName, projectCode = '', userId, initialLocations = [], scopeItems = [], allocations = [], spatial = {} }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [locations, setLocations] = useState(initialLocations)
  const [allocationRows, setAllocationRows] = useState(allocations)
  const [activeTab, setActiveTab] = useState('locations')
  const [selectedId, setSelectedId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState(scopeItems[0]?.id || '')
  const [searchTerm, setSearchTerm] = useState('')
  const [scopeSearch, setScopeSearch] = useState('')
  const [showAllocatedOnly, setShowAllocatedOnly] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())
  const [allocationCollapsed, setAllocationCollapsed] = useState(new Set())
  const [draftAllocations, setDraftAllocations] = useState(() => { const draft = {}; allocations.forEach((item) => { draft[`${item.service_id}:${item.location_id}`] = item.quantity == null ? '' : String(item.quantity) }); return draft })
  const [form, setForm] = useState(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qrSaving, setQrSaving] = useState(false)
  const [allocationSaving, setAllocationSaving] = useState(false)
  const [error, setError] = useState('')
  const [allocationMessage, setAllocationMessage] = useState('')
  // RitsuScope (licensed): the takeoff items that feed each scope activity, and their quantities by location.
  const [ritsuLicensed, setRitsuLicensed] = useState(false)
  const [takeoff, setTakeoff] = useState(null)
  const [takeoffError, setTakeoffError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState(new Set())
  const [linkSaving, setLinkSaving] = useState(false)
  useEffect(() => { let alive = true; supabase.rpc('has_workspace_access', { p_workspace_key: 'ritsuscope' }).then(({ data }) => { if (alive) setRitsuLicensed(data === true) }); return () => { alive = false } }, [supabase])
  async function refreshTakeoff() { try { setTakeoffError(''); setTakeoff(await loadTakeoffData(supabase, projectId)) } catch (e) { setTakeoffError(e?.message || 'RitsuScope data could not be loaded.') } }
  useEffect(() => { if (activeTab === 'allocation' && ritsuLicensed && !takeoff) refreshTakeoff() }, [activeTab, ritsuLicensed]) // eslint-disable-line react-hooks/exhaustive-deps

  const locationMap = useMemo(() => new Map(locations.map((item) => [item.id, item])), [locations])
  const childrenMap = useMemo(() => {
    const map = new Map()
    locations.forEach((item) => { const key = item.parent_id || 'root'; if (!map.has(key)) map.set(key, []); map.get(key).push(item) })
    map.forEach((items) => items.sort((a, b) => (number(a.sequence_number) - number(b.sequence_number)) || String(a.name).localeCompare(String(b.name))))
    return map
  }, [locations])

  const selected = selectedId ? locationMap.get(selectedId) : null
  const selectedQrEligible = selected ? isQrEligibleLocation(selected, childrenMap) : false
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const roots = childrenMap.get('root') || []

  const selectedScope = useMemo(() => {
    if (!selectedId) return []
    const byService = new Map()
    allocationRows.filter((item) => item.location_id === selectedId).forEach((item) => byService.set(item.service_id, (byService.get(item.service_id) || 0) + number(item.quantity)))
    return scopeItems.filter((item) => byService.has(item.id)).map((item) => ({ ...item, allocatedQuantity: byService.get(item.id) }))
  }, [selectedId, allocationRows, scopeItems])

  const serviceTotals = useMemo(() => { const totals = new Map(scopeItems.map((item) => [item.id, 0])); allocationRows.forEach((item) => totals.set(item.service_id, (totals.get(item.service_id) || 0) + number(item.quantity))); return totals }, [allocationRows, scopeItems])
  const visibleScopeItems = useMemo(() => { const query = scopeSearch.trim().toLowerCase(); return scopeItems.filter((item) => { if (showAllocatedOnly && (serviceTotals.get(item.id) || 0) <= 0) return false; if (!query) return true; return `${item.service_code || ''} ${item.service_name || ''} ${item.unit || ''}`.toLowerCase().includes(query) }) }, [scopeItems, scopeSearch, showAllocatedOnly, serviceTotals])
  const selectedService = scopeItems.find((item) => item.id === selectedServiceId) || null
  const selectedServiceTotal = number(selectedService?.scope_quantity)
  const draftSelectedTotal = useMemo(() => { if (!selectedServiceId) return 0; return locations.reduce((sum, location) => sum + number(draftAllocations[`${selectedServiceId}:${location.id}`]), 0) }, [draftAllocations, locations, selectedServiceId])
  const remaining = selectedServiceTotal - draftSelectedTotal
  const allocationPercent = selectedServiceTotal > 0 ? (draftSelectedTotal / selectedServiceTotal) * 100 : 0
  const overAllocated = selectedServiceTotal > 0 && draftSelectedTotal > selectedServiceTotal + 0.000001

  async function history(actionType, actionLabel, description, entityId, metadata = {}) {
    const { data: { user } } = await supabase.auth.getUser(); const actorId = user?.id || userId; let actorName = user?.email || 'RitsuFlow User'
    if (actorId) { const { data: profile } = await supabase.from('user_profiles').select('full_name,display_name,email').eq('user_id', actorId).maybeSingle(); actorName = profile?.full_name || profile?.display_name || profile?.email || actorName }
    const { error: historyError } = await supabase.from('project_history').insert({ project_id: projectId, action_type: actionType, action_label: actionLabel, description, entity_type: 'location', entity_id: String(entityId), performed_by: actorId, performed_by_name: actorName, metadata })
    if (historyError) throw new Error(`Change saved, but Project History could not be recorded: ${historyError.message}`)
  }

  function parentName(parentId) { return parentId ? locationMap.get(parentId)?.name || 'Unknown location' : 'Project root' }
  function descendants(id) { const result = []; const seen = new Set([id]); const queue = [id]; while (queue.length) { const current = queue.shift(); (childrenMap.get(current) || []).forEach((child) => { if (seen.has(child.id)) return; seen.add(child.id); result.push(child.id); queue.push(child.id) }) } return result }
  function matchesBranch(item) { if (!normalizedSearch) return true; if (`${item.name} ${item.location_type} ${item.environment_type || ''}`.toLowerCase().includes(normalizedSearch)) return true; return descendants(item.id).some((id) => { const child = locationMap.get(id); return child && `${child.name} ${child.location_type} ${child.environment_type || ''}`.toLowerCase().includes(normalizedSearch) }) }
  function nextSequence() { return locations.reduce((max, item) => Math.max(max, number(item.sequence_number)), 0) + 1 }
  function openAdd(parentId = '', locationType = 'floor') { setForm({ ...emptyForm, parent_id: parentId, location_type: locationType }); setError(''); setModalOpen(true) }
  function openEdit(item) { setForm({ id: item.id, location_type: item.location_type, name: item.name || '', parent_id: item.parent_id || '', environment_type: item.environment_type || '' }); setError(''); setModalOpen(true) }

  async function generateLocationQr() {
    if (!selected || !selectedQrEligible || selected.qr_token) return
    setQrSaving(true); setError('')
    try {
      const response = await fetch(`/api/projects/${projectId}/locations/${selected.id}/qr`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.qr_token) throw new Error(payload.error || 'The location QR could not be generated.')
      setLocations((current) => current.map((item) => item.id === selected.id ? { ...item, qr_token: payload.qr_token } : item))
      try { await history('location_qr_generated', 'Location QR generated', `A FieldOp QR identity was generated for ${selected.name}`, selected.id, { location_name: selected.name }) } catch (historyError) { setError(historyError.message) }
    } catch (qrError) { setError(qrError.message || 'The location QR could not be generated.') }
    finally { setQrSaving(false) }
  }

  async function saveLocation(event) {
    event.preventDefault(); const name = form.name.trim(); if (!name) return setError('Enter a location name.'); if (form.id && form.parent_id === form.id) return setError('A location cannot be its own parent.'); if (form.id && form.parent_id && descendants(form.id).includes(form.parent_id)) return setError('A location cannot be moved inside one of its own children.')
    setSaving(true); setError(''); const existing = form.id ? locationMap.get(form.id) : null
    const payload = { project_id: projectId, parent_id: form.parent_id || null, name, location_type: form.location_type, environment_type: form.environment_type.trim() || null, sequence_number: existing?.sequence_number ?? nextSequence() }
    const query = form.id ? supabase.from('locations').update(payload).eq('id', form.id).eq('project_id', projectId) : supabase.from('locations').insert({ ...payload, created_by: userId })
    const { data, error: saveError } = await query.select('id, project_id, parent_id, name, location_type, environment_type, sequence_number, qr_token, created_at, updated_at').single()
    if (saveError) { setError(saveError.message || 'The location could not be saved.'); setSaving(false); return }
    try {
      if (existing) { const changes = {}; if (existing.name !== data.name) changes.name = { from: existing.name, to: data.name }; if (existing.location_type !== data.location_type) changes.location_type = { from: existing.location_type, to: data.location_type }; if ((existing.parent_id || null) !== (data.parent_id || null)) changes.parent = { from: parentName(existing.parent_id), to: parentName(data.parent_id) }; if ((existing.environment_type || null) !== (data.environment_type || null)) changes.environment_type = { from: existing.environment_type || null, to: data.environment_type || null }; await history('location_updated', 'Location updated', `${existing.name} was updated in the Location Breakdown Structure`, data.id, { location_name: data.name, changes }) }
      else await history('location_added', 'Location added', `${data.name} was added under ${parentName(data.parent_id)}`, data.id, { location_name: data.name, location_type: data.location_type })
    } catch (historyError) { setError(historyError.message) }
    setLocations((current) => form.id ? current.map((item) => item.id === data.id ? data : item) : [...current, data]); setSelectedId(data.id); setSaving(false); setModalOpen(false); setForm(emptyForm); router.refresh()
  }

  async function removeLocation(item) {
    const childIds = descendants(item.id); const message = childIds.length ? `Delete ${item.name} and ${childIds.length} contained location${childIds.length === 1 ? '' : 's'}?` : `Delete ${item.name}?`; if (!window.confirm(`${message} This action cannot be undone.`)) return
    setSaving(true); setError('')
    if (childIds.length) { const { data, error: rpcError } = await supabase.rpc('delete_project_location_tree', { target_location_id: item.id }); if (rpcError || data?.deleted !== true) { setError(rpcError?.message || data?.message || 'The location could not be deleted.'); setSaving(false); return } }
    else { const { error: deleteError } = await supabase.from('locations').delete().eq('id', item.id).eq('project_id', projectId); if (deleteError) { setError(deleteError.message); setSaving(false); return } }
    try { await history('location_deleted', 'Location deleted', `${item.name} was deleted from the Location Breakdown Structure`, item.id, { location_name: item.name, descendant_count: childIds.length }) } catch (historyError) { setError(historyError.message) }
    const removed = new Set([item.id, ...childIds]); setLocations((current) => current.filter((location) => !removed.has(location.id))); if (removed.has(selectedId)) setSelectedId(''); setSaving(false); router.refresh()
  }

  function toggle(id) { setCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function toggleAllocation(id) { setAllocationCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function suggestedChildType(type) { if (type === 'building') return 'floor'; if (type === 'floor') return 'zone'; return 'area' }

  function renderNode(item, depth = 0) {
    if (!matchesBranch(item)) return null
    const children = childrenMap.get(item.id) || []; const isCollapsed = collapsed.has(item.id); const active = selectedId === item.id
    return <div key={item.id}><div className={`${styles.treeRow} ${active ? styles.treeRowActive : ''}`} style={{ '--depth': depth }} onClick={() => setSelectedId(item.id)}><button type="button" className={styles.chevron} onClick={(event) => { event.stopPropagation(); if (children.length) toggle(item.id) }}>{children.length ? (isCollapsed ? '›' : '⌄') : ''}</button><span className={`${styles.nodeIcon} ${styles[`nodeIcon_${item.location_type}`] || ''}`}>{typeIcon(item.location_type)}</span><div className={styles.nodeName}>{item.name}{spatial[item.id]?.hasArea ? <span title="Area drawn in RitsuScope" style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#0d7f77' }}>⌖ {formatQuantity(spatial[item.id].areaM2)} m²</span> : spatial[item.id]?.levels?.length ? <span title="Linked to a RitsuScope level" style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#0d7f77' }}>⌖ level</span> : null}</div><span className={styles.typeBadge}>{typeLabel(item.location_type)}</span><button type="button" className={styles.moreButton} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); openEdit(item) }}>•••</button></div>{!isCollapsed && children.map((child) => renderNode(child, depth + 1))}</div>
  }

  function renderAllocationNode(item, depth = 0) {
    const children = childrenMap.get(item.id) || []; const isCollapsed = allocationCollapsed.has(item.id); const isProduction = !nonProductionTypes.has(item.location_type); const key = `${selectedServiceId}:${item.id}`
    return <div key={item.id}><div className={`${styles.allocationTreeRow} ${isProduction ? styles.allocationProductionRow : ''}`} style={{ '--depth': depth }}><button type="button" className={styles.chevron} onClick={() => children.length && toggleAllocation(item.id)}>{children.length ? (isCollapsed ? '›' : '⌄') : ''}</button><span className={`${styles.nodeIcon} ${styles[`nodeIcon_${item.location_type}`] || ''}`}>{typeIcon(item.location_type)}</span><div className={styles.allocationLocationName}><strong>{item.name}</strong><span>{typeLabel(item.location_type)}</span></div>{isProduction ? <div className={styles.quantityField}><input type="number" min="0" step="any" value={draftAllocations[key] ?? ''} onChange={(event) => { setAllocationMessage(''); setDraftAllocations((current) => ({ ...current, [key]: event.target.value })) }} placeholder="0.00" /><span>{selectedService?.unit || ''}</span></div> : <span className={styles.groupLabel}>Group</span>}</div>{!isCollapsed && children.map((child) => renderAllocationNode(child, depth + 1))}</div>
  }

  function clearSelectedAllocation() { if (!selectedServiceId) return; setDraftAllocations((current) => { const next = { ...current }; locations.forEach((location) => { next[`${selectedServiceId}:${location.id}`] = '' }); return next }); setAllocationMessage('Allocation cleared locally. Save to apply the change.') }

  async function saveAllocation() {
    if (!selectedService) return; if (overAllocated) { setAllocationMessage('Allocated quantity cannot exceed the production scope quantity.'); return }
    setAllocationSaving(true); setAllocationMessage('')
    const existingForService = allocationRows.filter((item) => item.service_id === selectedService.id); const existingByLocation = new Map(existingForService.map((item) => [item.location_id, item])); const desired = locations.filter((location) => !nonProductionTypes.has(location.location_type)).map((location) => ({ location, quantity: number(draftAllocations[`${selectedService.id}:${location.id}`]) })).filter((item) => item.quantity > 0); const desiredIds = new Set(desired.map((item) => item.location.id)); const deleteIds = existingForService.filter((item) => !desiredIds.has(item.location_id)).map((item) => item.id)
    if (deleteIds.length) { const { error: deleteError } = await supabase.from('location_service_quantities').delete().in('id', deleteIds).eq('project_id', projectId); if (deleteError) { setAllocationMessage(deleteError.message); setAllocationSaving(false); return } }
    for (const item of desired) { const existing = existingByLocation.get(item.location.id); if (existing) { const { error: updateError } = await supabase.from('location_service_quantities').update({ quantity: item.quantity }).eq('id', existing.id).eq('project_id', projectId); if (updateError) { setAllocationMessage(updateError.message); setAllocationSaving(false); return } } else { const { error: insertError } = await supabase.from('location_service_quantities').insert({ project_id: projectId, location_id: item.location.id, service_id: selectedService.id, quantity: item.quantity, created_by: userId }); if (insertError) { setAllocationMessage(insertError.message); setAllocationSaving(false); return } } }
    const { data: refreshed, error: refreshError } = await supabase.from('location_service_quantities').select('id, project_id, location_id, service_id, quantity, source_scope_item_id, created_at, updated_at').eq('project_id', projectId)
    if (refreshError) { setAllocationMessage(`Allocation saved, but refresh failed: ${refreshError.message}`); setAllocationSaving(false); return }
    setAllocationRows(refreshed || [])
    try { await history('scope_location_allocation_updated', 'Scope allocation updated', `${selectedService.service_name} was allocated by production location`, selectedService.id, { service_id: selectedService.id, service_name: selectedService.service_name, scope_quantity: selectedServiceTotal, allocated_quantity: draftSelectedTotal, unit: selectedService.unit, locations: desired.map((item) => ({ location_id: item.location.id, location_name: item.location.name, quantity: item.quantity })) }) } catch (historyError) { setAllocationMessage(historyError.message); setAllocationSaving(false); return }
    setAllocationMessage('Allocation saved.'); setAllocationSaving(false); router.refresh()
  }

  return <div className={styles.workspace}>
    <section className={styles.toolbar}><div className={styles.tabs}><button type="button" className={`${styles.tab} ${activeTab === 'locations' ? styles.tabActive : ''}`} onClick={() => { setActiveTab('locations'); setError('') }}>☷ <span>Location Breakdown</span></button><button type="button" className={`${styles.tab} ${activeTab === 'allocation' ? styles.tabActive : ''}`} onClick={() => { setActiveTab('allocation'); setError('') }}>▥ <span>Scope Allocation</span></button><Link href={`/ritsuscope/${projectId}`} className={styles.tab} style={{ textDecoration: 'none' }}>⌑ <span>Map in RitsuScope</span></Link><button type="button" className={styles.tab} disabled>▤ <span>Location Report</span></button></div>{activeTab === 'locations' ? <div className={styles.toolbarActions}><div className={styles.searchWrap}><span>⌕</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search locations..." /></div><button type="button" className={styles.addButton} onClick={() => openAdd('', 'floor')}>＋ Add location</button></div> : <div className={styles.allocationToolbarNote}>Allocate production quantities to the lowest meaningful production location.</div>}</section>
    {error ? <div className={styles.error}>{error}</div> : null}

    {activeTab === 'locations' ? <section className={styles.mainGrid}><div className={styles.treePanel}><div className={styles.treeHeader}><span>Name</span><span>Type</span><span>Actions</span></div><div className={styles.projectRootRow}><span className={styles.chevron}>⌄</span><span className={styles.projectRootIcon}>▦</span><strong>{projectName}</strong><span className={styles.typeBadge}>Project root</span><button type="button" className={styles.rootAdd} onClick={() => openAdd('', 'floor')}>＋</button></div><div className={styles.treeBody}>{roots.length ? roots.map((item) => renderNode(item, 0)) : <div className={styles.treeEmpty}><strong>No locations yet</strong><span>Start with the first Division / Floor.</span><button type="button" onClick={() => openAdd('', 'floor')}>＋ Add division</button></div>}</div></div>
      <div className={styles.detailPanel}>{selected ? <div className={styles.selectedDetail}><div className={styles.detailTop}><span className={styles.detailIcon}>{typeIcon(selected.location_type)}</span><div><small>{typeLabel(selected.location_type)}</small><h2>{selected.name}</h2></div></div><dl className={styles.detailList}><div><dt>Parent</dt><dd>{selected.parent_id ? locationMap.get(selected.parent_id)?.name || 'Project' : projectName}</dd></div><div><dt>Environment</dt><dd>{selected.environment_type || 'Not specified'}</dd></div><div><dt>Linked scope</dt><dd>{selectedScope.length} item{selectedScope.length === 1 ? '' : 's'}</dd></div></dl>{selectedScope.length ? <div className={styles.scopeList}>{selectedScope.map((item) => <div key={item.id}><strong>{item.service_name}</strong><span>{formatQuantity(item.allocatedQuantity)} {item.unit || ''}</span></div>)}</div> : <div className={styles.noScope}>No scope is linked to this location yet.</div>}
        {(() => {
          const sp = spatial[selected.id]
          return <div style={{ marginTop: 16, padding: 14, border: '1px solid #d6ebe8', borderRadius: 10, background: '#f5fbfa', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <strong style={{ flex: 1, fontSize: 11, letterSpacing: '.08em', color: '#087f82' }}>RITSUSCOPE · DRAWING</strong>
              {sp?.hasArea ? <strong style={{ fontSize: 16, color: '#0b3b52' }}>{formatQuantity(sp.areaM2)} m²</strong> : null}
            </div>
            {sp?.levels?.map((l) => <div key={l.id} style={{ fontSize: 12, color: '#294955' }}>Floor level <strong>{l.name}</strong> · {l.elevation >= 0 ? '+' : ''}{formatQuantity(l.elevation)} m · {l.sheets} sheet{l.sheets === 1 ? '' : 's'}</div>)}
            {sp?.zones?.map((z) => <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: '#294955' }}><span><strong>{z.name}</strong> · {KIND_LABEL[z.kind] || z.kind}{z.level ? ` · ${z.level}` : ''}{z.sheet ? ` · ${z.sheet}` : ''}</span><span>{z.areaM2 != null ? `${formatQuantity(z.areaM2)} m²` : 'scale not set'}</span></div>)}
            {!sp ? <div style={{ fontSize: 12, color: '#718594' }}>Not drawn in RitsuScope yet.</div> : null}
            <Link href={`/ritsuscope/${projectId}`} style={{ alignSelf: 'flex-start', marginTop: 2, fontSize: 12, fontWeight: 800, color: '#087f82', textDecoration: 'none' }}>{sp ? 'Open in RitsuScope →' : 'Draw it in RitsuScope →'}</Link>
          </div>
        })()}
        {selectedQrEligible ? (selected.qr_token ? <LocationQrCard location={selected} locationMap={locationMap} projectName={projectName} projectCode={projectCode} /> : <div className={styles.noScope}><strong>FieldOp Location QR</strong><br />This leaf production location can have one stable physical QR identity.<br /><button type="button" disabled={qrSaving} onClick={generateLocationQr}>{qrSaving ? 'Generating QR...' : 'Generate Location QR'}</button></div>) : null}
        <div className={styles.detailActions}><button type="button" onClick={() => openAdd(selected.id, suggestedChildType(selected.location_type))}>＋ Add child</button><button type="button" onClick={() => openEdit(selected)}>Edit</button><button type="button" className={styles.deleteButton} disabled={saving} onClick={() => removeLocation(selected)}>Delete</button></div></div> : <div className={styles.emptyDetail}><div className={styles.illustration}><Image src="/lbs-icon.png" alt="Location Breakdown Structure" fill sizes="(max-width: 1200px) 45vw, 620px" style={{ objectFit: 'contain' }} priority /></div><h2>Select a location</h2><p>Choose a location from the list to view details, linked scope and mapped elements.</p></div>}</div></section> : <section className={styles.allocationWorkspace}>
      <aside className={styles.scopePanel}><div className={styles.scopePanelHeader}><div><span>PRODUCTION SCOPE</span><strong>{scopeItems.length} activities</strong></div><label className={styles.allocatedToggle}><input type="checkbox" checked={showAllocatedOnly} onChange={(event) => setShowAllocatedOnly(event.target.checked)} /> Allocated only</label></div><div className={styles.scopeSearch}><span>⌕</span><input value={scopeSearch} onChange={(event) => setScopeSearch(event.target.value)} placeholder="Search production scope..." /></div><div className={styles.serviceList}>{visibleScopeItems.length ? visibleScopeItems.map((item) => { const total = number(item.scope_quantity); const allocated = serviceTotals.get(item.id) || 0; const percent = total > 0 ? Math.min(100, (allocated / total) * 100) : 0; const status = allocated <= 0 ? 'Not allocated' : total > 0 && allocated >= total - 0.000001 ? 'Fully allocated' : 'Partially allocated'; return <button type="button" key={item.id} className={`${styles.serviceCard} ${selectedServiceId === item.id ? styles.serviceCardActive : ''}`} onClick={() => { setSelectedServiceId(item.id); setAllocationMessage('') }}><div className={styles.serviceCardTop}><span>{item.service_code || 'Scope'}</span><em className={status === 'Fully allocated' ? styles.statusComplete : status === 'Partially allocated' ? styles.statusPartial : ''}>{status === 'Fully allocated' ? '✓ ' : ''}{status}</em></div><strong>{item.service_name}</strong><div className={styles.serviceQuantity}>{formatQuantity(total)} {item.unit || ''}</div><div className={styles.miniProgress}><i style={{ width: `${percent}%` }} /></div><small>{formatQuantity(allocated)} allocated</small></button> }) : <div className={styles.emptyServices}>No production scope matches this filter.</div>}</div></aside>
      <div className={styles.allocationPanel}>{selectedService ? <><div className={styles.allocationHeader}><div><span>SCOPE ALLOCATION</span><h2>{selectedService.service_name}</h2><p>{selectedService.service_code || 'Production activity'} · {selectedService.unit || 'No unit'}</p></div><div className={styles.allocationStats}><div><span>Scope Qty</span><strong>{formatQuantity(selectedServiceTotal)} {selectedService.unit || ''}</strong></div><div><span>Allocated</span><strong>{formatQuantity(draftSelectedTotal)} {selectedService.unit || ''}</strong></div><div className={overAllocated ? styles.statDanger : ''}><span>Remaining</span><strong>{formatQuantity(remaining)} {selectedService.unit || ''}</strong></div></div></div><div className={styles.progressBlock}><div><strong>{overAllocated ? 'Over allocated' : `${Math.min(100, allocationPercent).toFixed(0)}% allocated`}</strong><span>{formatQuantity(draftSelectedTotal)} / {formatQuantity(selectedServiceTotal)} {selectedService.unit || ''}</span></div><div className={`${styles.progressTrack} ${overAllocated ? styles.progressDanger : ''}`}><i style={{ width: `${Math.min(100, allocationPercent)}%` }} /></div></div>{(() => {
        const linked = (takeoff?.layers || []).filter((l) => l.scope_activity_id === selectedService.id)
        const box = { margin: '0 0 12px', padding: 12, border: '1px solid #d8c8f5', borderRadius: 10, background: '#f9f6ff', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#3b2a63' }
        const btn = (primary) => ({ height: 30, padding: '0 12px', borderRadius: 7, border: primary ? 0 : '1px solid #cbb8ef', background: primary ? '#6d28d9' : '#fff', color: primary ? '#fff' : '#4c1d95', fontSize: 11, fontWeight: 800, cursor: 'pointer' })
        if (!ritsuLicensed) return <div style={box}><strong>RITSUSCOPE QUANTITIES</strong><span>🔒 Filling allocations from the RitsuScope takeoff is available with the RitsuScope license.</span></div>
        if (takeoffError) return <div style={box}><strong>RITSUSCOPE QUANTITIES</strong><span style={{ color: '#a11' }}>{takeoffError}</span></div>
        if (!takeoff) return <div style={box}><strong>RITSUSCOPE QUANTITIES</strong><span>Loading RitsuScope takeoff…</span></div>
        const fill = () => {
          const production = new Set(locations.filter((l) => !nonProductionTypes.has(l.location_type)).map((l) => l.id))
          const r = allocateFromTakeoff(takeoff, { layerIds: linked.map((l) => l.id), unit: selectedService.unit, productionLocationIds: production })
          setDraftAllocations((current) => { const next = { ...current }; locations.forEach((loc) => { if (!production.has(loc.id)) return; const v = r.byLocation.get(loc.id) || 0; next[`${selectedService.id}:${loc.id}`] = v > 0 ? String(Math.round(v * 100) / 100) : '' }); return next })
          const allocated = [...r.byLocation.values()].reduce((a, b) => a + b, 0)
          setAllocationMessage(`Filled from RitsuScope: ${formatQuantity(allocated)} ${selectedService.unit || ''} in ${r.byLocation.size} location(s) · RitsuScope total ${formatQuantity(r.total)} · ${formatQuantity(r.unallocated)} outside every location${r.uncalibratedSheets.length ? ` · sheets without scale left out: ${r.uncalibratedSheets.join(', ')}` : ''}. Review, then Save Allocation.`)
        }
        const saveLinks = async () => {
          setLinkSaving(true)
          try {
            const add = [...linkDraft].filter((id) => !linked.some((l) => l.id === id))
            const remove = linked.filter((l) => !linkDraft.has(l.id)).map((l) => l.id)
            if (add.length) { const { error: e1 } = await supabase.from('takeoff_layers').update({ scope_activity_id: selectedService.id }).in('id', add); if (e1) throw e1 }
            if (remove.length) { const { error: e2 } = await supabase.from('takeoff_layers').update({ scope_activity_id: null }).in('id', remove); if (e2) throw e2 }
            await refreshTakeoff(); setLinkOpen(false)
          } catch (e) { setAllocationMessage(e?.message || 'The RitsuScope links could not be saved.') } finally { setLinkSaving(false) }
        }
        return <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ flex: 1 }}>RITSUSCOPE QUANTITIES</strong>
            <button type="button" style={btn(false)} onClick={() => { setLinkDraft(new Set(linked.map((l) => l.id))); setLinkOpen((v) => !v) }}>{linkOpen ? 'Close' : 'Choose items'}</button>
            <button type="button" style={{ ...btn(true), opacity: linked.length ? 1 : 0.5 }} disabled={!linked.length} onClick={fill}>Fill from RitsuScope</button>
          </div>
          <span>{linked.length ? `Fed by: ${linked.map((l) => l.name).join(', ')}` : 'No RitsuScope item feeds this activity yet. Choose the items that measure it.'} · Walls shared by two locations are split 50/50.</span>
          {linkOpen ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflow: 'auto', padding: 8, background: '#fff', border: '1px solid #e4d9f7', borderRadius: 8 }}>
            {takeoff.layers.length ? takeoff.layers.map((l) => {
              const other = l.scope_activity_id && l.scope_activity_id !== selectedService.id ? scopeItems.find((x) => x.id === l.scope_activity_id) : null
              return <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={linkDraft.has(l.id)} onChange={() => setLinkDraft((cur) => { const n = new Set(cur); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n })} /><span style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} /><span>{l.name}</span><small style={{ color: '#8a7bb0' }}>{l.kind === 'linear' ? 'walls / lines' : l.kind === 'area' ? 'areas' : 'counts'}{other ? ` · now feeds ${other.service_name}` : ''}</small></label>
            }) : <span>No RitsuScope items in this project yet.</span>}
            <button type="button" style={{ ...btn(true), alignSelf: 'flex-start', marginTop: 4 }} disabled={linkSaving} onClick={() => void saveLinks()}>{linkSaving ? 'Saving…' : 'Save items'}</button>
          </div> : null}
        </div>
      })()}<div className={styles.allocationTreeHeader}><span>Location Breakdown</span><span>Allocated quantity</span></div><div className={styles.allocationTree}>{roots.length ? roots.map((item) => renderAllocationNode(item, 0)) : <div className={styles.emptyServices}>Create the Location Breakdown Structure before allocating scope.</div>}</div><div className={styles.allocationFooter}>{allocationMessage ? <span className={overAllocated ? styles.messageDanger : styles.message}>{allocationMessage}</span> : <span className={styles.allocationHint}>Quantities are stored against the existing production service and location records.</span>}<div><button type="button" className={styles.clearButton} disabled={allocationSaving} onClick={clearSelectedAllocation}>Clear</button><button type="button" className={styles.saveAllocationButton} disabled={allocationSaving || overAllocated} onClick={saveAllocation}>{allocationSaving ? 'Saving...' : 'Save Allocation'}</button></div></div></> : <div className={styles.emptyAllocation}><strong>Select a production scope item</strong><span>Choose an activity on the left to distribute its quantity through the Location Breakdown Structure.</span></div>}</div></section>}

    {modalOpen ? <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }}><form className={styles.modal} onSubmit={saveLocation}><div className={styles.modalHeader}><div><span>LOCATION BREAKDOWN STRUCTURE</span><h2>{form.id ? 'Edit location' : 'Add location'}</h2><p>Define the physical hierarchy used to organize production.</p></div><button type="button" onClick={() => !saving && setModalOpen(false)}>×</button></div><div className={styles.formGrid}><label><span>Location type</span><select value={form.location_type} onChange={(event) => setForm((current) => ({ ...current, location_type: event.target.value }))}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoFocus /></label><label><span>Parent location</span><select value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))}><option value="">Project root</option>{(() => { const blocked = form.id ? new Set([form.id, ...descendants(form.id)]) : new Set(); return locations.filter((item) => !blocked.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {typeLabel(item.location_type)}</option>) })()}</select></label><label><span>Environment type</span><input value={form.environment_type} onChange={(event) => setForm((current) => ({ ...current, environment_type: event.target.value }))} placeholder="Optional" /></label></div>{error ? <div className={styles.modalError}>{error}</div> : null}<div className={styles.modalActions}><button type="button" onClick={() => !saving && setModalOpen(false)}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving...' : form.id ? 'Save changes' : 'Add location'}</button></div></form></div> : null}
  </div>
}
