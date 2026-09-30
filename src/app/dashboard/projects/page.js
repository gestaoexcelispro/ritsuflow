'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '../../../lib/supabase/client'
import { useProjectCopy } from '../../../i18n/useProjectCopy'

const PROJECT_COVER_BUCKET = 'project-covers'
const SIGNED_URL_DURATION = 60 * 60
const PROJECT_VIEW_STORAGE_KEY = 'ritsuflow-projects-view'

function getStatusStyle(status) {
  const styles = {
    planning: { backgroundColor:'#eff6ff', color:'#1d4ed8', borderColor:'#bfdbfe' },
    active: { backgroundColor:'#ecfdf5', color:'#047857', borderColor:'#a7f3d0' },
    on_hold: { backgroundColor:'#fffbeb', color:'#b45309', borderColor:'#fde68a' },
    completed: { backgroundColor:'#f0fdf4', color:'#15803d', borderColor:'#bbf7d0' },
    archived: { backgroundColor:'#f8fafc', color:'#64748b', borderColor:'#cbd5e1' },
  }
  return styles[status] || styles.archived
}

function ListIcon() {
  return <span aria-hidden="true" style={{display:'inline-flex',flexDirection:'column',justifyContent:'center',gap:'3px',width:'14px'}}>{[0,1,2].map(i => <span key={i} style={{display:'block',height:'2px',borderRadius:'999px',backgroundColor:'currentColor'}} />)}</span>
}

function CardsIcon() {
  return <span aria-hidden="true" style={{display:'grid',gridTemplateColumns:'repeat(2, 5px)',gridTemplateRows:'repeat(2, 5px)',gap:'2px'}}>{Array.from({length:4}).map((_,i)=><span key={i} style={{display:'block',borderRadius:'1px',backgroundColor:'currentColor'}} />)}</span>
}

function AnimatedWorkspaceBackground() {
  return (
    <div aria-hidden="true" style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
      <style>{`
        @keyframes ritsuflowFloatOne { 0%,100% {transform:translate3d(0,0,0) rotate(0)} 50% {transform:translate3d(18px,-16px,0) rotate(7deg)} }
        @keyframes ritsuflowFloatTwo { 0%,100% {transform:translate3d(0,0,0) rotate(0)} 50% {transform:translate3d(-20px,14px,0) rotate(-8deg)} }
        @keyframes ritsuflowArcDrift { 0%,100% {transform:translate3d(0,0,0) scale(1)} 50% {transform:translate3d(24px,-12px,0) scale(1.03)} }
        @keyframes ritsuflowPulse { 0%,100% {opacity:.35;transform:scale(.95)} 50% {opacity:.75;transform:scale(1.08)} }
        @media (prefers-reduced-motion: reduce) { .ritsuflow-motion {animation:none!important} }
      `}</style>
      <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg, #f8fbff 0%, #f6fbfd 45%, #f8fcfa 100%)'}} />
      <div className="ritsuflow-motion" style={{position:'absolute',top:'-270px',left:'-220px',width:'720px',height:'720px',borderRadius:'50%',border:'58px solid rgba(37,99,235,.045)',animation:'ritsuflowArcDrift 18s ease-in-out infinite'}} />
      <div className="ritsuflow-motion" style={{position:'absolute',right:'-360px',bottom:'-390px',width:'860px',height:'860px',borderRadius:'50%',border:'64px solid rgba(20,184,166,.045)',animation:'ritsuflowArcDrift 22s ease-in-out infinite reverse'}} />
      <div style={{position:'absolute',top:'8%',right:'21%',width:'180px',height:'110px',opacity:.42,backgroundImage:'radial-gradient(circle, rgba(100,116,139,.26) 1.2px, transparent 1.2px)',backgroundSize:'16px 16px'}} />
      <div style={{position:'absolute',right:'8%',bottom:'12%',width:'170px',height:'110px',opacity:.32,backgroundImage:'radial-gradient(circle, rgba(100,116,139,.24) 1.2px, transparent 1.2px)',backgroundSize:'16px 16px'}} />
      <div className="ritsuflow-motion" style={{position:'absolute',top:'18%',right:'8%',width:'42px',height:'42px',border:'2px solid rgba(37,99,235,.30)',borderRadius:'11px',animation:'ritsuflowFloatOne 11s ease-in-out infinite'}} />
      <div className="ritsuflow-motion" style={{position:'absolute',top:'34%',right:'33%',width:'28px',height:'28px',borderRadius:'8px',background:'rgba(45,212,191,.18)',animation:'ritsuflowFloatTwo 9s ease-in-out infinite'}} />
      <div className="ritsuflow-motion" style={{position:'absolute',bottom:'16%',left:'6%',width:'18px',height:'18px',borderRadius:'50%',background:'rgba(45,212,191,.45)',animation:'ritsuflowPulse 6s ease-in-out infinite'}} />
      <div className="ritsuflow-motion" style={{position:'absolute',bottom:'22%',right:'28%',width:'22px',height:'22px',borderRadius:'50%',background:'rgba(59,130,246,.34)',animation:'ritsuflowPulse 7s ease-in-out infinite 1s'}} />
      <div style={{position:'absolute',left:'-160px',bottom:'-110px',width:'470px',height:'280px',borderRadius:'50% 50% 0 0',background:'linear-gradient(135deg, rgba(191,219,254,.26), rgba(204,251,241,.17))',filter:'blur(2px)'}} />
      <div style={{position:'absolute',top:'-120px',right:'-20px',width:'520px',height:'300px',borderRadius:'0 0 0 80%',background:'linear-gradient(225deg, rgba(204,251,241,.24), rgba(219,234,254,.10))'}} />
    </div>
  )
}

export default function ProjectsPage() {
  const { copy, statusLabels, text, formatCurrency } = useProjectCopy()
  const [projects,setProjects] = useState([])
  const [projectCoverUrls,setProjectCoverUrls] = useState({})
  const [isLoading,setIsLoading] = useState(true)
  const [deletingProjectId,setDeletingProjectId] = useState(null)
  const [errorMessage,setErrorMessage] = useState('')
  const [viewMode,setViewMode] = useState('list')
  const [topbarTarget,setTopbarTarget] = useState(null)

  const formatLocation = useCallback((project) => {
    const cityAndState = [project.city,project.state_region].filter(Boolean)
    if (cityAndState.length) return cityAndState.join(', ')
    return project.country_code || copy.notSpecified
  }, [copy.notSpecified])

  const formatContractValue = useCallback((project) => {
    if (project.contract_value === null || project.contract_value === undefined) return '—'
    try { return formatCurrency(Number(project.contract_value), project.currency_code || 'USD') }
    catch { return String(project.contract_value) }
  }, [formatCurrency])

  const fetchProjects = useCallback(async () => {
    setIsLoading(true); setErrorMessage('')
    const supabase = createClient()
    const {data,error} = await supabase.from('projects').select(`id,code,name,client_name,contract_value,currency_code,city,state_region,country_code,status,cover_image_path,created_at`).order('created_at',{ascending:false})
    if (error) {
      console.error('Projects could not be loaded.',error)
      setErrorMessage(text('unableLoad',{error:error.message})); setProjects([]); setIsLoading(false); return
    }
    const loadedProjects = data || []
    setProjects(loadedProjects)
    const coverProjects = loadedProjects.filter(project => project.cover_image_path)
    if (!coverProjects.length) { setProjectCoverUrls({}); setIsLoading(false); return }
    const coverEntries = await Promise.all(coverProjects.map(async project => {
      const {data:signedUrlData,error:signedUrlError} = await supabase.storage.from(PROJECT_COVER_BUCKET).createSignedUrl(project.cover_image_path,SIGNED_URL_DURATION)
      if (signedUrlError || !signedUrlData?.signedUrl) { console.error(`Project cover could not be loaded for ${project.code || project.id}.`,signedUrlError); return [project.id,null] }
      return [project.id,signedUrlData.signedUrl]
    }))
    const nextCoverUrls = {}
    coverEntries.forEach(([projectId,signedUrl]) => { if (signedUrl) nextCoverUrls[projectId] = signedUrl })
    setProjectCoverUrls(nextCoverUrls); setIsLoading(false)
  }, [text])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { setTopbarTarget(document.getElementById('dashboard-topbar-actions')) }, [])
  useEffect(() => { const savedView=window.localStorage.getItem(PROJECT_VIEW_STORAGE_KEY); if(savedView==='list'||savedView==='cards') setViewMode(savedView) }, [])

  function changeViewMode(nextViewMode) { setViewMode(nextViewMode); window.localStorage.setItem(PROJECT_VIEW_STORAGE_KEY,nextViewMode) }

  async function handleDelete(project) {
    if (!window.confirm(text('deleteConfirm',{name:project.name}))) return
    setDeletingProjectId(project.id); setErrorMessage('')
    const supabase = createClient()
    const {error} = await supabase.rpc('delete_project_everywhere',{target_project_id:project.id})
    if (error) { console.error('Project could not be deleted.',error); setErrorMessage(text('unableDelete',{error:error.message})); setDeletingProjectId(null); return }
    if (project.cover_image_path) {
      const {error:storageError}=await supabase.storage.from(PROJECT_COVER_BUCKET).remove([project.cover_image_path])
      if(storageError) console.warn('The project was deleted, but its cover image could not be removed from Storage.',storageError)
    }
    setProjects(current=>current.filter(item=>item.id!==project.id))
    setProjectCoverUrls(current=>{const next={...current};delete next[project.id];return next})
    setDeletingProjectId(null)
  }

  const toggleButton = active => ({display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'7px',minHeight:'36px',padding:'0 12px',border:'none',borderRadius:'6px',backgroundColor:active?'#fff':'transparent',color:active?'#0f172a':'#64748b',boxShadow:active?'0 1px 2px rgba(15,23,42,.08)':'none',cursor:'pointer',fontSize:'.82rem',fontWeight:800})

  const topbarActions = topbarTarget ? createPortal(
    <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'12px',minWidth:0}}>
      <div role="group" aria-label={copy.projectView} style={{display:'inline-flex',alignItems:'center',padding:'3px',border:'1px solid #e2e8f0',borderRadius:'8px',backgroundColor:'#f8fafc'}}>
        <button type="button" onClick={()=>changeViewMode('list')} aria-pressed={viewMode==='list'} style={toggleButton(viewMode==='list')}><ListIcon />{copy.list}</button>
        <button type="button" onClick={()=>changeViewMode('cards')} aria-pressed={viewMode==='cards'} style={toggleButton(viewMode==='cards')}><CardsIcon />{copy.cards}</button>
      </div>
      <Link href="/dashboard/projects/setup?mode=new" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'42px',padding:'0 18px',borderRadius:'8px',backgroundColor:'#1d4ed8',color:'#fff',fontSize:'.86rem',fontWeight:800,textDecoration:'none',whiteSpace:'nowrap',boxShadow:'0 1px 2px rgba(15,23,42,.08)'}}>+ {copy.newProject}</Link>
    </div>, topbarTarget) : null

  const statusBadge = project => {
    const s=getStatusStyle(project.status)
    return <span style={{display:'inline-flex',alignItems:'center',minHeight:'28px',padding:'0 10px',border:`1px solid ${s.borderColor}`,borderRadius:'999px',backgroundColor:s.backgroundColor,color:s.color,fontSize:'.76rem',fontWeight:800,whiteSpace:'nowrap'}}>{statusLabels[project.status] || project.status}</span>
  }

  const deleteButton = project => <button type="button" onClick={()=>handleDelete(project)} disabled={deletingProjectId===project.id} style={{border:'none',minHeight:'36px',padding:'0 14px',borderRadius:'7px',backgroundColor:'#fef2f2',color:'#dc2626',cursor:deletingProjectId===project.id?'not-allowed':'pointer',fontSize:'.8rem',fontWeight:800,opacity:deletingProjectId===project.id?.6:1}}>{deletingProjectId===project.id?copy.deleting:copy.delete}</button>

  return <>
    {topbarActions}
    <div style={{position:'relative',minHeight:'calc(100vh - 88px)',overflow:'hidden'}}>
      <AnimatedWorkspaceBackground />
      <div style={{position:'relative',zIndex:1,padding:'72px 40px 48px'}}>
        {errorMessage && <div role="alert" style={{marginBottom:'18px',padding:'12px 15px',border:'1px solid #feb2b2',borderRadius:'8px',backgroundColor:'#fff5f5',color:'#c53030'}}>{errorMessage}</div>}
        {viewMode==='list' ? <div style={tableShellStyle}>
          <table style={{width:'100%',minWidth:'920px',borderCollapse:'collapse',textAlign:'left'}}>
            <thead style={{borderBottom:'1px solid #e2e8f0',backgroundColor:'rgba(248,250,252,.96)'}}><tr>
              {[copy.code,copy.project,copy.client,copy.contractValue,copy.location,copy.status,copy.actions].map(label=><th key={label} style={headerCellStyle}>{label}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan="7" style={emptyCellStyle}>{copy.loadingProjects}</td></tr> : projects.length===0 ? <tr><td colSpan="7" style={emptyCellStyle}>{copy.noProjectsConfigured}</td></tr> : projects.map(project=><tr key={project.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                <td style={bodyCellStyle}><strong style={{color:'#1e3a5f'}}>{project.code||'—'}</strong></td>
                <td style={bodyCellStyle}><strong style={{color:'#0f172a'}}>{project.name}</strong></td>
                <td style={bodyCellStyle}>{project.client_name||'—'}</td>
                <td style={bodyCellStyle}><strong style={{color:'#1d4ed8'}}>{formatContractValue(project)}</strong></td>
                <td style={bodyCellStyle}>{formatLocation(project)}</td>
                <td style={bodyCellStyle}>{statusBadge(project)}</td>
                <td style={{...bodyCellStyle,whiteSpace:'nowrap'}}><Link href={`/dashboard/projects/setup?projectId=${project.id}`} style={setupLinkStyle}>{copy.setup}</Link>{deleteButton(project)}</td>
              </tr>)}
            </tbody>
          </table>
        </div> : <div>
          {isLoading ? <div style={cardEmptyStateStyle}>{copy.loadingProjects}</div> : projects.length===0 ? <div style={cardEmptyStateStyle}>{copy.noProjectsConfigured}</div> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))',gap:'20px'}}>
            {projects.map(project=>{const coverUrl=projectCoverUrls[project.id];return <article key={project.id} style={cardStyle}>
              <div style={{position:'relative',width:'100%',aspectRatio:'16 / 9',overflow:'hidden',background:'linear-gradient(135deg,#e2e8f0 0%,#f8fafc 100%)'}}>{coverUrl?<img src={coverUrl} alt={text('projectCoverAlt',{name:project.name})} style={{display:'block',width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',color:'#94a3b8',fontSize:'.78rem',fontWeight:800,letterSpacing:'.04em',textTransform:'uppercase'}}>{copy.noCoverImage}</div>}</div>
              <div style={{display:'flex',flexDirection:'column',flex:1,padding:'20px 22px 22px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px',marginBottom:'16px'}}><span style={{color:'#64748b',fontSize:'.76rem',fontWeight:900,letterSpacing:'.06em',textTransform:'uppercase'}}>{project.code||'—'}</span>{statusBadge(project)}</div>
                <h2 style={{margin:'0 0 8px',color:'#0f172a',fontSize:'1.06rem',lineHeight:1.35,fontWeight:900}}>{project.name}</h2>
                <p style={{margin:'0 0 4px',color:'#475569',fontSize:'.9rem',lineHeight:1.5}}>{project.client_name||copy.clientNotSpecified}</p>
                <p style={{margin:'0 0 18px',color:'#64748b',fontSize:'.86rem',lineHeight:1.5}}>{formatLocation(project)}</p>
                <div style={{marginTop:'auto',paddingTop:'16px',borderTop:'1px solid #e2e8f0'}}>
                  <div style={{marginBottom:'16px'}}><div style={{marginBottom:'4px',color:'#64748b',fontSize:'.72rem',fontWeight:800,letterSpacing:'.04em',textTransform:'uppercase'}}>{copy.contractValue}</div><strong style={{color:'#1d4ed8',fontSize:'1rem'}}>{formatContractValue(project)}</strong></div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}><Link href={`/dashboard/projects/setup?projectId=${project.id}`} style={{...setupLinkStyle,minHeight:'36px',marginRight:0,alignItems:'center'}}>{copy.setup}</Link>{deleteButton(project)}</div>
                </div>
              </div>
            </article>})}
          </div>}
        </div>}
      </div>
    </div>
  </>
}

const tableShellStyle={overflowX:'auto',borderRadius:'12px',backgroundColor:'rgba(255,255,255,.94)',border:'1px solid rgba(226,232,240,.92)',boxShadow:'0 12px 34px rgba(15,23,42,.07)',backdropFilter:'blur(10px)'}
const headerCellStyle={padding:'15px 20px',color:'#64748b',fontSize:'.76rem',fontWeight:900,letterSpacing:'.04em',textTransform:'uppercase',whiteSpace:'nowrap'}
const bodyCellStyle={padding:'15px 20px',color:'#475569',fontSize:'.88rem',verticalAlign:'middle'}
const emptyCellStyle={padding:'40px 20px',color:'#64748b',textAlign:'center'}
const cardEmptyStateStyle={padding:'50px 24px',border:'1px solid rgba(226,232,240,.92)',borderRadius:'12px',backgroundColor:'rgba(255,255,255,.94)',color:'#64748b',textAlign:'center',boxShadow:'0 12px 30px rgba(15,23,42,.06)',backdropFilter:'blur(10px)'}
const cardStyle={display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid rgba(226,232,240,.92)',borderRadius:'14px',backgroundColor:'rgba(255,255,255,.95)',boxShadow:'0 14px 36px rgba(15,23,42,.09)',backdropFilter:'blur(10px)'}
const setupLinkStyle={display:'inline-flex',marginRight:'8px',padding:'7px 12px',borderRadius:'6px',backgroundColor:'#eff6ff',color:'#1d4ed8',fontSize:'.8rem',fontWeight:800,textDecoration:'none'}
