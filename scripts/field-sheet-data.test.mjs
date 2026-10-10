// Tests for the field sheet content (task table, framing elevations, wall cards, order of work). Run: npm run test:field-sheet-data (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { elevationsOf, sequenceOf, studGaps, taskInfos, wallCards } from '../src/lib/takeoff/fieldSheetData.ts'
import { defaultFixings, defaultFraming } from '../src/lib/takeoff/framing/framing.ts'

// 10 pt = 1 m. A 10 m DW03 wall along y = 100, 0.1 m thick, 2.8 m high, a 0.8 × 2.1 m door centred at 7 m.
const K = 10
const framing = { ...defaultFraming({ thickness: 0.1 }), on: true, spacing: 0.4, bars: [3], boardH: 2.8, fixings: defaultFixings() }
const wall = { key: 'L', kind: 'linear', name: 'DW03', system: '', color: '#123456', thickness: 0.1, height: 2.8, framing,
  shapes: [{ id: 'w', page: 1, pts: [[0, 100], [100, 100]], openings: [{ off: 7, w: 0.8, h: 2.1, sill: 0, kind: 'door', guid: null }] }] }
const scopes = [
  { id: 's1', code: '1.1', name: 'Framing', color: '#E11D48', step: 'framing', unit: 'm²', itemKey: 'L' },
  { id: 's2', code: '1.2', name: 'Board A', color: '#2563EB', step: 'board_a', unit: 'm²', itemKey: 'L' },
  { id: 's4', code: '1.4', name: 'Board B', color: '#7C3AED', step: 'board_b', unit: 'm²', itemKey: 'L' },
  { id: 's5', code: '1.5', name: 'Joints B', color: '#059669', step: 'joints_b', unit: 'm²', itemKey: 'L' },
]
const lines = [
  { id: 'a', tag: 'T1.1-01', scope_item_id: 's1', points: [[0, 99.5], [100, 99.5]], side: -1, height_m: 2.8, quantity: 26.32 },
  { id: 'b', tag: 'T1.2-01', scope_item_id: 's2', points: [[0, 99.5], [50, 99.5]], side: -1, height_m: 2.8, quantity: 14 },
]

test('the task table gives wall, face, length × height and the openings deducted', () => {
  const rows = taskInfos(lines, scopes, [wall], K)
  assert.deepEqual(rows.map(r => r.tag), ['T1.1-01', 'T1.2-01'])
  const a = rows[0]
  assert.equal(a.wall, 'DW03')
  assert.ok(a.face === 'A' || a.face === 'B')
  assert.ok(Math.abs(a.lengthM - 10) < 1e-9 && a.heightM === 2.8)
  assert.ok(Math.abs(a.openingsM2 - 0.8 * 2.1) < 1e-6, `door deducted, got ${a.openingsM2}`)
  assert.equal(rows[1].openingsM2, 0, 'the door is not in the first 5 m')
})

test('framing and board lines on the same stretch share one elevation, with the studs at 40 cm', () => {
  const el = elevationsOf(lines, scopes, [wall], K)
  assert.equal(el.length, 1)
  const e = el[0]
  assert.deepEqual(e.tags, ['T1.1-01', 'T1.2-01'])
  assert.equal(e.color, '#E11D48', 'the framing colour')
  assert.ok(Math.abs(e.lengthM - 10) < 1e-6 && Math.abs(e.heightM - 2.8) < 1e-9)
  assert.equal(e.openings.length, 1)
  assert.ok(Math.abs(e.openings[0].x0 - 6.6) < 1e-6 && Math.abs(e.openings[0].x1 - 7.4) < 1e-6)
  assert.ok(e.studs.length > 20 && e.studs.every(s => s.x >= 0 && s.x <= 10 + 1e-6))
  assert.ok(e.headers.length >= 1, 'a header over the door')
  const gaps = studGaps(e.studs, e.lengthM)
  assert.ok(gaps.includes(0.4))
  assert.ok(Math.abs(gaps.reduce((a, b) => a + b, 0) - 10) < 0.02)
})

test('the wall card carries profiles, boards, screws, anchors and band', () => {
  const [c] = wallCards(lines, scopes, [wall], K, () => ({ boards: [{ side: 'A', count: 1, product: 'ST 12,5 mm', thickness_m: 0.0125 }, { side: 'B', count: 1, product: 'RU 12,5 mm', thickness_m: 0.0125 }], framing: { insulation: 'lã de vidro 50 mm', maxHeightM: 2.7 } }))
  assert.equal(c.name, 'DW03')
  assert.equal(c.spacingM, 0.4)
  assert.equal(c.faceB.name, 'RU 12,5 mm')
  assert.equal(c.faceA.thkMm, 12.5)
  assert.equal(c.insulation, 'lã de vidro 50 mm')
  // Fixed rule: anchors and band wherever the framing meets another system.
  assert.deepEqual(c.anchors.at, ['floor', 'ceiling', 'walls'])
  assert.deepEqual(c.band.at, ['floor', 'ceiling', 'walls'])
})

test('order of work: build-up order with the services hold point before the second face', () => {
  const seq = sequenceOf(scopes)
  assert.deepEqual(seq.map(r => (r.kind === 'hold' ? 'HOLD' : r.code)), ['1.1', '1.2', 'HOLD', '1.4', '1.5'])
  const withIns = sequenceOf([...scopes, { id: 's3', code: '1.3', name: 'Insulation', color: '#000', step: 'insulation', unit: 'm²', itemKey: 'L' }])
  assert.deepEqual(withIns.map(r => (r.kind === 'hold' ? 'HOLD' : r.code)), ['1.1', '1.2', 'HOLD', '1.3', '1.4', '1.5'])
  assert.ok(!sequenceOf([scopes[1]]).some(r => r.kind === 'hold'), 'no framing, no hold point')
})
