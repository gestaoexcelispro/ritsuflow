'use client'

import { AppShell, Icon, Panel } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import { useSignedIn } from '../useSignedIn'
import styles from './roles.module.css'

const ROLES = ['admin', 'manager', 'member', 'viewer']
// Capability -> roles that have it. Labels come from the "settings" messages (roles.cap.<key>).
const GROUPS = [
  { key: 'organization', items: [
    ['company_settings', 'admin'], ['users_manage', 'admin'], ['roles_manage', 'admin'], ['workspace_settings', 'admin'],
  ] },
  { key: 'projects', items: [
    ['project_create', 'admin manager'], ['project_edit', 'admin manager'], ['project_operate', 'admin manager member'],
    ['project_close', 'admin manager'], ['project_reopen', 'admin'], ['project_delete', 'admin'],
  ] },
  { key: 'precon', items: [
    ['planning_manage', 'admin manager member'], ['constraints_manage', 'admin manager member'],
    ['commitments_manage', 'admin manager member'], ['planning_approve', 'admin manager'],
  ] },
  { key: 'fieldop', items: [
    ['daily_reports', 'admin manager member'], ['workforce', 'admin manager member'],
    ['attendance_admin', 'admin manager'], ['field_approve', 'admin manager'],
  ] },
  { key: 'reporting', items: [
    ['ritsuscope_edit', 'admin manager member'], ['reports_view', 'admin manager member viewer'], ['reports_generate', 'admin manager member viewer'],
  ] },
]

export default function RolesPermissions() {
  const t = useT('settings')
  const ready = useSignedIn()
  return <AppShell module="settings" active="roles">
    {!ready ? <p className={styles.muted}>{t('loading')}</p> : <div className={styles.stack}>
      <p className={styles.intro}>{t('roles.intro')}</p>

      <div className={styles.cards}>
        {ROLES.map((role) => <article key={role} className={styles.role}>
          <div><strong>{t(`roles.${role}.name`)}</strong><span>{t(`roles.${role}.tag`)}</span></div>
          <p>{t(`roles.${role}.text`)}</p>
          {role === 'admin' && <small><Icon name="shield" size={14} />{t('roles.protected')}</small>}
        </article>)}
        <article className={`${styles.role} ${styles.owner}`}>
          <div><strong>{t('roles.owner.name')}</strong><span>{t('roles.owner.tag')}</span></div>
          <p>{t('roles.owner.text')}</p>
        </article>
      </div>

      <div className={styles.closed}><Icon name="shield" size={20} /><div><b>{t('roles.closedTitle')}</b><span>{t('roles.closedText')}</span></div></div>

      <Panel title={t('roles.matrixTitle')} text={t('roles.matrixText')} body={false}>
        <div className={styles.matrixWrap}>
          <table className={styles.matrix}>
            <thead><tr><th>{t('roles.capability')}</th>{ROLES.map((role) => <th key={role}>{t(`roles.${role}.name`)}</th>)}</tr></thead>
            {GROUPS.map((group) => <tbody key={group.key}>
              <tr className={styles.groupRow}><th colSpan={ROLES.length + 1}>{t(`roles.group.${group.key}`)}</th></tr>
              {group.items.map(([key, who]) => <tr key={key}>
                <td>{t(`roles.cap.${key}`)}</td>
                {ROLES.map((role) => <td key={role} className={styles.cell}>{who.split(' ').includes(role)
                  ? <span className={styles.yes} aria-label={t('roles.allowed')}><Icon name="check" size={15} strokeWidth={2.6} /></span>
                  : <span className={styles.no} aria-label={t('roles.notAllowed')}>—</span>}</td>)}
              </tr>)}
            </tbody>)}
          </table>
        </div>
      </Panel>

      <p className={styles.note}><b>{t('roles.noteTitle')}</b> {t('roles.noteText')}</p>
    </div>}
  </AppShell>
}
