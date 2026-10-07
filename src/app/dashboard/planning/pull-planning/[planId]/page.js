'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useT } from '../../../../../lib/i18n/useT'
import { paperOf } from '../../../../../lib/pull/data'
import { mondayOf, snapToWorkingDay, weekIndex, workingDaysInWeek } from '../../../../../lib/pull/schedule'
import { usePageDialogs } from '../../../../fieldop/ui/dialogs'
import { Badge, Empty, Icon, Notice, PageHeader, Panel, Stat, Stats, ui } from '../../../../fieldop/ui'
import HandoffDialog from '../HandoffDialog'
import StickyDialog from '../StickyDialog'
import usePullPlan, { DUPLICATE_HANDOFF, NO_PERMISSION } from '../usePullPlan'
import { PULL_BASE, STATUS_TONE, handoffLabel, useFormatDate, useFormatRange } from '../shared'
import styles from '../pull.module.css'

const cx = (...names) => names.filter(Boolean).join(' ')

export default function PullBoardPage({ params }) {
  const { planId } = params
  const t = useT('precon')
  const dialogs = usePageDialogs()
  const formatDate = useFormatDate()
  const formatRange = useFormatRange()
  const { notify } = dialogs
  const onError = useCallback((message) => notify(message === DUPLICATE_HANDOFF ? t('pull.handoff.duplicate') : message === NO_PERMISSION ? t('pull.noPermission') : message, 'bad'), [notify, t])
  const { data, calendar, weeks, schedule, saveSticky, deleteSticky, saveHandoff, deleteHandoff, updatePlan } = usePullPlan(planId, onError)

  const [showOrder, setShowOrder] = useState(true)
  const [showIds, setShowIds] = useState(true)
  const [stickyDialog, setStickyDialog] = useState(null) // { sticky } | { sticky: null, participantId }
  const [handoffDialog, setHandoffDialog] = useState(null) // { handoff } | { giverId }
  const [dragId, setDragId] = useState(null)
  const [overCell, setOverCell] = useState(null)

  const plan = data?.plan
  const readOnly = plan ? ['agreed', 'archived'].includes(plan.status) : true

  const derived = useMemo(() => {
    if (!data || !schedule) return null
    const lanes = new Set(data.participants.map((p) => p.id))
    const placed = data.stickies.filter((s) => s.is_placed && lanes.has(s.participant_id))
    const parking = data.stickies.filter((s) => !(s.is_placed && lanes.has(s.participant_id)))
    const ins = {}, outs = {}
    for (const h of data.handoffs) {
      ;(outs[h.giver_sticky_id] ||= []).push(h)
      if (h.receiver_sticky_id) (ins[h.receiver_sticky_id] ||= []).push(h)
    }
    const late = data.stickies.filter((s) => schedule.stickies[s.id]?.late).length
    const conflicts = data.handoffs.filter((h) => schedule.handoffs[h.id]?.conflict).length
    const agreed = data.handoffs.filter((h) => h.status === 'agreed').length
    const toMilestone = data.handoffs.filter((h) => !h.receiver_sticky_id)
    return { placed, parking, ins, outs, late, conflicts, agreed, toMilestone }
  }, [data, schedule])

  if (data === undefined) return <Empty text={t('pull.loading')} />
  if (data === null) return <>{dialogs.element}<Panel><Empty title={t('pull.notFound')} text={t('pull.notFoundText')} action={<Link className={ui.btn} href={PULL_BASE}>{t('pull.backToPlans')}</Link>} /></Panel></>

  const participantOf = (sticky) => data.participants.find((p) => p.id === sticky.participant_id)

  // Drop a sticky on a trade × week cell (weekIdx) or back in the parking lot (weekIdx = null).
  const place = async (stickyId, participantId, weekIdx) => {
    const sticky = data.stickies.find((s) => s.id === stickyId)
    if (!sticky || readOnly) return
    if (weekIdx === null) {
      if (!sticky.is_placed) return
      await saveSticky(sticky.id, { is_placed: false, planned_start: null })
      return
    }
    const timing = schedule.stickies[sticky.id]
    const monday = weeks[weekIdx]
    const where = weekIndex(timing.start, weeks)
    const sameCell = sticky.is_placed && sticky.participant_id === participantId && !where.clamped && where.index === weekIdx
    if (sameCell) return
    const plannedStart = mondayOf(timing.latestStart) === monday ? null : snapToWorkingDay(monday, calendar, 1)
    await saveSticky(sticky.id, { participant_id: participantId, is_placed: true, planned_start: plannedStart })
  }

  const dropProps = (participantId, weekIdx) => {
    const key = `${participantId || 'parking'}:${weekIdx ?? 'x'}`
    return readOnly ? {} : {
      onDragOver: (e) => { if (dragId) { e.preventDefault(); if (overCell !== key) setOverCell(key) } },
      onDragLeave: () => setOverCell((c) => (c === key ? null : c)),
      onDrop: (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; setOverCell(null); setDragId(null); if (id) place(id, participantId, weekIdx) },
      'data-over': overCell === key ? 'true' : undefined,
    }
  }

  const removeSticky = async (sticky) => {
    if (!(await dialogs.confirm(t('pull.sticky.deleteConfirm', { name: sticky.title }), { danger: true, confirmLabel: t('pull.delete') }))) return
    if (await deleteSticky(sticky.id)) { setStickyDialog(null); notify(t('pull.sticky.deleted')) }
  }
  const removeHandoff = async (handoff) => {
    if (!(await dialogs.confirm(t('pull.handoff.deleteConfirm', { label: handoffLabel(handoff) }), { danger: true, confirmLabel: t('pull.delete') }))) return
    if (await deleteHandoff(handoff.id)) setHandoffDialog(null)
  }

  const card = (sticky) => {
    const p = participantOf(sticky)
    const timing = schedule.stickies[sticky.id]
    const color = p?.color || '#55707e'
    const duration = sticky.duration_days
    const where = sticky.is_placed && p ? weekIndex(timing.start, weeks) : null
    const clamp = where?.clamped ? (where.index === 0 ? 'before' : 'after') : null
    const conflict = (derived.outs[sticky.id] || []).some((h) => schedule.handoffs[h.id]?.conflict)
    const inList = (derived.ins[sticky.id] || []).map(handoffLabel)
    const outList = (derived.outs[sticky.id] || []).map(handoffLabel)
    return <button
      key={sticky.id}
      type="button"
      className={cx(styles.sticky, timing.late && styles.stickyLate, conflict && !timing.late && styles.stickyWarn, dragId === sticky.id && styles.stickyDragging)}
      style={{ background: paperOf(color) }}
      draggable={!readOnly}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', sticky.id); e.dataTransfer.effectAllowed = 'move'; setDragId(sticky.id) }}
      onDragEnd={() => { setDragId(null); setOverCell(null) }}
      onClick={() => setStickyDialog({ sticky })}
      aria-label={t('pull.board.stickyAria', { title: sticky.title, company: p?.company_name || t('pull.sticky.noParticipant') })}
    >
      <span className={styles.stickyTop}>
        <span className={styles.chip} style={{ background: color }}>{sticky.code || '—'}</span>
        {showOrder && timing.pullOrder && <span className={styles.order} title={t('pull.board.pullOrder')}>{timing.pullOrder}</span>}
      </span>
      <strong className={styles.stickyTitle}>{sticky.title}</strong>
      <span className={styles.stickyMeta}>
        {formatRange(timing.start, timing.finish)} · {t('pull.wd', { count: duration })}{sticky.zone_label ? ` · ${sticky.zone_label}` : ''}
      </span>
      {clamp && <span className={styles.stickyAlert}>{t(clamp === 'before' ? 'pull.board.outsideBoard' : 'pull.board.afterBoard')}</span>}
      {timing.late && <span className={styles.stickyAlertBad}>{t('pull.board.lateBy', { count: -timing.float })}</span>}
      {conflict && <span className={styles.stickyAlert}>{t('pull.board.handoffConflict')}</span>}
      {timing.inCycle && <span className={styles.stickyAlertBad}>{t('pull.board.inLoop')}</span>}
      {showIds && <span className={styles.tags}>
        <span>{t('pull.board.in')} {inList.length ? inList.join(' ') : '—'}</span>
        <span>{t('pull.board.out')} {outList.length ? outList.join(' ') : t('pull.board.toMilestoneShort')}</span>
      </span>}
    </button>
  }

  const bufferRange = schedule.bufferStart ? formatRange(schedule.bufferStart, schedule.milestone) : null
  const alerts = derived.late + derived.conflicts + (schedule.cycle.length ? 1 : 0)
  const gridStyle = { gridTemplateColumns: `200px repeat(${weeks.length}, minmax(170px, 1fr)) 120px` }

  return <>
    <PageHeader
      back={{ href: PULL_BASE, label: t('pull.backToPlans') }}
      title={plan.name}
      meta={<>
        <Badge tone={STATUS_TONE[plan.status]}>{t(`pull.status.${plan.status}`)}</Badge>
        <span>{t('pull.board.milestoneMeta', { name: plan.milestone_name, date: formatDate(plan.milestone_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) })}</span>
        {plan.session_date && <span>· {t('pull.board.sessionMeta', { date: formatDate(plan.session_date) })}</span>}
      </>}
      actions={<>
        <Link className={ui.btn} href={`${PULL_BASE}/${planId}/settings`}><Icon name="settings" size={18} />{t('pull.board.settings')}</Link>
        {plan.status === 'draft' && <button type="button" className={ui.btn} onClick={() => updatePlan({ status: 'in_session' })}>{t('pull.board.startSession')}</button>}
        <Link className={ui.btnPrimary} href={`${PULL_BASE}/${planId}/handoffs`}>{t('pull.board.reviewAgree', { done: derived.agreed, total: data.handoffs.length })}</Link>
      </>}
    />

    {readOnly && <div style={{ marginBottom: 16 }}><Notice tone="ok">{plan.status === 'agreed' ? t('pull.board.agreedNotice') : t('pull.board.archivedNotice')}</Notice></div>}
    {schedule.cycle.length > 0 && <div style={{ marginBottom: 16 }}><Notice tone="warn">{t('pull.board.cycleNotice')}</Notice></div>}

    <Stats>
      <Stat label={t('pull.board.statMilestone')} value={formatDate(schedule.milestone, { weekday: 'short', month: 'short', day: 'numeric' })} hint={plan.milestone_name} />
      <Stat label={t('pull.board.statStickies')} value={`${derived.placed.length} / ${data.stickies.length}`} hint={t('pull.board.statStickiesHint')} />
      <Stat label={t('pull.board.statHandoffs')} value={`${derived.agreed} / ${data.handoffs.length}`} hint={t('pull.board.statHandoffsHint')} />
      <Stat label={t('pull.board.statBuffer')} value={t('pull.wd', { count: plan.buffer_days })} hint={bufferRange || t('pull.board.noBuffer')} />
      <Stat label={t('pull.board.statAlerts')} value={alerts} hint={alerts ? t('pull.board.statAlertsHint', { late: derived.late, conflicts: derived.conflicts }) : t('pull.board.noAlerts')} tone={alerts ? 'warn' : undefined} />
    </Stats>

    <Panel
      title={t('pull.board.wallTitle')}
      text={t('pull.board.wallText')}
      body={false}
      actions={<>
        <label className={styles.toggle}><input type="checkbox" checked={showOrder} onChange={(e) => setShowOrder(e.target.checked)} />{t('pull.board.pullOrder')}</label>
        <label className={styles.toggle}><input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} />{t('pull.board.handoffIds')}</label>
        {!readOnly && <button type="button" className={ui.btn} onClick={() => setHandoffDialog({ giverId: '' })} disabled={!data.stickies.length}><Icon name="plus" size={16} />{t('pull.board.addHandoff')}</button>}
        {!readOnly && <button type="button" className={ui.btnPrimary} onClick={() => setStickyDialog({ sticky: null })}><Icon name="plus" size={16} />{t('pull.board.addSticky')}</button>}
      </>}
    >
      {!data.participants.length
        ? <Empty title={t('pull.board.noParticipants')} text={t('pull.board.noParticipantsText')} action={<Link className={ui.btnPrimary} href={`${PULL_BASE}/${planId}/settings`}>{t('pull.board.addParticipants')}</Link>} />
        : <div className={styles.wallScroll}>
          <div className={styles.wall} style={gridStyle}>
            <div className={styles.corner}>{t('pull.board.trades')}</div>
            {weeks.map((monday, i) => {
              const days = workingDaysInWeek(monday, calendar)
              const last = i === weeks.length - 1
              return <div key={monday} className={cx(styles.weekHead, last && styles.weekHeadLast, days < calendar.workingDays.length && styles.weekHeadShort)} style={{ gridColumn: i + 2 }}>
                <strong>{t('pull.board.weekLabel', { n: i - weeks.length + 1, date: formatDate(monday, { month: 'short', day: 'numeric' }) })}</strong>
                <span>{last ? t('pull.board.milestoneWeek') : t('pull.board.workingDaysShort', { count: days })}</span>
              </div>
            })}
            <div className={styles.milestoneCol} style={{ gridColumn: weeks.length + 2, gridRow: `1 / span ${data.participants.length + 1}` }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l10 10-10 10L2 12z" /></svg>
              <strong>{t('pull.milestone')}</strong>
              <span>{plan.milestone_name}</span>
              <b>{formatDate(schedule.milestone, { weekday: 'short', month: 'short', day: 'numeric' })}</b>
              {bufferRange && <span className={styles.bufferTag}>{t('pull.board.bufferRange', { range: bufferRange })}</span>}
              {derived.toMilestone.length > 0 && <span>{t('pull.board.receives')} {derived.toMilestone.map(handoffLabel).join(' · ')}</span>}
            </div>

            {data.participants.map((p, row) => <div key={p.id} className={styles.laneRow} style={{ display: 'contents' }}>
              <div className={styles.lane} style={{ gridRow: row + 2 }}>
                <i style={{ background: p.color }} />
                <span><strong>{p.company_name}</strong>{p.trade && <small>{p.trade}</small>}</span>
              </div>
              {weeks.map((monday, w) => {
                const items = derived.placed
                  .filter((s) => s.participant_id === p.id && weekIndex(schedule.stickies[s.id].start, weeks).index === w)
                  .sort((a, b) => schedule.stickies[a.id].start.localeCompare(schedule.stickies[b.id].start))
                return <div key={monday} className={cx(styles.cell, workingDaysInWeek(monday, calendar) < calendar.workingDays.length && styles.cellShort, w === weeks.length - 1 && styles.cellLast)} style={{ gridRow: row + 2, gridColumn: w + 2 }} {...dropProps(p.id, w)}>
                  {items.map(card)}
                </div>
              })}
            </div>)}
          </div>
        </div>}
    </Panel>

    <section className={styles.parking} {...dropProps(null, null)}>
      <div className={styles.parkingHead}>
        <h2>{t('pull.board.parkingTitle', { count: derived.parking.length })}</h2>
        <span>{readOnly ? t('pull.board.parkingReadOnly') : t('pull.board.parkingText')}</span>
      </div>
      <div className={styles.parkingItems}>
        {derived.parking.map(card)}
        {!derived.parking.length && <span className={ui.fieldHint}>{t('pull.board.parkingEmpty')}</span>}
      </div>
    </section>

    {stickyDialog && <StickyDialog
      sticky={stickyDialog.sticky}
      participants={data.participants}
      weeks={weeks}
      calendar={calendar}
      schedule={schedule}
      handoffs={data.handoffs}
      stickies={data.stickies}
      readOnly={readOnly}
      onClose={() => setStickyDialog(null)}
      onSave={async (values) => { const ok = await saveSticky(stickyDialog.sticky?.id, values); if (ok) setStickyDialog(null); return ok }}
      onDelete={() => removeSticky(stickyDialog.sticky)}
      onAddHandoff={() => { setHandoffDialog({ giverId: stickyDialog.sticky.id }); setStickyDialog(null) }}
      onOpenHandoff={(h) => { setHandoffDialog({ handoff: h }); setStickyDialog(null) }}
    />}
    {handoffDialog && <HandoffDialog
      handoff={handoffDialog.handoff}
      giverId={handoffDialog.giverId}
      stickies={data.stickies}
      participants={data.participants}
      schedule={schedule}
      readOnly={readOnly}
      onClose={() => setHandoffDialog(null)}
      onSave={async (values) => { const ok = await saveHandoff(handoffDialog.handoff?.id, values); if (ok) setHandoffDialog(null); return ok }}
      onDelete={() => removeHandoff(handoffDialog.handoff)}
    />}
    {/* Last, so confirmations open above the sticky and handoff dialogs. */}
    {dialogs.element}
  </>
}
