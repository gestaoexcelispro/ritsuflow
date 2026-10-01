'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import styles from './workforce.module.css'

const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const name=w=>w?[w.first_name,w.middle_name,w.last_name].filter(Boolean).join(' ')||'Unnamed worker':'Unknown worker'
const minutes=v=>{const n=Math.max(0,Math.floor(Number(v)||0));return `${Math.floor(n/60)}h ${String(n%60).padStart(2,'0')}m`}
const time=v=>v?new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—'

export default function TimecardsPanel({projects=[],workers=[],query=''}){
  const [projectId,setProjectId]=useState(''),[date,setDate]=useState(localDate()),[sessions,setSessions]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(!projectId&&projects.length)setProjectId(projects[0].id)},[projects,projectId])
  const load=useCallback(async()=>{if(!projectId||!date){setSessions([]);return}setLoading(true);setError('');try{const {data,error}=await supabase.from('field_attendance_sessions').select('id,worker_id,project_id,work_date,check_in_at,check_out_at,status,worked_minutes,regular_minutes,overtime_minutes,has_exception,exception_code').eq('project_id',projectId).eq('work_date',date).order('check_in_at',{ascending:true});if(error)throw error;setSessions(data||[])}catch(e){setError(e?.message||'Unable to load timecards.')}finally{setLoading(false)}},[projectId,date])
  useEffect(()=>{load()},[load])
  const workerMap=useMemo(()=>new Map(workers.map(w=>[w.id,w])),[workers])
  const selectedProject=projects.find(p=>p.id===projectId)||null
  const cards=useMemo(()=>{const grouped=new Map();sessions.forEach(s=>grouped.set(s.worker_id,[...(grouped.get(s.worker_id)||[]),s]));return [...grouped].map(([workerId,list])=>{const closed=list.filter(s=>s.status==='closed'||s.status==='corrected');const total=closed.reduce((n,s)=>n+(Number(s.worked_minutes)||0),0);const allowed=selectedProject?.standard_daily_minutes??null;const open=list.some(s=>s.status==='open');return{workerId,worker:workerMap.get(workerId),list,total,allowed,variance:allowed==null?null:total-Number(allowed),open,exception:list.some(s=>s.has_exception),corrected:list.some(s=>s.status==='corrected'),first:list[0]?.check_in_at,last:[...closed].reverse()[0]?.check_out_at}}).sort((a,b)=>name(a.worker).localeCompare(name(b.worker)))},[sessions,selectedProject,workerMap])
  const q=query.trim().toLowerCase();const filtered=!q?cards:cards.filter(c=>[name(c.worker),c.worker?.field_id,c.worker?.company_employee_number].some(v=>String(v||'').toLowerCase().includes(q)))
  const labor=cards.reduce((n,c)=>n+c.total,0),exceptions=cards.filter(c=>c.exception).length,open=cards.filter(c=>c.open).length
  return <>
    <section className={styles.kpis}><article><span>♙</span><div><small>Workers With Attendance</small><strong>{cards.length}</strong><em>selected day</em></div></article><article><span>◷</span><div><small>Total Labor</small><strong>{minutes(labor)}</strong><em>closed sessions</em></div></article><article><span>!</span><div><small>Exceptions</small><strong>{exceptions}</strong><em>flagged timecards</em></div></article><article><span>○</span><div><small>Open Sessions</small><strong>{open}</strong><em>not checked out</em></div></article></section>
    <section className={styles.panel}><div className={styles.panelHead}><div><h2>Timecards</h2><p>Daily attendance totals and variance against the project's allowed working time.</p></div><div style={{display:'flex',gap:8}}><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div></div>{error&&<div className={styles.error}>{error}</div>}{loading?<div className={styles.empty}><b>Loading timecards...</b></div>:filtered.length===0?<div className={styles.empty}><b>No attendance recorded for this project and date.</b></div>:<div className={styles.tableWrap}><table><thead><tr><th>Worker</th><th>First In</th><th>Last Out</th><th>Worked</th><th>Allowed</th><th>Variance</th><th>Sessions</th><th>Status</th></tr></thead><tbody>{filtered.map(c=><tr key={c.workerId}><td><strong>{name(c.worker)}</strong><small>{c.worker?.field_id||c.worker?.company_employee_number||''}</small></td><td>{time(c.first)}</td><td>{time(c.last)}</td><td>{minutes(c.total)}</td><td>{c.allowed==null?'Not configured':minutes(c.allowed)}</td><td>{c.variance==null?'—':`${c.variance>0?'+':c.variance<0?'-':''}${minutes(Math.abs(c.variance))}`}</td><td>{c.list.length}</td><td><span className={c.open||c.exception?styles.inactive:styles.live}>{c.open?'Open Session':c.exception?'Exception':c.corrected?'Corrected':'Within Allowance'}</span></td></tr>)}</tbody></table></div>}</section>
  </>
}
