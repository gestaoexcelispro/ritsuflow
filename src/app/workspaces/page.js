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
  { key:'precon', eyebrow:'PLAN · PREPARE · CONTROL', name:'PreCon', subtitle:'Plan & Prepare', description:'Plan, sequence and make ready the work. Control constraints and prepare production flow.', features:['Pre-Planning','Master Plan','Lookahead Planning','Constraint Management','Weekly Planning','Planning Reports'], visual:'/precon-icon.png', href:'/dashboard', action:'Enter PreCon' },
  { key:'ritsuscope', eyebrow:'MEASURE · QUANTIFY · MODEL', name:'RitsuScope', subtitle:'Takeoff & Quantities', description:'Turn PDF and IFC drawings into measured quantities, levels and a 3D model of the building.', features:['PDF & IFC Takeoff','Levels & Typical Floors','Walls, Floors & Ceilings','Structure & MEP','3D Model & Reports'], visual:'/ritsuscope-icon.svg', href:'/ritsuscope', action:'Enter RitsuScope' },
  { key:'fieldop', eyebrow:'EXECUTE · CAPTURE · MEASURE', name:'FieldOp', subtitle:'Execute & Measure', description:'Bring the plan to the field. Coordinate operations, capture production, and measure actual performance.', features:['Daily Reports','Workforce Management','Live Attendance','Timecards','Exceptions','Field Data'], visual:'/fieldop-icon.png', href:'/fieldop', action:'Enter FieldOp' },
]

const adminWorkspace = {
  key:'ritsuadmin',
  eyebrow:'PLATFORM OWNER · INTERNAL',
  name:'Ritsu Admin',
  subtitle:'Platform Administration',
  description:'Manage and explore the RitsuFlow platform. Visualize its architecture, modules, pages, data relationships, and system status.',
  features:['Platform Map','Workspaces & Modules','Data Relationships','System Diagnostics','Feature Flags','Platform Settings'],
  href:'/ritsu-admin',
  action:'Open Ritsu Admin',
}

function WorkspaceCard({ workspace }) {
  return <article className={`${styles.card} ${styles[workspace.key]}`}>
    <div className={styles.cardTop}>
      <span className={styles.eyebrow}>{workspace.eyebrow}</span>
      <div className={styles.mark}>{workspace.key === 'ritsuadmin' ? '⌂' : workspace.name.slice(0,1)}</div>
    </div>
    <div className={styles.cardBody}>
      <h2>{workspace.name}</h2>
      <h3>{workspace.subtitle}</h3>
      <p>{workspace.description}</p>
      <div className={styles.rule}/>
      <ul>{workspace.features.map(feature=><li key={feature}><span>✓</span>{feature}</li>)}</ul>
      <div className={styles.visualWrap} aria-hidden="true">
        {workspace.visual ? <Image src={workspace.visual} alt="" width={1200} height={675} className={styles.workspaceVisual}/> : <div className={styles.adminVisual}><span>◆</span><i>◆</i><b>◆</b></div>}
      </div>
      <Link href={workspace.href} className={styles.enterButton}>{workspace.action}<span aria-hidden="true">→</span></Link>
    </div>
  </article>
}

export default function WorkspacesPage(){
  const router=useRouter()
  const [checking,setChecking]=useState(true)
  const [isPlatformOwner,setIsPlatformOwner]=useState(false)
  const [hasRitsuScope,setHasRitsuScope]=useState(false)

  useEffect(()=>{
    let active=true
    async function checkSession(){
      const {data}=await supabase.auth.getUser()
      if(!active)return
      const user=data?.user
      if(!user){router.replace('/login');return}

      const [{data:platformRole},{data:ritsuScopeAccess}]=await Promise.all([
        supabase
          .from('platform_user_roles')
          .select('role,is_active')
          .eq('user_id',user.id)
          .eq('role','platform_owner')
          .eq('is_active',true)
          .maybeSingle(),
        // RitsuScope is sold separately: show it only when the company's license includes it.
        supabase.rpc('has_workspace_access',{p_workspace_key:'ritsuscope'})
      ])

      if(!active)return
      setIsPlatformOwner(Boolean(platformRole))
      setHasRitsuScope(ritsuScopeAccess===true||Boolean(platformRole))
      setChecking(false)
    }
    checkSession()
    return()=>{active=false}
  },[router])

  if(checking)return <main className={styles.loading}>Loading RitsuFlow™...</main>

  const licensed=workspaces.filter(w=>w.key!=='ritsuscope'||hasRitsuScope)
  const visibleWorkspaces=isPlatformOwner?[...licensed,adminWorkspace]:licensed

  return <main className={styles.page}>
    <div className={styles.glow}/>
    <header className={styles.header}>
      <Image src="/logo-white.png" alt="RitsuFlow" width={220} height={82} priority className={styles.logo}/>
      <div className={styles.headerRight}>
        <div className={styles.platformLabel}>CONSTRUCTION PRODUCTION SYSTEM</div>
        <Link className={styles.settingsButton} href="/settings" aria-label="Open settings" title="Settings"><span aria-hidden="true">⚙</span><span>Settings</span></Link>
      </div>
    </header>
    <section className={styles.hero}><div className={styles.kicker}>WELCOME TO RITSUFLOW</div><h1>Choose your workspace</h1></section>
    <section className={`${styles.grid} ${isPlatformOwner ? styles.gridOwner : visibleWorkspaces.length===3 ? styles.gridThree : styles.gridStandard}`} aria-label="RitsuFlow workspaces">
      {visibleWorkspaces.map(workspace=><WorkspaceCard key={workspace.key} workspace={workspace}/>)}
    </section>
    <div aria-hidden="true"/>
    <footer className={styles.footer}><span>One Project</span><i/><span>One Team</span><i/><span>One Source of Truth</span><strong>BUILT FOR A HIGHER STANDARD.</strong></footer>
  </main>
}
