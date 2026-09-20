'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import styles from './users.module.css'

const supabase=createClient()
const label=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())

export default function UsersAccess(){
 const router=useRouter(); const [loading,setLoading]=useState(true); const [org,setOrg]=useState(null); const [members,setMembers]=useState([]); const [message,setMessage]=useState(''); const [search,setSearch]=useState('')
 useEffect(()=>{let active=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/login');return}const {data:mine,error:mineError}=await supabase.from('organization_members').select('organization_id,role,status,organizations(id,name,slug)').eq('user_id',user.id).eq('status','active');if(mineError)throw mineError;const membership=mine?.find(x=>['owner','admin'].includes(x.role))||mine?.[0];if(!membership)throw new Error('No company is connected to this account.');const organization=membership.organizations;const {data,error}=await supabase.from('organization_members').select('organization_id,user_id,role,status,joined_at,project_access_mode,profiles(id,full_name,email)').eq('organization_id',membership.organization_id).order('joined_at',{ascending:true});if(error)throw error;if(active){setOrg(organization);setMembers(data||[]);setLoading(false)}})().catch(e=>{if(active){setMessage(e.message);setLoading(false)}});return()=>{active=false}},[router])
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return members.filter(m=>!q||[m.profiles?.full_name,m.profiles?.email,m.role,m.status].join(' ').toLowerCase().includes(q))},[members,search])
 const active=members.filter(m=>m.status==='active').length
 if(loading)return <main className={styles.loading}>Loading users & access...</main>
 return <main className={styles.page}><header className={styles.header}><div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority/></div><div className={styles.headerTitle}><h1>Users & Access</h1><p>Company users, roles and access control</p></div><Link className={styles.backButton} href="/workspaces">← Back to Workspaces</Link></header><section className={styles.content}>
  <div className={styles.intro}><div><span>ORGANIZATION SETTINGS</span><h2>Users & Access</h2><p>Manage the people who can access {org?.name||'this company'} in RitsuFlow.</p></div><button disabled title="User invitation will be connected in the next step">+ Add User</button></div>
  {message&&<div className={styles.message}>{message}</div>}
  <section className={styles.stats}><article><small>REGISTERED USERS</small><strong>{members.length}</strong><p>Organization members</p></article><article><small>ACTIVE USERS</small><strong>{active}</strong><p>Currently consuming access</p></article><article><small>ADMINISTRATORS</small><strong>{members.filter(m=>['owner','admin'].includes(m.role)).length}</strong><p>Company administration access</p></article><article><small>COMPANY</small><strong className={styles.company}>{org?.name||'—'}</strong><p>{org?.slug||'Tenant isolated'}</p></article></section>
  <section className={styles.card}><div className={styles.cardHead}><div><h3>Company Users</h3><p>Users belong to the company tenant. Project assignments are managed separately.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..."/></div><div className={styles.tableWrap}><table><thead><tr><th>User</th><th>Email</th><th>Company Role</th><th>Status</th><th>Project Access</th><th>Joined</th><th></th></tr></thead><tbody>{filtered.map(m=><tr key={m.user_id}><td><div className={styles.person}><b>{(m.profiles?.full_name||m.profiles?.email||'?').slice(0,1).toUpperCase()}</b><span><strong>{m.profiles?.full_name||'RitsuFlow User'}</strong><small>{m.user_id===org?.owner_user_id?'Primary Admin':''}</small></span></div></td><td>{m.profiles?.email||'—'}</td><td><span className={styles.role}>{label(m.role)}</span></td><td><span className={`${styles.status} ${styles[m.status]||''}`}>● {label(m.status)}</span></td><td>{label(m.project_access_mode||'assigned_projects')}</td><td>{m.joined_at?new Date(m.joined_at).toLocaleDateString():'—'}</td><td><button className={styles.edit} disabled title="Editing will be connected with Roles & Permissions">Edit</button></td></tr>)}{!filtered.length&&<tr><td colSpan="7" className={styles.empty}>No users found.</td></tr>}</tbody></table></div></section>
  <div className={styles.note}><strong>Access architecture</strong><span>Company membership controls access to the tenant. Project Team controls participation in an individual project. Roles & Permissions and Workspace Access will be configured in their dedicated Settings sections.</span></div>
 </section></main>
}
