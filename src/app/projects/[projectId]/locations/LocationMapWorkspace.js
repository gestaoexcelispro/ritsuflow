'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import styles from './location-map-workspace.module.css'

const COLORS = ['#008F84','#2F80ED','#8E5BEF','#E58A1F','#D94F70','#2E8B57','#6B7280']
const SNAP_RADIUS_PX = 20
const CLOSE_RADIUS_PX = 16
const MIN_ZOOM = .20
const MAX_ZOOM = 6
const isPdf = (doc) => doc?.mime_type === 'application/pdf' || doc?.document_type === 'PDF' || doc?.file_name?.toLowerCase().endsWith('.pdf')
const pointsOf = (geometry) => Array.isArray(geometry?.points) ? geometry.points : []
const colorOf = (geometry) => geometry?.display?.color || '#008F84'
const clamp = (value,min,max) => Math.min(max,Math.max(min,value))

export default function LocationMapWorkspace({ projectId, userId, locations = [] }) {
  const supabase = useMemo(() => createClient(), [])
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const drawingRef = useRef(null)
  const pdfRef = useRef(null)
  const renderTaskRef = useRef(null)
  const panRef = useRef(null)
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
  const [snapEnabled,setSnapEnabled] = useState(true)
  const [snapPoint,setSnapPoint] = useState(null)
  const [viewport,setViewport] = useState({x:0,y:0,zoom:1})
  const [baseSize,setBaseSize] = useState({width:0,height:0})
  const [panning,setPanning] = useState(false)
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
  useEffect(() => { const row=mapped.get(selectedId); setColor(colorOf(row?.geometry)); setDraft([]); setDrawing(false); setSnapPoint(null) }, [selectedId,geometries])
  useEffect(() => {
    const shell=stageRef.current
    if(!shell)return
    const onWheel=(event)=>{
      if(!documentId)return
      event.preventDefault()
      event.stopPropagation()
      const factor=Math.exp(-event.deltaY*0.0015)
      applyZoom(viewport.zoom*factor,event.clientX,event.clientY)
    }
    shell.addEventListener('wheel',onWheel,{passive:false})
    return ()=>shell.removeEventListener('wheel',onWheel)
  },[documentId,viewport])

  async function loadDocuments(){
    const {data,error:e}=await supabase.from('project_documents').select('id,file_name,storage_path,mime_type,document_type,created_at').eq('project_id',projectId).order('created_at',{ascending:false})
    if(e){setError(e.message);return}
    const pdfs=(data||[]).filter(isPdf);setDocuments(pdfs);setDocumentId(current=>current||pdfs[0]?.id||'')
  }

  async function loadPdfAndMap(){
    const doc=documents.find(x=>x.id===documentId); if(!doc)return
    setLoading(true);setError('');setMessage('');setSnapPoint(null)
    try{
      const {data:signed,error:se}=await supabase.storage.from('project-documents').createSignedUrl(doc.storage_path,120)
      if(se||!signed?.signedUrl)throw new Error(se?.message||'Unable to access this PDF.')
      const response=await fetch(signed.signedUrl); if(!response.ok)throw new Error(`Unable to download PDF (${response.status}).`)
      const bytes=await response.arrayBuffer()
      const pdfjs=await import('pdfjs-dist/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      if(pdfRef.current?.destroy) await pdfRef.current.destroy().catch(()=>{})
      pdfRef.current=await pdfjs.getDocument({data:bytes}).promise
      setPageCount(pdfRef.current.numPages)
      const safePage=Math.min(Math.max(1,pageNumber),pdfRef.current.numPages)
      if(safePage!==pageNumber){setPageNumber(safePage);setLoading(false);return}
      const size=await renderPage(safePage)
      requestAnimationFrame(()=>fitDrawing(size))
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
    const canvas=canvasRef.current;if(!canvas||!pdfRef.current)return null
    const page=await pdfRef.current.getPage(pageNo)
    const base=page.getViewport({scale:1})
    const renderWidth=Math.max(900,Math.min(1500,base.width*1.7))
    const scale=renderWidth/base.width
    const pageViewport=page.getViewport({scale}); const dpr=Math.min(window.devicePixelRatio||1,2)
    canvas.width=Math.round(pageViewport.width*dpr);canvas.height=Math.round(pageViewport.height*dpr);canvas.style.width=`${pageViewport.width}px`;canvas.style.height=`${pageViewport.height}px`
    const size={width:pageViewport.width,height:pageViewport.height};setBaseSize(size)
    renderTaskRef.current?.cancel?.()
    const task=page.render({canvasContext:canvas.getContext('2d'),viewport:pageViewport,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});renderTaskRef.current=task
    try{await task.promise}catch(e){if(e?.name!=='RenderingCancelledException')throw e}
    return size
  }

  async function ensureMap(){
    if(mapId)return mapId
    const {data,error:e}=await supabase.from('project_drawing_maps').insert({project_id:projectId,document_id:documentId,page_number:pageNumber,drawing_type:'floor_plan',created_by:userId}).select('id').single()
    if(e){if(e.code==='23505'){const {data:existing,error:ee}=await supabase.from('project_drawing_maps').select('id').eq('document_id',documentId).eq('page_number',pageNumber).single();if(ee)throw ee;setMapId(existing.id);return existing.id}throw e}
    setMapId(data.id);return data.id
  }

  function rawPointerPoint(event){
    const rect=drawingRef.current?.getBoundingClientRect();if(!rect)return {x:0,y:0}
    return {x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)}
  }
  function distancePx(a,b,rect){return Math.hypot((a.x-b.x)*rect.width,(a.y-b.y)*rect.height)}
  function isDark(data,width,x,y){
    if(x<0||y<0||x>=width||y>=data.length/(width*4))return false
    const i=(y*width+x)*4;if(data[i+3]<70)return false
    return .2126*data[i]+.7152*data[i+1]+.0722*data[i+2] < 210
  }

  function findDrawingSnap(event){
    const raw=rawPointerPoint(event)
    if(!snapEnabled)return {point:raw,type:'free'}
    const rect=drawingRef.current?.getBoundingClientRect();if(!rect)return {point:raw,type:'free'}
    if(draft.length>=3 && distancePx(raw,draft[0],rect)<=CLOSE_RADIUS_PX)return {point:draft[0],type:'close'}
    const canvas=canvasRef.current;if(!canvas)return {point:raw,type:'free'}
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    const sx=canvas.width/rect.width,sy=canvas.height/rect.height
    const cx=Math.round(raw.x*canvas.width),cy=Math.round(raw.y*canvas.height)
    const rx=Math.max(5,Math.round(SNAP_RADIUS_PX*sx)),ry=Math.max(5,Math.round(SNAP_RADIUS_PX*sy))
    const left=Math.max(0,cx-rx),top=Math.max(0,cy-ry),right=Math.min(canvas.width-1,cx+rx),bottom=Math.min(canvas.height-1,cy+ry)
    const width=right-left+1,height=bottom-top+1;if(width<3||height<3)return {point:raw,type:'free'}
    let image;try{image=ctx.getImageData(left,top,width,height)}catch{return {point:raw,type:'free'}}
    let best=null,bestScore=Infinity,bestType='edge'
    const step=Math.max(1,Math.round(Math.min(sx,sy)))
    for(let y=0;y<height;y+=step){for(let x=0;x<width;x+=step){
      if(!isDark(image.data,width,x,y))continue
      const px=left+x,py=top+y,dist=Math.hypot((px-cx)/sx,(py-cy)/sy);if(dist>SNAP_RADIUS_PX)continue
      const arm=Math.max(3,Math.round(5*Math.min(sx,sy)))
      const horizontal=isDark(image.data,width,x-arm,y)||isDark(image.data,width,x+arm,y)
      const vertical=isDark(image.data,width,x,y-arm)||isDark(image.data,width,x,y+arm)
      const diag1=isDark(image.data,width,x-arm,y-arm)||isDark(image.data,width,x+arm,y+arm)
      const diag2=isDark(image.data,width,x+arm,y-arm)||isDark(image.data,width,x-arm,y+arm)
      const directions=[horizontal,vertical,diag1,diag2].filter(Boolean).length
      const corner=directions>=2
      const score=dist-(corner?10:0)
      if(score<bestScore){bestScore=score;best={x:px/canvas.width,y:py/canvas.height};bestType=corner?'corner':'edge'}
    }}
    return best?{point:best,type:bestType}:{point:raw,type:'free'}
  }

  function handlePointerMove(event){
    const pan=panRef.current
    if(pan){
      const dx=event.clientX-pan.x,dy=event.clientY-pan.y
      const nextX=pan.originX+dx,nextY=pan.originY+dy
      setViewport(v=>({...v,x:nextX,y:nextY}))
      return
    }
    if(!drawing){if(snapPoint)setSnapPoint(null);return}
    if(event.target.closest?.(`.${styles.drawingStage}`)){const snap=findDrawingSnap(event);setSnapPoint({...snap.point,type:snap.type})}
  }
  function handlePointerLeave(){if(drawing&&!panRef.current)setSnapPoint(null)}
  function beginPan(event){
    const middle=event.button===1;const leftPan=event.button===0&&!drawing
    if(!middle&&!leftPan)return
    event.preventDefault();event.stopPropagation()
    panRef.current={x:event.clientX,y:event.clientY,originX:viewport.x,originY:viewport.y};setPanning(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  function endPan(event){if(!panRef.current)return;panRef.current=null;setPanning(false);event.currentTarget.releasePointerCapture?.(event.pointerId)}
  function addPoint(event){
    if(panRef.current||event.button!==0||!drawing||!selectedId)return
    const snap=findDrawingSnap(event)
    if(snap.type==='close'&&draft.length>=3){setDrawing(false);setSnapPoint(null);setMessage('Polygon closed. Save the mapping to keep it.');return}
    const point={x:Number(snap.point.x.toFixed(6)),y:Number(snap.point.y.toFixed(6))};setDraft(current=>[...current,point])
  }

  function applyZoom(nextZoom,clientX,clientY){
    const shell=stageRef.current;if(!shell)return
    const next=clamp(nextZoom,MIN_ZOOM,MAX_ZOOM);if(Math.abs(next-viewport.zoom)<.001)return
    const rect=shell.getBoundingClientRect();const px=(clientX??(rect.left+rect.width/2))-rect.left;const py=(clientY??(rect.top+rect.height/2))-rect.top
    const worldX=(px-viewport.x)/viewport.zoom,worldY=(py-viewport.y)/viewport.zoom
    setViewport({zoom:next,x:px-worldX*next,y:py-worldY*next})
  }
  function fitDrawing(sizeOverride){
    const shell=stageRef.current;const size=sizeOverride||baseSize;if(!shell||!size?.width||!size?.height)return
    const pad=36,availableW=Math.max(100,shell.clientWidth-pad*2),availableH=Math.max(100,shell.clientHeight-pad*2)
    const next=clamp(Math.min(availableW/size.width,availableH/size.height),MIN_ZOOM,1.5)
    setViewport({zoom:next,x:(shell.clientWidth-size.width*next)/2,y:(shell.clientHeight-size.height*next)/2})
  }

  function closePolygon(){if(draft.length<3){setMessage('Add at least three points before closing the polygon.');return}setDrawing(false);setSnapPoint(null);setMessage('Polygon ready. Save the mapping to keep it.')}
  function startPolygon(){if(!selectedId)return;setDraft([]);setDrawing(true);setSnapPoint(null);setMessage(`Draw the boundary for ${selected?.name||'this location'}. Snap is ${snapEnabled?'ON':'OFF'}. Middle-drag pans while drawing.`)}
  function undoPoint(){setDraft(current=>current.slice(0,-1))}

  async function saveMapping(){
    const points=draft.length>=3?draft:pointsOf(mapped.get(selectedId)?.geometry);if(!selectedId||points.length<3)return
    setSaving(true);setError('')
    try{
      const drawingMapId=await ensureMap();const geometry={points,coordinate_space:'normalized',display:{color,fill_opacity:.30}}
      const existing=mapped.get(selectedId);const payload={project_id:projectId,drawing_map_id:drawingMapId,document_id:documentId,location_id:selectedId,page_number:pageNumber,geometry_type:'polygon',geometry}
      const query=existing?supabase.from('project_drawing_location_geometries').update(payload).eq('id',existing.id):supabase.from('project_drawing_location_geometries').insert({...payload,created_by:userId})
      const {error:e}=await query;if(e)throw e
      setDraft([]);setDrawing(false);setSnapPoint(null);setMessage(`${selected?.name||'Location'} mapping saved.`);await loadPdfAndMap()
    }catch(e){setError(e?.message||'Unable to save the location mapping.')}finally{setSaving(false)}
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
    }catch(e){setError(e?.message||'Unable to upload the PDF.')}finally{setUploading(false)}
  }

  const displayRows=geometries.filter(g=>pointsOf(g.geometry).length>=3)
  const activePoints=draft.length?draft:pointsOf(mapped.get(selectedId)?.geometry)
  const drawingStyle=baseSize.width?{width:baseSize.width,height:baseSize.height,transform:`translate3d(${viewport.x}px,${viewport.y}px,0) scale(${viewport.zoom})`}:undefined

  return <section className={styles.workspace}>
    <aside className={styles.sidebar}>
      <div className={styles.sideHeader}><span>LOCATION MAP</span><strong>Spatial identity</strong><small>{mapped.size} of {locations.length} locations mapped on this page</small></div>
      <div className={styles.locationList}>{locations.map(loc=><button key={loc.id} type="button" className={`${styles.locationRow} ${selectedId===loc.id?styles.locationActive:''}`} onClick={()=>setSelectedId(loc.id)}><span>{mapped.has(loc.id)?'●':'○'}</span><strong>{loc.name}</strong><small>{loc.location_type}</small></button>)}</div>
    </aside>
    <div className={styles.mapPanel}>
      <div className={styles.mapToolbar}>
        <select value={documentId} onChange={e=>{setDocumentId(e.target.value);setPageNumber(1)}}><option value="">Select PDF drawing…</option>{documents.map(doc=><option key={doc.id} value={doc.id}>{doc.file_name}</option>)}</select>
        <label className={styles.uploadButton}>＋ {uploading?'Uploading…':'Upload PDF'}<input type="file" accept="application/pdf,.pdf" onChange={uploadPdf} disabled={uploading}/></label>
        <button type="button" disabled={!documentId||pageNumber<=1} onClick={()=>setPageNumber(p=>p-1)}>‹</button><span className={styles.pageLabel}>Page {pageNumber} / {pageCount}</span><button type="button" disabled={!documentId||pageNumber>=pageCount} onClick={()=>setPageNumber(p=>p+1)}>›</button>
        <div className={styles.spacer}/>
        <div className={styles.zoomGroup}><button type="button" disabled={!documentId} onClick={()=>applyZoom(viewport.zoom/1.2)}>−</button><span>{Math.round(viewport.zoom*100)}%</span><button type="button" disabled={!documentId} onClick={()=>applyZoom(viewport.zoom*1.2)}>＋</button><button type="button" disabled={!documentId} onClick={()=>fitDrawing()}>Fit</button></div>
        <button type="button" className={snapEnabled?styles.snapOn:styles.snapOff} onClick={()=>{setSnapEnabled(v=>!v);setSnapPoint(null)}}>Snap {snapEnabled?'ON':'OFF'}</button>
        <button type="button" className={styles.drawButton} disabled={!documentId||!selectedId} onClick={startPolygon}>Draw Polygon</button>
        <button type="button" disabled={!drawing||!draft.length} onClick={undoPoint}>Undo Point</button>
        <button type="button" disabled={!drawing||draft.length<3} onClick={closePolygon}>Close Polygon</button>
      </div>
      <div className={styles.actionBar}><div><strong>{selected?.name||'Select a location'}</strong><span>{drawing?`Drawing polygon · Snap ${snapEnabled?'ON':'OFF'} · middle-drag to pan`:mapped.has(selectedId)?'Mapped on this page · drag anywhere to pan':'Not mapped on this page · drag anywhere to pan'}</span></div><div className={styles.colors}>{COLORS.map(c=><button key={c} type="button" aria-label={`Use ${c}`} className={color===c?styles.colorActive:''} style={{background:c}} onClick={()=>setColor(c)}/>)}</div><button type="button" className={styles.deleteButton} disabled={!mapped.has(selectedId)} onClick={removeMapping}>Remove</button><button type="button" className={styles.saveButton} disabled={saving||(!draft.length&&!mapped.has(selectedId))} onClick={saveMapping}>{saving?'Saving…':'Save Mapping'}</button></div>
      {error?<div className={styles.error}>{error}</div>:message?<div className={styles.message}>{message}</div>:null}
      <div className={`${styles.stageShell} ${panning?styles.panning:''}`} ref={stageRef} onPointerDown={beginPan} onPointerMove={handlePointerMove} onPointerUp={endPan} onPointerCancel={endPan} onPointerLeave={handlePointerLeave} onAuxClick={e=>e.preventDefault()}>
        {!documentId?<div className={styles.empty}><strong>Select or upload a project PDF</strong><span>The drawing stays untouched. Location polygons are stored as a separate spatial overlay.</span></div>:<div ref={drawingRef} style={drawingStyle} className={`${styles.drawingStage} ${drawing?styles.drawingMode:styles.panMode}`} onClick={addPoint}>
          <canvas ref={canvasRef}/>
          <svg className={styles.overlay} viewBox="0 0 1 1" preserveAspectRatio="none">
            {displayRows.filter(g=>g.location_id!==selectedId).map(g=><polygon key={g.id} points={pointsOf(g.geometry).map(p=>`${p.x},${p.y}`).join(' ')} fill={colorOf(g.geometry)} fillOpacity=".10" stroke="#6B7F8A" strokeOpacity=".55" strokeWidth=".002" vectorEffect="non-scaling-stroke"/>) }
            {activePoints.length>=2?<polyline points={activePoints.map(p=>`${p.x},${p.y}`).join(' ')} fill={activePoints.length>=3&&!drawing?color:'none'} fillOpacity=".30" stroke={color} strokeWidth=".003" vectorEffect="non-scaling-stroke"/>:null}
            {draft.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".006" fill="#fff" stroke={color} strokeWidth=".002" vectorEffect="non-scaling-stroke"/>)}
            {drawing&&snapPoint?<g className={styles.snapMarker}><circle cx={snapPoint.x} cy={snapPoint.y} r={snapPoint.type==='close'?'.011':'.008'} fill="none" stroke={snapPoint.type==='free'?'#8798A3':'#FF7A00'} strokeWidth=".0025" vectorEffect="non-scaling-stroke"/><line x1={snapPoint.x-.012} y1={snapPoint.y} x2={snapPoint.x+.012} y2={snapPoint.y} stroke={snapPoint.type==='free'?'#8798A3':'#FF7A00'} strokeWidth=".0015" vectorEffect="non-scaling-stroke"/><line x1={snapPoint.x} y1={snapPoint.y-.012} x2={snapPoint.x} y2={snapPoint.y+.012} stroke={snapPoint.type==='free'?'#8798A3':'#FF7A00'} strokeWidth=".0015" vectorEffect="non-scaling-stroke"/></g>:null}
          </svg>
          {loading?<div className={styles.loading}>Loading drawing…</div>:null}
        </div>}
      </div>
    </div>
  </section>
}
