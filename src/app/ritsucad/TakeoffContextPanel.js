'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function buildLocationRows(locations) {
  const children = new Map()
  locations.forEach((location) => { const key = location.parent_id || 'root'; if (!children.has(key)) children.set(key, []); children.get(key).push(location) })
  children.forEach((items) => items.sort((a,b) => Number(a.sequence_number||0)-Number(b.sequence_number||0) || String(a.name||'').localeCompare(String(b.name||''))))
  const rows=[]; const walk=(parentId,depth)=>{;(children.get(parentId)||[]).forEach((location)=>{rows.push({...location,depth});walk(location.id,depth+1)})}; walk('root',0); return rows
}

function buildScopeRows(scopes) {
  const children = new Map()
  scopes.forEach((scope) => { const key = scope.parent_scope_id || 'root'; if (!children.has(key)) children.set(key, []); children.get(key).push(scope) })
  children.forEach((items) => items.sort((a,b) => String(a.scope_code||'').localeCompare(String(b.scope_code||''),undefined,{numeric:true}) || String(a.scope_name||'').localeCompare(String(b.scope_name||''))))
  const rows=[]; const walk=(parentId,depth)=>{;(children.get(parentId)||[]).forEach((scope)=>{rows.push({...scope,depth});walk(scope.id,depth+1)})}; walk('root',0); return rows
}

export default function TakeoffContextPanel() {
  const router=useRouter(); const searchParams=useSearchParams(); const projectId=searchParams.get('projectId'); const documentId=searchParams.get('documentId'); const mappingMode=searchParams.get('mode')==='location-mapping'
  const [locations,setLocations]=useState([]); const [scopes,setScopes]=useState([]); const [locationId,setLocationId]=useState(''); const [scopeId,setScopeId]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [savedMessage,setSavedMessage]=useState(''); const [open,setOpen]=useState(false); const [collapsed,setCollapsed]=useState(false)
  const locationRows=useMemo(()=>buildLocationRows(locations),[locations]); const scopeRows=useMemo(()=>buildScopeRows(scopes),[scopes]); const selectedLocation=useMemo(()=>locations.find((item)=>item.id===locationId)||null,[locations,locationId]); const selectedScope=useMemo(()=>scopes.find((item)=>item.id===scopeId)||null,[scopes,scopeId]); const ready=Boolean(projectId&&documentId&&locationId)

  useEffect(()=>{function onOpen(){setOpen(true);setCollapsed(false)}function onClose(){setOpen(false)}window.addEventListener('ritsucad:open-takeoff-context',onOpen);window.addEventListener('ritsucad:close-takeoff-context',onClose);return()=>{window.removeEventListener('ritsucad:open-takeoff-context',onOpen);window.removeEventListener('ritsucad:close-takeoff-context',onClose)}},[])
  useEffect(()=>{if(!projectId||!documentId||mappingMode)return;let wasTakeoff=false;const sync=()=>{const active=[...document.querySelectorAll('.rfRibbonTabList > button.active')].find((button)=>(button.textContent||'').trim()==='Takeoff');const isTakeoff=Boolean(active);if(isTakeoff&&!wasTakeoff){setOpen(true);setCollapsed(false)}wasTakeoff=isTakeoff};sync();const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});return()=>observer.disconnect()},[projectId,documentId,mappingMode])
  useEffect(()=>{if(!projectId||mappingMode||!open)return;let active=true;(async()=>{setLoading(true);setError('');const [{data:locationData,error:locationError},{data:scopeData,error:scopeError}]=await Promise.all([supabase.from('locations').select('id,parent_id,name,location_type,sequence_number').eq('project_id',projectId).order('sequence_number',{ascending:true}),supabase.from('project_scopes').select('id,scope_code,scope_name,parent_scope_id,item_type,quantity,unit,status').eq('project_id',projectId).order('scope_code',{ascending:true})]);if(!active)return;if(locationError)setError(locationError.message);else setLocations(locationData||[]);if(scopeError)setError((current)=>current||scopeError.message);else setScopes(scopeData||[]);setLoading(false)})();return()=>{active=false}},[projectId,mappingMode,open])
  useEffect(()=>{if(!projectId||mappingMode)return;const detail={projectId,documentId,locationId:locationId||null,locationName:selectedLocation?.name||null,projectScopeId:scopeId||null,scopeCode:selectedScope?.scope_code||null,scopeName:selectedScope?.scope_name||null,scopeItemType:selectedScope?.item_type||null,scopeUnit:selectedScope?.unit||null,projectServiceId:null,serviceCode:null,serviceName:null,serviceUnit:null,ready};window.__RITSUCAD_TAKEOFF_CONTEXT__=detail;window.dispatchEvent(new CustomEvent('ritsucad:takeoff-context',{detail}))},[projectId,documentId,locationId,scopeId,selectedLocation,selectedScope,ready,mappingMode])
  useEffect(()=>{function onSaved(event){const detail=event.detail||{};setSavedMessage(`${detail.locationName||'Location'} · ${detail.scopeName||'Unmapped takeoff'} · ${Number(detail.quantity||0).toFixed(2)} ${detail.unit||''} saved`)}window.addEventListener('ritsucad:takeoff-saved',onSaved);return()=>window.removeEventListener('ritsucad:takeoff-saved',onSaved)},[])

  function openLocationMapping(){if(!projectId||!documentId)return;const params=new URLSearchParams(searchParams.toString());params.set('mode','location-mapping');router.push(`/ritsucad/project-document?${params.toString()}`)}

  if(!projectId||mappingMode||!open)return null

  return <aside style={collapsed?collapsedPanel:panel}>
    <div style={header}><div><div style={eyebrow}>PROJECT TAKEOFF</div><div style={title}>Takeoff Context</div></div><div style={{display:'flex',alignItems:'center',gap:7}}><span style={ready?readyBadge:setupBadge}>{ready?'Ready':'Setup'}</span><button type="button" onClick={()=>setCollapsed((v)=>!v)} style={collapseButton} title={collapsed?'Expand Takeoff Context':'Minimize Takeoff Context'}>{collapsed?'‹':'›'}</button><button type="button" onClick={()=>setOpen(false)} style={closeButton} title="Close Takeoff Context">×</button></div></div>
    {!collapsed&&<div style={body}>{loading?<div style={helper}>Loading project locations and contractual scope…</div>:<>
      <button type="button" onClick={openLocationMapping} style={mappingButton}>⌖ Map Locations on Drawing</button>
      <div style={mappingHelper}>Define or update the drawing boundary for an existing LBS location before using it for takeoff.</div>
      <label style={label}>Location</label><select value={locationId} onChange={(event)=>{setLocationId(event.target.value);setSavedMessage('')}} style={control}><option value="">Select LBS location…</option>{locationRows.map((location)=><option key={location.id} value={location.id}>{'— '.repeat(location.depth)}{location.name}</option>)}</select>
      <label style={label}>Contract Scope <span style={optional}>(optional)</span></label><select value={scopeId} onChange={(event)=>{setScopeId(event.target.value);setSavedMessage('')}} style={control}><option value="">Not linked to contract scope</option>{scopeRows.map((scope)=><option key={scope.id} value={scope.id}>{'— '.repeat(scope.depth)}{scope.scope_code?`${scope.scope_code} · `:''}{scope.scope_name}{scope.item_type==='item'?' · Item':' · Scope'}</option>)}</select>
      {ready?<div style={summary}><strong>{selectedLocation?.name}</strong><span> → </span><strong>{selectedScope?.scope_name||'Unmapped takeoff'}</strong><div style={summaryNote}>{selectedScope?'The takeoff will retain this Scope Management relationship.':'The takeoff will be saved without changing contractual Scope Management.'}</div></div>:<div style={helper}>Select where the work occurs. Contract Scope is optional so RitsuCAD can also quantify work that is not yet represented in Scope Management.</div>}
      {savedMessage&&<div style={success}>{savedMessage}</div>}{error&&<div style={errorBox}>{error}</div>}
    </>}</div>}
  </aside>
}

const panel={position:'fixed',top:126,right:370,width:320,zIndex:65,background:'#fff',border:'1px solid #cbd8df',borderRadius:10,boxShadow:'0 10px 30px rgba(15,52,70,.14)',fontFamily:'inherit',color:'#0d3347',overflow:'hidden'}
const collapsedPanel={...panel,width:235}
const header={display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'12px 13px',borderBottom:'1px solid #dce6eb'}
const eyebrow={fontSize:9,fontWeight:900,letterSpacing:'1.3px',color:'#008f8f'}
const title={marginTop:2,fontSize:16,fontWeight:900}
const setupBadge={border:'1px solid #d6e0e5',background:'#f5f8f9',color:'#647d89',borderRadius:999,padding:'4px 8px',fontSize:9,fontWeight:900}
const readyBadge={...setupBadge,border:'1px solid #9ed8d8',background:'#effafa',color:'#087f7f'}
const collapseButton={display:'grid',placeItems:'center',width:25,height:25,padding:0,border:'1px solid #d4e0e5',borderRadius:6,background:'#fff',color:'#52707e',fontSize:18,fontWeight:900,cursor:'pointer'}
const closeButton={...collapseButton,fontSize:16,fontWeight:700}
const body={padding:14}
const mappingButton={width:'100%',border:'1px solid #8fd5d5',borderRadius:7,background:'#effafa',color:'#087f7f',padding:'9px 10px',fontSize:11,fontWeight:900,cursor:'pointer'}
const mappingHelper={marginTop:6,marginBottom:10,fontSize:9.5,lineHeight:1.4,color:'#728a96'}
const label={display:'block',marginTop:8,marginBottom:5,fontSize:10,fontWeight:800,color:'#536f7d'}
const optional={fontWeight:600,color:'#81949d'}
const control={width:'100%',boxSizing:'border-box',minHeight:36,border:'1px solid #c9d8df',borderRadius:6,background:'#fff',color:'#173f52',padding:'7px 9px',fontSize:11.5,outline:'none'}
const helper={marginTop:10,fontSize:10.5,lineHeight:1.45,color:'#728a96'}
const summary={marginTop:12,padding:'10px 11px',border:'1px solid #9ed8d8',borderRadius:7,background:'#effafa',color:'#17656b',fontSize:11,lineHeight:1.5}
const summaryNote={marginTop:5,color:'#5c7d87',fontSize:10}
const success={marginTop:10,padding:'9px 10px',border:'1px solid #a9d9c4',borderRadius:6,background:'#f0fbf5',color:'#237a52',fontSize:10.5,fontWeight:800}
const errorBox={marginTop:10,padding:'9px 10px',border:'1px solid #efb0b0',borderRadius:6,background:'#fff3f3',color:'#a61b1b',fontSize:10.5,fontWeight:800}