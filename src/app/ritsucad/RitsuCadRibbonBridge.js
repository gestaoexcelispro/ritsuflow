'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function RitsuCadRibbonBridge() {
  const router=useRouter(), pathname=usePathname(), searchParams=useSearchParams()
  const [fileSection,setFileSection]=useState(null), [toolbar,setToolbar]=useState(null)
  const projectId=searchParams.get('projectId'), documentId=searchParams.get('documentId'), viewId=searchParams.get('viewId')
  const mappingMode=searchParams.get('mode')==='location-mapping', hasProjectDrawing=Boolean(projectId&&documentId)

  useEffect(()=>{let cancelled=false,observer=null;const sync=()=>{if(cancelled)return;const t=document.querySelector('[class*="cadToolbar"]');const f=t?.querySelector('[class*="toolbarSection"]')||null;setToolbar(c=>c===t?c:t);setFileSection(c=>c===f?c:f)};sync();observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});return()=>{cancelled=true;observer?.disconnect()}},[pathname])
  useEffect(()=>{let cancelled=false,attempts=0,closed=false;const run=()=>{if(cancelled||closed)return;attempts+=1;const inspector=document.querySelector('[class*="_inspector__"]');if(inspector){const close=Array.from(inspector.querySelectorAll('button')).find(b=>{const title=(b.getAttribute('title')||'').toLowerCase(),label=(b.getAttribute('aria-label')||'').toLowerCase(),text=(b.textContent||'').trim().toLowerCase();return title.includes('close')||label.includes('close')||text==='×'});if(close){close.click();closed=true;return}}if(attempts<120)window.setTimeout(run,50)};run();return()=>{cancelled=true}},[pathname,documentId])

  function openLocationMapping(){if(!hasProjectDrawing)return;const p=new URLSearchParams(searchParams.toString());p.set('mode','location-mapping');window.dispatchEvent(new Event('ritsucad:close-takeoff-context'));router.replace(`${pathname}?${p.toString()}`,{scroll:false})}
  function openTakeoffContext(){if(!hasProjectDrawing)return;const p=new URLSearchParams(searchParams.toString());p.delete('mode');router.replace(`${pathname}?${p.toString()}`,{scroll:false});window.setTimeout(()=>window.dispatchEvent(new Event('ritsucad:open-takeoff-context')),0)}

  const projectDataSection=toolbar&&hasProjectDrawing?createPortal(<div data-ritsucad-project-data="true" style={{position:'relative',flex:'0 0 auto',display:'flex',alignItems:'flex-end',gap:2,padding:'15px 5px 1px 12px',marginLeft:5,borderLeft:'1px solid #d5e0e8'}}><span style={{position:'absolute',top:2,left:12,color:'#496579',fontSize:8,lineHeight:1,fontWeight:900,letterSpacing:'.07em',whiteSpace:'nowrap'}}>PROJECT DATA</span><RibbonButton icon="▤" label="Views" onClick={()=>window.dispatchEvent(new Event('ritsucad:open-drawing-views-command'))} title="Open saved drawing views"/><RibbonButton icon="✓" label={viewId?'Save View':'Save As'} onClick={()=>window.dispatchEvent(new Event('ritsucad:save-drawing-view'))} title={viewId?'Save the current drawing view':'Save the current geometry as a drawing view'}/><RibbonButton icon="⌖" label="Locations" active={mappingMode} onClick={openLocationMapping} title="Map existing LBS locations on this drawing"/><RibbonButton icon="▦" label="Takeoff" onClick={openTakeoffContext} title="Open project takeoff context"/></div>,toolbar):null

  const projectDrawingButton=fileSection&&!hasProjectDrawing?createPortal(<RibbonButton icon="▣" label="Project Drawing" onClick={()=>window.dispatchEvent(new Event('ritsucad:open-project-drawing'))} title="Open a PDF drawing stored in a RitsuFlow project" wide/>,fileSection):null
  return <>{projectDrawingButton}{projectDataSection}</>
}

function RibbonButton({icon,label,onClick,title,active=false,wide=false}){return <button type="button" onClick={onClick} title={title} style={{height:42,minHeight:42,minWidth:wide?86:58,padding:'3px 7px',border:active?'1px solid #73d1cc':'1px solid #b9cbd5',borderRadius:6,background:active?'#e8faf8':'#fff',color:active?'#007f79':'#173e52',display:'inline-flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,font:'inherit',fontSize:7,lineHeight:1.05,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}><span aria-hidden="true" style={{fontSize:14,lineHeight:1}}>{icon}</span><span>{label}</span></button>}
