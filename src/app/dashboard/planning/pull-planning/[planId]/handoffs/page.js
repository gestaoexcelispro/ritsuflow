'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useT } from '../../../../../../lib/i18n/useT'
import { usePageDialogs } from '../../../../../fieldop/ui/dialogs'
import { Badge, Empty, Icon, Notice, PageHeader, Panel, Segments, ui } from '../../../../../fieldop/ui'
import HandoffDialog from '../../HandoffDialog'
import usePullPlan, { DUPLICATE_HANDOFF, NO_PERMISSION } from '../../usePullPlan'
import { PULL_BASE, STATUS_TONE, handoffLabel, useFormatDate } from '../../shared'
import styles from '../../pull.module.css'

export default function PullHandoffsPage({ params }) {
  const { planId } = params
  const t = useT('precon')
  const dialogs = usePageDialogs()
  const formatDate = useFormatDate()
  const { notify } = dialogs
  const onError = useCallback((message) => notify(message === DUPLICATE_HANDOFF ? t('pull.handoff.duplicate') : message === NO_PERMISSION ? t('pull.noPermission') : message, 'bad'), [notify, t])
  const { data, schedule, saveHandoff, deleteHandoff, updatePlan, signOff } = usePullPlan(planId, onError)
  const [filter, setFilter] = useState('all')
  const [dialog, setDialog] = useState(null)

  const rows = useMemo(() => {
    if (!data || !schedule) return []
    return data.handoffs
      .filter((h) => schedule.handoffs[h.id])
      .slice()
      .sort((a, b) => schedule.handoffs[a.id].neededBy.localeCompare(schedule.handoffs[b.id].neededBy) || a.number - b.number)
  }, [data, schedule])

  if (data === undefined) return <Empty text={t('pull.loading')} />
  if (data === null) return <>{dialogs.element}<Panel><Empty title={t('pull.notFound')} text={t('pull.notFoundText')} /></Panel></>

  const { plan } = data
  const readOnly = ['agreed', 'archived'].includes(plan.status)
  const stickyOf = (id) => data.stickies.find((s) => s.id === id)
  const personOf = (sticky) => data.participants.find((p) => p.id === sticky?.participant_id)
  const proposed = rows.filter((h) => h.status === 'proposed').length
  const visible = rows.filter((h) => filter === 'all' || h.status === filter)

  const pendingFor = (participantId) => rows.filter((h) => h.status === 'proposed'
    && [personOf(stickyOf(h.giver_sticky_id))?.id, personOf(stickyOf(h.receiver_sticky_id))?.id].includes(participantId)).length
  const signed = data.participants.filter((p) => p.signed_off_at).length
  const canAgree = !readOnly && rows.length > 0 && proposed === 0

  const toggle = (h) => saveHandoff(h.id, { status: h.status === 'agreed' ? 'proposed' : 'agreed', agreed_at: h.status === 'agreed' ? null : new Date().toISOString() })

  const agreePlan = async () => {
    if (!(await dialogs.confirm(t('pull.agree.confirm'), { confirmLabel: t('pull.agree.button') }))) return
    if (await updatePlan({ status: 'agreed', agreed_at: new Date().toISOString() })) notify(t('pull.agree.done'))
  }
  const reopen = async () => {
    if (await updatePlan({ status: 'in_session', agreed_at: null })) notify(t('pull.agree.reopened'))
  }
  const remove = async (h) => {
    if (!(await dialogs.confirm(t('pull.handoff.deleteConfirm', { label: handoffLabel(h) }), { danger: true, confirmLabel: t('pull.delete') }))) return
    if (await deleteHandoff(h.id)) setDialog(null)
  }

  const party = (sticky, fallback) => {
    if (!sticky) return <span>{fallback}</span>
    const p = personOf(sticky)
    return <span className={styles.party}>
      <span className={styles.chip} style={{ background: p?.color || '#55707e' }}>{sticky.code || '—'}</span>
      <span>{sticky.title}{p && <small>{p.company_name}</small>}</span>
    </span>
  }

  return <>
    <PageHeader
      back={{ href: `${PULL_BASE}/${planId}`, label: plan.name }}
      title={t('pull.agree.title')}
      subtitle={t('pull.agree.subtitle')}
      meta={<Badge tone={STATUS_TONE[plan.status]}>{t(`pull.status.${plan.status}`)}</Badge>}
      actions={<Link className={ui.btn} href={`${PULL_BASE}/${planId}`}>{t('pull.agree.backToBoard')}</Link>}
    />

    <div className={ui.split}>
      <Panel title={t('pull.agree.registerTitle', { count: rows.length })} body={false}
        actions={<Segments value={filter} onChange={setFilter} items={[
          { value: 'all', label: t('pull.agree.filterAll', { count: rows.length }) },
          { value: 'proposed', label: t('pull.agree.filterProposed', { count: proposed }) },
          { value: 'agreed', label: t('pull.agree.filterAgreed', { count: rows.length - proposed }) },
        ]} />}>
        {!rows.length && <Empty title={t('pull.agree.empty')} text={t('pull.agree.emptyText')} />}
        {rows.length > 0 && !visible.length && <Empty text={t('pull.emptyFilter')} />}
        {visible.length > 0 && <div className={ui.tableWrap}>
          <table className={`${ui.table} ${ui.cards}`}>
            <thead><tr>
              <th>{t('pull.agree.colId')}</th><th>{t('pull.agree.colNeededBy')}</th><th>{t('pull.agree.colFromTo')}</th>
              <th>{t('pull.agree.colDeliverable')}</th><th>{t('pull.agree.colAccepted')}</th><th>{t('pull.agree.colStatus')}</th>
            </tr></thead>
            <tbody>
              {visible.map((h) => {
                const timing = schedule.handoffs[h.id]
                return <tr key={h.id}>
                  <td data-label={t('pull.agree.colId')}><button type="button" className={styles.linkBtn} onClick={() => setDialog({ handoff: h })}>{handoffLabel(h)}</button></td>
                  <td data-label={t('pull.agree.colNeededBy')} style={{ whiteSpace: 'nowrap' }}>
                    <strong>{formatDate(timing.neededBy, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                    {timing.conflict && <span className={ui.sub} style={{ color: 'var(--fo-warn)' }}>{t('pull.board.handoffConflict')}</span>}
                  </td>
                  <td data-label={t('pull.agree.colFromTo')}>
                    <div className={styles.fromTo}>
                      {party(stickyOf(h.giver_sticky_id))}
                      <span aria-hidden="true" className={styles.arrow}>→</span>
                      {party(stickyOf(h.receiver_sticky_id), t('pull.milestone'))}
                    </div>
                  </td>
                  <td data-label={t('pull.agree.colDeliverable')}>{h.deliverable}{h.lag_days > 0 && <span className={ui.sub}>{t('pull.agree.lag', { count: h.lag_days })}</span>}</td>
                  <td data-label={t('pull.agree.colAccepted')}>{h.acceptance_criteria || '—'}</td>
                  <td data-label={t('pull.agree.colStatus')}>
                    {readOnly
                      ? <Badge tone={h.status === 'agreed' ? 'ok' : 'info'}>{t(`pull.handoffStatus.${h.status}`)}</Badge>
                      : <button type="button" className={h.status === 'agreed' ? styles.statusOn : styles.statusOff} onClick={() => toggle(h)} aria-pressed={h.status === 'agreed'}>
                        {h.status === 'agreed' && <Icon name="check" size={16} />}{t(`pull.handoffStatus.${h.status}`)}
                      </button>}
                  </td>
                </tr>
              })}
            </tbody>
          </table>
        </div>}
      </Panel>

      <div style={{ display: 'grid', gap: 16 }}>
        <Panel title={t('pull.agree.signTitle')} text={t('pull.agree.signText')} body={false}>
          <ul className={styles.signList}>
            {data.participants.map((p) => {
              const pending = pendingFor(p.id)
              return <li key={p.id}>
                <i style={{ background: p.color }} />
                <span><strong>{p.company_name}</strong><small>{p.signed_off_at ? t('pull.agree.signedOn', { date: formatDate(p.signed_off_at) }) : pending ? t('pull.agree.pending', { count: pending }) : t('pull.agree.readyToSign')}</small></span>
                {p.signed_off_at
                  ? <button type="button" className={ui.btnGhost} onClick={() => signOff(p.id, false)} disabled={readOnly}>{t('pull.agree.undoSign')}</button>
                  : <button type="button" className={ui.btn} onClick={() => signOff(p.id, true)} disabled={readOnly || pending > 0} style={{ minHeight: 36 }}>{t('pull.agree.sign')}</button>}
              </li>
            })}
            {!data.participants.length && <li><span className={ui.fieldHint}>{t('pull.board.noParticipantsText')}</span></li>}
          </ul>
          <div className={ui.panelBody} style={{ display: 'grid', gap: 10 }}>
            <div className={styles.kv}><span>{t('pull.agree.signedOff')}</span><strong>{t('pull.ofCount', { done: signed, total: data.participants.length })}</strong></div>
            {plan.status === 'agreed'
              ? <>
                <Notice tone="ok">{t('pull.agree.agreedOn', { date: plan.agreed_at ? formatDate(plan.agreed_at) : '—' })}</Notice>
                <button type="button" className={ui.btn} onClick={reopen}>{t('pull.agree.reopen')}</button>
              </>
              : <>
                <button type="button" className={ui.btnPrimary} onClick={agreePlan} disabled={!canAgree}>{t('pull.agree.button')}</button>
                <p className={ui.fieldHint} style={{ margin: 0 }}>{rows.length ? (proposed ? t('pull.agree.blocked', { count: proposed }) : t('pull.agree.ready')) : t('pull.agree.emptyText')}</p>
              </>}
          </div>
        </Panel>
      </div>
    </div>

    {dialog && <HandoffDialog
      handoff={dialog.handoff}
      stickies={data.stickies}
      participants={data.participants}
      schedule={schedule}
      readOnly={readOnly}
      onClose={() => setDialog(null)}
      onSave={async (values) => { const ok = await saveHandoff(dialog.handoff.id, values); if (ok) setDialog(null); return ok }}
      onDelete={() => remove(dialog.handoff)}
    />}
    {dialogs.element}
  </>
}
