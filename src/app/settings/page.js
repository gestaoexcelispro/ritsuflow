'use client'

import Link from 'next/link'
import { AppShell, Badge, Icon } from '../fieldop/ui'
import { useT } from '../../lib/i18n/useT'
import styles from './settings.module.css'
import { useSignedIn } from './useSignedIn'

// `href` only for pages that exist; the others show "Soon" instead of a broken link.
const GROUPS = [
  { key: 'organization', items: [
    { key: 'company', icon: 'building', href: '/settings/company' },
    { key: 'users', icon: 'workforce', href: '/settings/users' },
    { key: 'roles', icon: 'shield', href: '/settings/roles' },
  ] },
  { key: 'configuration', items: [
    { key: 'workspaces', icon: 'portfolio', href: '/settings/workspaces' },
    { key: 'workPackages', icon: 'package', href: '/settings/work-packages' },
    { key: 'projectStandards', icon: 'projects' },
    { key: 'standardsLibrary', icon: 'reports' },
    { key: 'calendars', icon: 'grid' },
  ] },
  { key: 'preferences', items: [
    { key: 'localization', icon: 'globe', href: '/settings/localization' },
    { key: 'notifications', icon: 'check' },
  ] },
  { key: 'administration', items: [
    { key: 'license', icon: 'card', href: '/settings/license' },
    { key: 'security', icon: 'shield' },
    { key: 'audit', icon: 'back' },
  ] },
]

export default function SettingsPage() {
  const t = useT('settings')
  const ready = useSignedIn()
  return <AppShell module="settings" active="hub">
    {!ready ? <p className={styles.muted}>{t('loading')}</p> : <div className={styles.groups}>
      {GROUPS.map((group) => <section key={group.key} className={styles.group}>
        <h2>{t(`hub.group.${group.key}`)}</h2>
        <div className={styles.grid}>
          {group.items.map((item) => {
            const body = <>
              <span className={styles.icon}><Icon name={item.icon} size={20} /></span>
              <span className={styles.text}><strong>{t(`hub.${item.key}.title`)}</strong><small>{t(`hub.${item.key}.text`)}</small></span>
              {item.href ? <Icon name="right" size={18} /> : <Badge>{t('hub.soon')}</Badge>}
            </>
            return item.href
              ? <Link key={item.key} href={item.href} className={styles.card}>{body}</Link>
              : <div key={item.key} className={`${styles.card} ${styles.cardSoon}`} aria-disabled="true">{body}</div>
          })}
        </div>
      </section>)}
    </div>}
  </AppShell>
}
