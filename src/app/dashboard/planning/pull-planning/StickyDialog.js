'use client'

import { useState } from 'react'
import { useT } from '../../../../lib/i18n/useT'
import { mondayOf, snapToWorkingDay } from '../../../../lib/pull/schedule'
import { Dialog } from '../../../fieldop/ui/dialogs'
import { Icon, Notice, ui } from '../../../fieldop/ui'
import { handoffLabel, useFormatDate } from './shared'
import styles from './pull.module.css'

/**
 * Create or edit a sticky. Placement: "Not placed yet", "At its latest start" or a board week
 * (the sticky then starts on that week's first working day).
 */
export default function StickyDialog({ sticky, participants, weeks, calendar, schedule, handoffs, stickies, readOnly, onSave, onDelete, onAddHandoff, onOpenHandoff, onClose }) {
  const t = useT('precon')
  const formatDate = useFormatDate()
  const timing = sticky ? schedule.stickies[sticky.id] : null
  const initialPlacement = () => {
    if (!sticky || !sticky.is_placed) return 'unplaced'
    if (!sticky.planned_start) return 'latest'
    return `week:${mondayOf(sticky.planned_start)}`
  }
  const [values, setValues] = useState(() => ({
    code: sticky?.code || '',
    title: sticky?.title || '',
    participant_id: sticky?.participant_id || '',
    zone_label: sticky?.zone_label || '',
    duration_days: sticky?.duration_days || 1,
    crew_size: sticky?.crew_size ?? '',
    notes: sticky?.notes || '',
    placement: initialPlacement(),
  }))
  const [problem, setProblem] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setProblem('')
    if (!values.title.trim()) { setProblem(t('pull.sticky.titleRequired')); return }
    if (values.placement !== 'unplaced' && !values.participant_id) { setProblem(t('pull.sticky.participantRequired')); return }
    const duration = Math.round(Number(values.duration_days))
    if (!(duration >= 1 && duration <= 250)) { setProblem(t('pull.sticky.durationInvalid')); return }
    let plannedStart = null
    if (values.placement.startsWith('week:')) {
      const monday = values.placement.slice(5)
      // A week that holds the latest start keeps the sticky at its latest start.
      plannedStart = timing && mondayOf(timing.latestStart) === monday ? null : snapToWorkingDay(monday, calendar, 1)
    }
    setSaving(true)
    const ok = await onSave({
      code: values.code.trim().toUpperCase() || null,
      title: values.title.trim(),
      participant_id: values.participant_id || null,
      zone_label: values.zone_label.trim() || null,
      duration_days: duration,
      crew_size: values.crew_size === '' ? null : Math.max(0, Math.round(Number(values.crew_size)) || 0),
      notes: values.notes.trim() || null,
      is_placed: values.placement !== 'unplaced',
      planned_start: plannedStart,
    })
    if (!ok) setSaving(false)
  }

  const label = (id) => {
    const s = stickies.find((x) => x.id === id)
    return s ? [s.code, s.title].filter(Boolean).join(' · ') : ''
  }
  const incoming = sticky ? handoffs.filter((h) => h.receiver_sticky_id === sticky.id) : []
  const outgoing = sticky ? handoffs.filter((h) => h.giver_sticky_id === sticky.id) : []

  return <Dialog
    as="form"
    onSubmit={submit}
    size="wide"
    title={sticky ? t('pull.sticky.editTitle') : t('pull.sticky.newTitle')}
    text={timing ? t('pull.sticky.timing', { start: formatDate(timing.latestStart, { month: 'short', day: 'numeric' }), finish: formatDate(timing.latestFinish, { month: 'short', day: 'numeric' }) }) : t('pull.sticky.newText')}
    onClose={onClose}
    footer={<>
      {sticky && !readOnly && <button type="button" className={ui.btnDanger} onClick={onDelete} style={{ marginRight: 'auto' }}>{t('pull.delete')}</button>}
      <button type="button" className={ui.btn} onClick={onClose}>{readOnly ? t('pull.close') : t('pull.cancel')}</button>
      {!readOnly && <button type="submit" className={ui.btnPrimary} disabled={saving}>{t('pull.save')}</button>}
    </>}
  >
    <fieldset disabled={readOnly} className={styles.fieldset}>
      <div className={styles.formGrid}>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.sticky.title')}</span><input value={values.title} onChange={set('title')} required autoFocus={!sticky} placeholder={t('pull.sticky.titlePlaceholder')} /></label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.sticky.code')}</span><input value={values.code} onChange={set('code')} maxLength={8} placeholder="FRM" /><span className={ui.fieldHint}>{t('pull.sticky.codeHint')}</span></label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.sticky.participant')}</span>
          <select value={values.participant_id} onChange={set('participant_id')}>
            <option value="">{t('pull.sticky.noParticipant')}</option>
            {participants.map((p) => <option key={p.id} value={p.id}>{p.company_name}{p.trade ? ` · ${p.trade}` : ''}</option>)}
          </select>
        </label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.sticky.zone')}</span><input value={values.zone_label} onChange={set('zone_label')} placeholder={t('pull.sticky.zonePlaceholder')} /></label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.sticky.duration')}</span><input type="number" min="1" max="250" value={values.duration_days} onChange={set('duration_days')} required /></label>
        <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.sticky.crew')}</span><input type="number" min="0" max="999" value={values.crew_size} onChange={set('crew_size')} /></label>
        <label className={ui.field} style={{ gridColumn: '1 / -1' }}><span className={ui.fieldLabel}>{t('pull.sticky.placement')}</span>
          <select value={values.placement} onChange={set('placement')}>
            <option value="unplaced">{t('pull.sticky.unplaced')}</option>
            <option value="latest">{timing ? t('pull.sticky.atLatestDate', { date: formatDate(timing.latestStart, { weekday: 'short', month: 'short', day: 'numeric' }) }) : t('pull.sticky.atLatest')}</option>
            {weeks.map((monday) => <option key={monday} value={`week:${monday}`}>{t('pull.sticky.weekOf', { date: formatDate(monday, { month: 'short', day: 'numeric' }) })}</option>)}
          </select>
          <span className={ui.fieldHint}>{t('pull.sticky.placementHint')}</span>
        </label>
        <label className={ui.field} style={{ gridColumn: '1 / -1' }}><span className={ui.fieldLabel}>{t('pull.sticky.notes')}</span><textarea value={values.notes} onChange={set('notes')} /></label>
      </div>
    </fieldset>

    {sticky && <div className={styles.handoffLists}>
      <div>
        <h3 className={styles.miniTitle}>{t('pull.sticky.receives', { count: incoming.length })}</h3>
        {!incoming.length && <p className={ui.fieldHint}>{t('pull.sticky.noIncoming')}</p>}
        {incoming.map((h) => <button type="button" key={h.id} className={styles.handoffRow} onClick={() => onOpenHandoff(h)}>
          <b>{handoffLabel(h)}</b><span>{t('pull.sticky.fromLabel', { name: label(h.giver_sticky_id) })} — {h.deliverable}</span><em data-status={h.status}>{t(`pull.handoffStatus.${h.status}`)}</em>
        </button>)}
      </div>
      <div>
        <h3 className={styles.miniTitle}>{t('pull.sticky.delivers', { count: outgoing.length })}</h3>
        {!outgoing.length && <p className={ui.fieldHint}>{t('pull.sticky.noOutgoing')}</p>}
        {outgoing.map((h) => <button type="button" key={h.id} className={styles.handoffRow} onClick={() => onOpenHandoff(h)}>
          <b>{handoffLabel(h)}</b><span>{t('pull.sticky.toLabel', { name: h.receiver_sticky_id ? label(h.receiver_sticky_id) : t('pull.milestone') })} — {h.deliverable}</span><em data-status={h.status}>{t(`pull.handoffStatus.${h.status}`)}</em>
        </button>)}
        {!readOnly && <button type="button" className={ui.btnGhost} onClick={onAddHandoff} style={{ marginTop: 6 }}><Icon name="plus" size={16} />{t('pull.sticky.addHandoff')}</button>}
      </div>
    </div>}
    <Notice>{problem}</Notice>
  </Dialog>
}
