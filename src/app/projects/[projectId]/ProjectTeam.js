'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { Empty, Notice, ui } from '../../fieldop/ui'

const ROLES=['manager','superintendent','project_engineer','planner','field_engineer','foreman','viewer']
const profileLabel=profile=>profile?.full_name?.trim()||profile?.display_name?.trim()||profile?.email?.trim()||''

export default function ProjectTeam({project}){
 const t=useT('projects'),{language}=useLanguage()
 const roleLabel=value=>t(`team.role.${value||'viewer'}`)
 const dateTime=v=>v?new Intl.DateTimeFormat(language,{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'
 const[members,setMembers]=useState([]),[users,setUsers]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[userId,setUserId]=useState(''),[role,setRole]=useState('manager')
 useEffect(()=>{if(!project?.id||!project?.organization_id)return;let active=true;(async()=>{setLoading(true);setError('');const[{data:pm,error:pmError},{data:om,error:omError}]=await Promise.all([supabase.from('project_members').select('project_id,user_id,role,joined_at').eq('project_id',project.id).order('joined_at',{ascending:true}),supabase.from('organization_members').select('user_id,role,status').eq('organization_id',project.organization_id).eq('status','active')]);if(!active)return;if(pmError||omError){setError(pmError?.message||omError?.message||t('team.errLoad'));setLoading(false);return}const ids=[...new Set([...(pm||[]).map(x=>x.user_id),...(om||[]).map(x=>x.user_id)])];let profiles=[];if(ids.length){const{data,error:e}=await supabase.from('user_profiles').select('user_id,email,full_name,display_name,job_title,status').in('user_id',ids);if(e){setError(e.message);setLoading(false);return}profiles=data||[]}const byId=Object.fromEntries(profiles.map(p=>[p.user_id,p]));setUsers((om||[]).map(x=>({...x,profile:byId[x.user_id]||null})).filter(x=>profileLabel(x.profile)));setMembers((pm||[]).map(x=>({...x,profile:byId[x.user_id]||null})));setLoading(false)})();return()=>{active=false}},[project?.id,project?.organization_id])
 const available=useMemo(()=>users.filter(u=>!members.some(m=>m.user_id===u.user_id)),[users,members])
 useEffect(()=>{if(!userId&&available.length)setUserId(available[0].user_id);if(userId&&!available.some(u=>u.user_id===userId))setUserId(available[0]?.user_id||'')},[available,userId])
 async function addMember(){if(!userId||saving)return;setSaving(true);setError('');const{data,error:e}=await supabase.from('project_members').insert({project_id:project.id,user_id:userId,role}).select('project_id,user_id,role,joined_at').single();if(e){setError(e.message);setSaving(false);return}const u=users.find(x=>x.user_id===userId);setMembers(current=>[...current,{...data,profile:u?.profile||null}]);setSaving(false)}
 async function changeRole(member,nextRole){setError('');const{error:e}=await supabase.from('project_members').update({role:nextRole}).eq('project_id',project.id).eq('user_id',member.user_id);if(e){setError(e.message);return}setMembers(current=>current.map(m=>m.user_id===member.user_id?{...m,role:nextRole}:m))}
 async function removeMember(member){const name=profileLabel(member.profile)||'—';if(!window.confirm(t('team.confirmRemove',{name})))return;setError('');const{error:e}=await supabase.from('project_members').delete().eq('project_id',project.id).eq('user_id',member.user_id);if(e){setError(e.message);return}setMembers(current=>current.filter(m=>m.user_id!==member.user_id))}
 return <div style={{display:'grid',gap:14}}>
  <Notice>{error}</Notice>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10,alignItems:'end'}}>
   <label style={{display:'grid',gap:6}}><b style={{fontSize:14}}>{t('team.person')}</b><select value={userId} onChange={e=>setUserId(e.target.value)} disabled={!available.length}>{available.length?available.map(u=><option key={u.user_id} value={u.user_id}>{profileLabel(u.profile)}</option>):<option value="">{t('team.noneAvailable')}</option>}</select></label>
   <label style={{display:'grid',gap:6}}><b style={{fontSize:14}}>{t('team.projectRole')}</b><select value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
   <button type="button" className={ui.btnPrimary} onClick={addMember} disabled={!userId||saving}>{saving?t('team.adding'):t('team.add')}</button>
  </div>
  {loading?<Empty title={t('team.loading')}/>:members.length===0?<Empty title={t('team.empty')}/>:<div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards}`}>
   <thead><tr><th>{t('team.colName')}</th><th>{t('team.colJob')}</th><th>{t('team.projectRole')}</th><th>{t('team.colAdded')}</th><th/></tr></thead>
   <tbody>{members.map(m=><tr key={m.user_id}>
    <td data-label=""><span><strong>{profileLabel(m.profile)||t('team.noProfile')}</strong><span className={ui.sub}>{m.profile?.email||''}</span></span></td>
    <td data-label={t('team.colJob')}>{m.profile?.job_title||'—'}</td>
    <td data-label={t('team.projectRole')}><select value={m.role||'viewer'} onChange={e=>changeRole(m,e.target.value)} style={{minWidth:180}}>{m.role==='field'&&<option value="field">{roleLabel('field')}</option>}{ROLES.map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></td>
    <td data-label={t('team.colAdded')}>{dateTime(m.joined_at)}</td>
    <td data-label="" style={{textAlign:'right'}}><button type="button" className={`${ui.btnDanger} ${ui.small}`} onClick={()=>removeMember(m)}>{t('team.remove')}</button></td>
   </tr>)}</tbody>
  </table></div>}
 </div>
}
