'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import LanguageSelector from '../../../components/LanguageSelector'
import { useT } from '../../../lib/i18n/useT'
import { useFieldOpUser } from '../FieldOpChrome'
import { createClient } from '../../../lib/supabase/client'
import Icon from './icons'
import { plex } from './font'
import ui from './ui.module.css'

export { ui, Icon }

const cx = (...names) => names.filter(Boolean).join(' ')
const supabase = createClient()

// Tabs of each RitsuFlow module that uses this shell. `labelKey` is in the fieldop namespace.
const MODULES = {
  fieldop: {
    name: 'FieldOp', taglineKey: 'brand.tagline', home: '/fieldop',
    tabs: (projectId) => [
      { key: 'portfolio', icon: 'portfolio', href: '/fieldop' },
      { key: 'projects', icon: 'projects', href: '/fieldop/projects' },
      { key: 'reports', icon: 'reports', href: '/fieldop/reports/daily' },
      { key: 'workforce', icon: 'workforce', href: projectId ? `/fieldop/projects/${projectId}/workforce` : '/workforce' },
    ],
  },
  projects: {
    nameKey: 'nav.projectsModule', taglineKey: 'nav.projectsTagline', home: '/projects',
    // Inside a project, its own pages appear as tabs next to "All projects".
    tabs: (projectId) => [
      { key: 'all', icon: 'grid', href: '/projects', labelKey: 'nav.allProjects' },
      ...(projectId ? [
        { key: 'overview', icon: 'projects', href: `/projects/${projectId}`, labelKey: 'nav.projectOverview' },
        { key: 'scope', icon: 'reports', href: `/projects/${projectId}/scope`, labelKey: 'nav.projectScope' },
        { key: 'locations', icon: 'portfolio', href: `/projects/${projectId}/locations`, labelKey: 'nav.projectLocations' },
        { key: 'history', icon: 'back', href: `/projects/${projectId}/history`, labelKey: 'nav.projectHistory' },
      ] : []),
    ],
  },
  precon: {
    nameKey: 'nav.precon', taglineKey: 'nav.preconTagline', home: '/dashboard',
    // The selected project travels with every tab (?projectId=…); `soon` tabs are shown but not linked.
    tabs: (projectId) => {
      const withProject = (href) => (projectId ? `${href}?projectId=${projectId}` : href)
      return [
        { key: 'overview', icon: 'grid', href: '/dashboard', labelKey: 'nav.preconOverview' },
        { key: 'masterPlan', icon: 'masterPlan', href: withProject('/dashboard/planning/master-plan'), labelKey: 'nav.preconMasterPlan' },
        { key: 'lookahead', icon: 'lookahead', href: withProject('/dashboard/planning/lookahead'), labelKey: 'nav.preconLookahead' },
        { key: 'constraints', icon: 'constraint', href: withProject('/dashboard/planning/constraints'), labelKey: 'nav.preconConstraints' },
        { key: 'weekly', icon: 'weekly', href: withProject('/dashboard/planning/weekly-planning'), labelKey: 'nav.preconWeekly' },
        { key: 'reports', icon: 'chart', labelKey: 'nav.preconReports', soon: true },
      ]
    },
  },
  commercial: {
    nameKey: 'nav.commercialModule', taglineKey: 'nav.commercialTagline', home: '/commercial',
    tabs: () => [
      { key: 'bids', icon: 'portfolio', href: '/commercial', labelKey: 'nav.commercialBids' },
      { key: 'library', icon: 'package', href: '/commercial/library', labelKey: 'nav.commercialLibrary' },
    ],
  },
  settings: {
    nameKey: 'nav.settingsModule', taglineKey: 'nav.settingsTagline', home: '/settings',
    tabs: () => [
      { key: 'hub', icon: 'grid', href: '/settings', labelKey: 'nav.settingsHub' },
      { key: 'company', icon: 'building', href: '/settings/company', labelKey: 'nav.settingsCompany' },
      { key: 'users', icon: 'workforce', href: '/settings/users', labelKey: 'nav.settingsUsers' },
      { key: 'roles', icon: 'shield', href: '/settings/roles', labelKey: 'nav.settingsRoles' },
      { key: 'workspaces', icon: 'portfolio', href: '/settings/workspaces', labelKey: 'nav.settingsWorkspaces' },
      { key: 'workPackages', icon: 'package', href: '/settings/work-packages', labelKey: 'nav.settingsWorkPackages' },
      { key: 'localization', icon: 'globe', href: '/settings/localization', labelKey: 'nav.settingsLocalization' },
      { key: 'license', icon: 'card', href: '/settings/license', labelKey: 'nav.settingsLicense' },
    ],
  },
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * FieldOp page frame, same structure as the RitsuFlow Projects module: app header (logo, module,
 * workspace and module switches, user) and a tab bar with the page's main action on the right.
 * `action` replaces the default main action (New Daily Report); pass `false` to hide it.
 */
/**
 * RitsuFlow app frame (same structure as the original Projects header): app header with the module,
 * Workspaces / other-module switches and the user, then the module tab bar with the main action on the right.
 * `action` replaces the module's default main action; pass `false` to hide it.
 * `bare` renders the page without the content padding (for full-height workspaces).
 */
export function AppShell({ module = 'fieldop', active, projectId, action, bare = false, children }) {
  const t = useT('fieldop')
  const user = useFieldOpUser()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  const config = MODULES[module]
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  async function logout() {
    setLeaving(true)
    const { error } = await supabase.auth.signOut()
    if (error) { setLeaving(false); return }
    router.replace('/login')
    router.refresh()
  }

  const switches = <>
    <Link href="/workspaces" className={ui.appBtn}><Icon name="back" size={16} />{t('nav.workspaces')}</Link>
    {module !== 'precon' && <Link href="/dashboard" className={cx(ui.appBtn, ui.appBtnPre)}>{t('nav.precon')}</Link>}
    {module !== 'projects' && <Link href="/projects" className={cx(ui.appBtn, ui.appBtnPrj)}>{t('nav.projectsModule')}</Link>}
    {module !== 'fieldop' && <Link href="/fieldop" className={cx(ui.appBtn, ui.appBtnPrj)}>FieldOp</Link>}
  </>
  const who = <div className={ui.appUser}>
    <span className={ui.avatar}>{initials(user.name)}</span>
    <div className={ui.who}><strong>{user.name || t('user.fallbackName')}</strong><span>{user.role ? t(`role.${user.role}`) : ''}</span></div>
    <LanguageSelector compact dark />
    <button type="button" className={ui.logoutBtn} onClick={logout} disabled={leaving} title={t('nav.logout')} aria-label={t('nav.logout')}><Icon name="logout" size={20} /><span>{t('nav.logout')}</span></button>
  </div>
  const defaultAction = module === 'settings' || module === 'precon' ? null : module === 'projects'
    ? <Link className={ui.btnPrimary} href="/projects/new"><Icon name="plus" size={18} />{t('nav.newProject')}</Link>
    : <Link className={ui.btnPrimary} href={projectId ? `/fieldop/reports/daily/new?projectId=${projectId}` : '/fieldop/reports/daily/new'}><Icon name="plus" size={18} />{t('nav.newReport')}</Link>
  const mainAction = action === undefined ? defaultAction : action
  const moduleName = config.nameKey ? t(config.nameKey) : config.name

  return <div className={cx(ui.root, plex.variable)}>
    <header className={ui.appbar}>
      <div className={ui.appbarInner}>
        <Link href="/workspaces" className={ui.appLogo} aria-label={t('nav.workspaces')}><Image src="/logo-white.png" alt="RitsuFlow" width={132} height={48} priority /></Link>
        <span className={ui.appDivider} />
        <Link href={config.home} className={ui.moduleName} style={{ color: 'inherit', textDecoration: 'none' }}><strong>{moduleName}</strong><span>{t(config.taglineKey)}</span></Link>
        <div className={ui.appActions}>{switches}</div>
        {who}
        <button type="button" className={ui.menuBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t('nav.openMenu')}><Icon name={open ? 'close' : 'menu'} size={24} /></button>
      </div>
      {open && <div className={ui.menuPanel}>{switches}{who}</div>}
    </header>
    <nav className={ui.tabbar} aria-label={moduleName}>
      <div className={ui.tabbarInner}>
        {config.tabs(projectId).map(({ key, icon, href, labelKey, soon }) => soon
          ? <span key={key} className={cx(ui.mtab, ui.mtabSoon)} aria-disabled="true"><Icon name={icon} size={18} />{t(labelKey || `nav.${key}`)}<Badge>{t('nav.soon')}</Badge></span>
          : <Link key={key} href={href} className={cx(ui.mtab, active === key && ui.mtabOn)} aria-current={active === key ? 'page' : undefined}>
            <Icon name={icon} size={18} />{t(labelKey || `nav.${key}`)}
          </Link>)}
        {mainAction && <div className={ui.tabbarAction}>{mainAction}</div>}
      </div>
    </nav>
    {/* `bare` pages manage their own full-height layout below the header (height: calc(100dvh - var(--app-chrome))). */}
    <main className={ui.main}>{bare ? children : <div className={ui.content}>{children}</div>}</main>
  </div>
}

/** FieldOp pages: the shared app frame with the FieldOp tabs. */
export function FieldOpShell(props) { return <AppShell module="fieldop" {...props} /> }

export function PageHeader({ title, subtitle, back, meta, actions }) {
  return <div className={ui.pageHead}>
    <div style={{ minWidth: 0 }}>
      {back && <Link href={back.href} className={ui.crumb}><Icon name="back" size={16} />{back.label}</Link>}
      <h1 className={ui.pageTitle}>{title}</h1>
      {subtitle && <p className={ui.pageSub}>{subtitle}</p>}
      {meta && <div className={ui.pageMeta}>{meta}</div>}
    </div>
    {actions && <div className={ui.actions}>{actions}</div>}
  </div>
}

export function Panel({ title, text, actions, children, body = true, className, style }) {
  return <section className={cx(ui.panel, className)} style={style}>
    {(title || actions) && <div className={ui.panelHead}>
      <div>{title && <h2 className={ui.panelTitle}>{title}</h2>}{text && <p className={ui.panelText}>{text}</p>}</div>
      {actions && <div className={ui.actions} style={{ width: 'auto' }}>{actions}</div>}
    </div>}
    {body ? <div className={ui.panelBody}>{children}</div> : children}
  </section>
}

const TONE_CLASS = { ok: ui.toneOk, warn: ui.toneWarn, bad: ui.toneBad, info: ui.toneInfo }
export function Badge({ tone, children }) { return <span className={cx(ui.badge, TONE_CLASS[tone])}>{children}</span> }

const STAT_CLASS = { ok: ui.statOk, warn: ui.statWarn, bad: ui.statBad }
export function Stat({ label, value, hint, tone }) {
  return <div className={cx(ui.stat, STAT_CLASS[tone])}><div className={ui.statLabel}>{label}</div><div className={ui.statValue}>{value}</div>{hint && <div className={ui.statHint}>{hint}</div>}</div>
}
export function Stats({ children }) { return <div className={ui.stats}>{children}</div> }

export function Empty({ title, text, action }) {
  return <div className={ui.empty}>{title && <strong>{title}</strong>}{text && <p>{text}</p>}{action}</div>
}

export function Notice({ tone = 'bad', children }) {
  if (!children) return null
  return <div className={cx(ui.notice, tone === 'ok' ? ui.noticeOk : tone === 'warn' ? ui.noticeWarn : ui.noticeBad)} role={tone === 'bad' ? 'alert' : 'status'}>{children}</div>
}

export function Segments({ items, value, onChange }) {
  return <div className={ui.segments} role="tablist">
    {items.map((item) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} className={cx(ui.segment, value === item.value && ui.segmentOn)} onClick={() => onChange(item.value)}>{item.label}</button>)}
  </div>
}

/** Daily Report status → badge tone (same mapping everywhere). */
export const reportTone = (status) => ({ approved: 'ok', reviewed: 'warn', submitted: 'info' })[status] || undefined
