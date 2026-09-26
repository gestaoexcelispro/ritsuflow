'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import styles from './location-map-workspace.module.css'

const COLORS = ['#008F84','#2F80ED','#8E5BEF','#E58A1F','#D94F70','#2E8B57','#6B7280']
const isPdf = (doc) => doc?.mime_type === 'application/pdf' || doc?.document_type === 'PDF' || doc?.file_name?.toLowerCase().endsWith('.pdf')
const pointsOf = (geometry) => Array.isArray(geometry?.points) ? geometry.points : []
const colorOf = (geometry) => geometry?.display?.color || '#008F84'

export default function LocationMapWorkspace({ projectId, userId, locations = [] }) {
  const supabase = useMemo(() => createClient(), [])
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const pdfRef = useRef(null)
  const renderTaskRef = useRef(null)
  const fileRef = useRef(null)
  const [documents,setDocuments] = useState([])
  const [documentId,setDocumentId] = useState('')
  const [pageNumber,setPageNumber] = useState(1)
  const [pageCount,setPageCount] = useState(1)
  const [mapId,setMapId] = useState('')
  const [geometries,setGeometries] = useState([])
  const [selectedId,setSelectedId] = useState(locations[0]?.id || '')
  const [draft,setDraft] = useState([])
  const [drawing,setDrawing] = useState(false)
  const [color,setColor] = useState(COLORS[0])
  const [loading,setLoading] = useState(false)
  const [saving,setSaving] = useState(false)
  const [uploading,setUploading] = useState(false)
  const [message,setMessage] = useState('')
  const [error,setError] = useState('')

  const locationMap = useMemo(() => new Map(locations.map(x => [x.id,x])),[locations])
  const mapped = useMemo(() => new Map(geometries.map(x => [x.location_id,x])),[geometries])
  const selected = locationMap.get(selectedId) || null

  useEffect(() => { loadDocuments() }, [projectId])
  useEffect(() => { if(documentId) loadPdfAndMap(); else { pdfRef.current=null; setGeometries([]); setMapId('') } }, [documentId,pageNumber])
  useEffect(() => { const row=mapped.get(selectedId); setColor(colorOf(row?.geometry)); setDraft([]); setDrawing(false) }, [selectedId,geometries])

  async function loadDocuments(){
    const {data,error:e}=await supabase.from('project_documents').select('id,file_name,storage_path,mime_type,document_type,created_at').eq('project_id',projectId).order('created_at',{ascending:false})
    if(e){setError(e.message);return}
    const pdfs=(data||[]).filter(isPdf);setDocuments(pdfs);setDocumentId(current=>current||pdfs[0]?.id||'')
  }

  async function loadPdfAndMap(){
    const doc=documents.find(x=>x.id===documentId); if(!doc)return
    setLoading(true);setError('');setMessage('')
    try{
      const {data:signed,error:se}=await supabase.storage.from('project-documents').createSignedUrl(doc.storage_path,120)
      if(se||!signed?.signedUrl)throw new Error(se?.message||'Unable to access this PDF.')
      const response=await fetch(signed.signedUrl); if(!response.ok)throw new Error(`Unable to download PDF (${response.status}).`)
      const bytes=await response.arrayBuffer()
      const pdfjs=await import('pdfjs-dist')
      if(!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      if(pdfRef.current?.destroy) await pdfRef.current.destroy().catch(()=>{})
      pdfRef.current=await pdfjs.getDocument({data:bytes}).promise
      setPageCount(pdfRef.current.numPages)
      const safePage=Math.min(Math.max(1,pageNumber),pdfRef.current.numPages)
      if(safePage!==pageNumber){setPageNumber(safePage);setLoading(false);return}
      await renderPage(safePage)
      const {data:dm,error:me}=await supabase.from('project_drawing_maps').select('id').eq('project_id',projectId).eq('document_id',documentId).eq('page_number',safePage).maybeSingle()
      if(me)throw me
      setMapId(dm?.id||'')
      if(dm?.id){
        const {data:g,error:ge}=await supabase.from('project_drawing_location_geometries').select('id,location_id,geometry,geometry_type,page_number').eq('drawing_map_id',dm.id).eq('page_number',safePage)
        if(ge)throw ge;setGeometries(g||[])
      }else setGeometries([])
    }catch(e){setError(e?.message||'The drawing could not be loaded.')}
    finally{setLoading(false)}
  }

  async function renderPage(pageNo){
    const canvas=canvasRef.current;if(!canvas||!pdfRef.current)return
    const page=await pdfRef.current.getPage(pageNo)
    const base=page.getViewport({scale:1}); const maxWidth=Math.max(600,Math.min(1100,stageRef.current?.clientWidth||1000)-24); const scale=maxWidth/base.width
    const viewport=page.getViewport({scale}); const dpr=Math.min(window.devicePixelRatio||1,2)
    canvas.width=Math.round(viewport.width*dpr);canvas.height=Math.round(viewport.height*dpr);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`
    renderTaskRef.current?.cancel?.()
    const task=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});renderTaskRef.current=task
    try{await task.promise}catch(e){if(e?.name!=='RenderingCancelledException')throw e}
  }

  async function ensureMap(){
    if(mapId)return mapId
    const {data,error:e}=await supabase.from('project_drawing_maps').insert({project_id:projectId,document_id:documentId,page_number:pageNumber,drawing_type:'floor_plan',created_by:userId}).select('id').single()
    if(e){if(e.code==='23505'){const {data:existing,error:ee}=await supabase.from('project_drawing_maps').select('id').eq('document_id',documentId).eq('page_number',pageNumber).single();if(ee)throw ee;setMapId(existing.id);return existing.id}throw e}
    setMapId(data.id);return data.id
  }

  function pointerPoint(event){const rect=event.currentTarget.getBoundingClientRect();return {x:Number(((event.clientX-rect.left)/rect.width).toFixed(6)),y:Number(((event.clientY-rect.top)/rect.height).toFixed(6))}}
  function addPoint(event){if(!drawing||!selectedId)return;setDraft(current=>[...current,pointerPoint(event)])}
  function closePolygon(){if(draft.length<3){setMessage('Add at least three points before closing the polygon.');return}setDrawing(false);setMessage('Polygon ready. Save the mapping to keep it.')}
  function startPolygon(){if(!selectedId)return;setDraft([]);setDrawing(true);setMessage(`Draw the boundary for ${selected?.name||'this location'}. Click each corner, then Close Polygon.`)}
  function undoPoint(){setDraft(current=>current.slice(0,-1))}

  async function saveMapping(){
    const points=draft.length>=3?draft:pointsOf(mapped.get(selectedId)?.geometry);if(!selectedId||points.length<3)return
    setSaving(true);setError('')
    try{
      const drawingMapId=await ensureMap();const geometry={points,coordinate_space:'normalized',display:{color,fill_opacity:.30}}
      const existing=mapped.get(selectedId)
      const payload={project_id:projectId,drawing_map_id:drawingMapId,document_id:documentId,location_id:selectedId,page_number:pageNumber,geometry_type:'polygon',geometry}
      const query=existing?supabase.from('project_drawing_location_geometries').update(payload).eq('id',existing.id):supabase.from('project_drawing_location_geometries').insert({...payload,created_by:userId})
      const {error:e}=await query;if(e)throw e
      setDraft([]);setDrawing(false);setMessage(`${selected?.name||'Location'} mapping saved.`);await loadPdfAndMap()
    }catch(e){setError(e?.message||'Unable to save the location mapping.')}
    finally{setSaving(false)}
  }

  async function removeMapping(){const row=mapped.get(selectedId);if(!row)return;if(!window.confirm(`Remove the saved polygon for ${selected?.name}?`))return;const{error:e}=await supabase.from('project_drawing_location_geometries').delete().eq('id',row.id);if(e){setError(e.message);return}setMessage('Mapping removed.');await loadPdfAndMap()}

  async function uploadPdf(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setError('Location Map accepts PDF drawings only.');return}
    if(file.size>50*1024*1024){setError('PDF must be 50 MB or smaller.');return}
    setUploading(true);setError('')
    try{
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${projectId}/${Date.now()}-${safe}`
      const{error:ue}=await supabase.storage.from('project-documents').upload(path,file,{contentType:'application/pdf',upsert:false});if(ue)throw ue
      const{data,error:de}=await supabase.from('project_documents').insert({project_id:projectId,file_name:file.name,storage_path:path,mime_type:'application/pdf',file_size:file.size,document_type:'PDF',uploaded_by:userId}).select('id,file_name,storage_path,mime_type,document_type,created_at').single()
      if(de){await supabase.storage.from('project-documents').remove([path]);throw de}
      setDocuments(current=>[data,...current]);setDocumentId(data.id);setPageNumber(1);setMessage('PDF uploaded. Select a location and draw its polygon.')
    }catch(e){setError(e?.message||'Unable to upload the PDF.')}
    finally{setUploading(false)}
  }

  const displayRows=geometries.filter(g=>pointsOf(g.geometry).length>=3)
  const activePoints=draft.length?draft:pointsOf(mapped.get(selectedId)?.geometry)

  return <section className={styles.workspace}>
    <aside className={styles.sidebar}>
      <div className={styles.sideHeader}><span>LOCATION MAP</span><strong>Spatial identity</strong><small>{mapped.size} of {locations.length} locations mapped on this page</small></div>
      <div className={styles.locationList}>{locations.map(loc=><button key={loc.id} type="button" className={`${styles.locationRow} ${selectedId===loc.id?styles.locationActive:''}`} onClick={()=>setSelectedId(loc.id)}><span>{mapped.has(loc.id)?'●':'○'}</span><strong>{loc.name}</strong><small>{loc.location_type}</small></button>)}</div>
    </aside>
    <div className={styles.mapPanel}>
      <div className={styles.mapToolbar}>
        <select value={documentId} onChange={e=>{setDocumentId(e.target.value);setPageNumber(1)}}><option value="">Select PDF drawing…</option>{documents.map(doc=><option key={doc.id} value={doc.id}>{doc.file_name}</option>)}</select>
        <label className={styles.uploadButton}>＋ {uploading?'Uploading…':'Upload PDF'}<input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={uploadPdf} disabled={uploading}/></label>
        <button type="button" disabled={!documentId||pageNumber<=1} onClick={()=>setPageNumber(p=>p-1)}>‹</button><span className={styles.pageLabel}>Page {pageNumber} / {pageCount}</span><button type="button" disabled={!documentId||pageNumber>=pageCount} onClick={()=>setPageNumber(p=>p+1)}>›</button>
        <div className={styles.spacer}/>
        <button type="button" className={styles.drawButton} disabled={!documentId||!selectedId} onClick={startPolygon}>Draw Polygon</button>
        <button type="button" disabled={!drawing||!draft.length} onClick={undoPoint}>Undo Point</button>
        <button type="button" disabled={!drawing||draft.length<3} onClick={closePolygon}>Close Polygon</button>
      </div>
      <div className={styles.actionBar}><div><strong>{selected?.name||'Select a location'}</strong><span>{drawing?'Drawing polygon':mapped.has(selectedId)?'Mapped on this page':'Not mapped on this page'}</span></div><div className={styles.colors}>{COLORS.map(c=><button key={c} type="button" aria-label={`Use ${c}`} className={color===c?styles.colorActive:''} style={{background:c}} onClick={()=>setColor(c)}/>)}</div><button type="button" className={styles.deleteButton} disabled={!mapped.has(selectedId)} onClick={removeMapping}>Remove</button><button type="button" className={styles.saveButton} disabled={saving||(!draft.length&&!mapped.has(selectedId))} onClick={saveMapping}>{saving?'Saving…':'Save Mapping'}</button></div>
      {error?<div className={styles.error}>{error}</div>:message?<div className={styles.message}>{message}</div>:null}
      <div className={styles.stageShell} ref={stageRef}>
        {!documentId?<div className={styles.empty}><strong>Select or upload a project PDF</strong><span>The drawing stays untouched. Location polygons are stored as a separate spatial overlay.</span></div>:<div className={`${styles.drawingStage} ${drawing?styles.drawingMode:''}`} onClick={addPoint}>
          <canvas ref={canvasRef}/>
          <svg className={styles.overlay} viewBox="0 0 1 1" preserveAspectRatio="none">
            {displayRows.filter(g=>g.location_id!==selectedId).map(g=><polygon key={g.id} points={pointsOf(g.geometry).map(p=>`${p.x},${p.y}`).join(' ')} fill={colorOf(g.geometry)} fillOpacity=".10" stroke="#6B7F8A" strokeOpacity=".55" strokeWidth=".002" vectorEffect="non-scaling-stroke"/>) }
            {activePoints.length>=2?<polyline points={activePoints.map(p=>`${p.x},${p.y}`).join(' ')} fill={activePoints.length>=3&&!drawing?color:'none'} fillOpacity=".30" stroke={color} strokeWidth=".003" vectorEffect="non-scaling-stroke"/>:null}
            {draft.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".006" fill="#fff" stroke={color} strokeWidth=".002" vectorEffect="non-scaling-stroke"/>)}
          </svg>
          {loading?<div className={styles.loading}>Loading drawing…</div>:null}
        </div>}
      </div>
    </div>
  </section>
}
