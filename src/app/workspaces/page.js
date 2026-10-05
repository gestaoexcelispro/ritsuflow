'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './workspaces.module.css'
import LanguageSelector from '../../components/LanguageSelector'
import { useT } from '../../lib/i18n/useT'

const supabase = createClient()

// Text comes from the "workspaces" messages: <key>.eyebrow, .name, .subtitle, .description, .features (separated by "|"), .action.
const workspaces = [
  { key:'projects', visual:'/projects-icon.png', href:'/projects' },
  { key:'precon', visual:'/precon-icon.png', href:'/dashboard' },
  { key:'ritsuscope', visual:'/ritsuscope-icon.svg', href:'/ritsuscope' },
  { key:'fieldop', visual:'/fieldop-icon.png', href:'/fieldop' },
]

const adminWorkspace = { key:'ritsuadmin', href:'/ritsu-admin' }

function WorkspaceCard({ workspace, t }) {
  const text = (field) => t(`${workspace.key}.${field}`)
  return <article className={`${styles.card} ${styles[workspace.key]}`}>
    <div className={styles.cardTop}>
      <span className={styles.eyebrow}>{text('eyebrow')}</span>
      <div className={styles.mark}>{workspace.key === 'ritsuadmin' ? '⌂' : text('name').slice(0,1)}</div>
    </div>
    <div className={styles.cardBody}>
      <h2>{text('name')}</h2>
      <h3>{text('subtitle')}</h3>
      <p>{text('description')}</p>
      <div className={styles.rule}/>
      <ul>{text('features').split('|').map(feature=><li key={feature}><span>✓</span>{feature}</li>)}</ul>
      <div className={styles.visualWrap} aria-hidden="true">
        {workspace.visual ? <Image src={workspace.visual} alt="" width={1200} height={675} className={styles.workspaceVisual}/> : <div className={styles.adminVisual}><span>◆</span><i>◆</i><b>◆</b></div>}
      </div>
      <Link href={workspace.href} className={styles.enterButton}>{text('action')}<span aria-hidden="true">→</span></Link>
    </div>
  </article>
}

export default function WorkspacesPage(){
  const t=useT('workspaces')
  const router=useRouter()
  const [checking,setChecking]=useState(true)
  const [isPlatformOwner,setIsPlatformOwner]=useState(false)

  useEffect(()=>{
    let active=true
    async function checkSession(){
      const {data}=await supabase.auth.getUser()
      if(!active)return
      const user=data?.user
      if(!user){router.replace('/login');return}

      const {data:platformRole}=await supabase
        .from('platform_user_roles')
        .select('role,is_active')
        .eq('user_id',user.id)
        .eq('role','platform_owner')
        .eq('is_active',true)
        .maybeSingle()

      if(!active)return
      setIsPlatformOwner(Boolean(platformRole))
      setChecking(false)
    }
    checkSession()
    return()=>{active=false}
  },[router])

  if(checking)return <main className={styles.loading}>{t('loading')}</main>

  // RitsuScope is open to every company (sheets, levels, zoning); its takeoff tools are licensed inside it.
  const visibleWorkspaces=isPlatformOwner?[...workspaces,adminWorkspace]:workspaces

  return <main className={styles.page}>
    <div className={styles.glow}/>
    <header className={styles.header}>
      <Image src="/logo-white.png" alt="RitsuFlow" width={220} height={82} priority className={styles.logo}/>
      <div className={styles.headerRight}>
        <div className={styles.platformLabel}>{t('platformLabel')}</div>
        <div className={styles.langWrap}><LanguageSelector dark /></div>
        <Link className={styles.settingsButton} href="/settings" aria-label={t('settingsAria')} title={t('settings')}><span aria-hidden="true">⚙</span><span>{t('settings')}</span></Link>
      </div>
    </header>
    <section className={styles.hero}><div className={styles.kicker}>{t('kicker')}</div><h1>{t('title')}</h1></section>
    <section className={`${styles.grid} ${isPlatformOwner ? styles.gridOwner : styles.gridStandard}`} aria-label={t('gridAria')}>
      {visibleWorkspaces.map(workspace=><WorkspaceCard key={workspace.key} workspace={workspace} t={t}/>)}
    </section>
    <div aria-hidden="true"/>
    <footer className={styles.footer}><span>{t('footer1')}</span><i/><span>{t('footer2')}</span><i/><span>{t('footer3')}</span><strong>{t('footerTagline')}</strong></footer>
  </main>
}
