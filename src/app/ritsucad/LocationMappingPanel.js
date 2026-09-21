'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const DRAWING_TYPES = [
  ['floor_plan', 'Floor Plan'],
  ['area_plan', 'Area Plan'],
  ['reflected_ceiling_plan', 'Reflected Ceiling Plan'],
  ['site_plan', 'Site Plan'],
  ['elevation', 'Elevation'],
  ['section', 'Section'],
  ['detail', 'Detail'],
  ['other', 'Other'],
]

function buildLocationRows(locations) {
  const children = new Map()
  locations.forEach(location => {
    const key = location.parent_id || 'root'
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(location)
  })
  children.forEach(items => items.sort((a, b) =>
    Number(a.sequence_number || 0) - Number(b.sequence_number || 0) ||
    String(a.name || '').localeCompare(String(b.name || ''))
  ))

  const rows = []
  const walk = (parentId, depth) => {
    ;(children.get(parentId) || []).forEach(location => {
      rows.push({ ...location, depth })
      walk(location.id, depth + 1)
    })
  }
  walk('root', 0)
  return rows
}

function parseSvgPoints(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(pair => {
      const [x, y] = pair.split(',').map(Number)
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    })
    .filter(Boolean)
}

function polygonSignature(points) {
  return points.map(point => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|')
}

function getRenderedCadPolygons() {
  return Array.from(document.querySelectorAll('svg polygon'))
    .map(element => parseSvgPoints(element.getAttribute('points')))
    .filter(points => points.length >= 3)
}

export default function LocationMappingPanel() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const enabled = mode === 'location-mapping' && projectId && documentId

  const [documentRecord, setDocumentRecord] = useState(null)
  const [locations, setLocations] = useState([])
  const [drawingType, setDrawingType] = useState('floor_plan')
  const [classificationLabel, setClassificationLabel] = useState('')
  const [rootLocationId, setRootLocationId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [mappingId, setMappingId] = useState(null)
  const [mappedLocationIds, setMappedLocationIds] = useState(new Set())
  const [loading, setLoading] = useState(Boolean(enabled))
  const [saving, setSaving] = useState(false)
  const [drawingLocation, setDrawingLocation] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const polygonSnapshotRef = useRef(new Set())

  const locationRows = useMemo(() => buildLocationRows(locations), [locations])
  const selectedLocation = useMemo(
    () => locations.find(location => location.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  )

  async function loadMappedLocations(mapId) {
    if (!mapId) {
      setMappedLocationIds(new Set())
      return
    }

    const { data, error: geometryError } = await supabase
      .from('project_drawing_location_geometries')
      .select('location_id')
      .eq('drawing_map_id', mapId)

    if (!geometryError) {
      setMappedLocationIds(new Set((data || []).map(item => item.location_id)))
    }
  }

  useEffect(() => {
    if (!enabled) return
    let active = true

    ;(async () => {
      setLoading(true)
      setError('')

      const [{ data: doc, error: docError }, { data: locationData, error: locationError }, { data: map, error: mapError }] = await Promise.all([
        supabase.from('project_documents').select('id,project_id,file_name,document_type').eq('id', documentId).eq('project_id', projectId).single(),
        supabase.from('locations').select('id,parent_id,name,location_type,sequence_number').eq('project_id', projectId).order('sequence_number', { ascending: true }),
        supabase.from('project_drawing_maps').select('id,drawing_type,classification_label,root_location_id,page_number').eq('project_id', projectId).eq('document_id', documentId).eq('page_number', 1).maybeSingle(),
      ])

      if (!active) return

      if (docError) setError(docError.message)
      else setDocumentRecord(doc)

      if (locationError) setError(current => current || locationError.message)
      else setLocations(locationData || [])

      if (mapError) {
        setError(current => current || mapError.message)
      } else if (map) {
        setMappingId(map.id)
        setDrawingType(map.drawing_type || 'floor_plan')
        setClassificationLabel(map.classification_label || '')
        setRootLocationId(map.root_location_id || '')
        await loadMappedLocations(map.id)
      }

      setLoading(false)
    })()

    return () => { active = false }
  }, [enabled, projectId, documentId])

  useEffect(() => {
    if (!enabled || !drawingLocation) return

    let cancelled = false

    async function saveCompletedPolygon() {
      await new Promise(resolve => window.setTimeout(resolve, 0))
      if (cancelled) return

      const polygons = getRenderedCadPolygons()
      const completed = polygons
        .map(points => ({ points, signature: polygonSignature(points) }))
        .filter(item => !polygonSnapshotRef.current.has(item.signature))
        .at(-1)

      if (!completed || completed.points.length < 3) {
        return
      }

      setSaving(true)
      setError('')
      setMessage('')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to save location geometry.')
        setSaving(false)
        setDrawingLocation(false)
        return
      }

      const payload = {
        project_id: projectId,
        drawing_map_id: mappingId,
        document_id: documentId,
        location_id: selectedLocationId,
        page_number: 1,
        geometry_type: 'polygon',
        geometry: {
          points: completed.points,
          source: 'ritsucad-native-polygon',
        },
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }

      const { error: saveError } = await supabase
        .from('project_drawing_location_geometries')
        .upsert(payload, { onConflict: 'drawing_map_id,location_id' })

      if (saveError) {
        setError(saveError.message)
      } else {
        setMappedLocationIds(current => new Set([...current, selectedLocationId]))
        setMessage(`${selectedLocation?.name || 'Location'} mapped successfully.`)
      }

      setSaving(false)
      setDrawingLocation(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setDrawingLocation(false)
        setMessage('Location mapping cancelled.')
        return
      }

      if (event.key === 'Enter') {
        saveCompletedPolygon()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelled = true
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, drawingLocation, mappingId, selectedLocationId, selectedLocation, projectId, documentId])

  async function saveClassification() {
    if (!enabled || saving) return
    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      project_id: projectId,
      document_id: documentId,
      page_number: 1,
      drawing_type: drawingType,
      classification_label: classificationLabel.trim() || null,
      root_location_id: rootLocationId || null,
      updated_at: new Date().toISOString(),
    }

    let result
    if (mappingId) {
      result = await supabase.from('project_drawing_maps').update(payload).eq('id', mappingId).select('id').single()
    } else {
      result = await supabase.from('project_drawing_maps').insert(payload).select('id').single()
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setMappingId(result.data.id)
      setMessage('Drawing classification saved to the project.')
      await loadMappedLocations(result.data.id)
    }
    setSaving(false)
  }

  function startLocationDrawing() {
    if (!mappingId) {
      setError('Save the drawing setup before mapping locations.')
      return
    }
    if (!selectedLocationId) {
      setError('Select a project location first.')
      return
    }

    polygonSnapshotRef.current = new Set(
      getRenderedCadPolygons().map(points => polygonSignature(points))
    )

    setError('')
    setMessage(`Trace ${selectedLocation?.name || 'the selected location'} on the drawing. Press Enter to finish the polygon or Esc to cancel.`)
    setDrawingLocation(true)

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: '4',
      code: 'Digit4',
      bubbles: true,
      cancelable: true,
    }))
  }

  if (!enabled) return null

  return (
    <aside style={panel}>
      <div style={header}>
        <div>
          <div style={eyebrow}>PROJECT LOCATION MAPPING</div>
          <div style={heading}>Configure Drawing</div>
        </div>
        <span style={badge}>Project Data</span>
      </div>

      {loading ? <div style={empty}>Loading project mapping...</div> : (
        <div style={body}>
          <section style={section}>
            <div style={label}>Drawing</div>
            <div style={documentName}>{documentRecord?.file_name || 'Project drawing'}</div>
            <div style={helper}>This PDF remains stored in Project Documents. Mapping data is saved against the shared project record.</div>
          </section>

          <section style={section}>
            <div style={sectionTitle}>1 · Classify this drawing</div>

            <label style={fieldLabel}>Drawing type</label>
            <select value={drawingType} onChange={event => setDrawingType(event.target.value)} style={control}>
              {DRAWING_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>

            <label style={fieldLabel}>Classification label</label>
            <input
              value={classificationLabel}
              onChange={event => setClassificationLabel(event.target.value)}
              placeholder="Example: Ground Floor"
              style={control}
            />

            <label style={fieldLabel}>Root location</label>
            <select value={rootLocationId} onChange={event => setRootLocationId(event.target.value)} style={control}>
              <option value="">Select project location...</option>
              {locationRows.map(location => (
                <option key={location.id} value={location.id}>
                  {'— '.repeat(location.depth)}{location.name} · {location.location_type}
                </option>
              ))}
            </select>
            <div style={helper}>The location comes from the project's shared Location Structure. RitsuCAD does not create a parallel location database.</div>

            <button type="button" onClick={saveClassification} disabled={saving} style={{ ...primaryButton, opacity: saving ? .6 : 1 }}>
              {saving ? 'Saving...' : mappingId ? 'Update Drawing Setup' : 'Save Drawing Setup'}
            </button>
          </section>

          <section style={{ ...section, ...nextSection }}>
            <div style={sectionTitle}>2 · Map locations on the drawing</div>

            <label style={fieldLabel}>Project location</label>
            <select value={selectedLocationId} onChange={event => setSelectedLocationId(event.target.value)} style={control} disabled={drawingLocation}>
              <option value="">Select location to map...</option>
              {locationRows.map(location => (
                <option key={location.id} value={location.id}>
                  {'— '.repeat(location.depth)}{location.name}{mappedLocationIds.has(location.id) ? ' ✓ Mapped' : ''}
                </option>
              ))}
            </select>

            <div style={helper}>Choose the existing project location that this polygon represents. Calibration is not required because the boundary uses RitsuCAD's native PDF coordinates.</div>

            <button
              type="button"
              onClick={startLocationDrawing}
              disabled={saving || drawingLocation}
              style={{ ...primaryButton, opacity: saving || drawingLocation ? .6 : 1 }}
            >
              {drawingLocation
                ? 'Drawing Location...'
                : mappedLocationIds.has(selectedLocationId)
                  ? 'Redraw Location Boundary'
                  : 'Draw Location Boundary'}
            </button>

            {drawingLocation && (
              <div style={drawingHint}>
                Polygon mode is active. Click each boundary point on the PDF, then press <strong>Enter</strong> to save the boundary. Press <strong>Esc</strong> to cancel.
              </div>
            )}

            <div style={flow}>Location Structure → PDF Geometry → FieldOp / PreCon</div>
          </section>

          {message && <div style={success}>{message}</div>}
          {error && <div style={errorBox}>{error}</div>}
        </div>
      )}
    </aside>
  )
}

const panel={position:'fixed',top:160,right:0,bottom:24,width:392,zIndex:80,display:'flex',flexDirection:'column',background:'#fff',borderLeft:'1px solid #cbd8df',boxShadow:'-8px 0 24px rgba(15,52,70,.10)',fontFamily:'inherit',color:'#0d3347'}
const header={display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'16px 18px',borderBottom:'1px solid #dce6eb'}
const eyebrow={fontSize:10,fontWeight:900,letterSpacing:'1.4px',color:'#008f8f'}
const heading={marginTop:3,fontSize:19,fontWeight:900}
const badge={border:'1px solid #9ed8d8',background:'#effafa',color:'#087f7f',borderRadius:999,padding:'5px 8px',fontSize:10,fontWeight:900}
const body={padding:16,overflowY:'auto'}
const section={paddingBottom:17,marginBottom:17,borderBottom:'1px solid #e3eaee'}
const sectionTitle={marginBottom:12,fontSize:13,fontWeight:900,color:'#123e53'}
const label={fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.7px',color:'#78909c'}
const documentName={marginTop:4,fontSize:13,fontWeight:900,wordBreak:'break-word'}
const fieldLabel={display:'block',marginTop:10,marginBottom:5,fontSize:10.5,fontWeight:800,color:'#536f7d'}
const control={width:'100%',boxSizing:'border-box',minHeight:36,border:'1px solid #c9d8df',borderRadius:6,background:'#fff',color:'#173f52',padding:'7px 9px',fontSize:11.5,outline:'none'}
const helper={marginTop:6,fontSize:10.5,lineHeight:1.45,color:'#728a96'}
const primaryButton={width:'100%',marginTop:14,border:0,borderRadius:7,background:'#079b9b',color:'#fff',padding:'10px 12px',fontSize:11.5,fontWeight:900,cursor:'pointer'}
const drawingHint={marginTop:10,padding:'10px 11px',border:'1px solid #8fd5d5',borderRadius:6,background:'#eefafa',color:'#17656b',fontSize:10.5,lineHeight:1.45}
const nextSection={borderBottom:0,marginBottom:0}
const flow={marginTop:10,padding:'9px 10px',borderRadius:6,background:'#f1f7f9',color:'#315c6e',fontSize:10.5,fontWeight:800}
const success={marginTop:10,padding:'9px 10px',border:'1px solid #a9d9c4',borderRadius:6,background:'#f0fbf5',color:'#237a52',fontSize:10.5,fontWeight:800}
const errorBox={marginTop:10,padding:'9px 10px',border:'1px solid #efb0b0',borderRadius:6,background:'#fff3f3',color:'#a61b1b',fontSize:10.5,fontWeight:800}
const empty={padding:20,color:'#718691',fontSize:11.5}
