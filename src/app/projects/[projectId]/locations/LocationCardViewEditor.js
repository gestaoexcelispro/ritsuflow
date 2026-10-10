'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { AppShell, Empty, Icon, Notice, ui } from '../../../fieldop/ui'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import { a4Template } from './LocationPrintCard'
import styles from './card-view.module.css'

const ASPECT = 1
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v))

export default function LocationCardViewEditor({ project, locations, userId }) {
  const t=useT('projects')
  const { language }=useLanguage()
  const supabase=useMemo(()=>createClient(),[])
  const [loaded,setLoaded]=useState(false)
  const frameRef=useRef(null),canvasRef=useRef(null),pdfRef=useRef(null),dragRef=useRef(null)
  const [documents,setDocuments]=useState([]),[documentId,setDocumentId]=useState(''),[pageNumber,setPageNumber]=useState(1),[pageCount,setPageCount]=useState(1)
  const [geometries,setGeometries]=useState([]),[selectedId,setSelectedId]=useState(locations[0]?.id||'')
  const [baseSize,setBaseSize]=useState({width:0,height:0}),[view,setView]=useState({zoom:1,x:0,y:0}),[savedView,setSavedView]=useState(null),[drawingUrl,setDrawingUrl]=useState('')
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')

  useEffect(()=>{loadDocuments()},[]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(documentId)loadPage()},[documentId,pageNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  // The card is framed on a RitsuScope sheet: its print area is kept in takeoff_sources.metadata.print_view.
  async function loadDocuments(){const {data,error:e}=await supabase.from('takeoff_sources').select('id,name,file_path,page_number,metadata').eq('project_id',project.id).eq('kind','pdf_page').order('sort_order').order('created_at');if(e){setError(e.message);setLoaded(true);return}const {data:zs}=await supabase.from('takeoff_zones').select('source_id').eq('project_id',project.id).not('location_id','is',null);const withZones=new Set((zs||[]).map(z=>z.source_id)),sheets=(data||[]).filter(d=>withZones.has(d.id));setDocuments(sheets);setDocumentId(sheets[0]?.id||'');setLoaded(true)}

  async function loadPage(){const doc=documents.find(d=>d.id===documentId);if(!doc)return;setLoading(true);setError('');setMessage('');try{const {data:signed,error:se}=await supabase.storage.from('takeoff-files').createSignedUrl(doc.file_path,120);if(se||!signed?.signedUrl)throw new Error(se?.message||t('loc.cardView.errAccess'));const res=await fetch(signed.signedUrl);if(!res.ok)throw new Error(t('loc.print.errDownload',{status:res.status}));const bytes=await res.arrayBuffer(),pdfjs=await import('pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';if(pdfRef.current?.destroy)await pdfRef.current.destroy().catch(()=>{});pdfRef.current=await pdfjs.getDocument({data:bytes}).promise;setPageCount(pdfRef.current.numPages);const safe=Math.min(Math.max(1,Number(doc.page_number)||1),pdfRef.current.numPages);const page=await pdfRef.current.getPage(safe),base=page.getViewport({scale:1}),scale=1500/base.width,vp=page.getViewport({scale}),dpr=Math.min(window.devicePixelRatio||1,2),canvas=canvasRef.current;canvas.width=Math.round(vp.width*dpr);canvas.height=Math.round(vp.height*dpr);canvas.style.width=`${vp.width}px`;canvas.style.height=`${vp.height}px`;await page.render({canvasContext:canvas.getContext('2d'),viewport:vp,transform:dpr===1?null:[dpr,0,0,dpr,0,0]}).promise;setDrawingUrl(canvas.toDataURL('image/png'));const size={width:vp.width,height:vp.height};setBaseSize(size);
      const pv=doc.metadata?.print_view||null;setSavedView(pv?.mode==='card_view'?pv:null);const {data:zs,error:ze}=await supabase.from('takeoff_zones').select('location_id,points,color').eq('source_id',doc.id).not('location_id','is',null);if(ze)throw ze;const g=(zs||[]).map(z=>({location_id:z.location_id,geometry:{points:(z.points||[]).map(p=>({x:p[0]/base.width,y:p[1]/base.height})),display:{color:z.color,fill_opacity:.35}}}));setGeometries(g);if(g.length&&!g.some(x=>x.location_id===selectedId))setSelectedId(g[0].location_id);requestAnimationFrame(()=>applySavedOrFit(size,pv));
    }catch(e){setError(e?.message||t('loc.cardView.errLoad'))}finally{setLoading(false)}}

  function frameSize(){const el=frameRef.current;return{width:Math.max(1,el?.clientWidth||900),height:Math.max(1,el?.clientHeight||900)}}
  function constrainView(next){if(!baseSize.width||!baseSize.height)return next;const frame=frameSize(),drawW=baseSize.width*next.zoom,drawH=baseSize.height*next.zoom;return{...next,x:drawW<=frame.width?(frame.width-drawW)/2:clamp(next.x,frame.width-drawW,0),y:drawH<=frame.height?(frame.height-drawH)/2:clamp(next.y,frame.height-drawH,0)}}
  function applySavedOrFit(size,saved){const frame=frameSize();if(saved?.mode==='card_view'&&saved.width>0&&saved.height>0){const zoom=Math.min(frame.width/(saved.width*size.width),frame.height/(saved.height*size.height));setView(constrainView({zoom,x:-saved.x*size.width*zoom,y:-saved.y*size.height*zoom}));return}const zoom=Math.min(frame.width/size.width,frame.height/size.height)*.92;setView(constrainView({zoom,x:(frame.width-size.width*zoom)/2,y:(frame.height-size.height*zoom)/2}))}
  function zoomAt(next){const frame=frameSize(),cx=frame.width/2,cy=frame.height/2,n=clamp(next,.15,8),wx=(cx-view.x)/view.zoom,wy=(cy-view.y)/view.zoom;setView(constrainView({zoom:n,x:cx-wx*n,y:cy-wy*n}))}
  function pointerDown(e){if(e.button!==0)return;e.preventDefault();dragRef.current={x:e.clientX,y:e.clientY,ox:view.x,oy:view.y};e.currentTarget.setPointerCapture?.(e.pointerId)}
  function pointerMove(e){if(!dragRef.current)return;const next={...view,x:dragRef.current.ox+e.clientX-dragRef.current.x,y:dragRef.current.oy+e.clientY-dragRef.current.y};setView(constrainView(next))}
  function pointerUp(e){dragRef.current=null;try{if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}
  function currentCrop(){if(!baseSize.width||!baseSize.height||!Number.isFinite(view.zoom)||view.zoom<=0)return null;const frame=frameSize(),rawX=(-view.x/view.zoom)/baseSize.width,rawY=(-view.y/view.zoom)/baseSize.height,rawW=(frame.width/view.zoom)/baseSize.width,rawH=(frame.height/view.zoom)/baseSize.height,x=clamp(rawX,0,1),y=clamp(rawY,0,1),width=Math.min(Math.max(rawW,.001),Math.max(.001,1-x)),height=Math.min(Math.max(rawH,.001),Math.max(.001,1-y));if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;return{x:Number(x.toFixed(6)),y:Number(y.toFixed(6)),width:Number(width.toFixed(6)),height:Number(height.toFixed(6))}}
  async function save(){const crop=currentCrop();if(!crop)return;setSaving(true);setError('');try{const doc=documents.find(d=>d.id===documentId),payload={mode:'card_view',...crop,aspect_ratio:ASPECT},metadata={...(doc?.metadata||{}),print_view:payload};const {error:e}=await supabase.from('takeoff_sources').update({metadata}).eq('id',documentId);if(e)throw e;setDocuments(v=>v.map(d=>d.id===documentId?{...d,metadata}:d));setSavedView(payload);setMessage(t('loc.cardView.saved'))}catch(e){setError(e?.message||t('loc.cardView.errSave'))}finally{setSaving(false)}}

  const selectedGeom=geometries.find(g=>g.location_id===selectedId)?.geometry,points=selectedGeom?.points||[],color=selectedGeom?.display?.color||'#008F84',opacity=Number(selectedGeom?.display?.fill_opacity??.35)
  const drawingStyle=baseSize.width?{width:baseSize.width,height:baseSize.height,transform:`translate3d(${view.x}px,${view.y}px,0) scale(${view.zoom})`,transformOrigin:'0 0'}:undefined
  const liveCrop=currentCrop()
  const previewDrawingStyle=liveCrop&&liveCrop.width>0&&liveCrop.height>0?{position:'absolute',left:`${-liveCrop.x/liveCrop.width*100}%`,top:`${-liveCrop.y/liveCrop.height*100}%`,width:`${100/liveCrop.width}%`,height:`${100/liveCrop.height}%`}:null

  const highlightable=locations.filter(l=>geometries.some(g=>g.location_id===l.id))
  const polygon=points.length>=3?<polygon points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill={color} fillOpacity={clamp(opacity,.2,.65)} stroke={color} strokeWidth=".004" vectorEffect="non-scaling-stroke"/>:null

  return <AppShell module="projects" active="locations" projectId={project.id} bare action={<Link className={ui.btn} href={`/projects/${project.id}/locations`}>{t('loc.cardView.back')}</Link>}>
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.title}><small>{t('loc.cardView.eyebrow')}</small><strong>{t('loc.cardView.title')}</strong></div>
        {documents.length ? <>
          <label className={styles.pick}><span>{t('loc.cardView.sheet')}</span><select value={documentId} onChange={e=>{setDocumentId(e.target.value);setPageNumber(1)}}>{documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className={styles.pick}><span>{t('loc.cardView.highlight')}</span><select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{highlightable.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <div className={styles.zoom}>
            <button type="button" className={`${ui.btn} ${ui.small}`} onClick={()=>zoomAt(view.zoom/1.15)} aria-label={t('loc.cardView.zoomOut')}>−</button>
            <strong>{Math.round(view.zoom*100)}%</strong>
            <button type="button" className={`${ui.btn} ${ui.small}`} onClick={()=>zoomAt(view.zoom*1.15)} aria-label={t('loc.cardView.zoomIn')}><Icon name="plus" size={16}/></button>
            <button type="button" className={`${ui.btn} ${ui.small}`} onClick={()=>applySavedOrFit(baseSize,null)}>{t('loc.cardView.fit')}</button>
            <button type="button" className={ui.btnPrimary} onClick={save} disabled={saving||!documentId}>{saving?t('loc.saving'):t('loc.cardView.save')}</button>
          </div>
        </> : null}
      </div>
      {error?<Notice>{error}</Notice>:message?<Notice tone="ok">{message}</Notice>:null}
      {loaded && !documents.length && !error ? <div className={ui.panel}><Empty title={t('loc.cardView.emptyTitle')} text={t('loc.cardView.emptyText')} action={<Link className={ui.btnPrimary} href={`/ritsuscope/${project.id}`}>{t('loc.ritsu.open')}</Link>}/></div> : null}
      <div className={styles.grid} hidden={loaded && !documents.length}>
        <section className={`${ui.panel} ${styles.card}`}>
          <h2>{t('loc.cardView.preview')}</h2>
          <div className={styles.sheet}>
            <img src={a4Template(language)} onError={e=>{if(!e.currentTarget.src.endsWith('/location-a4-picture.png'))e.currentTarget.src='/location-a4-picture.png'}} alt="" className={styles.sheetImg}/>
            <div className={styles.viewport}>{drawingUrl&&previewDrawingStyle?<div style={{...previewDrawingStyle,aspectRatio:'1 / 1'}}><img src={drawingUrl} alt="" className={styles.fill}/><svg viewBox="0 0 1 1" preserveAspectRatio="none" className={styles.fill}>{polygon}</svg></div>:null}</div>
          </div>
          <p className={styles.help}>{t('loc.cardView.previewHelp')}</p>
        </section>
        <section className={`${ui.panel} ${styles.card}`}>
          <h2>{t('loc.cardView.adjust')}</h2>
          <div ref={frameRef} className={styles.frame} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} style={{aspectRatio:String(ASPECT)}}>
            <div style={{...drawingStyle,position:'absolute'}}><canvas ref={canvasRef}/><svg viewBox="0 0 1 1" preserveAspectRatio="none" className={styles.fill}>{polygon}</svg></div>
            {loading?<div className={styles.loading}>{t('loc.cardView.loading')}</div>:null}
          </div>
          <p className={styles.help}>{t('loc.cardView.adjustHelp')} {savedView?t('loc.cardView.alreadySaved'):''}</p>
        </section>
      </div>
    </div>
  </AppShell>
}
