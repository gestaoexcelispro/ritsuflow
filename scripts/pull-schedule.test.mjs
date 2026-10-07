// Tests for the pull planning engine. Run: npm run test:pull (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addWorkingDays, boardWeeks, mondayOf, schedulePull, weekIndex, workingDaysBetween, workingDaysInWeek,
} from '../src/lib/pull/schedule.ts'

const calendar = { workingDays: [1, 2, 3, 4, 5], holidays: ['2026-11-26', '2026-11-27'] }

test('working-day math skips weekends and holidays', () => {
  assert.equal(addWorkingDays('2026-11-25', 1, calendar), '2026-11-30')
  assert.equal(addWorkingDays('2026-11-30', -1, calendar), '2026-11-25')
  assert.equal(workingDaysBetween('2026-11-23', '2026-11-30', calendar), 3)
  assert.equal(workingDaysBetween('2026-11-30', '2026-11-23', calendar), -3)
  assert.equal(workingDaysInWeek('2026-11-23', calendar), 3)
  assert.equal(mondayOf('2026-12-18'), '2026-12-14')
})

test('board weeks end on the milestone week', () => {
  const weeks = boardWeeks('2026-12-18', 6)
  assert.deepEqual(weeks, ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'])
  assert.deepEqual(weekIndex('2026-11-25', weeks), { index: 2, clamped: false })
  assert.deepEqual(weekIndex('2026-10-01', weeks), { index: 0, clamped: true })
})

const stickies = [
  { id: 'ROF', durationDays: 6, title: 'Roofing' },
  { id: 'WIN', durationDays: 3, title: 'Windows' },
  { id: 'WRB', durationDays: 2, title: 'WRB' },
  { id: 'SHE', durationDays: 3, title: 'Sheathing' },
  { id: 'TRS', durationDays: 4, title: 'Trusses' },
  { id: 'FRM2', durationDays: 7, title: 'Framing L2' },
]
const handoffs = [
  { id: 'H13', giverId: 'ROF', receiverId: null },
  { id: 'H14', giverId: 'WIN', receiverId: null },
  { id: 'H12', giverId: 'WRB', receiverId: 'WIN' },
  { id: 'H10', giverId: 'SHE', receiverId: 'ROF' },
  { id: 'H11', giverId: 'SHE', receiverId: 'WRB' },
  { id: 'H9', giverId: 'TRS', receiverId: 'SHE' },
  { id: 'H6', giverId: 'FRM2', receiverId: 'TRS' },
]

test('backward pass from the milestone with a 3-day buffer', () => {
  const s = schedulePull({ milestoneDate: '2026-12-18', bufferDays: 3, calendar, stickies, handoffs })
  assert.equal(s.bufferStart, '2026-12-16')
  assert.equal(s.workDeadline, '2026-12-15')
  assert.deepEqual([s.stickies.ROF.latestStart, s.stickies.ROF.latestFinish], ['2026-12-08', '2026-12-15'])
  assert.deepEqual([s.stickies.WIN.latestStart, s.stickies.WIN.latestFinish], ['2026-12-11', '2026-12-15'])
  assert.deepEqual([s.stickies.WRB.latestStart, s.stickies.WRB.latestFinish], ['2026-12-09', '2026-12-10'])
  // Sheathing feeds roofing (Dec 8) and WRB (Dec 9): the earlier need wins.
  assert.equal(s.stickies.SHE.latestFinish, '2026-12-07')
  assert.equal(s.stickies.SHE.latestStart, '2026-12-03')
  // Framing L2 crosses the Thanksgiving holidays.
  assert.equal(s.stickies.TRS.latestStart, '2026-11-25')
  assert.equal(s.stickies.FRM2.latestFinish, '2026-11-24')
  assert.equal(s.handoffs.H10.neededBy, '2026-12-07')
  assert.equal(s.cycle.length, 0)
})

test('pull order starts at the milestone', () => {
  const s = schedulePull({ milestoneDate: '2026-12-18', bufferDays: 3, calendar, stickies, handoffs })
  assert.equal(s.stickies.WIN.pullOrder, 1)
  assert.equal(s.stickies.ROF.pullOrder, 2)
  assert.equal(s.stickies.FRM2.pullOrder, 6)
  const unplaced = schedulePull({ milestoneDate: '2026-12-18', calendar, stickies: [{ id: 'A', durationDays: 1, isPlaced: false }], handoffs: [] })
  assert.equal(unplaced.stickies.A.pullOrder, null)
})

test('lag moves the giver earlier', () => {
  const s = schedulePull({
    milestoneDate: '2026-12-18', calendar,
    stickies: [{ id: 'A', durationDays: 1 }, { id: 'B', durationDays: 1 }],
    handoffs: [{ id: 'h', giverId: 'A', receiverId: 'B', lagDays: 2 }],
  })
  assert.equal(s.stickies.B.latestStart, '2026-12-18')
  assert.equal(s.stickies.A.latestFinish, '2026-12-15')
})

test('planned start gives float, or lateness', () => {
  const early = schedulePull({ milestoneDate: '2026-12-18', calendar, stickies: [{ id: 'A', durationDays: 2, plannedStart: '2026-12-14' }], handoffs: [] })
  assert.equal(early.stickies.A.finish, '2026-12-15')
  assert.equal(early.stickies.A.float, 3)
  assert.equal(early.stickies.A.late, false)
  const late = schedulePull({ milestoneDate: '2026-12-18', bufferDays: 2, calendar, stickies: [{ id: 'A', durationDays: 2, plannedStart: '2026-12-17' }], handoffs: [] })
  assert.equal(late.stickies.A.late, true)
  assert.equal(late.stickies.A.float, -2)
})

test('handoff conflict when the giver is placed after the receiver needs it', () => {
  const s = schedulePull({
    milestoneDate: '2026-12-18', calendar,
    stickies: [{ id: 'A', durationDays: 2, plannedStart: '2026-12-10' }, { id: 'B', durationDays: 1, plannedStart: '2026-12-10' }],
    handoffs: [{ id: 'h', giverId: 'A', receiverId: 'B' }],
  })
  assert.equal(s.handoffs.h.conflict, true)
})

test('a handoff loop does not hang and is reported', () => {
  const s = schedulePull({
    milestoneDate: '2026-12-18', calendar,
    stickies: [{ id: 'A', durationDays: 1 }, { id: 'B', durationDays: 1 }],
    handoffs: [{ id: '1', giverId: 'A', receiverId: 'B' }, { id: '2', giverId: 'B', receiverId: 'A' }],
  })
  assert.ok(s.cycle.includes('A') && s.cycle.includes('B'))
  assert.ok(s.stickies.A.latestStart && s.stickies.B.latestStart)
})

test('a milestone on a weekend snaps back to Friday', () => {
  const s = schedulePull({ milestoneDate: '2026-12-19', calendar, stickies: [{ id: 'A', durationDays: 1 }], handoffs: [] })
  assert.equal(s.milestone, '2026-12-18')
  assert.equal(s.stickies.A.latestFinish, '2026-12-18')
})
