'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../../../lib/pull/data'
import { boardWeeks, normalizeCalendar, schedulePull } from '../../../../lib/pull/schedule'
import { rememberPreconProjectId } from '../../preconProject'
import { errorText } from './shared'

/** Error code passed to onError when a giver → receiver handoff already exists. */
export const DUPLICATE_HANDOFF = 'pull:duplicate-handoff'
/** Error code passed to onError when the user may read but not edit the plan. */
export const NO_PERMISSION = 'pull:no-permission'

/**
 * Loads one pull plan, runs the backward pass and exposes save helpers that keep the local copy
 * in step with the database. Helpers resolve to true on success and report errors via `onError`.
 */
export default function usePullPlan(planId, onError) {
  const [data, setData] = useState(undefined)

  const reload = useCallback(async () => {
    try {
      const result = await api.loadPlan(planId)
      setData(result)
      if (result) rememberPreconProjectId(result.plan.project_id)
    } catch (e) {
      onError(errorText(e))
      setData((current) => current ?? null)
    }
  }, [planId, onError])

  useEffect(() => { reload() }, [reload])

  const calendar = useMemo(() => normalizeCalendar(data ? api.planCalendar(data.plan) : null), [data])
  const weeks = useMemo(() => (data ? boardWeeks(data.plan.milestone_date, data.plan.board_weeks) : []), [data])
  const schedule = useMemo(() => {
    if (!data) return null
    const placedIds = new Set(data.participants.map((p) => p.id))
    return schedulePull({
      milestoneDate: data.plan.milestone_date,
      bufferDays: data.plan.buffer_days,
      calendar,
      stickies: data.stickies.map((s) => ({
        id: s.id, title: s.title, durationDays: s.duration_days,
        plannedStart: s.is_placed ? s.planned_start : null,
        isPlaced: s.is_placed && placedIds.has(s.participant_id),
      })),
      handoffs: data.handoffs.map((h) => ({ id: h.id, giverId: h.giver_sticky_id, receiverId: h.receiver_sticky_id, lagDays: h.lag_days })),
    })
  }, [data, calendar])

  const run = useCallback(async (work) => {
    try { await work(); return true } catch (e) {
      // The same giver → receiver pair can only be agreed once.
      // PGRST116: the update matched no row, which RLS causes for users who cannot edit the project.
      onError(String(e?.message || '').includes('pull_handoffs_pair_idx') ? DUPLICATE_HANDOFF : e?.code === 'PGRST116' ? NO_PERMISSION : errorText(e))
      reload()
      return false
    }
  }, [onError, reload])

  const replace = (key, row) => setData((d) => ({ ...d, [key]: d[key].some((x) => x.id === row.id) ? d[key].map((x) => (x.id === row.id ? row : x)) : [...d[key], row] }))
  const drop = (key, id) => setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }))

  const actions = useMemo(() => ({
    saveSticky: (id, values) => run(async () => {
      if (id) {
        // Optimistic: the wall moves at once, the saved row replaces it.
        setData((d) => ({ ...d, stickies: d.stickies.map((s) => (s.id === id ? { ...s, ...values } : s)) }))
        replace('stickies', await api.updateSticky(id, values))
      } else {
        replace('stickies', await api.createSticky(data.plan, values))
      }
    }),
    deleteSticky: (id) => run(async () => {
      await api.deleteSticky(id)
      drop('stickies', id)
      setData((d) => ({ ...d, handoffs: d.handoffs.filter((h) => h.giver_sticky_id !== id && h.receiver_sticky_id !== id) }))
    }),
    saveHandoff: (id, values) => run(async () => {
      replace('handoffs', id ? await api.updateHandoff(id, values) : await api.createHandoff(data.plan, values))
    }),
    deleteHandoff: (id) => run(async () => { await api.deleteHandoff(id); drop('handoffs', id) }),
    updatePlan: (values) => run(async () => {
      const plan = await api.updatePlan(planId, values)
      setData((d) => ({ ...d, plan }))
    }),
    signOff: (participantId, signed) => run(async () => replace('participants', await api.setParticipantSignOff(participantId, signed))),
  }), [run, data, planId])

  return { data, calendar, weeks, schedule, reload, ...actions }
}
