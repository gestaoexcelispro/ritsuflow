'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Icon, Notice, Segments, ui } from '../../../fieldop/ui'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import LocationQrCard from './LocationQrCard'
import { isQrEligibleLocation } from './locationQr'
import styles from './standalone-location-workspace.module.css'
import { allocateScopeStep, defaultRuleFor, EXTERIOR, exteriorLocationOf, flowRankOf, loadTakeoffData } from '../../../../lib/takeoff/scopeAllocation'
import { drawnTotals } from '../../../../lib/takeoff/taskDrawings'

const TYPES = ['building', 'floor', 'zone', 'area', 'room', 'custom']
const SHORT = { building: 'B', floor: 'F', zone: 'Z', area: 'A', room: 'R', custom: 'C' }
const emptyForm = { id: null, location_type: 'floor', name: '', parent_id: '', environment_type: '' }
const nonProductionTypes = new Set(['building', 'floor', 'zone'])
const number = (value) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
const round2 = (value) => Math.round(value * 100) / 100

/** Label + control. Module-level so inputs keep focus while typing. */
function Field({ label, children }) {
  return <label className={ui.field}><span className={ui.fieldLabel}>{label}</span>{children}</label>
}

export default function StandaloneLocationWorkspace({ projectId, projectName, projectCode = '', userId, initialLocations = [], scopeItems: initialScopeItems = [], allocations = [], spatial = {}, loadError = '', taskDrawings = [], initialTab = 'locations', initialScopeItemId = '', returnedFromDraw = '' }) {
  const t = useT('projects')
  const { language } = useLanguage()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [locations, setLocations] = useState(initialLocations)
  const [allocationRows, setAllocationRows] = useState(allocations)
  const [scopeItems, setScopeItems] = useState(initialScopeItems)
  useEffect(() => { setScopeItems(initialScopeItems) }, [initialScopeItems])
  const [activeTab, setActiveTab] = useState(initialTab === 'allocation' ? 'allocation' : 'locations')
  const [selectedId, setSelectedId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState((initialScopeItemId && scopeItems.find((s) => s.source_scope_item_id === initialScopeItemId)?.id) || scopeItems[0]?.id || '')
  /** Came back from the task view: refresh that activity's draft once the takeoff is loaded. */
  const pendingRedraw = useRef(returnedFromDraw ? initialScopeItemId : '')
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
  const [bulk, setBulk] = useState(null) // { rows, replace } — 'Allocate all from RitsuScope' preview
  const [bulkSaving, setBulkSaving] = useState(false)
  useEffect(() => { let alive = true; supabase.rpc('has_workspace_access', { p_workspace_key: 'ritsuscope' }).then(({ data }) => { if (alive) setRitsuLicensed(data === true) }); return () => { alive = false } }, [supabase])
  async function refreshTakeoff() { try { setTakeoffError(''); setTakeoff(await loadTakeoffData(supabase, projectId)) } catch (e) { setTakeoffError(e?.message || t('loc.ritsu.loadError')) } }
  useEffect(() => { if (activeTab === 'allocation' && ritsuLicensed && !takeoff) refreshTakeoff() }, [activeTab, ritsuLicensed]) // eslint-disable-line react-hooks/exhaustive-deps

  const qty = (value) => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(number(value))
  const typeLabel = (value) => (TYPES.includes(value) ? t(`loc.type.${value}`) : t('loc.type.location'))

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
  const counts = useMemo(() => locations.reduce((c, l) => ({ ...c, [nonProductionTypes.has(l.location_type) ? 'groups' : 'production']: (c[nonProductionTypes.has(l.location_type) ? 'groups' : 'production'] || 0) + 1 }), {}), [locations])

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
  // Rounding to 0.01 per location, and drawn openings measured on the line rather than spread along the wall, leave small gaps.
  const overAllocated = selectedServiceTotal > 0 && draftSelectedTotal > selectedServiceTotal * 1.005 + 0.01

  // ---------- RitsuScope → locations ----------
  const productionIds = useMemo(() => new Set(locations.filter((l) => !nonProductionTypes.has(l.location_type)).map((l) => l.id)), [locations])
  /** Takeoff items feeding an activity: its own scope line's item (imported from RitsuScope) plus any chosen by hand. */
  function feedOf(service) {
    const layers = takeoff?.layers || []
    const auto = service?.takeoff_layer_id ? layers.find((l) => l.id === service.takeoff_layer_id) || null : null
    const manual = service ? layers.filter((l) => l.scope_activity_id === service.id && l.id !== auto?.id) : []
    return { auto, manual, all: auto ? [auto, ...manual] : manual }
  }
  // Task view drawings: a location drawn for a scope item uses its drawn quantity; the automatic split
  // leaves that location out and skips the wall stretches already drawn ("complement").
  const drawnBy = useMemo(() => drawnTotals(taskDrawings), [taskDrawings])
  const drawnOf = (service, locationId) => (service?.source_scope_item_id ? drawnBy.get(`${service.source_scope_item_id}:${locationId}`) : undefined)
  const drawnLocations = (service) => new Set(locations.filter((loc) => drawnOf(service, loc.id) !== undefined).map((loc) => loc.id))
  const claimedOf = (service) => (service?.source_scope_item_id ? taskDrawings.filter((d) => d.scope_item_id === service.source_scope_item_id).map((d) => ({ source_id: d.source_id, points: d.points })) : [])
  // Each wall step goes where its work is done (framing → the carrier room, faces → the room they look
  // into, outside faces → the level's Exterior); areas and counts by position. See allocateScopeStep.
  const flowRank = useMemo(() => flowRankOf(locations), [locations])
  function splitFor(service) {
    const { all } = feedOf(service)
    if (!takeoff || !all.length) return null
    const drawn = drawnLocations(service)
    return allocateScopeStep(takeoff, {
      layerIds: all.map((l) => l.id), unit: service.unit, step: service.takeoff_step, rule: service.allocation_rule,
      productionLocationIds: new Set([...productionIds].filter((id) => !drawn.has(id))), claimed: claimedOf(service), flowRank,
      exteriorLocationOf: (key) => exteriorLocationOf(key, locations, takeoff.levels),
    })
  }
  /** Outside faces with no Exterior location yet (one per level): their quantity, to offer creating them. */
  const exteriorPending = (r) => [...(r?.byLocation || new Map())].filter(([key, v]) => String(key).startsWith(EXTERIOR) && v > 0)
  async function createExteriorLocations(keys) {
    setAllocationSaving(true); setError('')
    try {
      let seq = nextSequence()
      const made = []
      for (const key of keys) {
        const level = (takeoff?.levels || []).find((l) => l.id === key.slice(EXTERIOR.length))
        const payload = { project_id: projectId, parent_id: level?.location_id || null, name: t('loc.exterior.name', { level: level?.name || t('loc.exterior.noLevel') }), location_type: 'area', environment_type: 'exterior', sequence_number: seq++, created_by: userId }
        const { data, error: e } = await supabase.from('locations').insert(payload).select('id, project_id, parent_id, name, location_type, environment_type, sequence_number, qr_token, created_at, updated_at').single()
        if (e) throw e
        made.push(data)
      }
      setLocations((current) => [...current, ...made])
      setAllocationMessage(t('loc.exterior.created', { count: made.length }))
      router.refresh()
    } catch (e) { setError(e?.message || t('loc.errSave')) }
    setAllocationSaving(false)
  }
  /** Drawn quantity where a location is drawn, otherwise the automatic split (or blank). */
  function plannedFor(service, r) {
    const out = new Map()
    locations.forEach((loc) => {
      if (!productionIds.has(loc.id)) return
      const drawn = drawnOf(service, loc.id)
      const v = round2(drawn !== undefined ? drawn : (r?.byLocation.get(loc.id) || 0))
      if (v > 0) out.set(loc.id, v)
    })
    return out
  }
  function fillDraft(service, r) {
    const planned = plannedFor(service, r)
    setDraftAllocations((current) => { const next = { ...current }; locations.forEach((loc) => { if (!productionIds.has(loc.id)) return; const v = planned.get(loc.id); next[`${service.id}:${loc.id}`] = v ? String(v) : '' }); return next })
  }
  // Drawn locations always show their drawn quantity.
  useEffect(() => {
    if (!selectedService) return
    setDraftAllocations((current) => {
      let changed = false
      const next = { ...current }
      locations.forEach((loc) => { const d = drawnOf(selectedService, loc.id); if (d === undefined) return; const key = `${selectedService.id}:${loc.id}`; const v = String(round2(d)); if (next[key] !== v) { next[key] = v; changed = true } })
      return changed ? next : current
    })
  }, [selectedServiceId, drawnBy]) // eslint-disable-line react-hooks/exhaustive-deps
  function filledMessage(service, r) {
    const allocated = [...r.byLocation.values()].reduce((a, b) => a + b, 0)
    const drawn = drawnLocations(service)
    const drawnSum = [...drawn].reduce((a, id) => a + (drawnOf(service, id) || 0), 0)
    const drawnText = drawn.size ? ` ${t('loc.task.drawnPart', { value: `${qty(drawnSum)} ${service.unit || ''}`, count: drawn.size })}` : ''
    return `${t('loc.ritsu.filled', { allocated: `${qty(allocated)} ${service.unit || ''}`, count: r.byLocation.size, total: qty(r.total), outside: qty(r.unallocated) })}${drawnText}${r.uncalibratedSheets.length ? ` ${t('loc.ritsu.noScaleSheets', { sheets: r.uncalibratedSheets.join(', ') })}` : ''}`
  }
  // Opening an activity with nothing saved or typed yet: draft its split from RitsuScope (saved only on Save).
  useEffect(() => {
    if (!takeoff || !selectedService) return
    if (pendingRedraw.current && pendingRedraw.current === selectedService.source_scope_item_id) {
      pendingRedraw.current = ''
      const r = splitFor(selectedService)
      if (r) { fillDraft(selectedService, r); setAllocationMessage(`${t('loc.task.backFromDraw')} ${filledMessage(selectedService, r)} ${t('loc.ritsu.reviewThenSave')}`) }
      else setAllocationMessage(`${t('loc.task.backFromDraw')} ${t('loc.ritsu.reviewThenSave')}`)
      return
    }
    if (allocationRows.some((row) => row.service_id === selectedService.id)) return
    if (locations.some((loc) => draftAllocations[`${selectedService.id}:${loc.id}`])) return
    const r = splitFor(selectedService)
    if (!r || !r.byLocation.size) return
    fillDraft(selectedService, r)
    setAllocationMessage(`${filledMessage(selectedService, r)} ${t('loc.ritsu.reviewThenSave')}`)
  }, [takeoff, selectedServiceId]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * A scope line without a FieldOp activity record gets one now, inactive: location quantities need it,
   * and FieldOp only uses the item once it is activated in FieldOp's project setup.
   */
  async function ensureActivity(service) {
    if (!service.pending) return service.id
    const { data: found } = await supabase.from('fieldop_project_activities').select('id').eq('project_id', projectId).eq('source', 'scope').eq('scope_item_id', service.source_scope_item_id).limit(1)
    let id = found?.[0]?.id
    if (!id) {
      const { data, error: e } = await supabase.from('fieldop_project_activities').insert({ project_id: projectId, source: 'scope', scope_item_id: service.source_scope_item_id, is_active: false }).select('id').single()
      if (e) throw e
      id = data.id
    }
    const oldId = service.id
    setScopeItems((current) => current.map((s) => (s.id === oldId ? { ...s, id, pending: false } : s)))
    setDraftAllocations((current) => { const next = {}; Object.entries(current).forEach(([k, v]) => { next[k.startsWith(`${oldId}:`) ? `${id}:${k.slice(oldId.length + 1)}` : k] = v }); return next })
    setSelectedServiceId((current) => (current === oldId ? id : current))
    return id
  }

  /** Replaces one activity's quantities by location (updates, inserts, then removes locations no longer used). */
  async function writeAllocation(serviceId, desired) {
    const existing = allocationRows.filter((row) => row.service_id === serviceId)
    const byLocation = new Map(existing.map((row) => [row.location_id, row]))
    const keep = new Set(desired.map((d) => d.locationId))
    for (const d of desired) {
      const row = byLocation.get(d.locationId)
      const { error: e } = row
        ? await supabase.from('location_service_quantities').update({ quantity: d.quantity }).eq('id', row.id).eq('project_id', projectId)
        : await supabase.from('location_service_quantities').insert({ project_id: projectId, location_id: d.locationId, service_id: serviceId, quantity: d.quantity, created_by: userId })
      if (e) throw e
    }
    const drop = existing.filter((row) => !keep.has(row.location_id)).map((row) => row.id)
    if (drop.length) { const { error: e } = await supabase.from('location_service_quantities').delete().in('id', drop).eq('project_id', projectId); if (e) throw e }
  }
  async function reloadAllocations() {
    const { data, error: e } = await supabase.from('location_service_quantities').select('id, project_id, location_id, service_id, quantity, source_scope_item_id, created_at, updated_at').eq('project_id', projectId)
    if (e) throw new Error(t('loc.alloc.errRefresh', { message: e.message }))
    setAllocationRows(data || [])
  }

  function openBulk() {
    const rows = scopeItems.map((service) => {
      const r = splitFor(service)
      if (!r) return null
      const planned = plannedFor(service, r)
      const allocated = [...planned.values()].reduce((a, b) => a + b, 0)
      return { service, r, planned, allocated, drawn: drawnLocations(service).size, saved: allocationRows.some((row) => row.service_id === service.id) }
    }).filter(Boolean)
    setBulk({ rows, replace: false })
  }
  async function applyBulk() {
    if (!bulk) return
    const todo = bulk.rows.filter((x) => x.planned.size > 0 && (!x.saved || bulk.replace))
    setBulkSaving(true); setAllocationMessage('')
    try {
      for (const x of todo) {
        const desired = [...x.planned].map(([locationId, quantity]) => ({ locationId, quantity }))
        const id = await ensureActivity(x.service)
        await writeAllocation(id, desired)
        fillDraft({ ...x.service, id }, x.r)
      }
      await reloadAllocations()
      await history('scope_location_allocation_bulk', 'Scope allocated from RitsuScope', `${todo.length} activities were allocated by production location from RitsuScope`, projectId, { activities: todo.map((x) => ({ scope_item_id: x.service.source_scope_item_id, service_name: x.service.service_name, allocated: x.allocated, total: x.r.total, outside: x.r.unallocated, unit: x.service.unit })) })
      setBulk(null); setAllocationMessage(t('loc.bulk.done', { count: todo.length })); router.refresh()
    } catch (e) {
      try { await reloadAllocations() } catch { /* keep the first error */ }
      setBulk(null); setAllocationMessage(e?.message || String(e))
    } finally { setBulkSaving(false) }
  }

  async function history(actionType, actionLabel, description, entityId, metadata = {}) {
    const { data: { user } } = await supabase.auth.getUser(); const actorId = user?.id || userId; let actorName = user?.email || 'RitsuFlow User'
    if (actorId) { const { data: profile } = await supabase.from('user_profiles').select('full_name,display_name,email').eq('user_id', actorId).maybeSingle(); actorName = profile?.full_name || profile?.display_name || profile?.email || actorName }
    const { error: historyError } = await supabase.from('project_history').insert({ project_id: projectId, action_type: actionType, action_label: actionLabel, description, entity_type: 'location', entity_id: String(entityId), performed_by: actorId, performed_by_name: actorName, metadata })
    if (historyError) throw new Error(t('loc.errHistory', { message: historyError.message }))
  }

  function parentName(parentId) { return parentId ? locationMap.get(parentId)?.name || '—' : projectName }
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
      if (!response.ok || !payload.qr_token) throw new Error(payload.error || t('loc.qr.errGenerate'))
      setLocations((current) => current.map((item) => item.id === selected.id ? { ...item, qr_token: payload.qr_token } : item))
      try { await history('location_qr_generated', 'Location QR generated', `A FieldOp QR identity was generated for ${selected.name}`, selected.id, { location_name: selected.name }) } catch (historyError) { setError(historyError.message) }
    } catch (qrError) { setError(qrError.message || t('loc.qr.errGenerate')) }
    finally { setQrSaving(false) }
  }

  async function saveLocation(event) {
    event.preventDefault(); const name = form.name.trim(); if (!name) return setError(t('loc.errName')); if (form.id && form.parent_id === form.id) return setError(t('loc.errSelfParent')); if (form.id && form.parent_id && descendants(form.id).includes(form.parent_id)) return setError(t('loc.errChildParent'))
    setSaving(true); setError(''); const existing = form.id ? locationMap.get(form.id) : null
    const payload = { project_id: projectId, parent_id: form.parent_id || null, name, location_type: form.location_type, environment_type: form.environment_type.trim() || null, sequence_number: existing?.sequence_number ?? nextSequence() }
    const query = form.id ? supabase.from('locations').update(payload).eq('id', form.id).eq('project_id', projectId) : supabase.from('locations').insert({ ...payload, created_by: userId })
    const { data, error: saveError } = await query.select('id, project_id, parent_id, name, location_type, environment_type, sequence_number, qr_token, created_at, updated_at').single()
    if (saveError) { setError(saveError.message || t('loc.errSave')); setSaving(false); return }
    try {
      if (existing) { const changes = {}; if (existing.name !== data.name) changes.name = { from: existing.name, to: data.name }; if (existing.location_type !== data.location_type) changes.location_type = { from: existing.location_type, to: data.location_type }; if ((existing.parent_id || null) !== (data.parent_id || null)) changes.parent = { from: parentName(existing.parent_id), to: parentName(data.parent_id) }; if ((existing.environment_type || null) !== (data.environment_type || null)) changes.environment_type = { from: existing.environment_type || null, to: data.environment_type || null }; await history('location_updated', 'Location updated', `${existing.name} was updated in the Location Breakdown Structure`, data.id, { location_name: data.name, changes }) }
      else await history('location_added', 'Location added', `${data.name} was added under ${parentName(data.parent_id)}`, data.id, { location_name: data.name, location_type: data.location_type })
    } catch (historyError) { setError(historyError.message) }
    setLocations((current) => form.id ? current.map((item) => item.id === data.id ? data : item) : [...current, data]); setSelectedId(data.id)
    if (data.parent_id) setCollapsed((current) => { const next = new Set(current); next.delete(data.parent_id); return next })
    setSaving(false); setModalOpen(false); setForm(emptyForm); router.refresh()
  }

  async function removeLocation(item) {
    const childIds = descendants(item.id)
    const message = childIds.length ? t('loc.confirmDeleteTree', { name: item.name, count: childIds.length }) : t('loc.confirmDelete', { name: item.name })
    if (!window.confirm(`${message} ${t('loc.cannotUndo')}`)) return
    setSaving(true); setError('')
    if (childIds.length) { const { data, error: rpcError } = await supabase.rpc('delete_project_location_tree', { target_location_id: item.id }); if (rpcError || data?.deleted !== true) { setError(rpcError?.message || data?.message || t('loc.errDelete')); setSaving(false); return } }
    else { const { error: deleteError } = await supabase.from('locations').delete().eq('id', item.id).eq('project_id', projectId); if (deleteError) { setError(deleteError.message); setSaving(false); return } }
    try { await history('location_deleted', 'Location deleted', `${item.name} was deleted from the Location Breakdown Structure`, item.id, { location_name: item.name, descendant_count: childIds.length }) } catch (historyError) { setError(historyError.message) }
    const removed = new Set([item.id, ...childIds]); setLocations((current) => current.filter((location) => !removed.has(location.id))); if (removed.has(selectedId)) setSelectedId(''); setSaving(false); router.refresh()
  }

  function toggle(id) { setCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function toggleAllocation(id) { setAllocationCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function suggestedChildType(type) { if (type === 'building') return 'floor'; if (type === 'floor') return 'zone'; return 'area' }

  function renderNode(item, depth = 0) {
    if (!matchesBranch(item)) return null
    const children = childrenMap.get(item.id) || []; const isCollapsed = collapsed.has(item.id) && !normalizedSearch; const active = selectedId === item.id
    const sp = spatial[item.id]
    return <div key={item.id}>
      <div className={`${styles.treeRow} ${active ? styles.treeRowActive : ''}`} style={{ '--depth': depth }} onClick={() => setSelectedId(item.id)}>
        {children.length ? <button type="button" className={styles.chevron} onClick={(event) => { event.stopPropagation(); toggle(item.id) }} aria-label={isCollapsed ? t('loc.expand') : t('loc.collapse')}><Icon name={isCollapsed ? 'right' : 'down'} size={16} strokeWidth={2.2} /></button> : <span className={styles.chevron} />}
        <span className={`${styles.mark} ${styles[`mark_${item.location_type}`] || ''}`} aria-hidden="true">{SHORT[item.location_type] || '·'}</span>
        <span className={styles.nodeName}>{item.name}{sp?.hasArea ? <em className={styles.areaChip} title={t('loc.ritsu.areaDrawn')}>{qty(sp.areaM2)} m²</em> : sp?.levels?.length ? <em className={styles.areaChip} title={t('loc.ritsu.levelLinked')}>{t('loc.ritsu.level')}</em> : null}{item.qr_token ? <em className={styles.qrChip}>QR</em> : null}</span>
        <span className={styles.typeBadge}>{typeLabel(item.location_type)}</span>
      </div>
      {!isCollapsed && children.map((child) => renderNode(child, depth + 1))}
    </div>
  }

  function renderAllocationNode(item, depth = 0) {
    const children = childrenMap.get(item.id) || []; const isCollapsed = allocationCollapsed.has(item.id); const isProduction = !nonProductionTypes.has(item.location_type); const key = `${selectedServiceId}:${item.id}`
    return <div key={item.id}>
      <div className={`${styles.allocationRow} ${isProduction ? styles.allocationProduction : ''}`} style={{ '--depth': depth }}>
        {children.length ? <button type="button" className={styles.chevron} onClick={() => toggleAllocation(item.id)} aria-label={isCollapsed ? t('loc.expand') : t('loc.collapse')}><Icon name={isCollapsed ? 'right' : 'down'} size={16} strokeWidth={2.2} /></button> : <span className={styles.chevron} />}
        <span className={`${styles.mark} ${styles[`mark_${item.location_type}`] || ''}`} aria-hidden="true">{SHORT[item.location_type] || '·'}</span>
        <span className={styles.allocationName}><strong>{item.name}</strong><small>{typeLabel(item.location_type)}</small></span>
        {isProduction ? <span className={styles.rowEnd}>
          {selectedService?.source_scope_item_id ? <Link className={`${ui.btn} ${ui.small} ${styles.drawBtn}`} href={`/ritsuscope/${projectId}?task=${selectedService.source_scope_item_id}&location=${item.id}&from=allocation`} title={t('loc.task.drawHint')}>{drawnOf(selectedService, item.id) !== undefined ? t('loc.task.editDrawing') : t('loc.task.draw')}</Link> : null}
          {drawnOf(selectedService, item.id) !== undefined ? <em className={styles.drawnChip} title={t('loc.task.drawnHint')}>{t('loc.task.drawn')}</em> : null}
          <span className={styles.quantityField}><input type="number" min="0" step="any" inputMode="decimal" value={draftAllocations[key] ?? ''} readOnly={drawnOf(selectedService, item.id) !== undefined} onChange={(event) => { setAllocationMessage(''); setDraftAllocations((current) => ({ ...current, [key]: event.target.value })) }} placeholder="0" aria-label={t('loc.alloc.quantityFor', { name: item.name })} /><span>{selectedService?.unit || ''}</span></span>
        </span> : <span className={styles.groupLabel}>{t('loc.alloc.group')}</span>}
      </div>
      {!isCollapsed && children.map((child) => renderAllocationNode(child, depth + 1))}
    </div>
  }

  function clearSelectedAllocation() { if (!selectedServiceId) return; setDraftAllocations((current) => { const next = { ...current }; locations.forEach((location) => { const d = drawnOf(selectedService, location.id); next[`${selectedServiceId}:${location.id}`] = d !== undefined ? String(round2(d)) : '' }); return next }); setAllocationMessage(t('loc.alloc.cleared')) }

  async function saveAllocation() {
    if (!selectedService) return; if (overAllocated) { setAllocationMessage(t('loc.alloc.errOver')); return }
    setAllocationSaving(true); setAllocationMessage('')
    const desired = locations.filter((location) => !nonProductionTypes.has(location.location_type)).map((location) => ({ location, quantity: number(draftAllocations[`${selectedService.id}:${location.id}`]) })).filter((item) => item.quantity > 0)
    let serviceId = selectedService.id
    try { serviceId = await ensureActivity(selectedService); await writeAllocation(serviceId, desired.map((d) => ({ locationId: d.location.id, quantity: d.quantity }))); await reloadAllocations() } catch (e) { setAllocationMessage(e?.message || String(e)); setAllocationSaving(false); return }
    try { await history('scope_location_allocation_updated', 'Scope allocation updated', `${selectedService.service_name} was allocated by production location`, serviceId, { service_id: serviceId, service_name: selectedService.service_name, scope_quantity: selectedServiceTotal, allocated_quantity: draftSelectedTotal, unit: selectedService.unit, locations: desired.map((item) => ({ location_id: item.location.id, location_name: item.location.name, quantity: item.quantity })) }) } catch (historyError) { setAllocationMessage(historyError.message); setAllocationSaving(false); return }
    setAllocationMessage(t('loc.alloc.saved')); setAllocationSaving(false); router.refresh()
  }

  function ritsuScopeBox() {
    const { auto, manual, all: linked } = feedOf(selectedService)
    if (!ritsuLicensed) return <div className={styles.ritsuBox}><strong>{t('loc.ritsu.quantitiesTitle')}</strong><span>{t('loc.ritsu.locked')}</span></div>
    if (takeoffError) return <div className={styles.ritsuBox}><strong>{t('loc.ritsu.quantitiesTitle')}</strong><span className={styles.bad}>{takeoffError}</span></div>
    if (!takeoff) return <div className={styles.ritsuBox}><strong>{t('loc.ritsu.quantitiesTitle')}</strong><span>{t('loc.ritsu.loading')}</span></div>
    const fill = () => {
      const r = splitFor(selectedService)
      if (!r) return
      fillDraft(selectedService, r)
      setAllocationMessage(`${filledMessage(selectedService, r)} ${t('loc.ritsu.reviewThenSave')}`)
    }
    const saveLinks = async () => {
      setLinkSaving(true)
      try {
        const add = [...linkDraft].filter((id) => id !== auto?.id && !manual.some((l) => l.id === id))
        const remove = manual.filter((l) => !linkDraft.has(l.id)).map((l) => l.id)
        const activityId = add.length ? await ensureActivity(selectedService) : selectedService.id
        if (add.length) { const { error: e1 } = await supabase.from('takeoff_layers').update({ scope_activity_id: activityId }).in('id', add); if (e1) throw e1 }
        if (remove.length) { const { error: e2 } = await supabase.from('takeoff_layers').update({ scope_activity_id: null }).in('id', remove); if (e2) throw e2 }
        await refreshTakeoff(); setLinkOpen(false)
      } catch (e) { setAllocationMessage(e?.message || t('loc.ritsu.errLinks')) } finally { setLinkSaving(false) }
    }
    return <div className={styles.ritsuBox}>
      <div className={styles.ritsuHead}>
        <strong>{t('loc.ritsu.quantitiesTitle')}</strong>
        <span className={styles.muted} title={t('loc.rule.hint')}>{t('loc.rule.label')}: {t(`loc.rule.${selectedService.allocation_rule || defaultRuleFor(selectedService.takeoff_step)}`)}</span>
        <button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => { setLinkDraft(new Set(manual.map((l) => l.id))); setLinkOpen((v) => !v) }}>{linkOpen ? t('loc.ritsu.close') : t('loc.ritsu.chooseItems')}</button>
        <button type="button" className={`${ui.btnPrimary} ${ui.small}`} disabled={!linked.length} onClick={fill}>{t('loc.ritsu.fill')}</button>
      </div>
      <span>{linked.length ? t('loc.ritsu.fedBy', { items: linked.map((l) => l.name).join(', ') }) : t('loc.ritsu.notFed')}{auto ? ` ${t('loc.ritsu.fromScopeLine')}` : ''} {t('loc.ritsu.sharedWalls')}</span>
      {linkOpen ? <div className={styles.linkList}>
        {takeoff.layers.length ? takeoff.layers.map((l) => {
          const other = l.scope_activity_id && l.scope_activity_id !== selectedService.id ? scopeItems.find((x) => x.id === l.scope_activity_id) : null
          if (auto && l.id === auto.id) return <label key={l.id}><input type="checkbox" checked disabled /><i style={{ background: l.color }} /><span>{l.name}</span><small>{t('loc.ritsu.viaScopeLine')}</small></label>
          return <label key={l.id}><input type="checkbox" checked={linkDraft.has(l.id)} onChange={() => setLinkDraft((cur) => { const n = new Set(cur); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n })} /><i style={{ background: l.color }} /><span>{l.name}</span><small>{t(`loc.ritsu.kind.${l.kind === 'linear' ? 'linear' : l.kind === 'area' ? 'area' : 'count'}`)}{other ? ` · ${t('loc.ritsu.nowFeeds', { name: other.service_name })}` : ''}</small></label>
        }) : <span>{t('loc.ritsu.noItems')}</span>}
        <button type="button" className={`${ui.btnPrimary} ${ui.small}`} disabled={linkSaving} onClick={() => void saveLinks()}>{linkSaving ? t('loc.saving') : t('loc.ritsu.saveItems')}</button>
      </div> : null}
    </div>
  }

  function detail() {
    if (!selected) return <div className={styles.emptyDetail}>
      <div className={styles.illustration}><Image src="/lbs-icon.png" alt="" fill sizes="320px" style={{ objectFit: 'contain' }} /></div>
      <strong>{t('loc.selectTitle')}</strong>
      <p>{t('loc.selectText')}</p>
    </div>
    const sp = spatial[selected.id]
    return <div className={styles.detail}>
      <div className={styles.detailTop}>
        <span className={`${styles.mark} ${styles.markLarge} ${styles[`mark_${selected.location_type}`] || ''}`} aria-hidden="true">{SHORT[selected.location_type] || '·'}</span>
        <div className={styles.detailName}><small>{typeLabel(selected.location_type)}</small><h2>{selected.name}</h2></div>
        <div className={styles.detailActions}>
          <button type="button" className={`${ui.btnPrimary} ${ui.small}`} onClick={() => openAdd(selected.id, suggestedChildType(selected.location_type))}><Icon name="plus" size={16} strokeWidth={2.4} />{t('loc.addChild')}</button>
          <button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => openEdit(selected)}>{t('loc.edit')}</button>
          <button type="button" className={`${ui.btnDanger} ${ui.small}`} disabled={saving} onClick={() => removeLocation(selected)}>{t('loc.delete')}</button>
        </div>
      </div>
      <dl className={styles.facts}>
        <div><dt>{t('loc.parent')}</dt><dd>{parentName(selected.parent_id)}</dd></div>
        <div><dt>{t('loc.environment')}</dt><dd>{selected.environment_type || t('loc.notSet')}</dd></div>
        <div><dt>{t('loc.linkedScope')}</dt><dd>{t('loc.itemsCount', { count: selectedScope.length })}</dd></div>
      </dl>

      <h3 className={styles.sectionTitle}>{t('loc.scopeHere')}</h3>
      {selectedScope.length ? <ul className={styles.scopeList}>{selectedScope.map((item) => <li key={item.id}><span>{item.service_name}</span><b>{qty(item.allocatedQuantity)} {item.unit || ''}</b></li>)}</ul> : <p className={styles.dashed}>{t('loc.noScope')}</p>}

      <div className={styles.ritsuCard}>
        <div className={styles.ritsuHead}><strong>{t('loc.ritsu.drawingTitle')}</strong>{sp?.hasArea ? <b>{qty(sp.areaM2)} m²</b> : null}</div>
        {sp?.levels?.map((l) => <span key={l.id}>{t('loc.ritsu.floorLevel', { name: l.name, elevation: `${l.elevation >= 0 ? '+' : ''}${qty(l.elevation)}`, sheets: l.sheets })}</span>)}
        {sp?.zones?.map((z) => <span key={z.id} className={styles.zoneLine}><span><b>{z.name}</b> · {t(`loc.ritsu.zoneKind.${['block', 'zone', 'area', 'room'].includes(z.kind) ? z.kind : 'area'}`)}{z.level ? ` · ${z.level}` : ''}{z.sheet ? ` · ${z.sheet}` : ''}</span><span>{z.areaM2 != null ? `${qty(z.areaM2)} m²` : t('loc.ritsu.noScale')}</span></span>)}
        {!sp ? <span className={styles.muted}>{t('loc.ritsu.notDrawn')}</span> : null}
        <Link href={`/ritsuscope/${projectId}`} className={styles.ritsuLink}>{sp ? t('loc.ritsu.open') : t('loc.ritsu.draw')}</Link>
      </div>

      {selectedQrEligible ? (selected.qr_token ? <LocationQrCard location={selected} locationMap={locationMap} projectName={projectName} projectCode={projectCode} /> : <div className={styles.qrEmpty}>
        <strong>{t('loc.qr.title')}</strong>
        <span>{t('loc.qr.eligible')}</span>
        <button type="button" className={ui.btn} disabled={qrSaving} onClick={generateLocationQr}>{qrSaving ? t('loc.qr.generating') : t('loc.qr.generate')}</button>
      </div>) : null}

    </div>
  }

  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <Segments value={activeTab} onChange={(v) => { setActiveTab(v); setError('') }} items={[{ value: 'locations', label: t('loc.tabBreakdown') }, { value: 'allocation', label: t('loc.tabAllocation') }]} />
      <Link className={`${ui.btnGhost} ${ui.small}`} href={`/ritsuscope/${projectId}`}>{t('loc.openRitsuScope')}</Link>
      <Link className={`${ui.btnGhost} ${ui.small}`} href={`/projects/${projectId}/location-map/card-view`}>{t('loc.a4Cards')}</Link>
      {activeTab === 'locations' ? <div className={styles.toolbarEnd}>
        <label className={styles.search}><Icon name="search" size={17} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t('loc.search')} aria-label={t('loc.search')} /></label>
        <button type="button" className={ui.btnPrimary} onClick={() => openAdd('', 'floor')}><Icon name="plus" size={16} strokeWidth={2.4} />{t('loc.add')}</button>
      </div> : <span className={`${styles.toolbarEnd} ${styles.toolbarNote}`}>{t('loc.alloc.toolbarNote')}</span>}
    </div>
    {loadError ? <Notice>{t('loc.errLoad', { message: loadError })}</Notice> : null}
    {error && !modalOpen ? <Notice>{error}</Notice> : null}

    {activeTab === 'locations' ? <section className={styles.mainGrid}>
      <div className={`${ui.panel} ${styles.treePanel}`}>
        <div className={styles.rootRow}>
          <span className={`${styles.mark} ${styles.markRoot}`} aria-hidden="true"><Icon name="projects" size={16} /></span>
          <span className={styles.rootName}><strong>{projectName}</strong><small>{t('loc.rootSummary', { groups: counts.groups || 0, production: counts.production || 0 })}</small></span>
          <button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => openAdd('', 'floor')} aria-label={t('loc.add')}><Icon name="plus" size={16} /></button>
        </div>
        <div className={styles.treeBody}>
          {roots.length ? roots.map((item) => renderNode(item, 0)) : <div className={styles.treeEmpty}><strong>{t('loc.emptyTitle')}</strong><span>{t('loc.emptyText')}</span><button type="button" className={ui.btnPrimary} onClick={() => openAdd('', 'floor')}>{t('loc.addFirst')}</button></div>}
        </div>
      </div>
      <div className={`${ui.panel} ${styles.detailPanel}`}>{detail()}</div>
    </section> : <section className={styles.allocationGrid}>
      <aside className={`${ui.panel} ${styles.servicePanel}`}>
        <div className={styles.serviceHead}>
          <div><small>{t('loc.alloc.productionScope')}</small><strong>{t('loc.alloc.activities', { count: scopeItems.length })}</strong></div>
          <label className={styles.check}><input type="checkbox" checked={showAllocatedOnly} onChange={(event) => setShowAllocatedOnly(event.target.checked)} />{t('loc.alloc.allocatedOnly')}</label>
        </div>
        {ritsuLicensed && takeoff && scopeItems.some((s) => feedOf(s).all.length) ? <button type="button" className={`${ui.btnPrimary} ${ui.small} ${styles.bulkButton}`} onClick={openBulk}>{t('loc.bulk.button')}</button> : null}
        <label className={`${styles.search} ${styles.serviceSearch}`}><Icon name="search" size={17} /><input value={scopeSearch} onChange={(event) => setScopeSearch(event.target.value)} placeholder={t('loc.alloc.search')} aria-label={t('loc.alloc.search')} /></label>
        <div className={styles.serviceList}>
          {visibleScopeItems.length ? visibleScopeItems.map((item) => {
            const total = number(item.scope_quantity); const allocated = serviceTotals.get(item.id) || 0; const percent = total > 0 ? Math.min(100, (allocated / total) * 100) : 0
            const status = allocated <= 0 ? 'none' : total > 0 && allocated >= total - 0.000001 ? 'full' : 'partial'
            return <button type="button" key={item.id} className={`${styles.serviceCard} ${selectedServiceId === item.id ? styles.serviceCardOn : ''}`} onClick={() => { setSelectedServiceId(item.id); setAllocationMessage(''); setLinkOpen(false) }}>
              <span className={styles.serviceTop}><small>{item.service_code || t('loc.alloc.activity')}{item.source === 'scope' && !item.in_fieldop ? <i className={styles.notInFieldop} title={t('loc.alloc.notInFieldopHint')}>{t('loc.alloc.notInFieldop')}</i> : null}</small><em className={styles[`st_${status}`]}>{t(`loc.alloc.status.${status}`)}</em></span>
              <strong>{item.service_name}</strong>
              <span className={styles.serviceQty}>{qty(total)} {item.unit || ''}</span>
              <span className={styles.miniBar}><i style={{ width: `${percent}%` }} /></span>
              <small>{t('loc.alloc.allocatedQty', { value: `${qty(allocated)} ${item.unit || ''}` })}</small>
            </button>
          }) : <p className={styles.muted}>{scopeItems.length ? t('loc.alloc.noMatch') : t('loc.alloc.noScope')}</p>}
        </div>
      </aside>
      <div className={`${ui.panel} ${styles.allocationPanel}`}>{selectedService ? <>
        <div className={styles.allocationHead}>
          <div><small>{selectedService.service_code || t('loc.alloc.activity')} · {selectedService.unit || t('loc.alloc.noUnit')}</small><h2>{selectedService.service_name}</h2></div>
          <div className={styles.allocStats}>
            <div><span>{t('loc.alloc.scopeQty')}</span><b>{qty(selectedServiceTotal)} {selectedService.unit || ''}</b></div>
            <div><span>{t('loc.alloc.allocated')}</span><b>{qty(draftSelectedTotal)} {selectedService.unit || ''}</b></div>
            <div className={overAllocated ? styles.statBad : ''}><span>{t('loc.alloc.remaining')}</span><b>{qty(remaining)} {selectedService.unit || ''}</b></div>
          </div>
        </div>
        <div className={styles.progressBlock}>
          <div><strong className={overAllocated ? styles.bad : ''}>{overAllocated ? t('loc.alloc.over') : t('loc.alloc.percent', { pct: Math.min(100, allocationPercent).toFixed(0) })}</strong><span>{qty(draftSelectedTotal)} / {qty(selectedServiceTotal)} {selectedService.unit || ''}</span></div>
          <div className={`${styles.track} ${overAllocated ? styles.trackOver : ''}`}><i style={{ width: `${Math.min(100, allocationPercent)}%` }} /></div>
        </div>
        <div className={styles.allocationBody}>
          {ritsuScopeBox()}
          <div className={styles.allocationTreeHead}><span>{t('loc.alloc.location')}</span><span>{t('loc.alloc.quantity')}</span></div>
          {roots.length ? roots.map((item) => renderAllocationNode(item, 0)) : <p className={styles.muted}>{t('loc.alloc.noLocations')}</p>}
        </div>
        <div className={styles.allocationFoot}>
          <span className={allocationMessage ? (overAllocated ? styles.bad : styles.ok) : styles.muted}>
            {allocationMessage || t('loc.alloc.hint')}
            {selectedService && (() => {
              const pending = exteriorPending(splitFor(selectedService))
              if (!pending.length) return null
              const sum = pending.reduce((a, [, v]) => a + v, 0)
              return <> {t('loc.exterior.pending', { value: `${qty(sum)} ${selectedService.unit || ''}`.trim() })} <button type="button" className={ui.btn} disabled={allocationSaving} onClick={() => createExteriorLocations(pending.map(([k]) => k))}>{t('loc.exterior.create')}</button></>
            })()}
          </span>
          <div><button type="button" className={ui.btn} disabled={allocationSaving} onClick={clearSelectedAllocation}>{t('loc.alloc.clear')}</button><button type="button" className={ui.btnPrimary} disabled={allocationSaving || overAllocated} onClick={saveAllocation}>{allocationSaving ? t('loc.saving') : t('loc.alloc.save')}</button></div>
        </div>
      </> : <div className={styles.emptyDetail}><strong>{t('loc.alloc.selectTitle')}</strong><p>{t('loc.alloc.selectText')}</p></div>}</div>
    </section>}

    {bulk ? <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !bulkSaving) setBulk(null) }}>
      <section className={`${styles.dialog} ${styles.bulkDialog}`} role="dialog" aria-modal="true" aria-labelledby="bulk-title">
        <header className={styles.dialogHead}><div><h2 id="bulk-title">{t('loc.bulk.title')}</h2><p>{t('loc.bulk.help')}</p></div><button type="button" className={styles.close} onClick={() => !bulkSaving && setBulk(null)} aria-label={t('loc.close')}><Icon name="close" /></button></header>
        <div className={styles.bulkBody}>
          {bulk.rows.length ? <table className={styles.bulkTable}>
            <thead><tr><th>{t('loc.alloc.activity')}</th><th>{t('loc.bulk.allocated')}</th><th>{t('loc.bulk.outside')}</th><th>{t('loc.bulk.locations')}</th><th /></tr></thead>
            <tbody>{bulk.rows.map((x) => {
              const skip = x.saved && !bulk.replace
              const none = !x.planned.size
              return <tr key={x.service.id} className={skip || none ? styles.bulkSkip : ''}>
                <td><small>{x.service.service_code}</small> {x.service.service_name}</td>
                <td>{qty(x.allocated)} / {qty(x.r.total)} {x.service.unit || ''}</td>
                <td className={x.r.unallocated > 0.005 ? styles.bad : ''}>{qty(x.r.unallocated)}</td>
                <td>{x.planned.size}{x.drawn ? ` · ${t('loc.task.drawnCount', { count: x.drawn })}` : ''}</td>
                <td>{none ? t('loc.bulk.noZones') : skip ? t('loc.bulk.keepSaved') : x.saved ? t('loc.bulk.replace') : t('loc.bulk.new')}</td>
              </tr>
            })}</tbody>
          </table> : <p className={styles.muted}>{t('loc.bulk.nothing')}</p>}
          {bulk.rows.some((x) => !x.planned.size) ? <p className={styles.muted}>{t('loc.bulk.noZonesHint')}</p> : null}
          {bulk.rows.some((x) => x.saved) ? <label className={styles.check}><input type="checkbox" checked={bulk.replace} onChange={(event) => setBulk((b) => ({ ...b, replace: event.target.checked }))} />{t('loc.bulk.replaceSaved')}</label> : null}
        </div>
        <footer className={styles.dialogFoot}><button type="button" className={ui.btn} disabled={bulkSaving} onClick={() => setBulk(null)}>{t('loc.cancel')}</button><button type="button" className={ui.btnPrimary} disabled={bulkSaving || !bulk.rows.some((x) => x.planned.size > 0 && (!x.saved || bulk.replace))} onClick={() => void applyBulk()}>{bulkSaving ? t('loc.saving') : t('loc.bulk.confirm', { count: bulk.rows.filter((x) => x.planned.size > 0 && (!x.saved || bulk.replace)).length })}</button></footer>
      </section>
    </div> : null}

    {modalOpen ? <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }}>
      <form className={styles.dialog} onSubmit={saveLocation} role="dialog" aria-modal="true" aria-labelledby="location-dialog-title">
        <header className={styles.dialogHead}><div><h2 id="location-dialog-title">{form.id ? t('loc.form.editTitle') : t('loc.form.addTitle')}</h2><p>{t('loc.form.help')}</p></div><button type="button" className={styles.close} onClick={() => !saving && setModalOpen(false)} aria-label={t('loc.close')}><Icon name="close" /></button></header>
        <div className={styles.dialogBody}>
          <Field label={t('loc.form.type')}><select value={form.location_type} onChange={(event) => setForm((current) => ({ ...current, location_type: event.target.value }))}>{TYPES.map((type) => <option key={type} value={type}>{t(`loc.type.${type}`)}</option>)}</select></Field>
          <Field label={t('loc.form.name')}><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoFocus /></Field>
          <Field label={t('loc.form.parent')}><select value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))}><option value="">{t('loc.form.projectRoot', { name: projectName })}</option>{(() => { const blocked = form.id ? new Set([form.id, ...descendants(form.id)]) : new Set(); return locations.filter((item) => !blocked.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {typeLabel(item.location_type)}</option>) })()}</select></Field>
          <Field label={t('loc.form.environment')}><input value={form.environment_type} onChange={(event) => setForm((current) => ({ ...current, environment_type: event.target.value }))} placeholder={t('loc.form.environmentHint')} /></Field>
          {error ? <div className={styles.wide}><Notice>{error}</Notice></div> : null}
        </div>
        <footer className={styles.dialogFoot}><button type="button" className={ui.btn} onClick={() => !saving && setModalOpen(false)}>{t('loc.cancel')}</button><button type="submit" className={ui.btnPrimary} disabled={saving}>{saving ? t('loc.saving') : form.id ? t('loc.form.save') : t('loc.form.add')}</button></footer>
      </form>
    </div> : null}
  </div>
}
