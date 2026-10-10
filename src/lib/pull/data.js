// Supabase access for Pull planning (tables pull_plans, pull_participants, pull_stickies,
// pull_handoffs — supabase/migrations/20261007_006_pull_planning.sql). Every function throws
// the Supabase error so pages can show it.
import { supabase } from '../supabase'

const PLAN_FIELDS = 'id, project_id, name, milestone_name, milestone_date, phase_label, session_date, facilitator, status, board_weeks, buffer_days, working_days, holidays, notes, agreed_at, created_at, updated_at'
const PARTICIPANT_FIELDS = 'id, pull_plan_id, project_id, company_name, trade, contact, color, sort_order, signed_off_at'
const STICKY_FIELDS = 'id, pull_plan_id, project_id, participant_id, code, title, zone_label, duration_days, crew_size, notes, is_placed, planned_start, created_at'
const HANDOFF_FIELDS = 'id, pull_plan_id, project_id, number, giver_sticky_id, receiver_sticky_id, deliverable, acceptance_criteria, lag_days, status, agreed_at'

function check({ data, error }) {
  if (error) throw error
  return data
}

/** Contract projects the user can see, for the PreCon project picker. */
export async function loadProjects() {
  return check(await supabase.from('projects').select('id, code, name').eq('stage', 'contract').order('code', { ascending: true })) || []
}

/** Plans of a project with the counts the list shows. */
export async function listPlans(projectId) {
  const plans = check(await supabase.from('pull_plans').select(PLAN_FIELDS).eq('project_id', projectId).order('milestone_date', { ascending: true })) || []
  if (!plans.length) return []
  const ids = plans.map((p) => p.id)
  const [participants, handoffs, stickies] = await Promise.all([
    supabase.from('pull_participants').select('id, pull_plan_id, color, sort_order').in('pull_plan_id', ids).order('sort_order'),
    supabase.from('pull_handoffs').select('id, pull_plan_id, status').in('pull_plan_id', ids),
    supabase.from('pull_stickies').select('id, pull_plan_id').in('pull_plan_id', ids),
  ])
  const people = check(participants) || []
  const links = check(handoffs) || []
  const notes = check(stickies) || []
  return plans.map((plan) => ({
    ...plan,
    participants: people.filter((p) => p.pull_plan_id === plan.id),
    handoffCount: links.filter((h) => h.pull_plan_id === plan.id).length,
    agreedCount: links.filter((h) => h.pull_plan_id === plan.id && h.status === 'agreed').length,
    stickyCount: notes.filter((s) => s.pull_plan_id === plan.id).length,
  }))
}

/** One plan with everything the board needs. */
export async function loadPlan(planId) {
  const plan = check(await supabase.from('pull_plans').select(PLAN_FIELDS).eq('id', planId).maybeSingle())
  if (!plan) return null
  const [participants, stickies, handoffs] = await Promise.all([
    supabase.from('pull_participants').select(PARTICIPANT_FIELDS).eq('pull_plan_id', planId).order('sort_order').order('created_at'),
    supabase.from('pull_stickies').select(STICKY_FIELDS).eq('pull_plan_id', planId).order('created_at'),
    supabase.from('pull_handoffs').select(HANDOFF_FIELDS).eq('pull_plan_id', planId).order('number'),
  ])
  return { plan, participants: check(participants) || [], stickies: check(stickies) || [], handoffs: check(handoffs) || [] }
}

export async function createPlan(values) {
  return check(await supabase.from('pull_plans').insert(values).select(PLAN_FIELDS).single())
}

export async function updatePlan(planId, values) {
  return check(await supabase.from('pull_plans').update(values).eq('id', planId).select(PLAN_FIELDS).single())
}

export async function deletePlan(planId) {
  check(await supabase.from('pull_plans').delete().eq('id', planId))
}

/**
 * Saves the participant list of a plan: updates the rows that have an id, inserts the new ones and
 * deletes the ones no longer listed (their stickies go back to "Not placed yet").
 */
export async function saveParticipants(plan, rows, existingIds) {
  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id))
  const removed = existingIds.filter((id) => !keep.has(id))
  if (removed.length) {
    check(await supabase.from('pull_stickies').update({ participant_id: null, is_placed: false, planned_start: null }).in('participant_id', removed))
    check(await supabase.from('pull_participants').delete().in('id', removed))
  }
  for (const [index, row] of rows.entries()) {
    const values = {
      company_name: row.company_name.trim(), trade: row.trade?.trim() || null, contact: row.contact?.trim() || null,
      color: row.color, sort_order: index,
    }
    if (row.id) check(await supabase.from('pull_participants').update(values).eq('id', row.id))
    else check(await supabase.from('pull_participants').insert({ ...values, pull_plan_id: plan.id, project_id: plan.project_id }))
  }
}

export async function setParticipantSignOff(participantId, signed) {
  return check(await supabase.from('pull_participants').update({ signed_off_at: signed ? new Date().toISOString() : null }).eq('id', participantId).select(PARTICIPANT_FIELDS).single())
}

export async function createSticky(plan, values) {
  return check(await supabase.from('pull_stickies').insert({ ...values, pull_plan_id: plan.id, project_id: plan.project_id }).select(STICKY_FIELDS).single())
}

export async function updateSticky(stickyId, values) {
  return check(await supabase.from('pull_stickies').update(values).eq('id', stickyId).select(STICKY_FIELDS).single())
}

export async function deleteSticky(stickyId) {
  check(await supabase.from('pull_stickies').delete().eq('id', stickyId))
}

/** Next H-number comes from the database; retried if someone else took it meanwhile. */
export async function createHandoff(plan, values) {
  for (let attempt = 0; ; attempt++) {
    const last = check(await supabase.from('pull_handoffs').select('number').eq('pull_plan_id', plan.id).order('number', { ascending: false }).limit(1))
    const number = (last?.[0]?.number || 0) + 1
    const result = await supabase.from('pull_handoffs').insert({ ...values, number, pull_plan_id: plan.id, project_id: plan.project_id }).select(HANDOFF_FIELDS).single()
    const taken = result.error && String(result.error.message || '').includes('pull_handoffs_pull_plan_id_number_key')
    if (!taken || attempt >= 2) return check(result)
  }
}

export async function updateHandoff(handoffId, values) {
  return check(await supabase.from('pull_handoffs').update(values).eq('id', handoffId).select(HANDOFF_FIELDS).single())
}

export async function deleteHandoff(handoffId) {
  check(await supabase.from('pull_handoffs').delete().eq('id', handoffId))
}

/** Calendar of a plan in the engine's shape. */
export function planCalendar(plan) {
  return {
    workingDays: Array.isArray(plan?.working_days) ? plan.working_days : [1, 2, 3, 4, 5],
    holidays: (Array.isArray(plan?.holidays) ? plan.holidays : []).map((h) => h?.date).filter(Boolean),
  }
}

/** Colors offered for participants (contrast-checked with white chip text). */
export const PARTICIPANT_COLORS = ['#1f5fa8', '#087a6f', '#94600a', '#5b3aa6', '#a3134f', '#33505e', '#2f6b1f', '#b4471b']

/** Sticky paper tint for a participant color. */
export function paperOf(color) {
  const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#087a6f'
  const mix = (i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.16 + 255 * 0.84)
  return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`
}
