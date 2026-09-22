'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function RitsuCadDrawingViewsPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const activeViewId = searchParams.get('viewId')
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!projectId || !documentId) return undefined
    const handler = () => setOpen(true)
    window.addEventListener('ritsucad:open-drawing-views', handler)
    return () => window.removeEventListener('ritsucad:open-drawing-views', handler)
  }, [projectId, documentId])

  useEffect(() => {
    if (!open || !projectId || !documentId) return
    let active = true
    ;(async () => {
      setLoading(true); setError('')
      const { data, error: queryError } = await supabase
        .from('ritsucad_drawing_views')
        .select('id,name,purpose,updated_at')
        .eq('project_id', projectId)
        .eq('document_id', documentId)
        .order('updated_at', { ascending: false })
      if (!active) return
      if (queryError) setError(queryError.message); else setViews(data || [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [open, projectId, documentId])

  if (!open || !projectId || !documentId) return null

  function openView(id) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('viewId', id)
    router.replace(`/ritsucad/project-document?${params.toString()}`)
    setOpen(false)
  }

  function newView() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('viewId')
    router.replace(`/ritsucad/project-document?${params.toString()}`)
    window.dispatchEvent(new CustomEvent('ritsucad:new-drawing-view'))
    setOpen(false)
  }

  return <div style={backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
    <section style={modal} role="dialog" aria-modal="true" aria-label="RitsuCAD drawing views">
      <div style={header}><div><div style={eyebrow}>RITSUCAD™ · DRAWING VIEWS</div><h2 style={title}>Drawing Views</h2><p style={subtitle}>Use the same source PDF for separate LBS, takeoff, markup, and planning drawings.</p></div><button type="button" style={closeButton} onClick={() => setOpen(false)}>×</button></div>
      <div style={body}>
        <button type="button" style={newButton} onClick={newView}>＋ New clean view from this PDF</button>
        {loading && <div style={helper}>Loading drawing views…</div>}
        {!loading && !views.length && <div style={empty}>No saved views yet. Create the first one from the current PDF.</div>}
        <div style={list}>{views.map((view) => <button type="button" key={view.id} style={{...row,...(view.id === activeViewId ? activeRow : {})}} onClick={() => openView(view.id)}><span style={{minWidth:0}}><strong style={name}>{view.name}</strong><small style={meta}>{view.purpose || 'general'} · {new Date(view.updated_at).toLocaleString()}</small></span><span style={arrow}>{view.id === activeViewId ? 'OPEN' : '→'}</span></button>)}</div>
        {error && <div style={errorBox}>{error}</div>}
      </div>
      <div style={footer}>The Project Document PDF remains the source of truth. Each view stores only RitsuCAD geometry and calibration.</div>
    </section>
  </div>
}

const backdrop={position:'fixed',inset:0,zIndex:10020,display:'grid',placeItems:'center',padding:24,background:'rgba(7,35,50,.55)',backdropFilter:'blur(2px)'}
const modal={width:'min(650px,94vw)',maxHeight:'82vh',overflow:'hidden',background:'#fff',borderRadius:14,boxShadow:'0 28px 70px rgba(0,0,0,.28)',color:'#0d3347'}
const header={display:'flex',justifyContent:'space-between',gap:20,padding:'22px 24px 18px',borderBottom:'1px solid #dce6eb'}
const eyebrow={fontSize:10,fontWeight:900,letterSpacing:'1.4px',color:'#008f8f'}
const title={margin:'5px 0 4px',fontSize:24,fontWeight:900,color:'#092f44'}
const subtitle={margin:0,fontSize:12,lineHeight:1.5,color:'#69818d'}
const closeButton={width:34,height:34,border:0,borderRadius:'50%',background:'#eef4f6',color:'#55717e',fontSize:22,cursor:'pointer'}
const body={padding:'18px 24px',maxHeight:'54vh',overflowY:'auto'}
const newButton={width:'100%',height:42,border:0,borderRadius:7,background:'#079b9b',color:'#fff',fontWeight:900,cursor:'pointer',marginBottom:12}
const list={display:'grid',gap:8}
const row={display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,width:'100%',padding:'12px 13px',border:'1px solid #d7e3e8',borderRadius:8,background:'#fff',textAlign:'left',cursor:'pointer'}
const activeRow={border:'1px solid #079b9b',background:'#f0fbfb'}
const name={display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12.5,color:'#10394d'}
const meta={display:'block',marginTop:4,fontSize:10,color:'#78909b'}
const arrow={fontSize:10,fontWeight:900,color:'#079b9b'}
const helper={padding:14,textAlign:'center',fontSize:11,color:'#728a96'}
const empty={padding:18,border:'1px dashed #cadbe2',borderRadius:8,textAlign:'center',fontSize:11.5,color:'#748c97'}
const errorBox={marginTop:12,padding:'10px 12px',border:'1px solid #efb0b0',borderRadius:7,background:'#fff3f3',color:'#a61b1b',fontSize:11,fontWeight:800}
const footer={padding:'12px 24px',borderTop:'1px solid #dce6eb',background:'#f8fafb',fontSize:10,color:'#758c97'}
