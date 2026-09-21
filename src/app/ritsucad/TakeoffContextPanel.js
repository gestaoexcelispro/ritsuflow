'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function buildLocationRows(locations) {
  const children = new Map()
  locations.forEach((location) => {
    const key = location.parent_id || 'root'
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(location)
  })
  children.forEach((items) => items.sort((a, b) => Number(a.sequence_number || 0) - Number(b.sequence_number || 0) || String(a.name || '').localeCompare(String(b.name || ''))))
  const rows = []
  const walk = (parentId, depth) => {
    ;(children.get(parentId) || []).forEach((location) => {
      rows.push({ ...location, depth })
      walk(location.id, depth + 1)
    })
  }
  walk('root', 0)
  return rows
}

export default function TakeoffContextPanel() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const mappingMode = searchParams.get('mode') === 'location-mapping'
  const [locations, setLocations] = useState([])
  const [services, setServices] = useState([])
  const [locationId, setLocationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  const locationRows = useMemo(() => buildLocationRows(locations), [locations])
  const selectedLocation = useMemo(() => locations.find((item) => item.id === locationId) || null, [locations, locationId])
  const selectedService = useMemo(() => services.find((item) => item.id === serviceId) || null, [services, serviceId])
  const ready = Boolean(projectId && documentId && locationId && serviceId)

  useEffect(() => {
    if (!projectId || mappingMode) return
    let active = true
    ;(async () => {
      setLoading(true); setError('')
      const [{ data: locationData, error: locationError }, { data: serviceData, error: serviceError }] = await Promise.all([
        supabase.from('locations').select('id,parent_id,name,location_type,sequence_number').eq('project_id', projectId).order('sequence_number', { ascending: true }),
        supabase.from('project_services').select('id,service_code,service_name,unit,sequence_number,is_active').eq('project_id', projectId).eq('is_active', true).order('sequence_number', { ascending: true }),
      ])
      if (!active) return
      if (locationError) setError(locationError.message); else setLocations(locationData || [])
      if (serviceError) setError((current) => current || serviceError.message); else setServices(serviceData || [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [projectId, mappingMode])

  useEffect(() => {
    if (!projectId || mappingMode) return
    const detail = { projectId, documentId, locationId: locationId || null, locationName: selectedLocation?.name || null, projectServiceId: serviceId || null, serviceCode: selectedService?.service_code || null, serviceName: selectedService?.service_name || null, serviceUnit: selectedService?.unit || null, ready }
    window.__RITSUCAD_TAKEOFF_CONTEXT__ = detail
    window.dispatchEvent(new CustomEvent('ritsucad:takeoff-context', { detail }))
  }, [projectId, documentId, locationId, serviceId, selectedLocation, selectedService, ready, mappingMode])

  useEffect(() => {
    function onSaved(event) {
      const detail = event.detail || {}
      setSavedMessage(`${detail.locationName || 'Location'} · ${detail.serviceName || 'Scope'} · ${Number(detail.quantity || 0).toFixed(2)} ${detail.unit || ''} saved`)
    }
    window.addEventListener('ritsucad:takeoff-saved', onSaved)
    return () => window.removeEventListener('ritsucad:takeoff-saved', onSaved)
  }, [])

  if (!projectId || mappingMode) return null

  return (
    <aside style={panel}>
      <div style={header}><div><div style={eyebrow}>PROJECT TAKEOFF</div><div style={title}>Takeoff Context</div></div><span style={ready ? readyBadge : setupBadge}>{ready ? 'Ready' : 'Setup'}</span></div>
      <div style={body}>
        {loading ? <div style={helper}>Loading project locations and scope…</div> : <>
          <label style={label}>Location</label>
          <select value={locationId} onChange={(event) => { setLocationId(event.target.value); setSavedMessage('') }} style={control}>
            <option value="">Select LBS location…</option>
            {locationRows.map((location) => <option key={location.id} value={location.id}>{'— '.repeat(location.depth)}{location.name}</option>)}
          </select>
          <label style={label}>Scope activity</label>
          <select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSavedMessage('') }} style={control}>
            <option value="">Select scope activity…</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.service_code ? `${service.service_code} · ` : ''}{service.service_name}{service.unit ? ` · ${service.unit}` : ''}</option>)}
          </select>
          {ready ? <div style={summary}><strong>{selectedLocation?.name}</strong><span> → </span><strong>{selectedService?.service_name}</strong><div style={summaryNote}>Choose a RitsuCAD takeoff tool and measure the drawing. The calculated quantity will inherit this context.</div></div> : <div style={helper}>Select where the work occurs and what scope is being quantified before starting a project takeoff.</div>}
          {savedMessage && <div style={success}>{savedMessage}</div>}
          {error && <div style={errorBox}>{error}</div>}
        </>}
      </div>
    </aside>
  )
}

const panel={position:'fixed',top:160,right:16,width:320,zIndex:75,background:'#fff',border:'1px solid #cbd8df',borderRadius:10,boxShadow:'0 10px 30px rgba(15,52,70,.14)',fontFamily:'inherit',color:'#0d3347',overflow:'hidden'}
const header={display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid #dce6eb'}
const eyebrow={fontSize:9,fontWeight:900,letterSpacing:'1.3px',color:'#008f8f'}
const title={marginTop:2,fontSize:17,fontWeight:900}
const setupBadge={border:'1px solid #d6e0e5',background:'#f5f8f9',color:'#647d89',borderRadius:999,padding:'4px 8px',fontSize:9,fontWeight:900}
const readyBadge={...setupBadge,border:'1px solid #9ed8d8',background:'#effafa',color:'#087f7f'}
const body={padding:14}
const label={display:'block',marginTop:8,marginBottom:5,fontSize:10,fontWeight:800,color:'#536f7d'}
const control={width:'100%',boxSizing:'border-box',minHeight:36,border:'1px solid #c9d8df',borderRadius:6,background:'#fff',color:'#173f52',padding:'7px 9px',fontSize:11.5,outline:'none'}
const helper={marginTop:10,fontSize:10.5,lineHeight:1.45,color:'#728a96'}
const summary={marginTop:12,padding:'10px 11px',border:'1px solid #9ed8d8',borderRadius:7,background:'#effafa',color:'#17656b',fontSize:11,lineHeight:1.5}
const summaryNote={marginTop:5,color:'#5c7d87',fontSize:10}
const success={marginTop:10,padding:'9px 10px',border:'1px solid #a9d9c4',borderRadius:6,background:'#f0fbf5',color:'#237a52',fontSize:10.5,fontWeight:800}
const errorBox={marginTop:10,padding:'9px 10px',border:'1px solid #efb0b0',borderRadius:6,background:'#fff3f3',color:'#a61b1b',fontSize:10.5,fontWeight:800}
