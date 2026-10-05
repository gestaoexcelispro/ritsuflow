'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { locationQrPath } from './locationQr'
import styles from './location-print-card.module.css'
import { ui } from '../../../fieldop/ui'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'

/** A4 template picture per language (labels are part of the picture). English is the fallback. */
export function a4Template(language) { return language === 'es' || language === 'pt-BR' ? `/location-a4-picture-${language}.png` : '/location-a4-picture.png' }

function humanLocationId(projectCode, location, locationMap) {
  const parts = [], visited = new Set(); let current = location
  while (current && !visited.has(current.id)) { visited.add(current.id); parts.unshift(current.name); current = current.parent_id ? locationMap.get(current.parent_id) : null }
  const slug = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return [slug(projectCode || 'PROJECT'), ...parts.map(slug)].filter(Boolean).join('-')
}
function hexToRgba(hex, opacity) { const clean=String(hex||'#008F84').replace('#',''),value=clean.length===3?clean.split('').map(x=>x+x).join(''):clean,parsed=Number.parseInt(value,16);return Number.isFinite(parsed)?`rgba(${(parsed>>16)&255},${(parsed>>8)&255},${parsed&255},${opacity})`:`rgba(0,143,132,${opacity})` }
function validView(value) { if(!value)return null;const x=Number(value.x),y=Number(value.y),width=Number(value.width),height=Number(value.height);if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;const sx=Math.max(0,Math.min(1,x)),sy=Math.max(0,Math.min(1,y));return{x:sx,y:sy,width:Math.max(0,Math.min(1-sx,width)),height:Math.max(0,Math.min(1-sy,height))} }
function ancestors(location, locationMap) { const result=[];const visited=new Set();let current=location?.parent_id?locationMap.get(location.parent_id):null;while(current&&!visited.has(current.id)){visited.add(current.id);result.unshift(current);current=current.parent_id?locationMap.get(current.parent_id):null}return result }
function calibrationLengthPx(a,b,size){return a&&b&&size?.width&&size?.height?Math.hypot((b.x-a.x)*size.width,(b.y-a.y)*size.height):0}
function polygonAreaPx(points,size){if(!points?.length||points.length<3||!size?.width||!size?.height)return 0;let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=(a.x*size.width)*(b.y*size.height)-(b.x*size.width)*(a.y*size.height)}return Math.abs(sum)/2}
function areaM2(points,calibration,size){const a=calibration?.point_a,b=calibration?.point_b,d=Number(calibration?.known_distance);if(!a||!b||!Number.isFinite(d)||d<=0)return null;const linePx=calibrationLengthPx(a,b,size);if(!linePx)return null;const area=polygonAreaPx(points,size)*Math.pow(d/linePx,2);return Number.isFinite(area)?area:null}
function ptArea(points){if(!Array.isArray(points)||points.length<3)return 0;let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1]}return Math.abs(sum)/2}
function polygonCenter(points){if(!points?.length)return null;const xs=points.map(p=>Number(p.x)),ys=points.map(p=>Number(p.y));if(!xs.every(Number.isFinite)||!ys.every(Number.isFinite))return null;return{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2}}

function LocationPlan({ mapData, loading, error, locationName, onAreaComputed }) {
  const t=useT('projects')
  const canvasRef=useRef(null),[renderError,setRenderError]=useState('')
  useEffect(()=>{if(!mapData?.signedUrl||!mapData?.geometry?.points?.length){onAreaComputed?.(null);return}let cancelled=false,pdf=null
    async function render(){setRenderError('');try{const response=await fetch(mapData.signedUrl);if(!response.ok)throw new Error(t('loc.print.errDownload',{status:response.status}));const bytes=await response.arrayBuffer(),pdfjs=await import('pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';pdf=await pdfjs.getDocument({data:bytes}).promise;const page=await pdf.getPage(Math.min(Math.max(1,Number(mapData.pageNumber)||1),pdf.numPages)),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:3000/base.width}),source=document.createElement('canvas'),isPt=mapData.coordinateSpace==='pt',points=isPt?mapData.geometry.points.map(p=>({x:p[0]/base.width,y:p[1]/base.height})):mapData.geometry.points,calculatedArea=isPt?(mapData.ptPerM>0?ptArea(mapData.geometry.points)/(mapData.ptPerM*mapData.ptPerM):null):areaM2(points,mapData.scaleCalibration,{width:base.width,height:base.height});if(!cancelled)onAreaComputed?.(calculatedArea);source.width=Math.round(viewport.width);source.height=Math.round(viewport.height);const sctx=source.getContext('2d');await page.render({canvasContext:sctx,viewport}).promise;if(cancelled)return
      const color=mapData.geometry?.display?.color||'#008F84',opacity=Number.isFinite(Number(mapData.geometry?.display?.fill_opacity))?Number(mapData.geometry.display.fill_opacity):.35;sctx.save();sctx.beginPath();points.forEach((p,i)=>{const px=Number(p.x)*source.width,py=Number(p.y)*source.height;i?sctx.lineTo(px,py):sctx.moveTo(px,py)});sctx.closePath();sctx.fillStyle=hexToRgba(color,Math.min(.65,Math.max(.20,opacity)));sctx.fill();sctx.strokeStyle=color;sctx.lineWidth=Math.max(5,source.width*.003);sctx.stroke();sctx.restore()
      const center=polygonCenter(points);if(center){const cx=center.x*source.width,cy=center.y*source.height,title=locationName||t('loc.type.location'),areaText=Number.isFinite(calculatedArea)?`${calculatedArea.toFixed(2)} m²`:'',boxWidth=Math.max(250,Math.min(620,source.width*.18)),boxHeight=areaText?150:110,radius=24;sctx.save();sctx.fillStyle='#0B4F6C';sctx.beginPath();sctx.roundRect(cx-boxWidth/2,cy-boxHeight/2,boxWidth,boxHeight,radius);sctx.fill();sctx.fillStyle='#fff';sctx.textAlign='center';sctx.textBaseline='middle';sctx.font=`800 ${Math.max(42,source.width*.021)}px Arial, sans-serif`;sctx.fillText(title,cx,cy-(areaText?24:0),boxWidth-40);if(areaText){sctx.font=`700 ${Math.max(30,source.width*.014)}px Arial, sans-serif`;sctx.fillText(areaText,cx,cy+35,boxWidth-40)}sctx.restore()}
      const cardView=validView(mapData.printView)||{x:0,y:0,width:1,height:1},sx=Math.round(cardView.x*source.width),sy=Math.round(cardView.y*source.height),sw=Math.max(1,Math.round(cardView.width*source.width)),sh=Math.max(1,Math.round(cardView.height*source.height)),canvas=canvasRef.current;if(!canvas||cancelled)return;canvas.width=1800;canvas.height=Math.max(1,Math.round(1800*sh/sw));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,sx,sy,sw,sh,0,0,canvas.width,canvas.height)
    }catch(e){if(!cancelled){onAreaComputed?.(null);setRenderError(e?.message||t('loc.print.errRender'))}}}render();return()=>{cancelled=true;pdf?.destroy?.().catch(()=>{})}},[mapData,locationName,onAreaComputed]) // eslint-disable-line react-hooks/exhaustive-deps
  if(loading)return <div className={styles.planStatus}>{t('loc.print.loadingPlan')}</div>
  if(error||renderError)return <div className={styles.planStatus}>{t('loc.print.planUnavailable')}</div>
  if(!mapData)return <div className={styles.planStatus}>{t('loc.ritsu.notDrawn')}</div>
  return <canvas ref={canvasRef} className={styles.planCanvas} aria-label={t('loc.print.planAria')} />
}

export default function LocationPrintCard({ location, locationMap, projectName, projectCode, mapData, mapLoading, mapError, onClose }) {
  const t=useT('projects')
  const { language }=useLanguage()
  const [calculatedArea,setCalculatedArea]=useState(null)
  const [templateFailed,setTemplateFailed]=useState(false)
  const [templateVersion,setTemplateVersion]=useState(()=>Date.now())
  if(!location?.qr_token)return null
  const qrPath=locationQrPath(location.qr_token),scanUrl=typeof window==='undefined'?qrPath:`${window.location.origin}${qrPath}`
  const locationId=humanLocationId(projectCode,location,locationMap)
  const lineage=ancestors(location,locationMap)
  const building=lineage.find(item=>item.location_type==='building')?.name||'—'
  const level=[...lineage].reverse().find(item=>item.location_type==='floor')?.name||'—'
  const locationColor=mapData?.geometry?.display?.color||'#008F84'
  const projectDisplay=[projectName,projectCode?`(${projectCode})`:null].filter(Boolean).join(' ')
  const areaDisplay=Number.isFinite(calculatedArea)?`${new Intl.NumberFormat(language,{minimumFractionDigits:2,maximumFractionDigits:2}).format(calculatedArea)} m²`:'—'
  const template=templateFailed?'/location-a4-picture.png':a4Template(language)
  const typeLabel=(value)=>['building','floor','zone','area','room','custom'].includes(value)?t(`loc.type.${value}`):(value||'—')
  const refreshTemplate=()=>setTemplateVersion(Date.now())

  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('loc.print.aria')}>
    <div className={styles.toolbar}><div><strong>{t('loc.print.title')}</strong><span>{location.name}</span></div><div className={styles.toolbarActions}><button type="button" className={ui.btn} onClick={refreshTemplate} title={t('loc.print.refreshHint')}>{t('loc.print.refresh')}</button><button type="button" className={ui.btnPrimary} onClick={()=>window.print()}>{t('loc.print.print')}</button><button type="button" className={ui.btn} onClick={onClose}>{t('loc.close')}</button></div></div>
    <main className={styles.sheet}>
      <img key={templateVersion} className={styles.background} src={`${template}?v=${templateVersion}`} onError={()=>setTemplateFailed(true)} alt="" aria-hidden="true"/>
      <div className={`${styles.dynamicText} ${styles.locationCode}`}>{locationId}</div>
      <div className={`${styles.dynamicText} ${styles.locationName}`}>{location.name}</div>
      <div className={`${styles.dynamicText} ${styles.heroProject}`}>{projectDisplay||'—'}</div>
      <div className={`${styles.dynamicText} ${styles.projectValue}`}>{projectDisplay||'—'}</div>
      <div className={`${styles.dynamicText} ${styles.buildingValue}`}>{building}</div>
      <div className={`${styles.dynamicText} ${styles.levelValue}`}>{level}</div>
      <div className={`${styles.dynamicText} ${styles.typeValue}`}>{typeLabel(location.location_type)}</div>
      <div className={`${styles.dynamicText} ${styles.areaValue}`}>{areaDisplay}</div>
      <div className={styles.colorSwatch} style={{backgroundColor:locationColor}} aria-label={t('loc.print.colorAria',{color:locationColor})}/>
      <div className={`${styles.dynamicText} ${styles.descriptionValue}`}>{location.environment_type||'—'}</div>
      <div className={styles.locationPlan}><LocationPlan mapData={mapData} loading={mapLoading} error={mapError} locationName={location.name} onAreaComputed={setCalculatedArea}/></div>
      <div className={styles.qr}><QRCodeSVG value={scanUrl} size="100%" level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000"/></div>
    </main>
  </div>
}
