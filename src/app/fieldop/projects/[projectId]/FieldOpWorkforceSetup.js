'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

function workerName(worker) {
  if (!worker) return '—'
  return [worker.first_name, worker.middle_name, worker.last_name].filter(Boolean).join(' ') || worker.field_id || '—'
}
function label(value) { if (!value) return '—'; return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() }
const blankManual = { worker_name: '', company: '', trade: '', role: '', crew: '', field_id: '', start_date: '', end_date: '', notes: '', status: 'active' }

export default function FieldOpWorkforceSetup({ projectId, onCountChange }) {
  const [assignments, setAssignments] = useState([])
  const [manualWorkers, setManualWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState(blankManual)
  const [saving, setSaving] = useState(false)

  async function loadWorkforce() {
    if (!projectId) return
    setLoading(true); setError('')
    try {
      const [assignmentResult, manualResult] = await Promise.all([
        supabase.from('field_project_assignments').select(`id, project_id, worker_id, start_date, end_date, status, field_workers:worker_id (id, field_id, first_name, middle_name, last_name, status), field_companies:company_id (id, name), field_trades:trade_id (id, name), field_roles:role_id (id, name), field_crews:crew_id (id, name)`).eq('project_id', projectId).in('status', ['active', 'scheduled']).order('start_date', { ascending: true }),
        supabase.from('fieldop_manual_workers').select('*').eq('project_id', projectId).in('status', ['active', 'scheduled']).order('created_at', { ascending: true })
      ])
      if (assignmentResult.error) throw assignmentResult.error
      if (manualResult.error) throw manualResult.error
      const registered = assignmentResult.data || []
      const manualRows = manualResult.data || []
      setAssignments(registered); setManualWorkers(manualRows)
      onCountChange?.(registered.filter(x => x.status === 'active').length + manualRows.filter(x => x.status === 'active').length)
    } catch (err) {
      setAssignments([]); setManualWorkers([]); onCountChange?.(0); setError(err?.message || String(err))
    } finally { setLoading(false) }
  }

  useEffect(() => { loadWorkforce() }, [projectId])

  const counts = useMemo(() => {
    const all = [...assignments, ...manualWorkers]
    const crewNames = [...assignments.map(x => x.field_crews?.name), ...manualWorkers.map(x => x.crew)].filter(Boolean)
    return { active: all.filter(x => x.status === 'active').length, scheduled: all.filter(x => x.status === 'scheduled').length, crews: new Set(crewNames).size }
  }, [assignments, manualWorkers])

  async function addManualWorker(e) {
    e.preventDefault()
    if (!manual.worker_name.trim() || saving) return
    setSaving(true); setError('')
    try {
      const payload = { project_id: projectId, worker_name: manual.worker_name.trim(), company: manual.company.trim() || null, trade: manual.trade.trim() || null, role: manual.role.trim() || null, crew: manual.crew.trim() || null, field_id: manual.field_id.trim() || null, start_date: manual.start_date || null, end_date: manual.end_date || null, notes: manual.notes.trim() || null, status: manual.status }
      const { error: insertError } = await supabase.from('fieldop_manual_workers').insert(payload)
      if (insertError) throw insertError
      setManual(blankManual); setManualOpen(false); await loadWorkforce()
    } catch (err) { setError(err?.message || String(err)) }
    finally { setSaving(false) }
  }

  async function removeManualWorker(id) {
    if (!window.confirm('Remove this manual worker from this FieldOp project?')) return
    const { error: deleteError } = await supabase.from('fieldop_manual_workers').delete().eq('id', id).eq('project_id', projectId)
    if (deleteError) setError(deleteError.message); else loadWorkforce()
  }

  return <section style={panelStyle}>
    <div style={headerStyle}>
      <div><h2 style={{ margin: 0, fontSize: 17 }}>Workforce</h2><p style={subtle}>Use registered Project Assignments or add project-specific workers manually without creating a RitsuFlow user.</p></div>
      <div style={actionsStyle}><Link href="/dashboard/field-management/workforce" style={buttonStyle}>View Workforce Registry</Link><Link href="/dashboard/field-management/workforce/assignments" style={buttonStyle}>Manage Project Assignments</Link><button type="button" style={primaryStyle} onClick={() => setManualOpen(true)}>+ Add Manual Worker</button></div>
    </div>
    <div style={metricsStyle}><Metric label="Active Workers" value={counts.active} /><Metric label="Scheduled" value={counts.scheduled} /><Metric label="Crews" value={counts.crews} /></div>
    {error && <div style={errorStyle}>{error}</div>}
    {loading ? <div style={emptyStyle}>Loading project workforce...</div> : assignments.length + manualWorkers.length === 0 ? <div style={emptyStyle}><strong style={{ color: '#385365' }}>No workers are available to this project yet.</strong><span>Assign a registered worker or add someone manually for FieldOp and Daily Reports.</span><button style={{ ...primaryStyle, marginTop: 8 }} onClick={() => setManualOpen(true)}>+ Add Manual Worker</button></div> : <div style={tableWrap}><table style={tableStyle}><thead><tr style={theadStyle}><th style={th}>Worker</th><th style={th}>Source</th><th style={th}>Company</th><th style={th}>Trade</th><th style={th}>Role</th><th style={th}>Crew</th><th style={th}>Status</th><th style={th}></th></tr></thead><tbody>
      {assignments.map(item => <tr key={`registered-${item.id}`} style={trStyle}><td style={td}><strong>{workerName(item.field_workers)}</strong><small style={small}>{item.field_workers?.field_id || '—'}</small></td><td style={td}><Badge text="Registered" bg="#e3f2ff" color="#0872b9" /></td><td style={td}>{item.field_companies?.name || '—'}</td><td style={td}>{item.field_trades?.name || '—'}</td><td style={td}>{item.field_roles?.name || '—'}</td><td style={td}>{item.field_crews?.name || '—'}</td><td style={td}><Status value={item.status} /></td><td style={td}></td></tr>)}
      {manualWorkers.map(item => <tr key={`manual-${item.id}`} style={trStyle}><td style={td}><strong>{item.worker_name}</strong><small style={small}>{item.field_id || 'No field ID'}</small></td><td style={td}><Badge text="Manual" bg="#f1e9ff" color="#7040b0" /></td><td style={td}>{item.company || '—'}</td><td style={td}>{item.trade || '—'}</td><td style={td}>{item.role || '—'}</td><td style={td}>{item.crew || '—'}</td><td style={td}><Status value={item.status} /></td><td style={td}><button style={removeStyle} onClick={() => removeManualWorker(item.id)}>Remove</button></td></tr>)}
    </tbody></table></div>}

    {manualOpen && <div style={backdropStyle}><form style={modalStyle} onSubmit={addManualWorker}><header style={modalHeader}><div><h2 style={{ margin: 0 }}>Add Manual Worker</h2><p style={subtle}>Add a project-specific worker without creating a user account or canonical Workforce Registry record.</p></div><button type="button" style={closeStyle} onClick={() => setManualOpen(false)}>×</button></header><div style={formGrid}>
      <Field label="Worker Name" required value={manual.worker_name} onChange={v => setManual({...manual,worker_name:v})} wide />
      <Field label="Company / Subcontractor" value={manual.company} onChange={v => setManual({...manual,company:v})} /><Field label="Trade" value={manual.trade} onChange={v => setManual({...manual,trade:v})} />
      <Field label="Role" value={manual.role} onChange={v => setManual({...manual,role:v})} /><Field label="Crew" value={manual.crew} onChange={v => setManual({...manual,crew:v})} />
      <Field label="Field ID / Badge" value={manual.field_id} onChange={v => setManual({...manual,field_id:v})} /><label style={fieldStyle}>Status<select style={inputStyle} value={manual.status} onChange={e => setManual({...manual,status:e.target.value})}><option value="active">Active</option><option value="scheduled">Scheduled</option></select></label>
      <Field label="Start Date" type="date" value={manual.start_date} onChange={v => setManual({...manual,start_date:v})} /><Field label="End Date" type="date" value={manual.end_date} onChange={v => setManual({...manual,end_date:v})} />
      <label style={{...fieldStyle,gridColumn:'1 / -1'}}>Notes<textarea style={{...inputStyle,minHeight:70,paddingTop:9}} value={manual.notes} onChange={e => setManual({...manual,notes:e.target.value})} /></label>
    </div><footer style={modalFooter}><button type="button" style={buttonStyle} onClick={() => setManualOpen(false)}>Cancel</button><button style={primaryStyle} disabled={saving}>{saving ? 'Adding...' : 'Add Worker'}</button></footer></form></div>}
  </section>
}

function Field({ label: name, value, onChange, type='text', required=false, wide=false }) { return <label style={{...fieldStyle,...(wide?{gridColumn:'1 / -1'}:{})}}>{name}<input style={inputStyle} type={type} required={required} value={value} onChange={e => onChange(e.target.value)} /></label> }
function Metric({ label: metricLabel, value }) { return <div style={metricStyle}><small style={{ color: '#71838e' }}>{metricLabel}</small><strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: '#17384a' }}>{value}</strong></div> }
function Badge({text,bg,color}) { return <span style={{display:'inline-block',borderRadius:999,padding:'4px 8px',background:bg,color,fontWeight:700}}>{text}</span> }
function Status({value}) { return <span style={{display:'inline-block',borderRadius:999,padding:'4px 8px',background:value==='active'?'#e6f8ef':'#fff5dc',color:value==='active'?'#147a50':'#9a6a00',fontWeight:700}}>{label(value)}</span> }

const panelStyle={marginTop:12,minHeight:430,background:'#fff',border:'1px solid #d6e0e5',borderRadius:10,padding:17}; const headerStyle={display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}; const subtle={margin:'5px 0',color:'#6b7e89'}; const actionsStyle={display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}; const buttonStyle={minHeight:34,border:'1px solid #cbd9df',borderRadius:7,background:'#fff',padding:'0 11px',color:'#36586b',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,cursor:'pointer'}; const primaryStyle={...buttonStyle,borderColor:'#0aa695',background:'#0aa695',color:'#fff'}; const metricsStyle={display:'grid',gridTemplateColumns:'repeat(3,minmax(130px,1fr))',gap:10,marginTop:18,maxWidth:560}; const metricStyle={border:'1px solid #dfe7eb',borderRadius:8,padding:'11px 13px',background:'#fafcfd'}; const errorStyle={marginTop:18,border:'1px solid #f0c6c6',background:'#fff4f4',color:'#a43c3c',padding:'10px 12px',borderRadius:7}; const emptyStyle={minHeight:260,display:'grid',placeContent:'center',justifyItems:'center',textAlign:'center',gap:7,color:'#748590'}; const tableWrap={marginTop:18,border:'1px solid #dfe7eb',borderRadius:8,overflow:'auto'}; const tableStyle={width:'100%',borderCollapse:'collapse',fontSize:13}; const theadStyle={background:'#edf3f5',color:'#45606f',textAlign:'left'}; const trStyle={borderTop:'1px solid #e3eaed'}; const th={padding:'10px 12px',fontSize:11,textTransform:'uppercase',letterSpacing:'.03em',whiteSpace:'nowrap'}; const td={padding:'11px 12px',color:'#294b5d',whiteSpace:'nowrap'}; const small={display:'block',color:'#7a8b95',marginTop:2}; const removeStyle={border:'1px solid #efcaca',borderRadius:6,background:'#fff',color:'#b54b4b',padding:'6px 9px',cursor:'pointer'}; const backdropStyle={position:'fixed',inset:0,zIndex:1000,background:'rgba(7,36,50,.62)',display:'grid',placeItems:'center',padding:20}; const modalStyle={width:'min(720px,96vw)',maxHeight:'90vh',overflow:'auto',background:'#fff',borderRadius:12,boxShadow:'0 24px 70px rgba(0,0,0,.25)'}; const modalHeader={display:'flex',justifyContent:'space-between',gap:20,padding:'20px 22px',borderBottom:'1px solid #dfe7eb'}; const closeStyle={border:0,background:'transparent',fontSize:26,color:'#637986',cursor:'pointer'}; const formGrid={display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,padding:'20px 22px'}; const fieldStyle={display:'grid',gap:6,fontSize:13,fontWeight:700,color:'#486170'}; const inputStyle={width:'100%',boxSizing:'border-box',height:38,border:'1px solid #cbd9df',borderRadius:7,padding:'0 10px',font:'inherit',background:'#fff'}; const modalFooter={display:'flex',justifyContent:'flex-end',gap:9,padding:'14px 22px',borderTop:'1px solid #dfe7eb'};
