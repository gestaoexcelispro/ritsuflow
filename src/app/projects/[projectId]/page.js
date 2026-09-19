'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const money=(v,c='BRL')=>{if(v===null||v===undefined||v==='')return '—';try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(Number(v)||0)}catch{return String(v)}}
const dateValue=v=>{if(!v)return '—';const[y,m,d]=String(v).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:String(v)}
const shortDate=v=>{if(!v)return '—';const[y,m,d]=String(v).slice(0,10).split('-');const n=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return y&&m&&d?`${Number(d)} ${n[Number(m)-1]} ${y}`:String(v)}
const hasCoordinates=p=>p&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))&&Number(p.latitude)>=-90&&Number(p.latitude)<=90&&Number(p.longitude)>=-180&&Number(p.longitude)<=180
const osmUrl=p=>{const lat=Number(p.latitude),lon=Number(p.longitude),dy=.006,dx=.009;return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${lon-dx},${lat-dy},${lon+dx},${lat+dy}`)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`}
const googleUrl=p=>{const q=hasCoordinates(p)?`${p.latitude},${p.longitude}`:[p.address_line,p.address_number,p.neighborhood,p.city,p.state_region,p.postal_code,p.country_code].filter(Boolean).join(', ');return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`}

export default function ProjectDetailPage(){
 const params=useParams(),router=useRouter(),projectId=params?.projectId
 const fileInputRef=useRef(null)
 const[project,setProject]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[deleting,setDeleting]=useState(false),[uploadingImage,setUploadingImage]=useState(false),[tab,setTab]=useState('Notes')
 useEffect(()=>{if(!projectId)return;let active=true;(async()=>{setLoading(true);setError('');const{data,error:e}=await supabase.from('projects').select('*').eq('id',projectId).maybeSingle();if(!active)return;if(e)setError(e.message||'Unable to load this project.');else if(!data)setError('Project not found or you do not have access to it.');else setProject(data);setLoading(false)})();return()=>{active=false}},[projectId])
 async function deleteProject(){if(!project||deleting)return;if(!window.confirm(`Delete project "${project.project_id||''} ${project.name||''}"?\n\nThis action cannot be undone.`))return;setDeleting(true);setError('');const{error:e}=await supabase.from('projects').delete().eq('id',project.id);if(e){setError(`Unable to delete project: ${e.message}`);setDeleting(false);return}router.replace('/projects');router.refresh()}
 async function uploadProjectImage(event){
  const file=event.target.files?.[0]
  event.target.value=''
  if(!file||!project||uploadingImage)return
  const allowed=['image/jpeg','image/png','image/webp']
  if(!allowed.includes(file.type)){setError('Project image must be a JPG, PNG or WebP file.');return}
  if(file.size>10*1024*1024){setError('Project image must be 10 MB or smaller.');return}
  setUploadingImage(true);setError('')
  const extension=file.name.split('.').pop()?.toLowerCase()||'jpg'
  const path=`${project.id}/project-${Date.now()}.${extension}`
  const{error:uploadError}=await supabase.storage.from('project-images').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
  if(uploadError){setError(`Unable to upload project image: ${uploadError.message}`);setUploadingImage(false);return}
  const oldPath=project.project_image_path
  const{data:updated,error:updateError}=await supabase.from('projects').update({project_image_path:path}).eq('id',project.id).select('*').single()
  if(updateError){await supabase.storage.from('project-images').remove([path]);setError(`Image uploaded, but the project could not be updated: ${updateError.message}`);setUploadingImage(false);return}
  if(oldPath&&oldPath!==path)await supabase.storage.from('project-images').remove([oldPath])
  setProject(updated);setUploadingImage(false)
 }
 const mapped=hasCoordinates(project)
 const imageUrl=project?.project_image_path?supabase.storage.from('project-images').getPublicUrl(project.project_image_path).data.publicUrl:''
 return <main style={shell}>
  <header style={header}>
   <Link href="/workspaces" style={brand}><Image src="/logo-white.png" alt="RitsuFlow" width={132} height={48} priority/></Link>
   <div style={{flex:1}}><div style={headerTitle}>Project</div><div style={headerSub}>Shared project record</div></div>
   <Link href="/projects" style={navButton}>← Return to Projects</Link><Link href="/precon" style={{...navButton,...blueButton}}>▣ Go to PreCon</Link><Link href="/fieldop" style={{...navButton,...greenButton}}>⌂ Go to FieldOp</Link>
  </header>
  <section style={content}>
   {loading&&<div style={panel}><strong>Loading project...</strong></div>}
   {!loading&&error&&!project&&<div style={panel}><h2>Unable to open project</h2><p>{error}</p><Link href="/projects">Return to Projects →</Link></div>}
   {!loading&&project&&<div style={workspace}>
    <section style={hero}>
     <div style={projectIcon}>▥</div><div style={{minWidth:0,flex:1}}><div style={heroTop}><h1 style={projectName}>{project.name||'Untitled Project'}</h1><span style={statusPill}>{project.status||'planning'}</span></div><div style={projectNumber}>{project.project_id||'Project ID pending'}</div><div style={heroMeta}><span>♙ <b>{project.client_name||'Client not defined'}</b></span><span>● {[project.city,project.state_region].filter(Boolean).join(', ')||'Location not defined'}</span><span>▣ {shortDate(project.planned_start_date)} → {shortDate(project.planned_finish_date)}</span><span>▤ {project.contract_number||'Contract not defined'}</span></div></div>
     <Link href={`/projects/${projectId}/edit`} style={{...editButton,textDecoration:'none'}}>✎ Edit Project</Link><button onClick={deleteProject} disabled={deleting} style={deleteButton}>▢ {deleting?'Deleting...':'Delete Project'}</button>
    </section>
    {error&&<div style={errorBanner}>{error}</div>}
    <div style={bodyGrid}>
     <div style={mainColumn}>
      <div style={cardsGrid}>
       <Info icon="●" title="Project Information"><Row label="Project ID" value={project.project_id}/><Row label="Project Name" value={project.name}/><Row label="Contract Number" value={project.contract_number}/><Row label="Client" value={project.client_name}/></Info>
       <Info icon="●" title="Project Address"><Row label="Address" value={[project.address_line,project.address_number].filter(Boolean).join(', ')}/><Row label="Neighborhood" value={project.neighborhood}/><Row label="City / State" value={[project.city,project.state_region].filter(Boolean).join(', ')}/><Row label="ZIP / Country" value={[project.postal_code,project.country_code].filter(Boolean).join(' · ')}/></Info>
       <Info icon="$" title="Contract & Financials"><Row label="Contract Value" value={money(project.contract_value,project.currency_code||'BRL')}/><Row label="Material Value" value={project.material_included?money(project.material_value,project.currency_code||'BRL'):'Not included'}/><Row label="Retainage" value={project.has_retainage?`${project.retainage_percent??'—'}% · ${money(project.retainage_value,project.currency_code||'BRL')}`:'No'}/><Row label="Payment Terms" value={project.has_retainage?`${project.retainage_payment_days??'—'} days · ${dateValue(project.probable_retainage_payment_date)}`:'—'}/></Info>
       <Info icon="▣" title="Schedule"><Row label="Planned Start" value={dateValue(project.planned_start_date)}/><Row label="Planned End" value={dateValue(project.planned_finish_date)}/><Row label="Contractual Term" value={project.contractual_term_days?`${project.contractual_term_days} days`:'—'}/><Row label="Status" value={<span style={smallStatus}>{project.status||'planning'}</span>}/></Info>
      </div>
      <section style={successPanel}><div><div style={successTitle}>⚑ &nbsp; Success Criteria</div><div style={successText}>{project.success_criteria||'Success criteria not defined yet.'}</div></div><Link href={`/projects/${projectId}/edit`} style={{...compactButton,textDecoration:'none'}}>✎ Edit</Link></section>
      <section style={tabsPanel}><div style={tabs}>{['Notes','Documents','Team','History'].map(t=><button key={t} onClick={()=>setTab(t)} style={{...tabButton,...(tab===t?activeTab:{})}}>{t}</button>)}</div>{tab==='Notes'?<><div style={noteComposer}><textarea placeholder="Add a note about this project..." style={textarea}/><button style={addNote}>＋ Add Note</button></div><div style={activity}><div style={avatar}>EF</div><div><strong>Eduardo Fernandes</strong><div>Project created.</div></div><div style={activityDate}>19/09/2026 09:14</div></div></>:<div style={emptyTab}>{tab} will be connected to this shared project record.</div>}</section>
     </div>
     <aside style={sideColumn}>
      <section style={sideCard}>
       <div style={sideTitle}>▰ &nbsp; Project Image</div>
       {imageUrl?<div style={projectImageFrame}><img src={imageUrl} alt={`${project.name||'Project'} image`} style={projectImage}/></div>:<div style={imagePlaceholder}><div style={{fontSize:28}}>▥</div><div>Project image</div></div>}
       <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProjectImage} style={{display:'none'}}/>
       <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={uploadingImage} style={{...sideAction,...(uploadingImage?disabledAction:{})}}>{uploadingImage?'Uploading...':imageUrl?'↥ Change Project Image':'↥ Add Project Image'}</button>
      </section>
      <section style={sideCard}><div style={sideTitle}>♥ &nbsp; Location Map</div>{mapped?<div style={mapContainer}><iframe title={`Map of ${project.name||'project'}`} src={osmUrl(project)} style={mapIframe} loading="lazy" referrerPolicy="no-referrer"/></div>:<div style={mapPlaceholder}><div style={{fontSize:22}}>⌖</div><strong>{project.city||'Project location'}</strong><span>{project.neighborhood||''}</span><span style={coordinatesMessage}>Coordinates not defined</span></div>}<a href={googleUrl(project)} target="_blank" rel="noreferrer" style={mapLink}>● Open in Google Maps ↗</a></section>
     </aside>
    </div>
   </div>}
  </section>
 </main>
}
function Info({icon,title,children}){return <section style={panel}><h2 style={cardTitle}><span style={cardIcon}>{icon}</span>{title}</h2>{children}</section>}
function Row({label,value}){const display=value===null||value===undefined||value===''?'—':value;return <div style={row}><span style={rowLabel}>{label}</span><strong style={rowValue}>{display}</strong></div>}

const shell={height:'100vh',overflow:'hidden',background:'#f4f8fa',color:'#082f43',fontFamily:'Arial, sans-serif'}
const header={height:72,boxSizing:'border-box',background:'#063247',display:'flex',alignItems:'center',padding:'0 28px',gap:12,color:'#fff',position:'fixed',top:0,left:0,right:0,zIndex:1000}
const brand={display:'flex',alignItems:'center',paddingRight:20,marginRight:4,borderRight:'1px solid rgba(255,255,255,.18)'}
const headerTitle={fontSize:23,fontWeight:800,lineHeight:1};const headerSub={fontSize:11,opacity:.8,marginTop:4}
const navButton={color:'#fff',textDecoration:'none',border:'1px solid rgba(255,255,255,.24)',borderRadius:8,padding:'10px 15px',fontWeight:800,fontSize:13,whiteSpace:'nowrap'}
const blueButton={background:'#2f86ee',borderColor:'#2f86ee'},greenButton={background:'#11aa61',borderColor:'#11aa61'}
const content={position:'fixed',top:72,left:0,right:0,bottom:0,overflow:'hidden',padding:'12px 18px 14px',boxSizing:'border-box'}
const workspace={height:'100%',maxWidth:1800,margin:'0 auto',display:'flex',flexDirection:'column',minHeight:0}
const panel={background:'#fff',border:'1px solid #d7e3e8',borderRadius:9,padding:'11px 13px',boxShadow:'0 1px 5px rgba(7,47,67,.03)',minWidth:0,boxSizing:'border-box'}
const hero={...panel,display:'flex',alignItems:'center',gap:12,padding:'10px 14px',flex:'0 0 auto'}
const projectIcon={width:54,height:54,borderRadius:8,background:'#eaf3f6',display:'grid',placeItems:'center',fontSize:26,color:'#0b6079'}
const heroTop={display:'flex',alignItems:'center',gap:14};const projectName={margin:0,fontSize:23,lineHeight:1};const projectNumber={fontSize:14,fontWeight:800,color:'#8aa5b2',marginTop:3}
const heroMeta={display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',marginTop:5,color:'#597789',fontSize:12}
const statusPill={padding:'5px 11px',borderRadius:999,background:'#e2f7ee',color:'#087747',fontWeight:800,textTransform:'capitalize',fontSize:12}
const editButton={background:'#fff',border:'1px solid #c8d8df',borderRadius:7,padding:'8px 11px',fontWeight:800,color:'#486879',fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}
const compactButton={...editButton,padding:'6px 10px'};const deleteButton={...editButton,borderColor:'#ef5555',color:'#d92828',background:'#fffafa'}
const errorBanner={marginTop:7,padding:'7px 10px',border:'1px solid #efb0b0',background:'#fff3f3',color:'#a61b1b',borderRadius:7,fontWeight:700,fontSize:12}
const bodyGrid={display:'grid',gridTemplateColumns:'minmax(0,1fr) 230px',gap:10,marginTop:10,flex:1,minHeight:0};const mainColumn={minWidth:0,display:'flex',flexDirection:'column',minHeight:0};const sideColumn={display:'grid',gridTemplateRows:'1fr 1fr',gap:10,minHeight:0}
const cardsGrid={display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:9,flex:'0 0 auto'}
const cardTitle={display:'flex',alignItems:'center',gap:7,margin:'0 0 7px',fontSize:14};const cardIcon={color:'#079a9a',fontSize:14}
const row={display:'grid',gridTemplateColumns:'42% minmax(0,1fr)',gap:7,alignItems:'center',minHeight:31,borderBottom:'1px solid #e5edf1'}
const rowLabel={color:'#6f8794',fontSize:11};const rowValue={fontSize:11.5,fontWeight:800,overflowWrap:'anywhere'}
const smallStatus={display:'inline-block',padding:'4px 8px',borderRadius:999,background:'#e2f7ee',color:'#087747',textTransform:'capitalize'}
const successPanel={...panel,marginTop:9,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flex:'0 0 auto'};const successTitle={fontWeight:800,fontSize:13};const successText={color:'#607784',fontSize:11.5,marginTop:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'70vw'}
const tabsPanel={...panel,marginTop:9,padding:'0 12px 10px',flex:1,minHeight:0,overflow:'hidden'};const tabs={display:'flex',gap:14,borderBottom:'1px solid #dce7eb'};const tabButton={border:0,background:'transparent',padding:'9px 9px 7px',fontWeight:800,color:'#526f80',fontSize:12,cursor:'pointer',borderBottom:'2px solid transparent'};const activeTab={color:'#079a9a',borderBottomColor:'#079a9a'}
const noteComposer={display:'flex',gap:8,marginTop:8};const textarea={flex:1,height:36,resize:'none',border:'1px solid #cddde4',borderRadius:7,padding:'9px 10px',fontFamily:'inherit',fontSize:11.5,boxSizing:'border-box'};const addNote={border:0,borderRadius:7,background:'#069b9b',color:'#fff',padding:'0 16px',fontWeight:800,fontSize:12}
const activity={display:'flex',alignItems:'center',gap:9,marginTop:7,padding:'7px 9px',border:'1px solid #d5e4f5',background:'#f4f9ff',borderRadius:7,fontSize:11};const avatar={width:27,height:27,borderRadius:'50%',background:'#dcedff',color:'#2474c6',display:'grid',placeItems:'center',fontWeight:800};const activityDate={marginLeft:'auto',color:'#607784'};const emptyTab={padding:'18px 3px',color:'#718691',fontSize:12}
const sideCard={...panel,padding:'10px',minHeight:0,display:'flex',flexDirection:'column'};const sideTitle={fontWeight:800,fontSize:12.5,marginBottom:7};const imagePlaceholder={flex:1,minHeight:80,borderRadius:6,background:'linear-gradient(145deg,#d9edf4,#edf5f1)',display:'flex',flexDirection:'column',gap:4,alignItems:'center',justifyContent:'center',color:'#557987',fontSize:11};const sideAction={width:'100%',marginTop:6,border:'1px solid #c8dff5',background:'#f3f9ff',color:'#1971c7',borderRadius:6,padding:'6px',fontWeight:800,fontSize:11,cursor:'pointer'}
const projectImageFrame={flex:1,minHeight:80,borderRadius:6,overflow:'hidden',background:'#eaf3f6'};const projectImage={display:'block',width:'100%',height:'100%',minHeight:80,objectFit:'cover'};const disabledAction={opacity:.6,cursor:'wait'}
const mapContainer={flex:1,minHeight:80,borderRadius:6,overflow:'hidden',border:'1px solid #d7e3e8',background:'#edf3f4'}
const mapIframe={display:'block',width:'100%',height:'100%',minHeight:80,border:0}
const mapPlaceholder={flex:1,minHeight:80,borderRadius:6,background:'linear-gradient(45deg,#eef2ed 25%,#f7f7f3 25%,#f7f7f3 50%,#eef2ed 50%,#eef2ed 75%,#f7f7f3 75%)',backgroundSize:'22px 22px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#607784',gap:3,fontSize:11}
const coordinatesMessage={marginTop:3,fontSize:9.5,color:'#8ba0aa'}
const mapLink={display:'block',marginTop:6,color:'#1971c7',fontWeight:800,textDecoration:'none',fontSize:10.5}
