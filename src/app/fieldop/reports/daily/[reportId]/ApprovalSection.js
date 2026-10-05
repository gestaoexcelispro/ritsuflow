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

export default function ApprovalSection({ report, supabase, t, language, approvalRequired, onChanged }) {
  const [history, setHistory] = useState([])
  const [people, setPeople] = useState(new Map())
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  const dateTime = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const actionLabel = (action) => { const key = `action.${action}`; const text = t(key); return text === key ? action : text }

  async function run(action) {
    setBusy(action); setMessage(''); setError('')
    const { data, error: rpcError } = await supabase.rpc('transition_daily_report_status', { p_daily_report_id: report.id, p_action: action, p_comments: comments.trim() || null })
    if (rpcError) setError(t('common.error', { message: rpcError.message }))
    else {
      const status = (Array.isArray(data) ? data[0] : data)?.status || report.status
      setComments('')
      setMessage(t('approval.done', { status: t(`status.${status}`) }))
      onChanged?.({ status })
      await loadHistory()
    }
    setBusy('')
  }

  const actions = ACTIONS[report.status] || []

  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.approval')}</h3><p>{t('approval.text')}</p></div><span className={styles.badge}>{t(`status.${report.status}`)}</span></div>
    <div style={{ display: 'grid', gap: 14, padding: 18 }}>
      {!approvalRequired && <p style={{ margin: 0, color: '#64748b' }}>{t('approval.notRequired')}</p>}
      <div><small style={{ color: '#64748b' }}>{t('approval.current')}</small><div style={{ fontSize: 18, fontWeight: 800 }}>{t(`status.${report.status}`)}</div></div>
      <label style={{ display: 'grid', gap: 6 }}><b>{t('approval.comments')}</b><textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t('approval.commentsPlaceholder')} /></label>
      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.successMessage}>{message}</div>}
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
