'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './workspaces.module.css'

const supabase = createClient()

const workspaces = [
  { key:'projects', eyebrow:'CREATE · ORGANIZE · MANAGE', name:'Projects', subtitle:'Project Portfolio', description:'Create and manage projects shared across the RitsuFlow production system.', features:['Project Information','Project Team','Locations','Module Access','Project Status'], visual:'/projects-icon.png', href:'/projects', action:'Enter Projects' },
  { key:'precon', eyebrow:'PLAN · PREPARE · CONTROL', name:'PreCon', subtitle:'Plan & Prepare', description:'Structure the project, prepare executable work, manage constraints, and control production flow.', features:['Project Setup & Locations','Pre-Planning & Master Plan','Lookahead & Constraints','Weekly Planning','Planning Reports'], visual:'/precon-icon.png', href:'/dashboard', action:'Enter PreCon' },
  { key:'fieldop', eyebrow:'EXECUTE · CAPTURE · MEASURE', name:'FieldOp', subtitle:'Execute & Measure', description:'Bring the plan to the field. Coordinate operations, capture production, and measure actual performance.', features:['Daily Scrum','Operations & Production','Workforce Management','Location Tracking','Daily Reports & Field Data'], visual:'/fieldop-icon.png', href:'/fieldop', action:'Enter FieldOp' },
  { key:'ritsucad', eyebrow:'DRAW · QUANTIFY · CONNECT', name:'RitsuCAD', subtitle:'Draw & Quantify', description:'Work with drawings, takeoffs, and quantities that connect planning and field execution.', features:['Drawing Workspace','Measurements & Takeoffs','Quantities','Location-Based Data','Planning & Field Integration'], visual:'/ritsucad-icon.png', href:'/ritsucad', action:'Enter RitsuCAD' },
]

export default function WorkspacesPage(){
  const router=useRouter(); const [checking,setChecking]=useState(true); const [settingsOpen,setSettingsOpen]=useState(false)
  useEffect(()=>{let active=true; async function checkSession(){const {data}=await supabase.auth.getUser(); if(!active)return; if(!data?.user){router.replace('/login');return} setChecking(false)} checkSession(); return()=>{active=false}},[router])
  if(checking)return <main className={styles.loading}>Loading RitsuFlow™...</main>
  return <main className={styles.page}>
    <div className={styles.glow}/>
    <header className={styles.header}>
      <Image src="/logo-white.png" alt="RitsuFlow" width={220} height={82} priority className={styles.logo}/>
      <div className={styles.headerRight}>
        <div className={styles.platformLabel}>CONSTRUCTION PRODUCTION SYSTEM</div>
        <button className={styles.settingsButton} onClick={()=>setSettingsOpen(true)} aria-label="Open settings" title="Settings"><span aria-hidden="true">⚙</span><span>Settings</span></button>
      </div>
    </header>
    <section className={styles.hero}><div className={styles.kicker}>WELCOME TO RITSUFLOW</div><h1>Choose your workspace</h1></section>
    <section className={styles.grid} aria-label="RitsuFlow workspaces">{workspaces.map(workspace=><article key={workspace.key} className={`${styles.card} ${styles[workspace.key]}`}>
      <div className={styles.cardTop}><span className={styles.eyebrow}>{workspace.eyebrow}</span><div className={styles.mark}>{workspace.name.slice(0,1)}</div></div>
      <div className={styles.cardBody}><h2>{workspace.name}</h2><h3>{workspace.subtitle}</h3><p>{workspace.description}</p><div className={styles.rule}/><ul>{workspace.features.map(feature=><li key={feature}><span>✓</span>{feature}</li>)}</ul><div className={styles.visualWrap} aria-hidden="true"><Image src={workspace.visual} alt="" width={1200} height={675} className={styles.workspaceVisual}/></div><Link href={workspace.href} className={styles.enterButton}>{workspace.action}<span aria-hidden="true">→</span></Link></div>
    </article>)}</section>
    <div aria-hidden="true"/>
    <footer className={styles.footer}><span>One Project</span><i/><span>One Team</span><i/><span>One Source of Truth</span><strong>BUILT FOR A HIGHER STANDARD.</strong></footer>

    {settingsOpen&&<div className={styles.settingsOverlay} onMouseDown={()=>setSettingsOpen(false)}>
      <aside className={styles.settingsPanel} onMouseDown={e=>e.stopPropagation()} aria-label="RitsuFlow settings">
        <div className={styles.settingsHeader}><div><span className={styles.settingsKicker}>ADMINISTRATION</span><h2>Settings</h2><p>Manage your company, access and RitsuFlow standards.</p></div><button className={styles.closeButton} onClick={()=>setSettingsOpen(false)} aria-label="Close settings">×</button></div>
        <div className={styles.settingsGroups}>
          <section><h3>Organization</h3><Link href="/settings/company"><b>🏢</b><span><strong>Company Profile</strong><small>Company identity, address, currency, timezone and logo</small></span><em>→</em></Link><Link href="/settings/users"><b>👥</b><span><strong>Users & Access</strong><small>Register users, status, roles and workspace access</small></span><em>→</em></Link><Link href="/settings/roles"><b>🛡</b><span><strong>Roles & Permissions</strong><small>Control administrative and operational permissions</small></span><em>→</em></Link></section>
          <section><h3>RitsuFlow Configuration</h3><Link href="/settings/workspaces"><b>🧩</b><span><strong>Workspace Access</strong><small>Projects, PreCon, FieldOp and RitsuCAD access</small></span><em>→</em></Link><Link href="/settings/project-standards"><b>🏗</b><span><strong>Project Standards</strong><small>Company-wide project conventions and defaults</small></span><em>→</em></Link><Link href="/settings/standards-library"><b>📚</b><span><strong>Company Standards Library</strong><small>Work packages, activities, crews and productivity assumptions</small></span><em>→</em></Link><Link href="/settings/calendars"><b>📅</b><span><strong>Calendars & Holidays</strong><small>Working weeks, hours and regional holidays</small></span><em>→</em></Link></section>
          <section><h3>Preferences</h3><Link href="/settings/localization"><b>📐</b><span><strong>Units & Localization</strong><small>Metric or Imperial, currency, date format and language</small></span><em>→</em></Link><Link href="/settings/notifications"><b>🔔</b><span><strong>Notifications</strong><small>Default alerts for constraints, commitments and approvals</small></span><em>→</em></Link></section>
          <section><h3>Administration</h3><Link href="/settings/license"><b>💳</b><span><strong>License & Subscription</strong><small>Plan, seats, usage and subscription status</small></span><em>→</em></Link><Link href="/settings/security"><b>🔐</b><span><strong>Security</strong><small>Authentication and company security policies</small></span><em>→</em></Link><Link href="/settings/audit"><b>📋</b><span><strong>Audit & Activity</strong><small>Administrative changes and access activity</small></span><em>→</em></Link></section>
        </div>
      </aside>
    </div>}
  </main>
}
