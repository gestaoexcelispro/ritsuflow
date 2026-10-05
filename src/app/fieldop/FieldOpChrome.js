'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import LanguageSelector from '../../components/LanguageSelector'
import { useT } from '../../lib/i18n/useT'

/**
 * Shared FieldOp frame: the sidebar and the signed-in user block.
 * Every FieldOp page module defines the same class names (.sidebar, .brand, .navTitle,
 * .active, .workspaceReturn, .user), so each page passes its own `styles`.
 */

// A null href means the page does not exist yet; it is shown as "Soon".
function navItems(projectId) {
  return [
    { key: 'portfolio', icon: '⌂', href: '/fieldop' },
    { key: 'projects', icon: '□', href: '/fieldop/projects' },
    { key: 'workforce', icon: '♙', href: projectId ? `/fieldop/projects/${projectId}/workforce` : '/workforce' },
    { key: 'operations', icon: '⌖', href: null },
    { key: 'occurrences', icon: '△', href: null },
    { key: 'reports', icon: '▥', href: '/fieldop/reports/daily' },
    { key: 'settings', icon: '⚙', href: null },
  ]
}

export function FieldOpSidebar({ styles, active, projectId, showTagline = false }) {
  const t = useT('fieldop')
  return <aside className={styles.sidebar}>
    <Link href="/fieldop" className={styles.brand} style={{ color: "inherit", textDecoration: "none" }}>
      <Image src="/logo-white.png" alt="RitsuFlow" width={showTagline ? 160 : 150} height={showTagline ? 58 : 55} priority />
      {showTagline && <div><b>FieldOp</b><span>{t('brand.tagline')}</span></div>}
    </Link>
    <div className={styles.navTitle}>{t('nav.section')}</div>
    <nav>{navItems(projectId).map(({ key, icon, href }) => href
      ? <Link key={key} className={active === key ? styles.active : ''} href={href}><i>{icon}</i>{t(`nav.${key}`)}</Link>
      : <a key={key} aria-disabled="true" style={{ opacity: 0.55, cursor: 'default' }}><i>{icon}</i>{t(`nav.${key}`)}<small style={{ marginLeft: 'auto', fontSize: 10, border: '1px solid currentColor', borderRadius: 999, padding: '1px 7px' }}>{t('nav.soon')}</small></a>)}
    </nav>
    <Link href="/workspaces" className={styles.workspaceReturn}>← <span>{t('nav.workspaces')}</span></Link>
  </aside>
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Name and company role of the signed-in user. */
export function useFieldOpUser() {
  const [user, setUser] = useState({ name: '', role: '' })
  useEffect(() => {
    let alive = true
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser || !alive) return
      const [profile, member] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', authUser.id).maybeSingle(),
        supabase.from('organization_members').select('role').eq('user_id', authUser.id).eq('status', 'active').limit(1).maybeSingle(),
      ])
      if (!alive) return
      setUser({ name: profile.data?.full_name || authUser.email || '', role: member.data?.role || '' })
    }
    load()
    return () => { alive = false }
  }, [])
  return user
}

export function FieldOpUser({ styles }) {
  const t = useT('fieldop')
  const user = useFieldOpUser()
  return <div className={styles.user}>
    <LanguageSelector compact />
    <b>{initials(user.name)}</b>
    <div><strong>{user.name || t('user.fallbackName')}</strong><span>{user.role ? t(`role.${user.role}`) : ''}</span></div>
  </div>
}
