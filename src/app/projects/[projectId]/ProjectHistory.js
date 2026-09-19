'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const when=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—'

export default function ProjectHistory({project}){
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    if(!project?.id)return
    let active=true
    ;(async()=>{
      setLoading(true);setError('')
      const {data,error:e}=await supabase.from('project_history').select('*').eq('project_id',project.id).order('created_at',{ascending:false})
      if(!active)return
      if(e)setError(e.message)
      else setItems(data||[])
      setLoading(false)
    })()
    return()=>{active=false}
  },[project?.id])

  if(loading)return <div style={empty}>Loading project history...</div>
  if(error)return <div style={errorBox}>Unable to load history: {error}</div>
  if(!items.length)return <div style={empty}>No audited actions recorded yet. New project activity will appear here automatically.</div>

  return <div style={list}>{items.map(item=><div key={item.id} style={entry}>
    <div style={rail}><span style={dot}/><span style={line}/></div>
    <div style={body}>
      <div style={top}><strong style={label}>{item.action_label}</strong><span style={date}>{when(item.created_at)}</span></div>
      {item.description&&<div style={description}>{item.description}</div>}
      <div style={meta}><strong>{item.performed_by_name||'RitsuFlow User'}</strong>{item.entity_type&&<><span>·</span><span>{item.entity_type}</span></>}</div>
      {item.metadata&&Object.keys(item.metadata).length>0&&<HistoryMetadata metadata={item.metadata}/>} 
    </div>
  </div>)}</div>
}

function HistoryMetadata({metadata}){
  const changes=metadata?.changes
  if(!changes||typeof changes!=='object')return null
  const rows=Object.entries(changes)
  if(!rows.length)return null
  return <div style={changesBox}>{rows.map(([field,value])=><div key={field} style={changeRow}>
    <span style={fieldName}>{field}</span>
    {value&&typeof value==='object'&&('from'in value||'to'in value)?<span><span style={oldValue}>{String(value.from??'—')}</span><span style={arrow}> → </span><strong>{String(value.to??'—')}</strong></span>:<strong>{String(value??'—')}</strong>}
  </div>)}</div>
}

const list={padding:'10px 4px 4px',overflowY:'auto',minHeight:0,maxHeight:'100%'}
const entry={display:'grid',gridTemplateColumns:'22px 1fr',gap:8,minHeight:66}
const rail={position:'relative',display:'flex',justifyContent:'center'}
const dot={position:'relative',zIndex:2,width:9,height:9,borderRadius:'50%',background:'#08a2a2',marginTop:6,boxShadow:'0 0 0 4px #e7f7f7'}
const line={position:'absolute',top:17,bottom:0,width:1,background:'#d6e5e9'}
const body={padding:'0 8px 13px 0',borderBottom:'1px solid #edf2f4',minWidth:0}
const top={display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}
const label={fontSize:12.5,color:'#103b4e'}
const date={fontSize:10.5,color:'#718793',whiteSpace:'nowrap'}
const description={fontSize:11.5,color:'#345a6b',marginTop:4,lineHeight:1.35}
const meta={display:'flex',gap:6,alignItems:'center',fontSize:10.5,color:'#718793',marginTop:5}
const changesBox={marginTop:7,padding:'6px 8px',border:'1px solid #dce9ed',borderRadius:6,background:'#f8fbfc'}
const changeRow={display:'grid',gridTemplateColumns:'150px 1fr',gap:10,fontSize:10.5,padding:'2px 0',color:'#365b6b'}
const fieldName={color:'#718793',fontWeight:700}
const oldValue={textDecoration:'line-through',color:'#8a9ca5'}
const arrow={color:'#08a2a2'}
const empty={padding:'18px 2px',color:'#718691',fontSize:11.5}
const errorBox={marginTop:8,padding:'8px 10px',border:'1px solid #efb0b0',background:'#fff3f3',color:'#a61b1b',borderRadius:7,fontSize:11,fontWeight:700}
