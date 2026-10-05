'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { AppShell, Badge, Notice, Panel, Stat, Stats } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import { WORKSPACE_KEYS, useOrgModules, workspaceKey } from '../orgModules'
import styles from './license.module.css'

/** Plan & usage: what the company is entitled to. Values are set by the RitsuFlow platform operator. */
export default function PlanUsagePage() {
  const t = useT('settings')
  const { loading, organization, modules, role, error } = useOrgModules(t('ws.errNoCompany'))
  const entitled = useMemo(() => { const s = new Set(['projects']); modules.forEach((m) => { if (m.is_enabled) s.add(workspaceKey(m.module_key)) }); return s }, [modules])
  const roleName = (r) => (['owner', 'admin', 'manager', 'user', 'viewer'].includes(r) ? t(`users.role.${r}`) : r || '—')

  return <AppShell module="settings" active="license">
    {loading ? <p className={styles.muted}>{t('loading')}</p> : <div className={styles.stack}>
      {error && <Notice>{error}</Notice>}
      <Stats>
        <Stat label={t('users.statCompany')} value={<span className={styles.company}>{organization?.name || '—'}</span>} hint={organization?.organization_number || organization?.slug} />
        <Stat label={t('plan.status')} value={t('plan.active')} hint={t('plan.statusHint')} tone="ok" />
        <Stat label={t('plan.basis')} value={t('plan.basisValue')} hint={t('plan.basisHint')} />
        <Stat label={t('plan.entitlements')} value={`${entitled.size} / ${WORKSPACE_KEYS.length}`} hint={t('plan.entitlementsHint')} />
      </Stats>
      <p className={styles.intro}>{t('plan.intro')}</p>

      <div className={styles.columns}>
        <Panel title={t('plan.contractTitle')} actions={<Badge tone="ok">{t('plan.active')}</Badge>}>
          <dl className={styles.rows}>
            <div><dt>{t('plan.plan')}</dt><dd>{t('plan.planValue')}</dd></div>
            <div><dt>{t('plan.basis')}</dt><dd>{t('plan.basisValue')}</dd></div>
            <div><dt>{t('plan.users')}</dt><dd>{t('plan.usersValue')}</dd></div>
            <div><dt>{t('plan.start')}</dt><dd>—</dd></div>
            <div><dt>{t('plan.renewal')}</dt><dd>—</dd></div>
            <div><dt>{t('plan.reference')}</dt><dd>—</dd></div>
          </dl>
          <p className={styles.help}>{t('plan.contractHelp')}</p>
        </Panel>
        <Panel title={t('plan.capacityTitle')} actions={<span className={styles.controlled}>{t('company.platformControlled')}</span>}>
          <dl className={styles.capacity}>
            <div><dt>{t('users.statProjects')}</dt><dd>—</dd></div>
            <div><dt>{t('plan.limit')}</dt><dd>—</dd></div>
            <div><dt>{t('plan.available')}</dt><dd>—</dd></div>
          </dl>
          <p className={styles.rule}><b>{t('plan.capacityRuleTitle')}</b> {t('plan.capacityRule')}</p>
          <p className={styles.help}>{t('plan.capacityHelp')}</p>
        </Panel>
      </div>

      <Panel title={t('plan.workspacesTitle')} text={t('plan.workspacesText')} actions={<Link className={styles.link} href="/settings/workspaces">{t('plan.viewProvisioning')}</Link>}>
        <div className={styles.grid}>
          {WORKSPACE_KEYS.map((k) => { const on = entitled.has(k); return <div key={k} className={`${styles.ws} ${on ? '' : styles.off}`}>
            <b>{t(`users.workspace.${k}`)}</b><span>{t(`plan.wsText.${k}`)}</span><Badge tone={on ? 'ok' : undefined}>{on ? t('plan.entitled') : t('plan.notEntitled')}</Badge>
          </div> })}
        </div>
      </Panel>

      <Panel title={t('plan.controlTitle')} text={t('plan.controlText')}>
        <dl className={styles.rows}>
          <div><dt>{t('plan.yourRole')}</dt><dd>{roleName(role)}</dd></div>
          <div><dt>{t('plan.selfUpgrade')}</dt><dd>{t('plan.blocked')}</dd></div>
          <div><dt>{t('plan.authority')}</dt><dd>{t('plan.authorityValue')}</dd></div>
        </dl>
      </Panel>
      <p className={styles.note}><b>{t('plan.chainTitle')}</b> {t('plan.chainText')}</p>
    </div>}
  </AppShell>
}
