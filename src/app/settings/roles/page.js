'use client'
import Image from 'next/image'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '../../../lib/supabase/client'
import styles from './roles.module.css'

const supabase=createClient()
const roles=[
 {key:'admin',name:'Admin',tag:'Full control',description:'Organization administration and full operational control.'},
 {key:'manager',name:'Manager',tag:'Project control',description:'Manage projects, teams, planning and field operations.'},
 {key:'member',name:'Member',tag:'Operational',description:'Create and update information within assigned access.'},
 {key:'viewer',name:'Viewer',tag:'Read only',description:'View project information and generate reports.'}
]
const groups=[
 {name:'Organization Administration',items:[
  ['company_settings','Manage company settings',{admin:1}],
  ['users_manage','Manage users & access',{admin:1}],
  ['roles_manage','Manage roles & permissions',{admin:1}],
  ['workspace_settings','Manage workspace configuration',{admin:1}]
 ]},
 {name:'Projects',items:[
  ['project_create','Create projects',{admin:1,manager:1}],
  ['project_edit','Edit project setup',{admin:1,manager:1}],
  ['project_operate','Perform project operations',{admin:1,manager:1,member:1}],
  ['project_close','Start / complete project closeout',{admin:1,manager:1}],
  ['project_reopen','Reopen a closed project',{admin:1}],
  ['project_delete','Delete projects',{admin:1}]
 ]},
 {name:'PreCon',items:[
  ['planning_manage','Create & update planning',{admin:1,manager:1,member:1}],
  ['constraints_manage','Manage constraints & readiness',{admin:1,manager:1,member:1}],
  ['commitments_manage','Manage weekly commitments',{admin:1,manager:1,member:1}],
  ['planning_approve','Approve planning decisions',{admin:1,manager:1}]
 ]},
 {name:'FieldOp',items:[
  ['daily_reports','Create & update Daily Reports',{admin:1,manager:1,member:1}],
  ['workforce','Manage workforce records',{admin:1,manager:1,member:1}],
  ['attendance_admin','Manage attendance exceptions',{admin:1,manager:1}],
  ['field_approve','Approve field records',{admin:1,manager:1}]
 ]},
 {name:'RitsuCAD & Reporting',items:[
  ['ritsucad_edit','Create & edit RitsuCAD takeoffs',{admin:1,manager:1,member:1}],
  ['reports_view','View reports',{admin:1,manager:1,member:1,viewer:1}],
  ['reports_generate','Generate & export reports',{admin:1,manager:1,member:1,viewer:1}]
 ]}
]
export default function RolesPermissions(){const router=useRouter();const[loading,setLoading]=useState(true);useEffect(()=>{let alive=true;(async()=>{const{data}=await supabase.auth.getUser();if(!alive)return;if(!data?.user){router.replace('/login');return}setLoading(false)})();return()=>{alive=false}},[router]);if(loading)return <main className={styles.loading}>Loading roles & permissions...</main>;return <main className={styles.page}><header className={styles.header}><div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority/></div><div className={styles.headerTitle}><h1>Roles & Permissions</h1><p>Control what each RitsuFlow role can do</p></div><Link className={styles.backButton} href="/settings">← Return to Settings</Link></header><section className={styles.content}><div className={styles.summary}><div><span>ROLE-BASED ACCESS CONTROL</span><h2>Permission Matrix</h2><p>Roles define what users can do. Workspace Access defines where they can go, and Project Access defines which projects they can access.</p></div><div className={styles.owner}><b>Owner</b><span>Organization authority</span><small>Ownership is transferred separately and is not an assignable everyday role.</small></div></div><div className={styles.roleCards}>{roles.map(r=><article key={r.key}><div><strong>{r.name}</strong><span>{r.tag}</span></div><p>{r.description}</p>{r.key==='admin'&&<small>🔒 Protected system role</small>}</article>)}</div><div className={styles.closedRule}><b>🔒 Closed Project = Read Only</b><span>Project closure overrides every role. Closed projects allow visualization, search, reporting and export only. Operational changes require an authorized project reopen action.</span></div><section className={styles.matrix}><div className={styles.matrixHead}><div>Capability</div>{roles.map(r=><div key={r.key}><b>{r.name}</b><small>{r.tag}</small></div>)}</div>{groups.map(g=><div className={styles.group} key={g.name}><h3>{g.name}</h3>{g.items.map(([key,name,access])=><div className={styles.row} key={key}><div><b>{name}</b></div>{roles.map(r=><div key={r.key}>{access[r.key]?<span className={styles.yes}>✓</span>:<span className={styles.no}>—</span>}</div>)}</div>)}</div>)}</section><div className={styles.note}><b>Permission architecture</b><span>Admin is the protected organization administration role. Manager, Member and Viewer use standard RitsuFlow permission profiles. Role customization can be introduced later without changing user, workspace or project assignments.</span></div></section></main>