'use client'
import Image from 'next/image'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '../../../lib/supabase/client'
import {useLanguage} from '../../../contexts/LanguageContext'
import styles from './roles.module.css'

const supabase=createClient()

export default function RolesPermissions(){
 const router=useRouter()
 const{t}=useLanguage()
 const[loading,setLoading]=useState(true)
 useEffect(()=>{let alive=true;(async()=>{const{data}=await supabase.auth.getUser();if(!alive)return;if(!data?.user){router.replace('/login');return}setLoading(false)})();return()=>{alive=false}},[router])
 const roles=[
  {key:'admin',name:t('roles.admin'),tag:t('roles.fullControl'),description:t('roles.adminDescription')},
  {key:'manager',name:t('roles.manager'),tag:t('roles.projectControl'),description:t('roles.managerDescription')},
  {key:'member',name:t('roles.member'),tag:t('roles.operational'),description:t('roles.memberDescription')},
  {key:'viewer',name:t('roles.viewer'),tag:t('roles.readOnly'),description:t('roles.viewerDescription')}
 ]
 const groups=[
  {name:t('roles.organizationAdministration'),items:[['company_settings',t('roles.manageCompany'),{admin:1}],['users_manage',t('roles.manageUsers'),{admin:1}],['roles_manage',t('roles.manageRoles'),{admin:1}],['workspace_settings',t('roles.manageWorkspace'),{admin:1}]]},
  {name:t('roles.projects'),items:[['project_create',t('roles.createProjects'),{admin:1,manager:1}],['project_edit',t('roles.editProjectSetup'),{admin:1,manager:1}],['project_operate',t('roles.performOperations'),{admin:1,manager:1,member:1}],['project_close',t('roles.closeProject'),{admin:1,manager:1}],['project_reopen',t('roles.reopenProject'),{admin:1}],['project_delete',t('roles.deleteProjects'),{admin:1}]]},
  {name:'PreCon',items:[['planning_manage',t('roles.managePlanning'),{admin:1,manager:1,member:1}],['constraints_manage',t('roles.manageConstraints'),{admin:1,manager:1,member:1}],['commitments_manage',t('roles.manageCommitments'),{admin:1,manager:1,member:1}],['planning_approve',t('roles.approvePlanning'),{admin:1,manager:1}]]},
  {name:'FieldOp',items:[['daily_reports',t('roles.manageDailyReports'),{admin:1,manager:1,member:1}],['workforce',t('roles.manageWorkforce'),{admin:1,manager:1,member:1}],['attendance_admin',t('roles.manageAttendance'),{admin:1,manager:1}],['field_approve',t('roles.approveField'),{admin:1,manager:1}]]},
  {name:t('roles.ritsucadReporting'),items:[['ritsucad_edit',t('roles.editRitsucad'),{admin:1,manager:1,member:1}],['reports_view',t('roles.viewReports'),{admin:1,manager:1,member:1,viewer:1}],['reports_generate',t('roles.generateReports'),{admin:1,manager:1,member:1,viewer:1}]]}
 ]
 if(loading)return <main className={styles.loading}>{t('roles.loading')}</main>
 return <main className={styles.page}><header className={styles.header}><div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority/></div><div className={styles.headerTitle}><h1>{t('roles.title')}</h1><p>{t('roles.subtitle')}</p></div><Link className={styles.backButton} href="/settings">← {t('roles.back')}</Link></header><section className={styles.content}><div className={styles.summary}><div><span>{t('roles.eyebrow')}</span><h2>{t('roles.matrix')}</h2><p>{t('roles.matrixHelp')}</p></div><div className={styles.owner}><b>{t('roles.owner')}</b><span>{t('roles.organizationAuthority')}</span><small>{t('roles.ownerHelp')}</small></div></div><div className={styles.roleCards}>{roles.map(r=><article key={r.key}><div><strong>{r.name}</strong><span>{r.tag}</span></div><p>{r.description}</p>{r.key==='admin'&&<small>🔒 {t('roles.protectedRole')}</small>}</article>)}</div><div className={styles.closedRule}><b>🔒 {t('roles.closedReadOnly')}</b><span>{t('roles.closedHelp')}</span></div><section className={styles.matrix}><div className={styles.matrixHead}><div>{t('roles.capability')}</div>{roles.map(r=><div key={r.key}><b>{r.name}</b><small>{r.tag}</small></div>)}</div>{groups.map(g=><div className={styles.group} key={g.name}><h3>{g.name}</h3>{g.items.map(([key,name,access])=><div className={styles.row} key={key}><div><b>{name}</b></div>{roles.map(r=><div key={r.key}>{access[r.key]?<span className={styles.yes}>✓</span>:<span className={styles.no}>—</span>}</div>)}</div>)}</div>)}</section><div className={styles.note}><b>{t('roles.architecture')}</b><span>{t('roles.architectureHelp')}</span></div></section></main>
}