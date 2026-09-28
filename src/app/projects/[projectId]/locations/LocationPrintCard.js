'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { locationQrPath } from './locationQr'
import styles from './location-print-card.module.css'

function humanLocationId(projectCode, location, locationMap) {
  const parts = [], visited = new Set(); let current = location
  while (current && !visited.has(current.id)) { visited.add(current.id); parts.unshift(current.name); current = current.parent_id ? locationMap.get(current.parent_id) : null }
  const slug = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return [slug(projectCode || 'PROJECT'), ...parts.map(slug)].filter(Boolean).join('-')
}
function hexToRgba(hex, opacity) { const clean=String(hex||'#008F84').replace('#',''),value=clean.length===3?clean.split('').map(x=>x+x).join(''):clean,parsed=Number.parseInt(value,16);return Number.isFinite(parsed)?`rgba(${(parsed>>16)&255},${(parsed>>8)&255},${parsed&255},${opacity})`:`rgba(0,143,132,${opacity})` }
function validView(value) { if(!value)return null;const x=Number(value.x),y=Number(value.y),width=Number(value.width),height=Number(value.height);if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;const sx=Math.max(0,Math.min(1,x)),sy=Math.max(0,Math.min(1,y));return{x:sx,y:sy,width:Math.max(0,Math.min(1-sx,width)),height:Math.max(0,Math.min(1-sy,height))} }
function typeLabel(value) { const labels={building:'Building',floor:'Floor',zone:'Zone / Area',area:'Area',room:'Room',custom:'Custom'};return labels[value]||value||'—' }
function ancestors(location, locationMap) { const result=[];const visited=new Set();let current=location?.parent_id?locationMap.get(location.parent_id):null;while(current&&!visited.has(current.id)){visited.add(current.id);result.unshift(current);current=current.parent_id?locationMap.get(current.parent_id):null}return result }
function calibrationLengthPx(a,b,size){return a&&b&&size?.width&&size?.height?Math.hypot((b.x-a.x)*size.width,(b.y-a.y)*size.height):0}
function polygonAreaPx(points,size){if(!points?.length||points.length<3||!size?.width||!size?.height)return 0;let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=(a.x*size.width)*(b.y*size.height)-(b.x*size.width)*(a.y*size.height)}return Math.abs(sum)/2}
function areaM2(points,calibration,size){const a=calibration?.point_a,b=calibration?.point_b,d=Number(calibration?.known_distance);if(!a||!b||!Number.isFinite(d)||d<=0)return null;const linePx=calibrationLengthPx(a,b,size);if(!linePx)return null;const area=polygonAreaPx(points,size)*Math.pow(d/linePx,2);return Number.isFinite(area)?area:null}

function LocationPlan({ mapData, loading, error, onAreaComputed }) {
  const canvasRef=useRef(null),[renderError,setRenderError]=useState('')
  useEffect(()=>{if(!mapData?.signedUrl||!mapData?.geometry?.points?.length){onAreaComputed?.(null);return}let cancelled=false,pdf=null
    async function render(){setRenderError('');try{const response=await fetch(mapData.signedUrl);if(!response.ok)throw new Error(`Drawing download failed (${response.status}).`);const bytes=await response.arrayBuffer(),pdfjs=await import('pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';pdf=await pdfjs.getDocument({data:bytes}).promise;const page=await pdf.getPage(Math.min(Math.max(1,Number(mapData.pageNumber)||1),pdf.numPages)),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:3000/base.width}),source=document.createElement('canvas');if(!cancelled)onAreaComputed?.(areaM2(mapData.geometry.points,mapData.scaleCalibration,{width:base.width,height:base.height}));source.width=Math.round(viewport.width);source.height=Math.round(viewport.height);const sctx=source.getContext('2d');await page.render({canvasContext:sctx,viewport}).promise;if(cancelled)return
      const points=mapData.geometry.points,color=mapData.geometry?.display?.color||'#008F84',opacity=Number.isFinite(Number(mapData.geometry?.display?.fill_opacity))?Number(mapData.geometry.display.fill_opacity):.35;sctx.save();sctx.beginPath();points.forEach((p,i)=>{const px=Number(p.x)*source.width,py=Number(p.y)*source.height;i?sctx.lineTo(px,py):sctx.moveTo(px,py)});sctx.closePath();sctx.fillStyle=hexToRgba(color,Math.min(.65,Math.max(.20,opacity)));sctx.fill();sctx.strokeStyle=color;sctx.lineWidth=Math.max(5,source.width*.003);sctx.stroke();sctx.restore()
      const cardView=validView(mapData.printView)||{x:0,y:0,width:1,height:1},sx=Math.round(cardView.x*source.width),sy=Math.round(cardView.y*source.height),sw=Math.max(1,Math.round(cardView.width*source.width)),sh=Math.max(1,Math.round(cardView.height*source.height)),canvas=canvasRef.current;if(!canvas||cancelled)return;canvas.width=1800;canvas.height=Math.max(1,Math.round(1800*sh/sw));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,sx,sy,sw,sh,0,0,canvas.width,canvas.height)
    }catch(e){if(!cancelled){onAreaComputed?.(null);setRenderError(e?.message||'Unable to render the location plan.')}}}render();return()=>{cancelled=true;pdf?.destroy?.().catch(()=>{})}},[mapData,onAreaComputed])
  if(loading)return <div className={styles.planStatus}>Loading mapped location…</div>
  if(error||renderError)return <div className={styles.planStatus}>Location plan unavailable</div>
  if(!mapData)return <div className={styles.planStatus}>No Location Map assigned</div>
  return <canvas ref={canvasRef} className={styles.planCanvas} aria-label="Mapped location on project plan" />
}

export default function LocationPrintCard({ location, locationMap, projectName, projectCode, mapData, mapLoading, mapError, onClose }) {
  const [calculatedArea,setCalculatedArea]=useState(null)
  if(!location?.qr_token)return null
  const qrPath=locationQrPath(location.qr_token),scanUrl=typeof window==='undefined'?qrPath:`${window.location.origin}${qrPath}`
  const locationId=humanLocationId(projectCode,location,locationMap)
  const lineage=ancestors(location,locationMap)
  const building=lineage.find(item=>item.location_type==='building')?.name||'—'
  const level=[...lineage].reverse().find(item=>item.location_type==='floor')?.name||'—'
  const locationColor=mapData?.geometry?.display?.color||'#008F84'
  const projectDisplay=[projectName,projectCode?`(${projectCode})`:null].filter(Boolean).join(' ')
  const areaDisplay=Number.isFinite(calculatedArea)?`${calculatedArea.toFixed(2)} m²`:'—'

  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="A4 location card preview">
    <div className={styles.toolbar}><div><strong>FieldOp Location Report</strong><span>{location.name}</span></div><div className={styles.toolbarActions}><button type="button" onClick={()=>window.print()}>Print / Save PDF</button><button type="button" className={styles.secondary} onClick={onClose}>Close</button></div></div>
    <main className={styles.sheet}>
      <img className={styles.background} src="/location-a4-picture.png" alt="" aria-hidden="true"/>
      <div className={`${styles.dynamicText} ${styles.locationCode}`}>{locationId}</div>
      <div className={`${styles.dynamicText} ${styles.locationName}`}>{location.name}</div>
      <div className={`${styles.dynamicText} ${styles.heroProject}`}>{projectDisplay||'—'}</div>
      <div className={`${styles.dynamicText} ${styles.projectValue}`}>{projectDisplay||'—'}</div>
      <div className={`${styles.dynamicText} ${styles.buildingValue}`}>{building}</div>
      <div className={`${styles.dynamicText} ${styles.levelValue}`}>{level}</div>
      <div className={`${styles.dynamicText} ${styles.typeValue}`}>{typeLabel(location.location_type)}</div>
      <div className={`${styles.dynamicText} ${styles.areaValue}`}>{areaDisplay}</div>
      <div className={styles.colorSwatch} style={{backgroundColor:locationColor}} aria-label={`Location color ${locationColor}`}/>
      <div className={`${styles.dynamicText} ${styles.descriptionValue}`}>{location.environment_type||'—'}</div>
      <div className={styles.locationPlan}><LocationPlan mapData={mapData} loading={mapLoading} error={mapError} onAreaComputed={setCalculatedArea}/></div>
      <div className={styles.qr}><QRCodeSVG value={scanUrl} size="100%" level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000"/></div>
    </main>
  </div>
}
