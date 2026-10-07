// Pull planning engine: working-day calendar and the backward pass from a milestone.
// Pure functions, no I/O. Dates are ISO strings (YYYY-MM-DD) and all math runs in UTC.
//
// Model
//   * The milestone date ends the phase. The phase buffer is the last `bufferDays` working days
//     up to and including the milestone; work has to finish before the buffer starts.
//   * A sticky with no handoffs feeds the milestone directly (it must finish by the work deadline).
//   * A handoff from giver G to receiver R means G must finish the working day before R's latest
//     start, minus the handoff lag. A handoff with no receiver delivers to the milestone.
//   * Latest finish = the earliest of those deadlines; latest start = latest finish − (duration − 1).
//   * A sticky may be placed earlier than its latest start (planned start); the difference is its
//     float. Placed later than its latest start, it is late and eats the buffer.

export type IsoDate = string

export type Calendar = {
  /** ISO weekdays that are working days: 1 = Monday … 7 = Sunday. */
  workingDays: number[]
  /** Non-working dates (YYYY-MM-DD). */
  holidays: IsoDate[]
}

export type PullStickyInput = {
  id: string
  durationDays: number
  plannedStart?: IsoDate | null
  isPlaced?: boolean
  title?: string
}

export type PullHandoffInput = {
  id: string
  giverId: string
  /** null = delivers to the milestone. */
  receiverId: string | null
  lagDays?: number
}

export type StickySchedule = {
  latestStart: IsoDate
  latestFinish: IsoDate
  /** Where the sticky sits: its planned start, or its latest start when none is set. */
  start: IsoDate
  finish: IsoDate
  /** Working days between finish and latest finish (negative = late). */
  float: number
  late: boolean
  /** 1 = closest to the milestone. Only placed stickies get a number. */
  pullOrder: number | null
  /** Part of a handoff loop: the backward pass ignored its outgoing handoffs. */
  inCycle: boolean
}

export type HandoffSchedule = {
  /** The giver must deliver by the end of this day (from the latest dates). */
  neededBy: IsoDate
  /** With the placed dates, the giver finishes after the receiver needs it. */
  conflict: boolean
}

export type PullSchedule = {
  milestone: IsoDate
  bufferStart: IsoDate | null
  workDeadline: IsoDate
  stickies: Record<string, StickySchedule>
  handoffs: Record<string, HandoffSchedule>
  cycle: string[]
}

const DAY = 86_400_000

export function parseIso(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(parseIso(iso) + days * DAY)
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: IsoDate): number {
  const day = new Date(parseIso(iso)).getUTCDay()
  return day === 0 ? 7 : day
}

export function mondayOf(iso: IsoDate): IsoDate {
  return addDays(iso, 1 - isoWeekday(iso))
}

export function normalizeCalendar(calendar?: Partial<Calendar> | null): Calendar {
  const days = (calendar?.workingDays || []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  return {
    workingDays: days.length ? [...new Set(days)].sort() : [1, 2, 3, 4, 5],
    holidays: [...new Set((calendar?.holidays || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))],
  }
}

export function isWorkingDay(iso: IsoDate, calendar: Calendar): boolean {
  return calendar.workingDays.includes(isoWeekday(iso)) && !calendar.holidays.includes(iso)
}

// Guard against calendars with no working day reachable (e.g. every day a holiday).
const MAX_SCAN = 3700

/** The date itself when it is a working day, else the nearest working day in `direction`. */
export function snapToWorkingDay(iso: IsoDate, calendar: Calendar, direction: 1 | -1): IsoDate {
  let current = iso
  for (let i = 0; i < MAX_SCAN; i++) {
    if (isWorkingDay(current, calendar)) return current
    current = addDays(current, direction)
  }
  return iso
}

/** Move `count` working days from a date (negative = backward). The start date is not counted. */
export function addWorkingDays(iso: IsoDate, count: number, calendar: Calendar): IsoDate {
  if (count === 0) return iso
  const step = count > 0 ? 1 : -1
  let left = Math.abs(count)
  let current = iso
  for (let i = 0; left > 0 && i < MAX_SCAN * 4; i++) {
    current = addDays(current, step)
    if (isWorkingDay(current, calendar)) left--
  }
  return current
}

/** Working days from `from` to `to`: positive when `to` is later. Neither end is double counted. */
export function workingDaysBetween(from: IsoDate, to: IsoDate, calendar: Calendar): number {
  if (from === to) return 0
  const forward = parseIso(to) > parseIso(from)
  const [a, b] = forward ? [from, to] : [to, from]
  let count = 0
  for (let current = addDays(a, 1); parseIso(current) <= parseIso(b); current = addDays(current, 1)) {
    if (isWorkingDay(current, calendar)) count++
  }
  return forward ? count : -count
}

/** Working days in the Monday–Sunday week starting on `monday`. */
export function workingDaysInWeek(monday: IsoDate, calendar: Calendar): number {
  let count = 0
  for (let i = 0; i < 7; i++) if (isWorkingDay(addDays(monday, i), calendar)) count++
  return count
}

/** Monday of each board week, oldest first, ending with the milestone's week. */
export function boardWeeks(milestone: IsoDate, weeks: number): IsoDate[] {
  const last = mondayOf(milestone)
  const count = Math.max(1, Math.round(weeks))
  return Array.from({ length: count }, (_, i) => addDays(last, (i - count + 1) * 7))
}

/** Index of the board week a date falls in, clamped to the board. */
export function weekIndex(iso: IsoDate, weeks: IsoDate[]): { index: number; clamped: boolean } {
  const monday = mondayOf(iso)
  const index = weeks.indexOf(monday)
  if (index >= 0) return { index, clamped: false }
  return { index: parseIso(monday) < parseIso(weeks[0]) ? 0 : weeks.length - 1, clamped: true }
}

export function schedulePull(input: {
  milestoneDate: IsoDate
  bufferDays?: number
  calendar?: Partial<Calendar> | null
  stickies: PullStickyInput[]
  handoffs: PullHandoffInput[]
}): PullSchedule {
  const calendar = normalizeCalendar(input.calendar)
  const milestone = snapToWorkingDay(input.milestoneDate, calendar, -1)
  const bufferDays = Math.max(0, Math.round(input.bufferDays || 0))
  const bufferStart = bufferDays > 0 ? addWorkingDays(milestone, -(bufferDays - 1), calendar) : null
  const workDeadline = bufferStart ? addWorkingDays(bufferStart, -1, calendar) : milestone

  const byId = new Map(input.stickies.map((s) => [s.id, s]))
  const outgoing = new Map<string, PullHandoffInput[]>()
  for (const h of input.handoffs) {
    if (!byId.has(h.giverId)) continue
    if (h.receiverId && !byId.has(h.receiverId)) continue
    const list = outgoing.get(h.giverId) || []
    list.push(h)
    outgoing.set(h.giverId, list)
  }

  const latestStart = new Map<string, IsoDate>()
  const latestFinish = new Map<string, IsoDate>()
  const state = new Map<string, 'visiting' | 'done'>()
  const cycle = new Set<string>()

  // Deadline a handoff puts on its giver, given the receiver's latest start (or the milestone).
  const deadlineFor = (h: PullHandoffInput, receiverStart: IsoDate | null): IsoDate => {
    const base = receiverStart ? addWorkingDays(receiverStart, -1, calendar) : workDeadline
    return addWorkingDays(base, -Math.max(0, h.lagDays || 0), calendar)
  }

  const visit = (id: string): void => {
    if (state.get(id) === 'done') return
    state.set(id, 'visiting')
    let finish: IsoDate | null = null
    for (const h of outgoing.get(id) || []) {
      let receiverStart: IsoDate | null = null
      if (h.receiverId) {
        if (state.get(h.receiverId) === 'visiting') { cycle.add(id); cycle.add(h.receiverId); continue }
        visit(h.receiverId)
        receiverStart = latestStart.get(h.receiverId) || null
        if (!receiverStart) continue
      }
      const deadline = deadlineFor(h, receiverStart)
      if (!finish || parseIso(deadline) < parseIso(finish)) finish = deadline
    }
    const lf = finish || workDeadline
    const duration = Math.max(1, Math.round(byId.get(id)?.durationDays || 1))
    latestFinish.set(id, lf)
    latestStart.set(id, addWorkingDays(lf, -(duration - 1), calendar))
    state.set(id, 'done')
  }
  for (const s of input.stickies) visit(s.id)

  const stickies: Record<string, StickySchedule> = {}
  for (const s of input.stickies) {
    const ls = latestStart.get(s.id) as IsoDate
    const lf = latestFinish.get(s.id) as IsoDate
    const duration = Math.max(1, Math.round(s.durationDays || 1))
    const start = s.plannedStart ? snapToWorkingDay(s.plannedStart, calendar, 1) : ls
    const finish = s.plannedStart ? addWorkingDays(start, duration - 1, calendar) : lf
    const float = workingDaysBetween(finish, lf, calendar)
    stickies[s.id] = { latestStart: ls, latestFinish: lf, start, finish, float, late: float < 0, pullOrder: null, inCycle: cycle.has(s.id) }
  }

  // Pull order: the sticky finishing closest to the milestone is pulled first.
  const placed = input.stickies.filter((s) => s.isPlaced !== false)
  placed
    .slice()
    .sort((a, b) => {
      const A = stickies[a.id], B = stickies[b.id]
      return (parseIso(B.latestFinish) - parseIso(A.latestFinish))
        || (parseIso(B.latestStart) - parseIso(A.latestStart))
        || String(a.title || '').localeCompare(String(b.title || ''))
        || a.id.localeCompare(b.id)
    })
    .forEach((s, i) => { stickies[s.id].pullOrder = i + 1 })

  const handoffs: Record<string, HandoffSchedule> = {}
  for (const h of input.handoffs) {
    const giver = stickies[h.giverId]
    if (!giver) continue
    const receiver = h.receiverId ? stickies[h.receiverId] : null
    if (h.receiverId && !receiver) continue
    const neededBy = deadlineFor(h, receiver ? receiver.latestStart : null)
    const plannedNeed = deadlineFor(h, receiver ? receiver.start : null)
    handoffs[h.id] = { neededBy, conflict: parseIso(giver.finish) > parseIso(plannedNeed) }
  }

  return { milestone, bufferStart, workDeadline, stickies, handoffs, cycle: [...cycle] }
}
