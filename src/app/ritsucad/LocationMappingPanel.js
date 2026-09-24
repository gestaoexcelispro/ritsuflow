'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function buildTree(locations) {
  const map = new Map()
  locations.forEach((location) => {
    const key = location.parent_id || 'root'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(location)
  })
  map.forEach((items) => items.sort((a, b) => Number(a.sequence_number || 0) - Number(b.sequence_number || 0) || String(a.name || '').localeCompare(String(b.name || ''))))
  return map
}

export default function LocationMappingPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const enabled = searchParams.get('mode') === 'location-mapping' && projectId && documentId

  const [locations, setLocations] = useState([])
  const [mapped, setMapped] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())
  const [selected, setSelected] = useState('')
  const [drawingMapId, setDrawingMapId] = useState('')
  const [draftBoundary, setDraftBoundary] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')

  const tree = useMemo(() => buildTree(locations), [locations])
  const selectedLocation = locations.find((location) => location.id === selected) || null
  const mappedCount = mapped.size
  const total = locations.length
  const percent = total ? Math.round((mappedCount / total) * 100) : 0
  const draftReady = Boolean(draftBoundary && draftBoundary.locationId === selected)

  useEffect(() => {
    if (!enabled) return
    let active = true

    ;(async () => {
      setLoading(true)
      setError('')

      const [{ data: locs, error: locationError }, { data: drawingMap, error: mapError }] = await Promise.all([
        supabase.from('locations').select('id,parent_id,name,location_type,sequence_number').eq('project_id', projectId).order('sequence_number', { ascending: true }),
        supabase.from('project_drawing_maps').select('id,root_location_id,page_number,drawing_type').eq('project_id', projectId).eq('document_id', documentId).eq('page_number', 1).maybeSingle(),
      ])

      if (!active) return

      if (locationError) {
        setError(locationError.message)
      } else {
        const nextLocations = locs || []
        setLocations(nextLocations)
        setExpanded(new Set(nextLocations.filter((item) => !item.parent_id).map((item) => item.id)))
        setSelected(nextLocations[0]?.id || '')
      }

      if (mapError) {
        setError((current) => current || mapError.message)
      } else if (drawingMap) {
        setDrawingMapId(drawingMap.id)
        const { data: geometries, error: geometryError } = await supabase.from('project_drawing_location_geometries').select('location_id').eq('drawing_map_id', drawingMap.id)
        if (!geometryError) setMapped(new Set((geometries || []).map((item) => item.location_id).filter(Boolean)))
      } else {
        setError('This drawing is not connected to a project drawing map yet.')
      }

      setLoading(false)
    })()

    return () => { active = false }
  }, [enabled, projectId, documentId])

  useEffect(() => {
    if (!enabled) return

    function handleBoundaryReady(event) {
      const detail = event?.detail || {}
      if (!detail.locationId || !Array.isArray(detail.points) || detail.points.length < 3) return
      setSelected(detail.locationId)
      setDraftBoundary(detail)
      setMessage(`Boundary ready for ${detail.name || 'selected location'}. Review it on the drawing, then click Save Boundary.`)
    }

    window.addEventListener('ritsucad:location-boundary-ready', handleBoundaryReady)
    return () => window.removeEventListener('ritsucad:location-boundary-ready', handleBoundaryReady)
  }, [enabled])

  function close() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('mode')
    params.delete('locationStep')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function toggle(id) {
    setExpanded((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectLocation(location) {
    setSelected(location.id)
    setDraftBoundary(null)
    setMessage(mapped.has(location.id) ? `${location.name} is already mapped. Use Find on Drawing to locate its boundary.` : `${location.name} selected. Click Map Boundary to draw its spatial boundary.`)
    window.dispatchEvent(new CustomEvent('ritsucad:location-selected', { detail: { locationId: location.id, name: location.name } }))
  }

  function startBoundary() {
    if (!selectedLocation) {
      setMessage('Select a location before mapping a boundary.')
      return
    }

    setDraftBoundary(null)
    window.dispatchEvent(new CustomEvent('ritsucad:location-map-start', {
      detail: { locationId: selectedLocation.id, name: selectedLocation.name, projectId, documentId },
    }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', code: 'Digit4', bubbles: true }))
    setMessage(`Boundary mode started for ${selectedLocation.name}. Draw the polygon and double-click to finish.`)
  }

  async function saveBoundary() {
    if (!draftReady || !drawingMapId || !selectedLocation) {
      setMessage('Finish drawing the boundary before saving it.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      project_id: projectId,
      drawing_map_id: drawingMapId,
      document_id: documentId,
      location_id: selectedLocation.id,
      page_number: Number(draftBoundary.pageNumber || 1),
      geometry_type: 'polygon',
      geometry: { points: draftBoundary.points },
      location_scope: 'macro',
    }

    const { error: saveError } = await supabase
      .from('project_drawing_location_geometries')
      .upsert(payload, { onConflict: 'drawing_map_id,location_id' })

    if (saveError) {
      setError(saveError.message)
      setMessage('The boundary could not be saved. Nothing was marked as mapped.')
      setSaving(false)
      return
    }

    setMapped((current) => new Set([...current, selectedLocation.id]))
    setDraftBoundary(null)
    setMessage(`${selectedLocation.name} boundary saved. This location is now mapped on the drawing.`)
    setSaving(false)

    window.dispatchEvent(new CustomEvent('ritsucad:location-boundary-saved', {
      detail: { locationId: selectedLocation.id, name: selectedLocation.name, points: draftBoundary.points },
    }))
  }

  function findOnDrawing() {
    if (!selectedLocation || !mapped.has(selectedLocation.id)) {
      setMessage('This location does not have a saved boundary on this drawing yet.')
      return
    }
    window.dispatchEvent(new CustomEvent('ritsucad:location-find', { detail: { locationId: selectedLocation.id, name: selectedLocation.name } }))
    setMessage(`Locating ${selectedLocation.name} on the drawing.`)
  }

  function renderBranch(parent = 'root', depth = 0) {
    return (tree.get(parent) || []).map((location) => {
      const children = tree.get(location.id) || []
      const open = expanded.has(location.id)
      const done = mapped.has(location.id)
      const active = selected === location.id
      const ownMatch = !query || String(location.name || '').toLowerCase().includes(query.toLowerCase())
      const childMatch = children.some((child) => String(child.name || '').toLowerCase().includes(query.toLowerCase()))
      if (query && !ownMatch && !childMatch) return null

      return <div key={location.id}>
        <button type="button" style={{ ...row, paddingLeft: 12 + depth * 18, ...(active ? selectedRow : {}) }} onClick={() => selectLocation(location)}>
          <span style={{ ...chevron, cursor: children.length ? 'pointer' : 'default' }} onClick={(event) => { event.stopPropagation(); if (children.length) toggle(location.id) }}>
            {children.length ? (open ? '▾' : '▸') : '◇'}
          </span>
          <span style={nodeIcon}>{depth === 0 ? '▥' : children.length ? '□' : '◇'}</span>
          <span style={text}><strong>{location.name}</strong><small style={type}>{location.location_type || 'Location'}</small></span>
          <span style={status(done)}>{done ? 'Mapped' : 'Not mapped'}</span>
        </button>
        {children.length && (open || query) ? renderBranch(location.id, depth + 1) : null}
      </div>
    })
  }

  if (!enabled) return null

  return <aside style={panel}>
    <div style={header}>
      <div><div style={title}>Spatial Location Model</div><div style={subtitle}>Map the project LBS directly onto the drawing</div></div>
      <button type="button" onClick={close} style={closeButton}>×</button>
    </div>

    <div style={workflow}>
      <span style={workflowStep}>1</span><strong>Select location</strong><span style={arrow}>→</span>
      <span style={workflowStep}>2</span><strong>Map boundary</strong><span style={arrow}>→</span>
      <span style={workflowStep}>3</span><strong>Save boundary</strong>
    </div>

    <div style={connectedBar}>
      <span style={check}>✓</span>
      <div style={connectedText}><strong>Connected to project LBS</strong><small>{mappedCount} of {total} locations mapped on this drawing</small></div>
      <span style={percentBadge}>{percent}%</span>
    </div>

    {message ? <div style={draftReady ? readyBox : messageBox}>{message}</div> : null}
    {error ? <div style={errorBox}>{error}</div> : null}

    <div style={searchWrap}><span style={searchIcon}>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project locations..." style={search} /></div>

    <div style={body}>
      {loading ? <div style={empty}>Loading project locations...</div> : locations.length === 0 ? <div style={empty}>No locations are available. Create the Location Breakdown Structure in Project Setup first.</div> : renderBranch()}
    </div>

    <div style={fixedBottom}>
      <div style={selectionCard}>
        <div style={selectionLabel}>ACTIVE LOCATION</div>
        <div style={selectionName}>{selectedLocation?.name || 'Select a location'}</div>
        <div style={selectionMeta}>{selectedLocation ? `${selectedLocation.location_type || 'Location'} · ${draftReady ? 'Boundary ready to save' : mapped.has(selectedLocation.id) ? 'Boundary mapped' : 'Boundary not mapped'}` : 'Choose a location from the project LBS above.'}</div>
      </div>

      <div style={actions}>
        {draftReady ? <>
          <button type="button" style={savePrimary} onClick={saveBoundary} disabled={saving}>{saving ? 'Saving…' : '✓ Save Boundary'}</button>
          <button type="button" style={secondary} onClick={startBoundary} disabled={saving}>Redraw</button>
        </> : <>
          <button type="button" style={primary} onClick={startBoundary} disabled={!selectedLocation}><span>◇</span>{mapped.has(selected) ? 'Remap Boundary' : 'Map Boundary'}</button>
          <button type="button" style={{ ...secondary, opacity: selectedLocation && mapped.has(selectedLocation.id) ? 1 : 0.45 }} onClick={findOnDrawing} disabled={!selectedLocation || !mapped.has(selectedLocation.id)}>Find on Drawing</button>
        </>}
      </div>

      <div style={footerNote}>{draftReady ? 'Review the boundary before saving. Saving persists the geometry to this project drawing.' : 'Boundary geometry is stored in drawing coordinates and linked to the selected LBS location.'}</div>
    </div>
  </aside>
}

const panel = { position:'fixed', top:156, right:28, bottom:64, width:430, maxHeight:'calc(100vh - 176px)', zIndex:80, display:'flex', flexDirection:'column', background:'#fff', border:'1px solid #aebfc8', borderRadius:8, boxShadow:'0 10px 30px rgba(15,52,70,.24)', fontFamily:'inherit', color:'#0d3347', overflow:'hidden' }
const header = { flex:'0 0 auto', minHeight:58, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 12px 0 16px', borderBottom:'1px solid #dce6eb' }
const title = { fontSize:16, fontWeight:900 }
const subtitle = { marginTop:3, fontSize:8.5, color:'#708894', fontWeight:700 }
const closeButton = { width:30, height:30, border:0, background:'#fff', color:'#315668', fontSize:19, cursor:'pointer' }
const workflow = { flex:'0 0 auto', minHeight:48, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'5px 10px', borderBottom:'1px solid #e3eaed', background:'#fbfdfd', fontSize:8.5, color:'#345d6e' }
const workflowStep = { flex:'0 0 20px', width:20, height:20, borderRadius:'50%', display:'grid', placeItems:'center', background:'#0aa3a0', color:'#fff', fontSize:8, fontWeight:900 }
const arrow = { color:'#9bafb8', fontSize:12 }
const connectedBar = { flex:'0 0 auto', margin:'9px 10px 8px', minHeight:42, display:'flex', alignItems:'center', gap:8, padding:'5px 10px', border:'1px solid #b7e5dc', borderRadius:5, background:'#eafaf6', color:'#087c70', fontSize:9 }
const connectedText = { minWidth:0, display:'flex', flexDirection:'column', lineHeight:1.25 }
const check = { flex:'0 0 22px', width:22, height:22, borderRadius:4, display:'grid', placeItems:'center', background:'#19b887', color:'#fff', fontSize:13, fontWeight:900 }
const percentBadge = { flex:'0 0 auto', marginLeft:'auto', minWidth:36, padding:'4px 5px', borderRadius:999, background:'#fff', textAlign:'center', fontSize:8.5, fontWeight:900 }
const messageBox = { flex:'0 0 auto', margin:'0 10px 8px', padding:'8px 10px', border:'1px solid #b9d9e4', borderRadius:5, background:'#f0f8fb', color:'#24596d', fontSize:9, lineHeight:1.4 }
const readyBox = { ...messageBox, border:'1px solid #8bd5c7', background:'#eafaf6', color:'#087c70', fontWeight:800 }
const searchWrap = { flex:'0 0 auto', position:'relative', margin:'0 10px 7px' }
const searchIcon = { position:'absolute', left:10, top:7, color:'#67838f', fontSize:16 }
const search = { width:'100%', height:33, boxSizing:'border-box', border:'1px solid #c8d7de', borderRadius:4, padding:'0 10px 0 31px', outline:'none', color:'#173f52', fontSize:9.5 }
const body = { flex:'1 1 auto', minHeight:72, overflowY:'auto', overscrollBehavior:'contain', margin:'0 10px', border:'1px solid #d9e4e8', borderRadius:4 }
const row = { width:'100%', minHeight:42, display:'flex', alignItems:'center', gap:7, paddingRight:10, border:0, borderBottom:'1px solid #edf2f4', background:'#fff', color:'#173f52', textAlign:'left', cursor:'pointer' }
const selectedRow = { background:'#e9f7f7', boxShadow:'inset 3px 0 0 #0aa3a0' }
const chevron = { width:11, color:'#2e657b', fontSize:10 }
const nodeIcon = { width:14, color:'#174e69', fontSize:13 }
const text = { display:'flex', flex:1, minWidth:0, flexDirection:'column', gap:1, fontSize:10 }
const type = { fontSize:8, color:'#8297a1', fontWeight:700, textTransform:'capitalize' }
const status = (done) => ({ padding:'3px 6px', borderRadius:999, background:done ? '#e5f8f5' : '#f1f4f5', color:done ? '#078d80' : '#84959d', fontSize:7.5, fontWeight:900, whiteSpace:'nowrap' })
const fixedBottom = { flex:'0 0 auto', background:'#fff', borderTop:'1px solid #e3eaed', boxShadow:'0 -5px 12px rgba(15,52,70,.04)' }
const selectionCard = { margin:'8px 10px 0', padding:'9px 11px', border:'1px solid #d5e2e7', borderRadius:5, background:'#fbfcfd' }
const selectionLabel = { fontSize:7.5, color:'#78909b', fontWeight:900, letterSpacing:'.08em' }
const selectionName = { marginTop:3, fontSize:11, color:'#123e52', fontWeight:900 }
const selectionMeta = { marginTop:2, fontSize:8.5, color:'#708894' }
const actions = { display:'flex', gap:7, padding:'8px 10px 5px' }
const primary = { flex:1, minWidth:0, height:36, border:0, borderRadius:4, background:'#056b88', color:'#fff', fontSize:9.5, fontWeight:900, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }
const savePrimary = { ...primary, background:'#078d80' }
const secondary = { flex:'0 0 112px', minWidth:112, height:36, border:'1px solid #b9ccd5', borderRadius:4, background:'#fff', color:'#17627c', fontSize:9, fontWeight:900, cursor:'pointer' }
const footerNote = { padding:'3px 12px 10px', color:'#7d919a', fontSize:7.8, lineHeight:1.35, whiteSpace:'normal', overflowWrap:'anywhere' }
const empty = { padding:18, color:'#718995', fontSize:10.5, lineHeight:1.5 }
const errorBox = { flex:'0 0 auto', margin:'0 10px 8px', padding:10, border:'1px solid #e3b5b5', background:'#fff5f5', color:'#9a4545', fontSize:9 }