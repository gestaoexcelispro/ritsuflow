'use client'

import { useMemo } from 'react'
import { AppShell, Badge, Notice, Stat, Stats } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import { WORKSPACE_KEYS, useOrgModules, workspaceKey } from '../orgModules'
import styles from './workspaces.module.css'

/** What the company has: the workspaces provisioned for it. User access can never go beyond this. */
export default function WorkspaceAccessPage() {
  const t = useT('settings')
  const { loading, organization, modules, error } = useOrgModules(t('ws.errNoCompany'))
  const cards = useMemo(() => {
    const byKey = new Map(modules.map((m) => [workspaceKey(m.module_key), m]))
    return WORKSPACE_KEYS.map((key) => {
      const record = byKey.get(key)
      const core = key === 'projects'
      return { key, core, enabled: core ? record?.is_enabled !== false : Boolean(record?.is_enabled) }
    })
  }, [modules])
  const active = cards.filter((c) => c.enabled).length

  return <AppShell module="settings" active="workspaces">
    {loading ? <p className={styles.muted}>{t('loading')}</p> : <div className={styles.stack}>
      {error && <Notice>{error}</Notice>}
      <Stats>
        <Stat label={t('users.statCompany')} value={<span className={styles.company}>{organization?.name || '—'}</span>} hint={organization?.organization_number || organization?.slug} />
        <Stat label={t('ws.statProvisioned')} value={`${active} / ${WORKSPACE_KEYS.length}`} hint={t('ws.statProvisionedHint')} />
      </Stats>
      <p className={styles.intro}>{t('ws.intro')}</p>
      <ol className={styles.flow}>{['provisioning', 'company', 'user', 'project'].map((k) => <li key={k}>{t(`ws.flow.${k}`)}</li>)}</ol>

      <div className={styles.grid}>
        {cards.map((c) => <article key={c.key} className={`${styles.card} ${c.enabled ? '' : styles.off}`}>
          <div className={styles.cardTop}>
            <h3>{t(`users.workspace.${c.key}`)}</h3>
            <Badge tone={c.enabled ? 'ok' : undefined}>{c.enabled ? t('ws.active') : t('ws.notProvisioned')}</Badge>
          </div>
          {c.core && <small className={styles.core}>{t('ws.core')}</small>}
          <p>{t(`ws.desc.${c.key}`)}</p>
          <dl>
            <div><dt>{t('ws.companyStatus')}</dt><dd>{c.enabled ? t('ws.enabled') : t('ws.unavailable')}</dd></div>
            <div><dt>{t('ws.userAssignment')}</dt><dd>{c.enabled ? t('ws.available') : t('ws.blocked')}</dd></div>
          </dl>
          <span className={styles.foot}>{c.enabled ? t('ws.footOn') : t('ws.footOff')}</span>
        </article>)}
      </div>
      <p className={styles.note}><b>{t('ws.ruleTitle')}</b> {t('ws.ruleText')}</p>
    </div>}
  </AppShell>
}
