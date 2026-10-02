'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import PlatformMapCanvas from './platform-map/PlatformMapCanvas'
import styles from './ritsu-admin.module.css'

const supabase=createClient()

export default function RitsuAdminPage(){
  const router=useRouter()
  const [checking,setChecking]=useState(true)

  useEffect(()=>{
    let active=true
    async function authorize(){
      const {data}=await supabase.auth.getUser()
      const user=data?.user
      if(!active)return
      if(!user){router.replace('/login');return}
      const {data:role}=await supabase.from('platform_user_roles').select('role,is_active').eq('user_id',user.id).eq('role','platform_owner').eq('is_active',true).maybeSingle()
      if(!active)return
      if(!role){router.replace('/workspaces');return}
      setChecking(false)
    }
    authorize()
    return()=>{active=false}
  },[router])

  if(checking)return <main className={styles.loading}>Authorizing Ritsu Admin...</main>

  return <main className={styles.page}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}>RitsuFlow™</div>
      <nav>
        <Link href="/projects">Projects</Link>
        <Link href="/dashboard">PreCon</Link>
        <Link href="/fieldop">FieldOp</Link>
        <Link href="/ritsu-admin" className={styles.active}>⚙ Ritsu Admin</Link>
      </nav>
      <div className={styles.subnav}><b>Platform Map</b><span>System Status · Coming Soon</span><span>Organizations · Coming Soon</span><span>Feature Flags · Coming Soon</span><span>Audit Log · Coming Soon</span></div>
      <Link href="/workspaces" className={styles.back}>← Workspaces</Link>
    </aside>
    <section className={styles.workspace}>
      <header className={styles.header}><div><h1>Platform Map</h1><p>RitsuFlow architecture & system flow</p></div><span className={styles.ownerBadge}>🔒 Platform Owner</span></header>
      <div className={styles.toolbar}><div className={styles.filters}><button className={styles.selected}>All</button><button>Workspaces</button><button>Modules</button><button>Pages</button><button>Database</button><button>APIs</button></div><input placeholder="Search nodes..." /></div>
      <div className={styles.canvas}><PlatformMapCanvas /></div>
    </section>
  </main>
}
