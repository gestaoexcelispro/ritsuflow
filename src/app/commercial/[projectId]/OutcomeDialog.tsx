'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/useT'
import { OUTCOME_REASONS, type BidStatus, type OutcomeReason } from '@/lib/commercial/bids'
import { ui } from '../ui'

type Props = {
  status: Extract<BidStatus, 'won' | 'lost' | 'no_bid'>
  initialNote: string | null
  initialReason: OutcomeReason | null
  busy: boolean
  onCancel: () => void
  onConfirm: (note: string | null, reason: OutcomeReason | null) => void
}

/** Won / Lost / Declined: a reason from a fixed list (for Insights) and a free note. */
export default function OutcomeDialog({ status, initialNote, initialReason, busy, onCancel, onConfirm }: Props) {
  const t = useT('commercial')
  const [note, setNote] = useState(initialNote || '')
  const [reason, setReason] = useState<OutcomeReason | ''>(initialReason || '')
  const [error, setError] = useState('')
  const needsReason = status !== 'won'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (needsReason && !reason) { setError(t('outcome.errReason')); return }
    onConfirm(note.trim() || null, needsReason ? (reason || null) : null)
  }

  return (
    <div role="presentation" onClick={e => { if (e.target === e.currentTarget && !busy) onCancel() }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(23,52,65,.35)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form role="dialog" aria-modal="true" aria-labelledby="outcome-title" onSubmit={submit}
        style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(23,52,65,.25)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="outcome-title" style={{ margin: 0, fontSize: 20, color: '#173441' }}>{t(`outcome.title.${status}`)}</h2>
        {needsReason && (
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <legend style={{ ...ui.label, marginBottom: 6 }}>{t('outcome.reason')}</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
              {OUTCOME_REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#294955', border: `1px solid ${reason === r ? '#0b7f75' : '#dfe7ea'}`, background: reason === r ? '#f3fbfa' : '#fff' }}>
                  <input type="radio" name="outcome-reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: '#0b7f75' }} />
                  {t(`reason.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label style={ui.label}>{t('outcome.note')}
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={t('bid.notePrompt')}
            style={{ ...ui.input, height: 'auto', padding: 10, fontFamily: 'inherit', resize: 'vertical' }} />
        </label>
        {error && <div role="alert" style={ui.error}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" disabled={busy} onClick={onCancel} style={ui.buttonGhost}>{t('action.cancel')}</button>
          <button type="submit" disabled={busy} style={ui.button}>{t('action.save')}</button>
        </div>
      </form>
    </div>
  )
}
