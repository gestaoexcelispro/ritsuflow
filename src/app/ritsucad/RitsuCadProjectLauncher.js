'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function RitsuCadProjectLauncher() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasProjectContext = Boolean(searchParams.get('projectId'))
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [documents, setDocuments] = useState([])
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (hasProjectContext) return undefined

    const handleOpenProjectDrawing = () => setOpen(true)
    window.addEventListener('ritsucad:open-project-drawing', handleOpenProjectDrawing)
    return () => window.removeEventListener('ritsucad:open-project-drawing', handleOpenProjectDrawing)
  }, [hasProjectContext])

  useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      setLoading(true); setError('')
      const { data, error: queryError } = await supabase.from('projects').select('id,project_id,code,name,status').order('created_at', { ascending: false })
      if (!active) return
      if (queryError) setError(queryError.message); else setProjects(data || [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [open])

  useEffect(() => {
    setDocuments([])
    if (!projectId) return
    let active = true
    ;(async () => {
      setLoading(true); setError('')
      const { data, error: queryError } = await supabase.from('project_documents').select('id,project_id,file_name,mime_type,document_type,created_at').eq('project_id', projectId).order('created_at', { ascending: false })
      if (!active) return
      if (queryError) setError(queryError.message); else setDocuments((data || []).filter((d) => d.mime_type === 'application/pdf' || d.file_name?.toLowerCase().endsWith('.pdf')))
      setLoading(false)
    })()
    return () => { active = false }
  }, [projectId])

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])
  if (hasProjectContext || !open) return null

  return <div style={backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
    <section style={modal} role="dialog" aria-modal="true" aria-label="Open project drawing">
      <div style={header}><div><div style={eyebrow}>RITSUCAD™ · PROJECT DRAWINGS</div><h2 style={title}>Open Project Drawing</h2><p style={subtitle}>Choose the project first, then open a PDF already stored in Project Documents.</p></div><button type="button" onClick={() => setOpen(false)} style={closeButton}>×</button></div>
      <div style={body}>
        <label style={label}>Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={select}><option value="">Select project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.project_id || project.code || 'Project'} · {project.name}</option>)}</select>
        {projectId && <div style={{marginTop:20}}><div style={sectionHeader}><div><div style={label}>PROJECT DOCUMENTS</div><strong style={{fontSize:14,color:'#0d3347'}}>{selectedProject?.name}</strong></div><span style={countBadge}>{documents.length} PDF{documents.length === 1 ? '' : 's'}</span></div>
          {documents.length ? <div style={documentList}>{documents.map((document) => <button key={document.id} type="button" onClick={() => router.push(`/ritsucad/project-document?projectId=${encodeURIComponent(projectId)}&documentId=${encodeURIComponent(document.id)}`)} style={documentButton}><span style={pdfIcon}>PDF</span><span style={{minWidth:0,flex:1,textAlign:'left'}}><strong style={documentName}>{document.file_name}</strong><small style={documentMeta}>Open in RitsuCAD with project, LBS and scope context</small></span><span style={openArrow}>→</span></button>)}</div> : !loading && <div style={empty}>No PDF drawings were found in this project's Project Documents.</div>}
        </div>}
        {loading && <div style={helper}>Loading…</div>}{error && <div style={errorBox}>{error}</div>}
      </div>
      <div style={footer}><span style={footerNote}>Project Documents remains the source of truth. RitsuCAD does not create a duplicate PDF.</span><button type="button" onClick={() => setOpen(false)} style={cancelButton}>Cancel</button></div>
    </section>
  </div>
}

const backdrop={position:'fixed',inset:0,zIndex:10000,display:'grid',placeItems:'center',padding:24,background:'rgba(7,35,50,.55)',backdropFilter:'blur(2px)'}
const modal={width:'min(720px,94vw)',maxHeight:'82vh',overflow:'hidden',background:'#fff',borderRadius:14,boxShadow:'0 28px 70px rgba(0,0,0,.28)',color:'#0d3347',fontFamily:'inherit'}
const header={display:'flex',justifyContent:'space-between',gap:20,padding:'24px 26px 20px',borderBottom:'1px solid #dce6eb'}
const eyebrow={fontSize:10,fontWeight:900,letterSpacing:'1.5px',color:'#008f8f'}
const title={margin:'5px 0 4px',fontSize:25,fontWeight:900,color:'#092f44'}
const subtitle={margin:0,fontSize:12.5,lineHeight:1.5,color:'#69818d'}
const closeButton={width:36,height:36,border:0,borderRadius:'50%',background:'#eef4f6',color:'#55717e',fontSize:24,cursor:'pointer'}
const body={padding:'22px 26px',maxHeight:'52vh',overflowY:'auto'}
const label={display:'block',marginBottom:7,fontSize:10,fontWeight:900,letterSpacing:'.5px',color:'#587381'}
const select={width:'100%',height:44,border:'1px solid #c8d8df',borderRadius:7,padding:'0 12px',background:'#fff',color:'#143c50',fontSize:13,outline:'none'}
const sectionHeader={display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:10}
const countBadge={padding:'5px 9px',borderRadius:999,background:'#edf6f7',color:'#167c80',fontSize:10,fontWeight:900}
const documentList={display:'grid',gap:8}
const documentButton={display:'flex',alignItems:'center',gap:12,width:'100%',padding:'12px 13px',border:'1px solid #d7e3e8',borderRadius:8,background:'#fff',cursor:'pointer'}
const pdfIcon={display:'grid',placeItems:'center',width:42,height:42,borderRadius:7,background:'#eef5f7',color:'#0b5870',fontSize:10,fontWeight:900}
const documentName={display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12.5,color:'#10394d'}
const documentMeta={display:'block',marginTop:3,fontSize:10,color:'#78909b'}
const openArrow={fontSize:20,fontWeight:900,color:'#079b9b'}
const empty={padding:'20px',border:'1px dashed #cadbe2',borderRadius:8,textAlign:'center',fontSize:11.5,color:'#748c97'}
const helper={marginTop:12,fontSize:11,color:'#728a96'}
const errorBox={marginTop:12,padding:'10px 12px',border:'1px solid #efb0b0',borderRadius:7,background:'#fff3f3',color:'#a61b1b',fontSize:11,fontWeight:800}
const footer={display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,padding:'14px 26px',borderTop:'1px solid #dce6eb',background:'#f8fafb'}
const footerNote={fontSize:10,color:'#758c97'}
const cancelButton={height:36,padding:'0 16px',border:'1px solid #cbd9df',borderRadius:7,background:'#fff',color:'#284f60',fontWeight:800,cursor:'pointer'}