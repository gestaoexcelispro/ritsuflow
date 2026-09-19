'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const money = (value, currency = 'BRL') => {
  if (value === null || value === undefined || value === '') return '—'
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0) }
  catch { return String(value) }
}
const dateValue = (value) => {
  if (!value) return '—'
  const [y,m,d] = String(value).slice(0,10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : String(value)
}
const shortDate = (value) => {
  if (!value) return '—'
  const [y,m,d] = String(value).slice(0,10).split('-')
  const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return y && m && d ? `${Number(d)} ${names[Number(m)-1]} ${y}` : String(value)
}

export default function ProjectDetailPage() {
  const params = useParams(); const router = useRouter(); const projectId = params?.projectId
  const [project,setProject]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [deleting,setDeleting]=useState(false)
  const [tab,setTab]=useState('Notes')

  useEffect(()=>{
    if(!projectId)return; let active=true
    ;(async()=>{
      setLoading(true); setError('')
      const {data,error:e}=await supabase.from('projects').select('*').eq('id',projectId).maybeSingle()
      if(!active)return
      if(e)setError(e.message||'Unable to load this project.')
      else if(!data)setError('Project not found or you do not have access to it.')
      else setProject(data)
      setLoading(false)
    })()
    return()=>{active=false}
  },[projectId])

  async function deleteProject(){
    if(!project||deleting)return
    if(!window.confirm(`Delete project "${project.project_id || ''} ${project.name || ''}"?\n\nThis action cannot be undone.`))return
    setDeleting(true); setError('')
    const {error:e}=await supabase.from('projects').delete().eq('id',project.id)
    if(e){setError(`Unable to delete project: ${e.message}`);setDeleting(false);return}
    router.replace('/projects'); router.refresh()
  }

  return <main style={shell}>
    <header style={header}>
      <Link href="/workspaces" style={brand}><Image src="/logo-white.png" alt="RitsuFlow" width={138} height={50} priority /></Link>
      <div style={{flex:1}}><div style={headerTitle}>Project</div><div style={headerSub}>Shared project record</div></div>
      <Link href="/projects" style={navButton}>← Return to Projects</Link>
      <Link href="/precon" style={{...navButton,...blueButton}}>▣ Go to PreCon</Link>
      <Link href="/fieldop" style={{...navButton,...greenButton}}>⌂ Go to FieldOp</Link>
      <button onClick={deleteProject} disabled={!project||deleting} style={headerDelete}>▢ {deleting?'Deleting...':'Delete Project'}</button>
    </header>

    <section style={content}>
      {loading && <div style={panel}><strong>Loading project...</strong></div>}
      {!loading&&error&&!project&&<div style={panel}><h2>Unable to open project</h2><p>{error}</p><Link href="/projects">Return to Projects →</Link></div>}
      {!loading&&project&&<>
        <section style={hero}>
          <div style={projectIcon}>▥</div>
          <div style={{minWidth:0,flex:1}}>
            <div style={heroTop}><h1 style={projectName}>{project.name||'Untitled Project'}</h1><span style={statusPill}>{project.status||'planning'}</span></div>
            <div style={projectNumber}>{project.project_id||'Project ID pending'}</div>
            <div style={heroMeta}>
              <span>♙ <b>{project.client_name||'Client not defined'}</b></span>
              <span>● {[project.city,project.state_region].filter(Boolean).join(', ')||'Location not defined'}</span>
              <span>▣ {shortDate(project.planned_start_date)} → {shortDate(project.planned_finish_date)}</span>
              <span>▤ {project.contract_number||'Contract not defined'}</span>
            </div>
          </div>
          <button style={editButton}>✎ Edit Project</button>
          <button onClick={deleteProject} disabled={deleting} style={deleteButton}>▢ {deleting?'Deleting...':'Delete Project'}</button>
        </section>
        {error&&<div style={errorBanner}>{error}</div>}

        <div style={bodyGrid}>
          <div style={mainColumn}>
            <div style={cardsGrid}>
              <Info icon="●" title="Project Information"><Row label="Project ID" value={project.project_id}/><Row label="Project Name" value={project.name}/><Row label="Contract Number" value={project.contract_number}/><Row label="Client" value={project.client_name}/></Info>
              <Info icon="●" title="Project Address"><Row label="Address" value={[project.address_line,project.address_number].filter(Boolean).join(', ')}/><Row label="Neighborhood" value={project.neighborhood}/><Row label="City" value={project.city}/><Row label="State" value={project.state_region}/><Row label="ZIP Code" value={project.postal_code}/><Row label="Country" value={project.country_code}/></Info>
              <Info icon="$" title="Contract & Financials"><Row label="Contract Value" value={money(project.contract_value,project.currency_code||'BRL')}/><Row label="Material Value" value={project.material_included?money(project.material_value,project.currency_code||'BRL'):'Not included'}/><Row label="Retainage" value={project.has_retainage?`${project.retainage_percent??'—'}% · ${money(project.retainage_value,project.currency_code||'BRL')}`:'No'}/><Row label="Payment Terms" value={project.has_retainage?`${project.retainage_payment_days??'—'} days · ${dateValue(project.probable_retainage_payment_date)}`:'—'}/></Info>
              <Info icon="▣" title="Schedule"><Row label="Planned Start" value={dateValue(project.planned_start_date)}/><Row label="Planned End" value={dateValue(project.planned_finish_date)}/><Row label="Contractual Term" value={project.contractual_term_days?`${project.contractual_term_days} days`:'—'}/><Row label="Status" value={<span style={smallStatus}>{project.status||'planning'}</span>}/></Info>
            </div>

            <section style={successPanel}><div><div style={successTitle}>⚑ &nbsp; Success Criteria</div><div style={successText}>{project.success_criteria||'Success criteria not defined yet.'}</div></div><button style={editButton}>✎ Edit Success Criteria</button></section>

            <section style={tabsPanel}>
              <div style={tabs}>{['Notes','Documents','Team','History'].map(t=><button key={t} onClick={()=>setTab(t)} style={{...tabButton,...(tab===t?activeTab:{})}}>{t==='Notes'?'▤ ':t==='Documents'?'⌕ ':t==='Team'?'♙ ':'◷ '}{t}</button>)}</div>
              {tab==='Notes'&&<><div style={noteComposer}><textarea placeholder="Add a note about this project..." style={textarea}/><button style={addNote}>＋ Add Note</button></div><div style={activity}><div style={avatar}>EF</div><div><strong>Eduardo Fernandes</strong><div style={{marginTop:5}}>Project created.</div></div><div style={activityDate}>19/09/2026 09:14 &nbsp; ⋮</div></div></>}
              {tab!=='Notes'&&<div style={emptyTab}>{tab} will be connected to this shared project record.</div>}
            </section>
          </div>

          <aside style={sideColumn}>
            <section style={sideCard}><div style={sideTitle}>▰ &nbsp; Project Image</div><div style={imagePlaceholder}><div style={{fontSize:38}}>▥</div><div>Project image</div></div><button style={sideAction}>↥ Add Project Image</button></section>
            <section style={sideCard}><div style={sideTitle}>♥ &nbsp; Location Map</div><div style={mapPlaceholder}><div style={{fontSize:30}}>●</div><strong>{project.city||'Project location'}</strong><span>{project.neighborhood||''}</span></div><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([project.address_line,project.address_number,project.city,project.state_region,project.postal_code,project.country_code].filter(Boolean).join(', '))}`} target="_blank" rel="noreferrer" style={mapLink}>● Open in Google Maps ↗</a></section>
          </aside>
        </div>
      </>}
    </section>
  </main>
}

function Info({icon,title,children}){return <section style={panel}><h2 style={cardTitle}><span style={cardIcon}>{icon}</span>{title}</h2>{children}</section>}
function Row({label,value}){const display=value===null||value===undefined||value===''?'—':value;return <div style={row}><span style={rowLabel}>{label}</span><strong style={rowValue}>{display}</strong></div>}

const shell={minHeight:'100vh',background:'#f4f8fa',color:'#082f43',fontFamily:'Arial, sans-serif'}
const header={height:82,background:'#063247',display:'flex',alignItems:'center',padding:'0 34px',gap:16,color:'#fff'}
const brand={display:'flex',alignItems:'center',paddingRight:24,marginRight:4,borderRight:'1px solid rgba(255,255,255,.18)'}
const headerTitle={fontSize:26,fontWeight:800,lineHeight:1.05}; const headerSub={fontSize:12,opacity:.8,marginTop:4}
const navButton={color:'#fff',textDecoration:'none',border:'1px solid rgba(255,255,255,.24)',borderRadius:9,padding:'12px 18px',fontWeight:800,fontSize:14,whiteSpace:'nowrap'}
const blueButton={background:'#2f86ee',borderColor:'#2f86ee'}; const greenButton={background:'#11aa61',borderColor:'#11aa61'}
const headerDelete={...navButton,background:'transparent',borderColor:'#ef5555',color:'#ff6767',cursor:'pointer'}
const content={width:'100%',maxWidth:1800,margin:'0 auto',padding:'24px 28px 34px'}
const panel={background:'#fff',border:'1px solid #d7e3e8',borderRadius:11,padding:'18px 20px',boxShadow:'0 2px 8px rgba(7,47,67,.035)',minWidth:0}
const hero={...panel,display:'flex',alignItems:'center',gap:18,padding:'16px 20px'}
const projectIcon={width:88,height:88,borderRadius:9,background:'#eaf3f6',display:'grid',placeItems:'center',fontSize:38,color:'#0b6079'}
const heroTop={display:'flex',alignItems:'center',gap:20}; const projectName={margin:0,fontSize:29,lineHeight:1.05}; const projectNumber={fontSize:18,fontWeight:800,color:'#8aa5b2',marginTop:5}
const heroMeta={display:'flex',alignItems:'center',gap:28,flexWrap:'wrap',marginTop:8,color:'#597789',fontSize:14}
const statusPill={padding:'8px 16px',borderRadius:999,background:'#e2f7ee',color:'#087747',fontWeight:800,textTransform:'capitalize'}
const editButton={background:'#fff',border:'1px solid #c8d8df',borderRadius:8,padding:'11px 16px',fontWeight:800,color:'#486879',fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}
const deleteButton={...editButton,borderColor:'#ef5555',color:'#d92828',background:'#fffafa'}
const errorBanner={marginTop:10,padding:'10px 14px',border:'1px solid #efb0b0',background:'#fff3f3',color:'#a61b1b',borderRadius:9,fontWeight:700}
const bodyGrid={display:'grid',gridTemplateColumns:'minmax(0,1fr) 275px',gap:14,marginTop:14}; const mainColumn={minWidth:0}; const sideColumn={display:'flex',flexDirection:'column',gap:14}
const cardsGrid={display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12}
const cardTitle={display:'flex',alignItems:'center',gap:10,margin:'0 0 14px',fontSize:17}; const cardIcon={color:'#079a9a',fontSize:18}
const row={display:'grid',gridTemplateColumns:'43% minmax(0,1fr)',gap:10,alignItems:'center',minHeight:42,borderBottom:'1px solid #e5edf1'}
const rowLabel={color:'#6f8794',fontSize:12.5}; const rowValue={fontSize:13,fontWeight:800,overflowWrap:'anywhere'}
const smallStatus={display:'inline-block',padding:'6px 12px',borderRadius:999,background:'#e2f7ee',color:'#087747',textTransform:'capitalize'}
const successPanel={...panel,marginTop:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:18}; const successTitle={fontWeight:800,fontSize:16}; const successText={color:'#607784',fontSize:13,marginTop:7}
const tabsPanel={...panel,marginTop:14,padding:'0 18px 16px'}; const tabs={display:'flex',gap:18,borderBottom:'1px solid #dce7eb'}; const tabButton={border:0,background:'transparent',padding:'16px 12px 13px',fontWeight:800,color:'#526f80',fontSize:14,cursor:'pointer',borderBottom:'2px solid transparent'}; const activeTab={color:'#079a9a',borderBottomColor:'#079a9a'}
const noteComposer={display:'flex',gap:12,marginTop:14}; const textarea={flex:1,minHeight:48,resize:'vertical',border:'1px solid #cddde4',borderRadius:8,padding:'13px 14px',fontFamily:'inherit',fontSize:13}; const addNote={border:0,borderRadius:8,background:'#069b9b',color:'#fff',padding:'0 22px',fontWeight:800,fontSize:14}
const activity={display:'flex',alignItems:'center',gap:12,marginTop:12,padding:'12px 14px',border:'1px solid #d5e4f5',background:'#f4f9ff',borderRadius:8,fontSize:12.5}; const avatar={width:34,height:34,borderRadius:'50%',background:'#dcedff',color:'#2474c6',display:'grid',placeItems:'center',fontWeight:800}; const activityDate={marginLeft:'auto',color:'#607784'}; const emptyTab={padding:'28px 4px',color:'#718691'}
const sideCard={...panel,padding:'14px'}; const sideTitle={fontWeight:800,fontSize:14,marginBottom:12}; const imagePlaceholder={height:165,borderRadius:7,background:'linear-gradient(145deg,#d9edf4,#edf5f1)',display:'flex',flexDirection:'column',gap:6,alignItems:'center',justifyContent:'center',color:'#557987'}; const sideAction={width:'100%',marginTop:9,border:'1px solid #c8dff5',background:'#f3f9ff',color:'#1971c7',borderRadius:7,padding:'9px',fontWeight:800}
const mapPlaceholder={height:175,borderRadius:7,background:'linear-gradient(45deg,#eef2ed 25%,#f7f7f3 25%,#f7f7f3 50%,#eef2ed 50%,#eef2ed 75%,#f7f7f3 75%)',backgroundSize:'26px 26px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#d73b2e',gap:4}; const mapLink={display:'block',marginTop:10,color:'#1971c7',fontWeight:800,textDecoration:'none',fontSize:12.5}
