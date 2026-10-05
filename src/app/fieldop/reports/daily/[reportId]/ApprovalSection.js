'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from '../daily-reports.module.css'

// Workflow actions available from each status (enforced again by transition_daily_report_status).
const ACTIONS = {
  draft: ['submitted'],
  submitted: ['reviewed', 'returned'],
  reviewed: ['approved', 'returned'],
  approved: ['reopened'],
}
const PRIMARY = new Set(['submitted', 'reviewed', 'approved'])
// Permission each action needs (same mapping as transition_daily_report_status).
const NEEDS = { submitted: 'submit', reviewed: 'review', returned: 'review', approved: 'approve', reopened: 'reopen' }

export default function ApprovalSection({ report, supabase, t, language, approvalRequired, onChanged }) {
  const [history, setHistory] = useState([])
  const [people, setPeople] = useState(new Map())
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [perms, setPerms] = useState(null)

  const loadPerms = useCallback(async () => {
    const { data, error: permError } = await supabase.rpc('fieldop_daily_report_permissions', { p_daily_report_id: report.id })
    // If the check is unavailable, fall back to showing every action; the database still enforces permissions.
    setPerms(permError || !data ? null : data)
  }, [report.id, supabase])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('daily_report_approval_history').select('id,action,from_status,to_status,comments,performed_by,performed_at').eq('daily_report_id', report.id).order('performed_at', { ascending: false })
    const list = data || []
    setHistory(list)
    const ids = [...new Set(list.map((h) => h.performed_by).filter(Boolean))]
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('user_id,full_name,email').in('user_id', ids)
      setPeople(new Map((profiles || []).map((p) => [p.user_id, p.full_name || p.email])))
    }
  }, [report.id, supabase])

  useEffect(() => { loadHistory() }, [loadHistory])
  useEffect(() => { loadPerms() }, [loadPerms, report.status])

  const dateTime = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const actionLabel = (action) => { const key = `action.${action}`; const text = t(key); return text === key ? action : text }

  async function run(action) {
    setBusy(action); setMessage(''); setError('')
    const { data, error: rpcError } = await supabase.rpc('transition_daily_report_status', { p_daily_report_id: report.id, p_action: action, p_comments: comments.trim() || null })
    if (rpcError) setError(rpcError.message?.includes('SEPARATE_APPROVER_REQUIRED') ? t('approval.separateBlocked') : t('common.error', { message: rpcError.message }))
    else {
      const status = (Array.isArray(data) ? data[0] : data)?.status || report.status
      setComments('')
      setMessage(t('approval.done', { status: t(`status.${status}`) }))
      onChanged?.({ status })
      await loadHistory()
    }
    setBusy('')
  }

  const possible = ACTIONS[report.status] || []
  const separationBlocks = Boolean(perms?.approve_blocked_by_separation) && possible.includes('approved')
  const actions = perms
    ? possible.filter((action) => perms[NEEDS[action]] && !(action === 'approved' && separationBlocks))
    : possible

  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.approval')}</h3><p>{t('approval.text')}</p></div><span className={styles.badge}>{t(`status.${report.status}`)}</span></div>
    <div style={{ display: 'grid', gap: 14, padding: 18 }}>
      {!approvalRequired && <p style={{ margin: 0, color: 'var(--fo-muted)' }}>{t('approval.notRequired')}</p>}
      {perms?.separate_approver_required && <p style={{ margin: 0, color: 'var(--fo-muted)' }}>{t('approval.separateRule')}</p>}
      <div><small style={{ color: 'var(--fo-muted)' }}>{t('approval.current')}</small><div style={{ fontSize: 18, fontWeight: 800 }}>{t(`status.${report.status}`)}</div></div>
      {actions.length > 0 && <label style={{ display: 'grid', gap: 6 }}><b>{t('approval.comments')}</b><textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t('approval.commentsPlaceholder')} /></label>}
      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.successMessage}>{message}</div>}
      {separationBlocks && perms?.approve && <div className={styles.error}>{t('approval.separateBlocked')}</div>}
      {perms && possible.length > 0 && actions.length === 0 && !separationBlocks && <p style={{ margin: 0, color: 'var(--fo-muted)' }}>{t('approval.noActions')}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {actions.map((action) => <button key={action} type="button" disabled={Boolean(busy)} className={PRIMARY.has(action) ? styles.primaryButton : styles.secondaryButton} onClick={() => run(action)}>{busy === action ? t('common.saving') : t(`approval.${action}`)}</button>)}
      </div>
    </div>
    <div className={styles.panelHead}><h3>{t('approval.history')}</h3></div>
    {history.length === 0
      ? <div className={styles.empty}>{t('approval.historyEmpty')}</div>
      : <table className={styles.table}>
        <tbody>{history.map((h) => <tr key={h.id}>
          <td style={{ whiteSpace: 'nowrap' }}>{h.performed_at ? dateTime.format(new Date(h.performed_at)) : '—'}</td>
          <td><strong>{actionLabel(h.action)}</strong><br /><small>{t(`status.${h.from_status}`)} → {t(`status.${h.to_status}`)}</small></td>
          <td>{people.get(h.performed_by) || '—'}</td>
          <td>{h.comments || ''}</td>
        </tr>)}</tbody>
      </table>}
  </section>
}
