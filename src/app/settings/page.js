'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './settings.module.css'

const supabase=createClient()

const groups=[
 {title:'Organization',items:[
  {icon:'🏢',title:'Company Profile',text:'Company identity, branding, address and regional defaults.',href:'/settings/company'},
  {icon:'👥',title:'Users & Access',text:'Register users, status, roles and workspace access.',href:'/settings/users'},
  {icon:'🛡',title:'Roles & Permissions',text:'Control administrative and operational permissions.',href:'/settings/roles'}]},
 {title:'RitsuFlow Configuration',items:[
  {icon:'🧩',title:'Workspace Access',text:'Projects, PreCon, FieldOp and RitsuCAD access.',href:'/settings/workspaces'},
  {icon:'🏗',title:'Project Standards',text:'Company-wide project conventions and defaults.',href:'/settings/project-standards'},
  {icon:'📚',title:'Company Standards Library',text:'Work packages, activities, crews and productivity assumptions.',href:'/settings/standards-library'},
  {icon:'📅',title:'Calendars & Holidays',text:'Working weeks, hours and regional holidays.',href:'/settings/calendars'}]},
 {title:'Preferences',items:[
  {icon:'📐',title:'Units & Localization',text:'Units, currency, date format, timezone and language.',href:'/settings/localization'},
  {icon:'🔔',title:'Notifications',text:'Default alerts for constraints, commitments and approvals.',href:'/settings/notifications'}]},
 {title:'Administration',items:[
  {icon:'💳',title:'License & Subscription',text:'Plan, seats, usage and subscription status.',href:'/settings/license'},
  {icon:'🔐',title:'Security',text:'Authentication and company security policies.',href:'/settings/security'},
  {icon:'📋',title:'Audit & Activity',text:'Administrative changes and access activity.',href:'/settings/audit'}]}
]

export default function SettingsPage(){
 const router=useRouter();const [loading,setLoading]=useState(true)
 useEffect(()=>{let active=true;(async()=>{const {data}=await supabase.auth.getUser();if(!active)return;if(!data?.user){router.replace('/login');return}setLoading(false)})();return()=>{active=false}},[router])
 if(loading)return <main className={styles.loading}>Loading settings...</main>
 return <main className={styles.page}>
  <header className={styles.header}><div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority/></div><div className={styles.headerTitle}><h1>Settings</h1><p>Administration and RitsuFlow configuration</p></div><Link className={styles.backButton} href="/workspaces">← Back to Workspaces</Link></header>
  <div className={styles.content}><div className={styles.intro}><div><span>ADMINISTRATION</span><h2>Settings</h2><p>Manage your organization, access, standards and platform preferences from one place.</p></div></div>
   <div className={styles.groups}>{groups.map(group=><section className={styles.group} key={group.title}><h3>{group.title}</h3><div className={styles.grid}>{group.items.map(item=><Link href={item.href} className={styles.card} key={item.title}><div className={styles.icon}>{item.icon}</div><div><strong>{item.title}</strong><p>{item.text}</p></div><b>→</b></Link>)}</div></section>)}</div>
  </div>
 </main>
}
