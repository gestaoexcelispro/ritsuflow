'use client'

import { useState } from 'react'
import { useT } from '../../../../lib/i18n/useT'
import { Dialog } from '../../../fieldop/ui/dialogs'
import { Notice, ui } from '../../../fieldop/ui'
import { handoffLabel, useFormatDate } from './shared'
import styles from './pull.module.css'

const MILESTONE = '__milestone__'

/** Create or edit a handoff: what a giver sticky delivers to a receiver sticky (or the milestone). */
export default function HandoffDialog({ handoff, giverId, stickies, participants, schedule, readOnly, onSave, onDelete, onClose }) {
  const t = useT('precon')
  const formatDate = useFormatDate()
  const [values, setValues] = useState(() => ({
    giver_sticky_id: handoff?.giver_sticky_id || giverId || '',
    receiver: handoff ? (handoff.receiver_sticky_id || MILESTONE) : '',
    deliverable: handoff?.deliverable || '',
    acceptance_criteria: handoff?.acceptance_criteria || '',
    lag_days: handoff?.lag_days ?? 0,
    status: handoff?.status || 'proposed',
  }))
  const [problem, setProblem] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }))

  const nameOf = (s) => {
    const who = participants.find((p) => p.id === s.participant_id)?.company_name
    return [[s.code, s.title].filter(Boolean).join(' · '), who].filter(Boolean).join(' — ')
  }
  const sorted = stickies.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  const timing = handoff ? schedule.handoffs[handoff.id] : null

  const submit = async (event) => {
    event.preventDefault()
    setProblem('')
    if (!values.giver_sticky_id || !values.receiver) { setProblem(t('pull.handoff.pickBoth')); return }
    if (values.giver_sticky_id === values.receiver) { setProblem(t('pull.handoff.sameSticky')); return }
    if (!values.deliverable.trim()) { setProblem(t('pull.handoff.deliverableRequired')); return }
    setSaving(true)
    const ok = await onSave({
      giver_sticky_id: values.giver_sticky_id,
      receiver_sticky_id: values.receiver === MILESTONE ? null : values.receiver,
      deliverable: values.deliverable.trim(),
      acceptance_criteria: values.acceptance_criteria.trim() || null,
      lag_days: Math.min(60, Math.max(0, Math.round(Number(values.lag_days)) || 0)),
      status: values.status,
      agreed_at: values.status === 'agreed' ? (handoff?.agreed_at || new Date().toISOString()) : null,
    })
    if (!ok) setSaving(false)
  }

  return <Dialog
    as="form"
    onSubmit={submit}
    title={handoff ? t('pull.handoff.editTitle', { label: handoffLabel(handoff) }) : t('pull.handoff.newTitle')}
    text={timing ? t('pull.handoff.neededBy', { date: formatDate(timing.neededBy, { weekday: 'short', month: 'short', day: 'numeric' }) }) : t('pull.handoff.newText')}
    onClose={onClose}
    footer={<>
      {handoff && !readOnly && <button type="button" className={ui.btnDanger} onClick={onDelete} style={{ marginRight: 'auto' }}>{t('pull.delete')}</button>}
      <button type="button" className={ui.btn} onClick={onClose}>{readOnly ? t('pull.close') : t('pull.cancel')}</button>
      {!readOnly && <button type="submit" className={ui.btnPrimary} disabled={saving}>{t('pull.save')}</button>}
    </>}
  >
    <fieldset disabled={readOnly} className={styles.fieldset}>
      <div className={styles.formGrid}>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.handoff.giver')}</span>
          <select value={values.giver_sticky_id} onChange={set('giver_sticky_id')} required>
            <option value="">{t('pull.handoff.pick')}</option>
            {sorted.map((s) => <option key={s.id} value={s.id}>{nameOf(s)}</option>)}
          </select>
        </label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.handoff.receiver')}</span>
          <select value={values.receiver} onChange={set('receiver')} required>
            <option value="">{t('pull.handoff.pick')}</option>
            <option value={MILESTONE}>{t('pull.handoff.toMilestone')}</option>
            {sorted.filter((s) => s.id !== values.giver_sticky_id).map((s) => <option key={s.id} value={s.id}>{nameOf(s)}</option>)}
          </select>
        </label>
        <label className={ui.field} style={{ gridColumn: '1 / -1' }}><span className={ui.fieldLabel}>{t('pull.handoff.deliverable')}</span>
          <input value={values.deliverable} onChange={set('deliverable')} required placeholder={t('pull.handoff.deliverablePlaceholder')} />
        </label>
        <label className={ui.field} style={{ gridColumn: '1 / -1' }}><span className={ui.fieldLabel}>{t('pull.handoff.acceptance')}</span>
          <input value={values.acceptance_criteria} onChange={set('acceptance_criteria')} placeholder={t('pull.handoff.acceptancePlaceholder')} />
        </label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.handoff.lag')}</span><input type="number" min="0" max="60" value={values.lag_days} onChange={set('lag_days')} /><span className={ui.fieldHint}>{t('pull.handoff.lagHint')}</span></label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.handoff.status')}</span>
          <select value={values.status} onChange={set('status')}>
            <option value="proposed">{t('pull.handoffStatus.proposed')}</option>
            <option value="agreed">{t('pull.handoffStatus.agreed')}</option>
          </select>
        </label>
      </div>
    </fieldset>
    <Notice>{problem}</Notice>
  </Dialog>
}
