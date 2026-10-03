'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { useLanguage } from '../../contexts/LanguageContext'
import styles from './settings.module.css'

const supabase=createClient()

export default function SettingsPage(){
 const router=useRouter();const {t,localeReady}=useLanguage();const [loading,setLoading]=useState(true)
 const groups=useMemo(()=>[
  {title:t('settings.organization'),items:[
   {icon:'🏢',title:t('settings.companyProfile'),text:t('settings.companyProfileText'),href:'/settings/company'},
   {icon:'👥',title:t('settings.users'),text:t('settings.usersText'),href:'/settings/users'},
   {icon:'🛡',title:t('settings.roles'),text:t('settings.rolesText'),href:'/settings/roles'}]},
  {title:t('settings.configuration'),items:[
   {icon:'🧩',title:t('settings.workspace'),text:t('settings.workspaceText'),href:'/settings/workspaces'},
   {icon:'🏗',title:t('settings.projectStandards'),text:t('settings.projectStandardsText'),href:'/settings/project-standards'},
   {icon:'📚',title:t('settings.standardsLibrary'),text:t('settings.standardsLibraryText'),href:'/settings/standards-library'},
   {icon:'📅',title:t('settings.calendars'),text:t('settings.calendarsText'),href:'/settings/calendars'}]},
  {title:t('settings.preferences'),items:[
   {icon:'📐',title:t('settings.localization'),text:t('settings.localizationText'),href:'/settings/localization'},
   {icon:'🔔',title:t('settings.notifications'),text:t('settings.notificationsText'),href:'/settings/notifications'}]},
  {title:t('settings.administration'),items:[
   {icon:'💳',title:t('settings.plan'),text:t('settings.planText'),href:'/settings/license'},
   {icon:'🔐',title:t('settings.security'),text:t('settings.securityText'),href:'/settings/security'},
   {icon:'📋',title:t('settings.audit'),text:t('settings.auditText'),href:'/settings/audit'}]}
 ],[t])
 useEffect(()=>{let active=true;(async()=>{const {data}=await supabase.auth.getUser();if(!active)return;if(!data?.user){router.replace('/login');return}setLoading(false)})();return()=>{active=false}},[router])
 if(loading||!localeReady)return <main className={styles.loading}>{t('settings.loading')}</main>
 return <main className={styles.page}>
  <header className={styles.header}><div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority/></div><div className={styles.headerTitle}><h1>{t('settings.title')}</h1><p>{t('settings.subtitle')}</p></div><Link className={styles.backButton} href="/workspaces">← {t('settings.back')}</Link></header>
  <div className={styles.content}><div className={styles.intro}><div><span>{t('settings.eyebrow')}</span><h2>{t('settings.title')}</h2><p>{t('settings.intro')}</p></div></div>
   <div className={styles.groups}>{groups.map(group=><section className={styles.group} key={group.title}><h3>{group.title}</h3><div className={styles.grid}>{group.items.map(item=><Link href={item.href} className={styles.card} key={item.href}><div className={styles.icon}>{item.icon}</div><div><strong>{item.title}</strong><p>{item.text}</p></div><b>→</b></Link>)}</div></section>)}</div>
  </div>
 </main>
}
