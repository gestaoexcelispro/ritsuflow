'use client'

import { useMemo, useState } from 'react'
import { useT } from '../../../../lib/i18n/useT'
import { PARTICIPANT_COLORS } from '../../../../lib/pull/data'
import { boardWeeks, normalizeCalendar, workingDaysBetween, addWorkingDays } from '../../../../lib/pull/schedule'
import { Icon, Notice, Panel, ui } from '../../../fieldop/ui'
import { STATUSES, useFormatDate } from './shared'
import styles from './pull.module.css'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]
let rowKey = 0
const newRow = (index) => ({ key: `new-${++rowKey}`, id: null, company_name: '', trade: '', contact: '', color: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length] })

/** Plan settings and participants: used to create a plan and to edit one. */
export default function PlanForm({ plan, participants = [], saving, onSubmit, onCancel, showStatus = false }) {
  const t = useT('precon')
  const formatDate = useFormatDate()
  const [values, setValues] = useState(() => ({
    name: plan?.name || '',
    milestone_name: plan?.milestone_name || '',
    milestone_date: plan?.milestone_date || '',
    phase_label: plan?.phase_label || '',
    session_date: plan?.session_date || '',
    facilitator: plan?.facilitator || '',
    status: plan?.status || 'draft',
    board_weeks: plan?.board_weeks || 6,
    buffer_days: plan?.buffer_days ?? 3,
    working_days: plan?.working_days || [1, 2, 3, 4, 5],
    holidays: Array.isArray(plan?.holidays) ? plan.holidays : [],
    notes: plan?.notes || '',
  }))
  const [rows, setRows] = useState(() => participants.length
    ? participants.map((p) => ({ key: p.id, id: p.id, company_name: p.company_name, trade: p.trade || '', contact: p.contact || '', color: p.color }))
    : [newRow(0)])
  const [holiday, setHoliday] = useState({ date: '', label: '' })
  const [problem, setProblem] = useState('')

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }))
  const setRow = (key, field, value) => setRows((list) => list.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  const moveRow = (index, step) => setRows((list) => {
    const next = list.slice()
    const target = index + step
    if (target < 0 || target >= next.length) return list
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const toggleDay = (day) => setValues((v) => ({
    ...v,
    working_days: v.working_days.includes(day) ? v.working_days.filter((d) => d !== day) : [...v.working_days, day].sort(),
  }))
  const addHoliday = () => {
    if (!holiday.date) return
    setValues((v) => ({ ...v, holidays: [...v.holidays.filter((h) => h.date !== holiday.date), { date: holiday.date, label: holiday.label.trim() }].sort((a, b) => a.date.localeCompare(b.date)) }))
    setHoliday({ date: '', label: '' })
  }

  // Window summary shown next to the form.
  const span = useMemo(() => {
    if (!values.milestone_date) return null
    const calendar = normalizeCalendar({ workingDays: values.working_days, holidays: values.holidays.map((h) => h.date) })
    const weeks = boardWeeks(values.milestone_date, Number(values.board_weeks) || 6)
    const first = weeks[0]
    const days = workingDaysBetween(addWorkingDays(first, -1, calendar), values.milestone_date, calendar)
    return { first, days }
  }, [values.milestone_date, values.working_days, values.holidays, values.board_weeks])

  const submit = (event) => {
    event.preventDefault()
    setProblem('')
    if (!values.name.trim() || !values.milestone_name.trim() || !values.milestone_date) { setProblem(t('pull.form.required')); return }
    if (!values.working_days.length) { setProblem(t('pull.form.noWorkingDays')); return }
    const people = rows.filter((r) => r.company_name.trim() || r.trade.trim() || r.contact.trim())
    if (people.some((r) => !r.company_name.trim())) { setProblem(t('pull.form.companyRequired')); return }
    onSubmit({
      name: values.name.trim(),
      milestone_name: values.milestone_name.trim(),
      milestone_date: values.milestone_date,
      phase_label: values.phase_label.trim() || null,
      session_date: values.session_date || null,
      facilitator: values.facilitator.trim() || null,
      status: values.status,
      board_weeks: Math.min(16, Math.max(2, Number(values.board_weeks) || 6)),
      buffer_days: Math.min(60, Math.max(0, Number(values.buffer_days) || 0)),
      working_days: values.working_days,
      holidays: values.holidays,
      notes: values.notes.trim() || null,
    }, people)
  }

  return <form onSubmit={submit} className={ui.split}>
    <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
      <Panel title={t('pull.form.milestoneTitle')} text={t('pull.form.milestoneText')}>
        <div className={styles.formGrid}>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.name')}</span><input value={values.name} onChange={set('name')} required placeholder={t('pull.form.namePlaceholder')} /></label>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.milestone')}</span><input value={values.milestone_name} onChange={set('milestone_name')} required placeholder={t('pull.form.milestonePlaceholder')} /></label>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.milestoneDate')}</span><input type="date" value={values.milestone_date} onChange={set('milestone_date')} required /></label>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.phase')}</span><input value={values.phase_label} onChange={set('phase_label')} /><span className={ui.fieldHint}>{t('pull.form.phaseHint')}</span></label>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.sessionDate')}</span><input type="date" value={values.session_date} onChange={set('session_date')} /></label>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.facilitator')}</span><input value={values.facilitator} onChange={set('facilitator')} /></label>
          {showStatus && <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.status')}</span>
            <select value={values.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s} value={s}>{t(`pull.status.${s}`)}</option>)}</select>
          </label>}
        </div>
      </Panel>

      <Panel title={t('pull.form.calendarTitle')} text={t('pull.form.calendarText')}>
        <fieldset className={styles.fieldset}>
          <legend className={ui.fieldLabel}>{t('pull.form.workingDays')}</legend>
          <div className={styles.dayPicks}>
            {WEEKDAYS.map((day) => <label key={day} className={values.working_days.includes(day) ? styles.dayOn : styles.day}>
              <input type="checkbox" checked={values.working_days.includes(day)} onChange={() => toggleDay(day)} />{t(`pull.weekday.${day}`)}
            </label>)}
          </div>
        </fieldset>
        <div className={ui.field} style={{ marginTop: 18 }}>
          <span className={ui.fieldLabel}>{t('pull.form.holidays')}</span>
          <div className={styles.chips}>
            {values.holidays.map((h) => <span key={h.date} className={styles.holidayChip}>
              {formatDate(h.date, { weekday: 'short', month: 'short', day: 'numeric' })}{h.label ? ` · ${h.label}` : ''}
              <button type="button" onClick={() => setValues((v) => ({ ...v, holidays: v.holidays.filter((x) => x.date !== h.date) }))} aria-label={t('pull.form.removeHoliday')}><Icon name="close" size={14} /></button>
            </span>)}
            {!values.holidays.length && <span className={ui.fieldHint}>{t('pull.form.noHolidays')}</span>}
          </div>
          <div className={styles.inlineAdd}>
            <input type="date" value={holiday.date} onChange={(e) => setHoliday((h) => ({ ...h, date: e.target.value }))} aria-label={t('pull.form.holidayDate')} />
            <input value={holiday.label} onChange={(e) => setHoliday((h) => ({ ...h, label: e.target.value }))} placeholder={t('pull.form.holidayLabel')} aria-label={t('pull.form.holidayLabel')} />
            <button type="button" className={ui.btn} onClick={addHoliday} disabled={!holiday.date}><Icon name="plus" size={16} />{t('pull.form.addHoliday')}</button>
          </div>
        </div>
      </Panel>

      <Panel title={t('pull.form.participantsTitle')} text={t('pull.form.participantsText')} body={false}
        actions={<button type="button" className={ui.btn} onClick={() => setRows((list) => [...list, newRow(list.length)])}><Icon name="plus" size={16} />{t('pull.form.addParticipant')}</button>}>
        <div className={ui.tableWrap}>
          <table className={`${ui.table} ${ui.phoneCards}`} style={{ minWidth: 760 }}>
            <thead><tr><th>{t('pull.form.color')}</th><th>{t('pull.form.company')}</th><th>{t('pull.form.trade')}</th><th>{t('pull.form.contact')}</th><th /></tr></thead>
            <tbody>
              {rows.map((row, index) => <tr key={row.key}>
                <td data-label={t('pull.form.color')}>
                  <select value={row.color} onChange={(e) => setRow(row.key, 'color', e.target.value)} aria-label={t('pull.form.color')} className={styles.colorSelect} style={{ background: row.color }}>
                    {PARTICIPANT_COLORS.map((c, i) => <option key={c} value={c} style={{ background: c }}>{t('pull.form.colorN', { n: i + 1 })}</option>)}
                  </select>
                </td>
                <td data-label={t('pull.form.company')}><input value={row.company_name} onChange={(e) => setRow(row.key, 'company_name', e.target.value)} aria-label={t('pull.form.company')} /></td>
                <td data-label={t('pull.form.trade')}><input value={row.trade} onChange={(e) => setRow(row.key, 'trade', e.target.value)} aria-label={t('pull.form.trade')} /></td>
                <td data-label={t('pull.form.contact')}><input value={row.contact} onChange={(e) => setRow(row.key, 'contact', e.target.value)} aria-label={t('pull.form.contact')} /></td>
                <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button type="button" className={ui.btnGhost} onClick={() => moveRow(index, -1)} disabled={index === 0} aria-label={t('pull.form.moveUp')}>↑</button>
                  <button type="button" className={ui.btnGhost} onClick={() => moveRow(index, 1)} disabled={index === rows.length - 1} aria-label={t('pull.form.moveDown')}>↓</button>
                  <button type="button" className={ui.btnGhost} onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))} aria-label={t('pull.form.removeParticipant')}><Icon name="close" size={16} /></button>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {participants.length > 0 && <p className={ui.fieldHint} style={{ padding: '10px 20px 16px', margin: 0 }}>{t('pull.form.removeHint')}</p>}
      </Panel>
    </div>

    <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
      <Panel title={t('pull.form.windowTitle')}>
        <div className={styles.kv}><span>{t('pull.form.boardStarts')}</span><strong>{span ? formatDate(span.first, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}</strong></div>
        <div className={styles.kv}><span>{t('pull.form.milestoneDate')}</span><strong>{values.milestone_date ? formatDate(values.milestone_date, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}</strong></div>
        <div className={styles.kv}><span>{t('pull.form.length')}</span><strong>{span ? t('pull.form.lengthValue', { weeks: values.board_weeks, days: span.days }) : '—'}</strong></div>
        <div className={styles.formGrid} style={{ marginTop: 14 }}>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.weeks')}</span><input type="number" min="2" max="16" value={values.board_weeks} onChange={set('board_weeks')} /></label>
          <label className={ui.field}><span className={ui.fieldLabel}>{t('pull.form.buffer')}</span><input type="number" min="0" max="60" value={values.buffer_days} onChange={set('buffer_days')} /><span className={ui.fieldHint}>{t('pull.form.bufferHint')}</span></label>
        </div>
        <label className={ui.field} style={{ marginTop: 14 }}><span className={ui.fieldLabel}>{t('pull.form.notes')}</span><textarea value={values.notes} onChange={set('notes')} /></label>
      </Panel>
      <Notice>{problem}</Notice>
      <div className={ui.actions} style={{ justifyContent: 'flex-end' }}>
        <button type="button" className={ui.btn} onClick={onCancel}>{t('pull.cancel')}</button>
        <button type="submit" className={ui.btnPrimary} disabled={saving}>{plan ? t('pull.form.save') : t('pull.form.create')}</button>
      </div>
    </div>
  </form>
}
