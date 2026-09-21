'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function LocationMappingPanel() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')

  const enabled = mode === 'location-mapping' && projectId && documentId

  const [document, setDocument] = useState(null)
  const [locations, setLocations] = useState([])
  const [drawingType, setDrawingType] = useState('floor_plan')
  const [classificationLabel, setClassificationLabel] = useState('')
  const [rootLocationId, setRootLocationId] = useState('')
  const [mappingId, setMappingId] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const locationRows = useMemo(() => buildLocationRows(locations), [locations])

  useEffect(() => {
    if (!enabled) return
    let active = true

    ;(async () => {
      setLoading(true)
      setError('')

      const [{ data: doc, error: docError }, { data: locationData, error: locationError }, { data: map, error: mapError }] = await Promise.all([
        supabase
          .from('project_documents')
          .select('id,project_id,file_name,document_type')
          .eq('id', documentId)
          .eq('project_id', projectId)
          .single(),
        supabase
          .from('locations')
          .select('id,parent_id,name,location_type,sequence_number')
          .eq('project_id', projectId)
          .order('sequence_number', { ascending: true }),
        supabase
          .from('project_drawing_maps')
          .select('id,drawing_type,classification_label,root_location_id')
          .eq('project_id', projectId)
          .eq('document_id', documentId)
          .eq('page_number', 1)
          .maybeSingle(),
      ])

      if (!active) return

      if (docError) setError(docError.message)
      else setDocument(doc)

      if (locationError) setError(current => current || locationError.message)
      else setLocations(locationData || [])

      if (!mapError && map) {
        setMappingId(map.id)
        setDrawingType(map.drawing_type || 'floor_plan')
        setClassificationLabel(map.classification_label || '')
        setRootLocationId(map.root_location_id || '')
      }

      setLoading(false)
    })()

    return () => { active = false }
  }, [enabled, projectId, documentId])

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
      result = await supabase
        .from('project_drawing_maps')
        .update(payload)
        .eq('id', mappingId)
        .select('id')
        .single()
    } else {
      result = await supabase
        .from('project_drawing_maps')
        .insert(payload)
        .select('id')
        .single()
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setMappingId(result.data.id)
      setMessage('Drawing classification saved to the project.')
    }
    setSaving(false)
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

      {loading ? (
        <div style={empty}>Loading project mapping...</div>
      ) : (
        <div style={body}>
          <section style={section}>
            <div style={label}>Drawing</div>
            <div style={documentName}>{document?.file_name || 'Project drawing'}</div>
            <div style={helper}>This PDF remains stored in Project Documents. Mapping data is saved against the shared project record.</div>
          </section>

          <section style={section}>
            <div style={sectionTitle}>1 · Classify this drawing</div>

            <label style={fieldLabel}>Drawing type</label>
            <select value={drawingType} onChange={e => setDrawingType(e.target.value)} style={control}>
              {DRAWING_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>

            <label style={fieldLabel}>Classification label</label>
            <input
              value={classificationLabel}
              onChange={e => setClassificationLabel(e.target.value)}
              placeholder="Example: Ground Floor"
              style={control}
            />

            <label style={fieldLabel}>Root location</label>
            <select value={rootLocationId} onChange={e => setRootLocationId(e.target.value)} style={control}>
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
            <div style={nextTitle}>Location geometry is next</div>
            <div style={helper}>After the drawing setup is saved, the next operation will let you select a project location and trace its boundary directly on the PDF using RitsuCAD's native polygon geometry.</div>
            <div style={flow}>Location Structure → PDF Geometry → FieldOp / PreCon</div>
          </section>

          {message && <div style={success}>{message}</div>}
          {error && <div style={errorBox}>{error}</div>}
        </div>
      )}
    </aside>
  )
}

const panel = {
  position: 'fixed',
  top: 160,
  right: 0,
  bottom: 24,
  width: 392,
  zIndex: 80,
  display: 'flex',
  flexDirection: 'column',
  background: '#ffffff',
  borderLeft: '1px solid #cbd8df',
  boxShadow: '-8px 0 24px rgba(15, 52, 70, .10)',
  fontFamily: 'inherit',
  color: '#0d3347',
}
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid #dce6eb' }
const eyebrow = { fontSize: 10, fontWeight: 900, letterSpacing: '1.4px', color: '#008f8f' }
const heading = { marginTop: 3, fontSize: 19, fontWeight: 900 }
const badge = { border: '1px solid #9ed8d8', background: '#effafa', color: '#087f7f', borderRadius: 999, padding: '5px 8px', fontSize: 10, fontWeight: 900 }
const body = { padding: 16, overflowY: 'auto' }
const section = { paddingBottom: 17, marginBottom: 17, borderBottom: '1px solid #e3eaee' }
const sectionTitle = { marginBottom: 12, fontSize: 13, fontWeight: 900, color: '#123e53' }
const label = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.7px', color: '#78909c' }
const documentName = { marginTop: 4, fontSize: 13, fontWeight: 900, wordBreak: 'break-word' }
const fieldLabel = { display: 'block', marginTop: 10, marginBottom: 5, fontSize: 10.5, fontWeight: 800, color: '#536f7d' }
const control = { width: '100%', boxSizing: 'border-box', minHeight: 36, border: '1px solid #c9d8df', borderRadius: 6, background: '#fff', color: '#173f52', padding: '7px 9px', fontSize: 11.5, outline: 'none' }
const helper = { marginTop: 6, fontSize: 10.5, lineHeight: 1.45, color: '#728a96' }
const primaryButton = { width: '100%', marginTop: 14, border: 0, borderRadius: 7, background: '#079b9b', color: '#fff', padding: '10px 12px', fontSize: 11.5, fontWeight: 900, cursor: 'pointer' }
const nextSection = { borderBottom: 0, marginBottom: 0 }
const nextTitle = { fontSize: 12, fontWeight: 900, color: '#284f61' }
const flow = { marginTop: 10, padding: '9px 10px', borderRadius: 6, background: '#f1f7f9', color: '#315c6e', fontSize: 10.5, fontWeight: 800 }
const success = { marginTop: 10, padding: '9px 10px', border: '1px solid #a9d9c4', borderRadius: 6, background: '#f0fbf5', color: '#237a52', fontSize: 10.5, fontWeight: 800 }
const errorBox = { marginTop: 10, padding: '9px 10px', border: '1px solid #efb0b0', borderRadius: 6, background: '#fff3f3', color: '#a61b1b', fontSize: 10.5, fontWeight: 800 }
const empty = { padding: 20, color: '#718691', fontSize: 11.5 }
