'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LanguageSelector from '../../../components/LanguageSelector'
import { useT } from '../../../lib/i18n/useT'
import { useFieldOpUser } from '../FieldOpChrome'
import Icon from './icons'
import { plex } from './font'
import ui from './ui.module.css'

export { ui, Icon }

const cx = (...names) => names.filter(Boolean).join(' ')

function navItems(projectId) {
  return [
    { key: 'portfolio', icon: 'portfolio', href: '/fieldop' },
    { key: 'projects', icon: 'projects', href: '/fieldop/projects' },
    { key: 'reports', icon: 'reports', href: '/fieldop/reports/daily' },
    { key: 'workforce', icon: 'workforce', href: projectId ? `/fieldop/projects/${projectId}/workforce` : '/workforce' },
  ]
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
export function FieldOpShell({ active, projectId, action, children }) {
  const t = useT('fieldop')
  const user = useFieldOpUser()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])

  const switches = <>
    <Link href="/workspaces" className={ui.appBtn}><Icon name="back" size={16} />{t('nav.workspaces')}</Link>
    <Link href="/dashboard" className={cx(ui.appBtn, ui.appBtnPre)}>{t('nav.precon')}</Link>
    <Link href="/projects" className={cx(ui.appBtn, ui.appBtnPrj)}>{t('nav.projectsModule')}</Link>
  </>
  const who = <div className={ui.appUser}>
    <span className={ui.avatar}>{initials(user.name)}</span>
    <div className={ui.who}><strong>{user.name || t('user.fallbackName')}</strong><span>{user.role ? t(`role.${user.role}`) : ''}</span></div>
    <LanguageSelector compact dark />
  </div>
  const mainAction = action === undefined
    ? <Link className={ui.btnPrimary} href={projectId ? `/fieldop/reports/daily/new?projectId=${projectId}` : '/fieldop/reports/daily/new'}><Icon name="plus" size={18} />{t('nav.newReport')}</Link>
    : action

  return <div className={cx(ui.root, plex.variable)}>
    <header className={ui.appbar}>
      <div className={ui.appbarInner}>
        <Link href="/workspaces" className={ui.appLogo} aria-label={t('nav.workspaces')}><Image src="/logo-white.png" alt="RitsuFlow" width={132} height={48} priority /></Link>
        <span className={ui.appDivider} />
        <Link href="/fieldop" className={ui.moduleName} style={{ color: 'inherit', textDecoration: 'none' }}><strong>FieldOp</strong><span>{t('brand.tagline')}</span></Link>
        <div className={ui.appActions}>{switches}</div>
        {who}
        <button type="button" className={ui.menuBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t('nav.openMenu')}><Icon name={open ? 'close' : 'menu'} size={24} /></button>
      </div>
      {open && <div className={ui.menuPanel}>{switches}{who}</div>}
    </header>
    <nav className={ui.tabbar} aria-label="FieldOp">
      <div className={ui.tabbarInner}>
        {navItems(projectId).map(({ key, icon, href }) => <Link key={key} href={href} className={cx(ui.mtab, active === key && ui.mtabOn)} aria-current={active === key ? 'page' : undefined}>
          <Icon name={icon} size={18} />{t(`nav.${key}`)}
        </Link>)}
        {mainAction && <div className={ui.tabbarAction}>{mainAction}</div>}
      </div>
    </nav>
    <main className={ui.main}><div className={ui.content}>{children}</div></main>
  </div>
}

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
