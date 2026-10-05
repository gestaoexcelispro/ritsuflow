'use client'

import { useT } from '../../../lib/i18n/useT'
import { ui } from '../../fieldop/ui'

export default function DeleteProjectModal({ project, open, deleting, onCancel, onConfirm }) {
  const t = useT('projects')
  if (!open || !project) return null
  const label = [project.project_id, project.name].filter(Boolean).join(' – ')
  return <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) onCancel?.() }}>
    <section style={modal} role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
      <div style={{ padding: '20px 24px 8px' }}>
        <h2 id="delete-project-title" style={{ margin: 0, fontSize: 22 }}>{t('delete.title')}</h2>
        <div style={{ marginTop: 4, color: 'var(--fo-muted)' }}>{label}</div>
      </div>
      <div style={warning}>
        <strong>{t('delete.cannotUndo')}</strong>
        <p style={{ margin: '8px 0 0' }}>{t('delete.text')}</p>
      </div>
      <div style={footer}>
        <button type="button" className={ui.btn} onClick={onCancel} disabled={deleting}>{t('delete.cancel')}</button>
        <button type="button" className={ui.btnPrimary} style={{ background: 'var(--fo-bad)', borderColor: 'var(--fo-bad)', color: '#fff' }} onClick={onConfirm} disabled={deleting}>{deleting ? t('delete.deleting') : t('delete.confirm')}</button>
      </div>
    </section>
  </div>
}

const overlay = { position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(6,38,55,.6)', display: 'grid', placeItems: 'center', padding: 20 }
const modal = { width: 'min(560px, calc(100vw - 40px))', background: 'var(--fo-surface, #fff)', borderRadius: 12, boxShadow: '0 24px 70px rgba(6,38,55,.3)', overflow: 'hidden', color: 'var(--fo-ink, #0a2433)' }
const warning = { margin: '12px 24px 18px', padding: '14px 16px', borderRadius: 8, background: 'var(--fo-bad-wash, #fce8e6)', color: 'var(--fo-bad, #b3261e)', fontSize: 15 }
const footer = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid var(--fo-line-soft, #e5ebee)' }
