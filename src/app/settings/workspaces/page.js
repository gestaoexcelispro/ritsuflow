'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { useLanguage } from '../../../contexts/LanguageContext'
import styles from './workspaces.module.css'

const supabase = createClient()

const TEXT = {
  'en-US': {
    loading: 'Loading workspace access...', title: 'Workspace Access', subtitle: 'Organization workspace provisioning and availability', back: 'Return to Settings', noOrg: 'No organization is connected to this account.', unable: 'Unable to load workspace provisioning.', organization: 'ORGANIZATION', provisioned: 'PROVISIONED WORKSPACES', ofAvailable: 'of {count} available', accessModel: 'ACCESS MODEL', organizationValue: 'Organization', maximumScope: 'Sets the maximum workspace scope', userAssignment: 'USER ASSIGNMENT', controlled: 'Controlled', assignmentHelp: 'Users can only receive provisioned workspaces', configuration: 'RITSUFLOW CONFIGURATION', provisioningTitle: 'Organization Workspace Provisioning', provisioningHelp: 'This page defines the RitsuFlow environments available to the organization. Individual user access is assigned separately in Users & Access and can never exceed this provisioned scope.', provisioning: 'Provisioning', user: 'User', project: 'Project', active: 'Active', notProvisioned: 'Not Provisioned', core: 'Core workspace', orgStatus: 'Organization Status', enabled: 'Enabled', unavailable: 'Unavailable', available: 'Available', blocked: 'Blocked', commercialControl: 'Commercial Control', platformProvisioned: 'Platform Provisioned', enabledFooter: 'Users may be assigned access according to their role and project scope.', disabledFooter: 'This workspace must be provisioned before it can be assigned to users.', rule: 'Provisioning rule', ruleHelp: 'Workspace Access defines the maximum RitsuFlow environment available to this organization. Organization administrators can view provisioning, but commercial activation is controlled by the RitsuFlow platform provisioning layer. User workspace assignments remain subordinate to this configuration.', architecture: 'Access architecture', architectureHelp: '<workspace>Workspace Provisioning</workspace> determines what the organization has. <users>Users & Access</users> determines which provisioned workspaces a person receives. <project>Project Access</project> determines where that person can work. <roles>Roles & Permissions</roles> determines what that person can do.', projectsDescription: 'Core project environment for project setup, location structure, project records and organization-wide project access.', preconDescription: 'Planning environment for pre-planning, Master Plan, Lookahead, constraints, Weekly Planning and production readiness.', fieldopDescription: 'Field execution environment for Daily Reports, operational visibility, workforce and timekeeping.', ritsucadDescription: 'Drawing and takeoff environment for PDF/CAD-style measurement, quantities and project visual analysis.'
  },
  'pt-BR': {
    loading: 'Carregando acesso aos workspaces...', title: 'Acesso aos Workspaces', subtitle: 'Provisionamento e disponibilidade dos workspaces da organização', back: 'Voltar às Configurações', noOrg: 'Nenhuma organização está conectada a esta conta.', unable: 'Não foi possível carregar o provisionamento dos workspaces.', organization: 'ORGANIZAÇÃO', provisioned: 'WORKSPACES PROVISIONADOS', ofAvailable: 'de {count} disponíveis', accessModel: 'MODELO DE ACESSO', organizationValue: 'Organização', maximumScope: 'Define o escopo máximo de workspaces', userAssignment: 'ATRIBUIÇÃO DE USUÁRIOS', controlled: 'Controlada', assignmentHelp: 'Usuários só podem receber workspaces provisionados', configuration: 'CONFIGURAÇÃO RITSUFLOW', provisioningTitle: 'Provisionamento de Workspaces da Organização', provisioningHelp: 'Esta página define os ambientes RitsuFlow disponíveis para a organização. O acesso individual dos usuários é atribuído separadamente em Usuários e Acessos e nunca pode exceder este escopo provisionado.', provisioning: 'Provisionamento', user: 'Usuário', project: 'Projeto', active: 'Ativo', notProvisioned: 'Não Provisionado', core: 'Workspace principal', orgStatus: 'Status da Organização', enabled: 'Habilitado', unavailable: 'Indisponível', available: 'Disponível', blocked: 'Bloqueado', commercialControl: 'Controle Comercial', platformProvisioned: 'Provisionado pela Plataforma', enabledFooter: 'Usuários podem receber acesso de acordo com sua função e escopo de projetos.', disabledFooter: 'Este workspace precisa ser provisionado antes de ser atribuído aos usuários.', rule: 'Regra de provisionamento', ruleHelp: 'Acesso aos Workspaces define o ambiente máximo do RitsuFlow disponível para esta organização. Administradores da organização podem visualizar o provisionamento, mas a ativação comercial é controlada pela camada de provisionamento da plataforma RitsuFlow. As atribuições de workspace dos usuários permanecem subordinadas a esta configuração.', architecture: 'Arquitetura de acesso', architectureHelp: '<workspace>Provisionamento de Workspaces</workspace> determina o que a organização possui. <users>Usuários e Acessos</users> determina quais workspaces provisionados cada pessoa recebe. <project>Acesso aos Projetos</project> determina onde essa pessoa pode trabalhar. <roles>Funções e Permissões</roles> determina o que essa pessoa pode fazer.', projectsDescription: 'Ambiente central de projetos para configuração, estrutura de localizações, registros e acesso a projetos em toda a organização.', preconDescription: 'Ambiente de planejamento para pré-planejamento, Plano Mestre, Lookahead, restrições, Planejamento Semanal e prontidão da produção.', fieldopDescription: 'Ambiente de execução em campo para Relatórios Diários, visibilidade operacional, força de trabalho e apontamento de horas.', ritsucadDescription: 'Ambiente de desenhos e levantamento para medição em PDF/CAD, quantitativos e análise visual do projeto.'
  },
  es: {
    loading: 'Cargando acceso a workspaces...', title: 'Acceso a Workspaces', subtitle: 'Provisionamiento y disponibilidad de workspaces de la organización', back: 'Volver a Configuración', noOrg: 'No hay ninguna organización conectada a esta cuenta.', unable: 'No se pudo cargar el provisionamiento de workspaces.', organization: 'ORGANIZACIÓN', provisioned: 'WORKSPACES PROVISIONADOS', ofAvailable: 'de {count} disponibles', accessModel: 'MODELO DE ACCESO', organizationValue: 'Organización', maximumScope: 'Define el alcance máximo de workspaces', userAssignment: 'ASIGNACIÓN DE USUARIOS', controlled: 'Controlada', assignmentHelp: 'Los usuarios solo pueden recibir workspaces provisionados', configuration: 'CONFIGURACIÓN RITSUFLOW', provisioningTitle: 'Provisionamiento de Workspaces de la Organización', provisioningHelp: 'Esta página define los entornos RitsuFlow disponibles para la organización. El acceso individual de usuarios se asigna por separado en Usuarios y Acceso y nunca puede superar este alcance provisionado.', provisioning: 'Provisionamiento', user: 'Usuario', project: 'Proyecto', active: 'Activo', notProvisioned: 'No Provisionado', core: 'Workspace principal', orgStatus: 'Estado de la Organización', enabled: 'Habilitado', unavailable: 'No disponible', available: 'Disponible', blocked: 'Bloqueado', commercialControl: 'Control Comercial', platformProvisioned: 'Provisionado por la Plataforma', enabledFooter: 'Los usuarios pueden recibir acceso según su rol y alcance de proyectos.', disabledFooter: 'Este workspace debe provisionarse antes de poder asignarse a usuarios.', rule: 'Regla de provisionamiento', ruleHelp: 'Acceso a Workspaces define el entorno máximo de RitsuFlow disponible para esta organización. Los administradores pueden ver el provisionamiento, pero la activación comercial está controlada por la capa de provisionamiento de la plataforma RitsuFlow. Las asignaciones de workspace de usuarios permanecen subordinadas a esta configuración.', architecture: 'Arquitectura de acceso', architectureHelp: '<workspace>Provisionamiento de Workspaces</workspace> determina lo que tiene la organización. <users>Usuarios y Acceso</users> determina qué workspaces provisionados recibe una persona. <project>Acceso a Proyectos</project> determina dónde puede trabajar. <roles>Roles y Permisos</roles> determina qué puede hacer.', projectsDescription: 'Entorno central de proyectos para configuración, estructura de ubicaciones, registros y acceso a proyectos en toda la organización.', preconDescription: 'Entorno de planificación para preplanificación, Plan Maestro, Lookahead, restricciones, Planificación Semanal y preparación de producción.', fieldopDescription: 'Entorno de ejecución en campo para Informes Diarios, visibilidad operativa, fuerza laboral y control de tiempo.', ritsucadDescription: 'Entorno de dibujos y takeoff para medición estilo PDF/CAD, cantidades y análisis visual del proyecto.'
  }
}

function normalizedKey(value = '') {
  const key = String(value).toLowerCase().replaceAll('_', '').replaceAll('-', '').replaceAll(' ', '')
  if (key.includes('precon')) return 'precon'
  if (key.includes('fieldop') || key.includes('field')) return 'fieldop'
  if (key.includes('ritsucad') || key.includes('cad')) return 'ritsucad'
  if (key.includes('project')) return 'projects'
  return String(value).toLowerCase()
}

function interpolate(value, vars = {}) {
  let result = value
  for (const [key, replacement] of Object.entries(vars)) result = String(result).replaceAll(`{${key}}`, replacement)
  return result
}

export default function WorkspaceAccessPage() {
  const router = useRouter()
  const { locale } = useLanguage()
  const text = TEXT[locale] || TEXT['en-US']
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState(null)
  const [modules, setModules] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) { router.replace('/login'); return }
        const { data: memberships, error: membershipError } = await supabase.from('organization_members').select('organization_id,role,status').eq('user_id', user.id).eq('status', 'active')
        if (membershipError) throw membershipError
        const membership = memberships?.find((item) => ['owner', 'admin'].includes(item.role)) || memberships?.[0]
        if (!membership?.organization_id) throw new Error(text.noOrg)
        const [{ data: org, error: orgError }, { data: orgModules, error: moduleError }] = await Promise.all([
          supabase.from('organizations').select('id,name,slug,organization_number').eq('id', membership.organization_id).single(),
          supabase.from('organization_modules').select('module_key,is_enabled,enabled_at,disabled_at').eq('organization_id', membership.organization_id),
        ])
        if (orgError) throw orgError
        if (moduleError) throw moduleError
        if (!alive) return
        setOrganization(org); setModules(orgModules || [])
      } catch (err) { if (alive) setError(err?.message || text.unable) }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [router, text.noOrg, text.unable])

  const statusByKey = useMemo(() => {
    const map = new Map()
    for (const item of modules) map.set(normalizedKey(item.module_key), item)
    return map
  }, [modules])

  const workspaces = [
    { key: 'projects', icon: '🏢', name: 'Projects', description: text.projectsDescription, core: true },
    { key: 'precon', icon: '⚙️', name: 'PreCon', description: text.preconDescription },
    { key: 'fieldop', icon: '👷', name: 'FieldOp', description: text.fieldopDescription },
    { key: 'ritsucad', icon: '📐', name: 'RitsuCAD', description: text.ritsucadDescription },
  ]
  const cards = workspaces.map((workspace) => { const record = statusByKey.get(workspace.key); const enabled = workspace.core ? record?.is_enabled !== false : Boolean(record?.is_enabled); return { ...workspace, record, enabled } })
  const activeCount = cards.filter((item) => item.enabled).length

  if (loading) return <main className={styles.loading}>{text.loading}</main>

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority /></div>
      <div className={styles.headerTitle}><h1>{text.title}</h1><p>{text.subtitle}</p></div>
      <Link className={styles.backButton} href="/settings">← {text.back}</Link>
    </header>
    <section className={styles.content}>
      {error && <div className={styles.error}>{error}</div>}
      <section className={styles.summary}>
        <article><small>{text.organization}</small><strong>{organization?.name || '—'}</strong><span>{organization?.organization_number || organization?.slug || '—'}</span></article>
        <article><small>{text.provisioned}</small><strong>{activeCount}</strong><span>{interpolate(text.ofAvailable, { count: workspaces.length })}</span></article>
        <article><small>{text.accessModel}</small><strong>{text.organizationValue}</strong><span>{text.maximumScope}</span></article>
        <article><small>{text.userAssignment}</small><strong>{text.controlled}</strong><span>{text.assignmentHelp}</span></article>
      </section>
      <section className={styles.intro}>
        <div><span>{text.configuration}</span><h2>{text.provisioningTitle}</h2><p>{text.provisioningHelp}</p></div>
        <div className={styles.flow}><b>{text.provisioning}</b><i>→</i><b>{text.organizationValue}</b><i>→</i><b>{text.user}</b><i>→</i><b>{text.project}</b></div>
      </section>
      <section className={styles.workspaceGrid}>{cards.map((workspace) => <article className={`${styles.workspaceCard} ${workspace.enabled ? styles.enabled : styles.disabled}`} key={workspace.key}>
        <div className={styles.cardTop}><div className={styles.icon}>{workspace.icon}</div><div className={styles.statusBlock}><span className={workspace.enabled ? styles.activePill : styles.inactivePill}>{workspace.enabled ? `● ${text.active}` : `○ ${text.notProvisioned}`}</span>{workspace.core && <small>{text.core}</small>}</div></div>
        <h3>{workspace.name}</h3><p>{workspace.description}</p>
        <div className={styles.details}><div><span>{text.orgStatus}</span><b>{workspace.enabled ? text.enabled : text.unavailable}</b></div><div><span>{text.userAssignment}</span><b>{workspace.enabled ? text.available : text.blocked}</b></div><div><span>{text.commercialControl}</span><b>{text.platformProvisioned}</b></div></div>
        <div className={styles.cardFooter}>{workspace.enabled ? text.enabledFooter : text.disabledFooter}</div>
      </article>)}</section>
      <div className={styles.rule}><b>🔒 {text.rule}</b><span>{text.ruleHelp}</span></div>
      <div className={styles.architecture}><b>{text.architecture}</b><span dangerouslySetInnerHTML={{ __html: text.architectureHelp.replaceAll('<workspace>', '<strong>').replaceAll('</workspace>', '</strong>').replaceAll('<users>', '<strong>').replaceAll('</users>', '</strong>').replaceAll('<project>', '<strong>').replaceAll('</project>', '</strong>').replaceAll('<roles>', '<strong>').replaceAll('</roles>', '</strong>') }} /></div>
    </section>
  </main>
}
