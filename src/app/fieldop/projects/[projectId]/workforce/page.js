'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

function workerName(worker) {
  return [worker?.first_name, worker?.middle_name, worker?.last_name].filter(Boolean).join(' ').trim() || worker?.full_name || worker?.name || 'Unnamed worker'
}

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function time(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function minutes(value) {
  if (value === null || value === undefined) return '—'
  const total = Math.max(0, Math.floor(Number(value) || 0))
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

function deviceLocation() {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) return resolve({ latitude: null, longitude: null, accuracy: null, available: false })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, available: true }),
      () => resolve({ latitude: null, longitude: null, accuracy: null, available: false }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  })
}

export default function FieldOpProjectWorkforcePage() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [workers, setWorkers] = useState([])
  const [companies, setCompanies] = useState([])
  const [trades, setTrades] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    if (!projectId) return
    setError('')
    const [projectResult, assignmentResult, workerResult, companyResult, tradeResult, sessionResult] = await Promise.all([
      supabase.from('projects').select('id,code,name,project_name,standard_daily_minutes,geofence_enabled,geofence_radius_m,max_gps_accuracy_m').eq('id', projectId).maybeSingle(),
      supabase.from('field_project_assignments').select('*').eq('project_id', projectId).eq('status', 'active').order('start_date'),
      supabase.from('field_workers').select('*'),
      supabase.from('field_companies').select('*'),
      supabase.from('field_trades').select('*'),
      supabase.from('field_attendance_sessions').select('*').eq('project_id', projectId).eq('work_date', todayKey()).order('check_in_at', { ascending: false }),
    ])
    const failure = [projectResult, assignmentResult, workerResult, companyResult, tradeResult, sessionResult].find((r) => r.error)
    if (failure?.error) throw failure.error
    setProject(projectResult.data || null)
    setAssignments(assignmentResult.data || [])
    setWorkers(workerResult.data || [])
    setCompanies(companyResult.data || [])
    setTrades(tradeResult.data || [])
    setSessions(sessionResult.data || [])
    setNow(Date.now())
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    load().catch((e) => setError(e?.message || 'Unable to load FieldOp workforce.')).finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const workerMap = useMemo(() => new Map(workers.map((x) => [x.id, x])), [workers])
  const companyMap = useMemo(() => new Map(companies.map((x) => [x.id, x])), [companies])
  const tradeMap = useMemo(() => new Map(trades.map((x) => [x.id, x])), [trades])
  const openMap = useMemo(() => {
    const map = new Map()
    sessions.filter((s) => s.status === 'open').forEach((s) => { if (!map.has(s.worker_id)) map.set(s.worker_id, s) })
    return map
  }, [sessions])

  const rows = useMemo(() => assignments.map((assignment) => {
    const open = openMap.get(assignment.worker_id)
    const closed = sessions.filter((s) => s.worker_id === assignment.worker_id && s.status === 'closed')
    const closedMinutes = closed.reduce((sum, s) => sum + (Number(s.worked_minutes) || 0), 0)
    const currentMinutes = open?.check_in_at ? Math.max(0, Math.floor((now - new Date(open.check_in_at).getTime()) / 60000)) : 0
    return {
      assignment,
      worker: workerMap.get(assignment.worker_id),
      company: companyMap.get(assignment.company_id),
      trade: tradeMap.get(assignment.trade_id),
      open,
      worked: closedMinutes + currentMinutes,
      currentMinutes,
    }
  }).sort((a, b) => workerName(a.worker).localeCompare(workerName(b.worker))), [assignments, openMap, sessions, workerMap, companyMap, tradeMap, now])

  async function checkIn(assignment) {
    setProcessing(assignment.id); setError(''); setMessage('Capturing location...')
    try {
      const location = await deviceLocation()
      const { error: rpcError } = await supabase.rpc('field_worker_check_in', {
        p_assignment_id: assignment.id,
        p_method: 'supervisor',
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_gps_accuracy_m: location.accuracy,
        p_notes: location.available ? null : 'Device location unavailable',
      })
      if (rpcError) throw rpcError
      setMessage(`${workerName(workerMap.get(assignment.worker_id))} checked in successfully.`)
      await load()
    } catch (e) { setError(e?.message || 'Unable to check worker in.'); setMessage('') }
    finally { setProcessing(null) }
  }

  async function checkOut(session) {
    setProcessing(session.id); setError(''); setMessage('Capturing location...')
    try {
      const location = await deviceLocation()
      const { error: rpcError } = await supabase.rpc('field_worker_check_out', {
        p_session_id: session.id,
        p_method: 'supervisor',
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_gps_accuracy_m: location.accuracy,
        p_notes: location.available ? null : 'Device location unavailable',
      })
      if (rpcError) throw rpcError
      setMessage(`${workerName(workerMap.get(session.worker_id))} checked out successfully.`)
      await load()
    } catch (e) { setError(e?.message || 'Unable to check worker out.'); setMessage('') }
    finally { setProcessing(null) }
  }

  const allowed = project?.standard_daily_minutes ?? null
  const onSite = rows.filter((r) => r.open).length
  const checkedOut = new Set(sessions.filter((s) => s.status === 'closed').map((s) => s.worker_id)).size
  const over = allowed === null ? 0 : rows.filter((r) => r.worked > Number(allowed)).length
  const projectName = project?.name || project?.project_name || 'Project'

  return <main style={{ minHeight: '100vh', background: '#f6f8fa', color: '#0f172a' }}>
    <header style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'18px 28px',borderBottom:'1px solid #e2e8f0',background:'#fff' }}>
      <div><div style={{fontSize:12,fontWeight:800,letterSpacing:'.08em',color:'#64748b'}}>FIELD OPERATIONS / {projectName.toUpperCase()}</div><h1 style={{margin:'5px 0 0',fontSize:24,color:'#061b2f'}}>Live Attendance</h1></div>
      <div style={{display:'flex',gap:8}}><button onClick={() => load().catch((e)=>setError(e.message))} style={button(false)}>Refresh</button><Link href={`/fieldop/projects/${projectId}`} style={{...button(false),textDecoration:'none',display:'flex',alignItems:'center'}}>← Project Setup</Link></div>
    </header>

    <section style={{padding:'26px 28px 40px',display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
        <Metric label="Active Workforce" value={rows.length}/><Metric label="On Site" value={onSite}/><Metric label="Checked Out Today" value={checkedOut}/><Metric label="Over Allowed Hours" value={over}/>
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',padding:16,border:'1px solid #e2e8f0',borderRadius:12,background:'#fff'}}>
        <Info label="Project" value={projectName}/><Info label="Daily Hours" value={allowed === null ? 'Not configured' : minutes(allowed)}/><Info label="Geofence" value={project?.geofence_enabled ? `Enabled · ${project?.geofence_radius_m || '—'} m` : 'Disabled'}/><Info label="GPS Accuracy" value={project?.max_gps_accuracy_m == null ? 'Not configured' : `${project.max_gps_accuracy_m} m`}/>
      </div>
      {error && <div style={{padding:12,border:'1px solid #fecaca',borderRadius:9,background:'#fef2f2',color:'#991b1b'}}>{error}</div>}
      {message && <div style={{padding:12,border:'1px solid #bae6fd',borderRadius:9,background:'#f0f9ff',color:'#075985'}}>{message}</div>}
      <section style={{overflow:'hidden',border:'1px solid #e2e8f0',borderRadius:14,background:'#fff'}}>
        <div style={{padding:'16px 18px',borderBottom:'1px solid #e2e8f0'}}><strong>Project Workforce</strong></div>
        {loading ? <div style={empty}>Loading workforce...</div> : rows.length === 0 ? <div style={empty}>No active workers are assigned to this project.</div> : <div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:1050,borderCollapse:'collapse'}}><thead><tr style={{background:'#f8fafc'}}>{['Field ID','Worker','Company','Trade','Status','Check-In','Current Session','Worked Today','Action'].map((h)=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{rows.map((row)=><tr key={row.assignment.id} style={{borderTop:'1px solid #e2e8f0'}}><td style={td}>{row.worker?.field_id || row.worker?.employee_number || '—'}</td><td style={td}><strong>{workerName(row.worker)}</strong></td><td style={td}>{row.company?.name || row.company?.company_name || '—'}</td><td style={td}>{row.trade?.name || row.trade?.trade_name || '—'}</td><td style={td}><span style={{fontWeight:800,color:row.open?'#047857':'#64748b'}}>{row.open?'● On Site':'○ Off Site'}</span></td><td style={td}>{time(row.open?.check_in_at || sessions.find((s)=>s.worker_id===row.assignment.worker_id)?.check_in_at)}</td><td style={td}>{row.open ? minutes(row.currentMinutes) : '—'}</td><td style={td}><strong>{minutes(row.worked)}</strong></td><td style={td}>{row.open ? <button disabled={processing===row.open.id} onClick={()=>checkOut(row.open)} style={button(false)}>{processing===row.open.id?'Checking Out...':'Check Out'}</button> : <button disabled={processing===row.assignment.id} onClick={()=>checkIn(row.assignment)} style={button(true)}>{processing===row.assignment.id?'Checking In...':'Check In'}</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </section>
  </main>
}

const th={padding:'11px 14px',color:'#64748b',fontSize:11,fontWeight:800,textAlign:'left',textTransform:'uppercase',whiteSpace:'nowrap'}
const td={padding:'13px 14px',color:'#475569',fontSize:13,whiteSpace:'nowrap'}
const empty={padding:36,color:'#64748b',textAlign:'center'}
function button(primary){return{minHeight:38,padding:'0 14px',border:`1px solid ${primary?'#078c7c':'#cbd5e1'}`,borderRadius:9,background:primary?'#08aa96':'#fff',color:primary?'#fff':'#082a4a',fontWeight:800,cursor:'pointer'}}
function Metric({label,value}){return <div style={{padding:17,border:'1px solid #e2e8f0',borderRadius:12,background:'#fff'}}><div style={{fontSize:11,fontWeight:800,color:'#64748b',textTransform:'uppercase'}}>{label}</div><div style={{marginTop:6,fontSize:24,fontWeight:850,color:'#061b2f'}}>{value}</div></div>}
function Info({label,value}){return <div style={{minWidth:180,flex:'1 1 180px'}}><div style={{fontSize:11,fontWeight:800,color:'#64748b',textTransform:'uppercase'}}>{label}</div><div style={{marginTop:5,fontWeight:750,color:'#334155'}}>{value}</div></div>}
