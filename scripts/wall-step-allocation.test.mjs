// Wall steps to the room where the work is done (Tasks / planning layer).
// Run: node --experimental-strip-types --import ./scripts/ts-resolve.mjs --test scripts/wall-step-allocation.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocateScopeStep, exteriorKeyOf } from '../src/lib/takeoff/scopeAllocation.ts'

// Test 1 in miniature (1 pt = 1 m): Room 1 below, the corridor (Room 7) above, a dividing wall between
// them along y = 5 and an exterior wall along y = 0. Height 2.8 m, no openings.
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const layer = (id, wt) => ({ id, project_id: 'p', kind: 'linear', name: id, system: '', color: '#000', thickness_m: 0.1, height_m: 2.8, elevation_m: 0, deduct_openings: true, framing: {}, is_visible: true, sort_order: 1, recipe_id: null, wall_type_id: wt })
const el = (id, layer_id, points) => ({ id, project_id: 'p', layer_id, source_id: 's', points, height_override_m: null, z_rel_m: 0, ifc_guid: null, root_guid: null, layer_guids: [], openings: [], faces: {} })
const data = (elements, layers = [layer('W', 'sym'), layer('X', 'asym')]) => ({
  layers, elements,
  sources: [{ id: 's', name: 'S', kind: 'pdf_page', scale_pt_per_m: 1, level_id: 'L1' }],
  levels: [],
  zones: [
    { id: 'z1', source_id: 's', location_id: 'room1', points: rect(0, 0.05, 10, 4.95) },
    { id: 'z7', source_id: 's', location_id: 'room7', points: rect(0, 5.05, 10, 7) },
  ],
})
const wallTypes = new Map([
  ['sym', { id: 'sym', boards: [{ side: 'A', product: 'ST', count: 1 }, { side: 'B', product: 'ST', count: 1 }] }],
  ['asym', { id: 'asym', boards: [{ side: 'A', product: 'RU', count: 1 }, { side: 'B', product: 'ST', count: 1 }] }],
])
const base = { unit: 'm²', productionLocationIds: new Set(['room1', 'room7']), flowRank: new Map([['room1', 0], ['room7', 1]]), wallTypes }
const run = (d, step, extra = {}) => allocateScopeStep(d, { ...base, layerIds: ['W', 'X'], step, ...extra }).byLocation
const near = (a, b) => Math.abs((a || 0) - b) < 0.01
// Dividing wall drawn left → right: face A (left of the drawing direction, +n with y down) looks into y < 5? n = (-0, 1) → y + : Room 7.
const dividing = data([el('d', 'W', [[0, 5], [10, 5]])])

test('framing of a dividing wall: 100% to the carrier (first in the flow), never split', () => {
  const r = run(dividing, 'framing')
  assert.ok(near(r.get('room1'), 28))
  assert.equal(r.get('room7'), undefined)
})

test('faces: Side A to the carrier, Side B to the neighbour, no 50/50; insulation with Side B', () => {
  assert.ok(near(run(dividing, 'board_a').get('room1'), 28) && !run(dividing, 'board_a').get('room7'))
  assert.ok(near(run(dividing, 'joints_b').get('room7'), 28) && !run(dividing, 'joints_b').get('room1'))
  assert.ok(near(run(dividing, 'insulation').get('room7'), 28))
})

test('the planner can make the corridor carry the wall', () => {
  const r = run(dividing, 'framing', { carriers: new Map([['d', 'room7']]) })
  assert.ok(near(r.get('room7'), 28) && !r.get('room1'))
  assert.ok(near(run(dividing, 'board_a', { carriers: new Map([['d', 'room7']]) }).get('room7'), 28))
})

test('asymmetric type: each board stays on its drawn face', () => {
  const d = data([el('x', 'X', [[0, 5], [10, 5]])])
  // face A (+n) is the y > 5 side → Room 7 gets the RU board even though Room 1 carries the wall.
  assert.ok(near(run(d, 'board_a').get('room7'), 28))
  assert.ok(near(run(d, 'board_b').get('room1'), 28))
  assert.ok(near(run(d, 'framing').get('room1'), 28))
})

test('exterior wall: inside face to the room, outside face to the level Exterior', () => {
  const d = data([el('e', 'W', [[0, 0], [10, 0]])])
  const ext = exteriorKeyOf({ id: 's', level_id: 'L1' })
  assert.ok(near(run(d, 'framing').get('room1'), 28))
  assert.ok(near(run(d, 'board_a').get('room1'), 28))
  assert.ok(near(run(d, 'board_b').get(ext), 28))
  assert.ok(near(run(d, 'board_b', { exteriorLocationOf: () => 'extL1' }).get('extL1'), 28))
})

test('a face step ignores an old carrier / 50-50 choice: 100% to the room it faces', () => {
  for (const rule of ['position', 'carrier']) {
    const r = run(dividing, 'board_b', { rule })
    assert.ok(near(r.get('room7'), 28) && !r.get('room1'), rule)
  }
  // Lines that are not wall steps keep the position (50/50) split.
  const r = allocateScopeStep(dividing, { ...base, layerIds: ['W'], step: null, rule: 'position' }).byLocation
  assert.ok(near(r.get('room1'), 14) && near(r.get('room7'), 14))
})

test('allowed rules per step', async () => {
  const { allowedRulesFor } = await import('../src/lib/takeoff/scopeAllocation.ts')
  assert.deepEqual(allowedRulesFor('board_a'), ['face', 'manual'])
  assert.deepEqual(allowedRulesFor('framing'), ['carrier', 'manual'])
  assert.deepEqual(allowedRulesFor(null), ['face', 'carrier', 'position', 'manual'])
})

test('a neighbour room without a zone is not "Exterior": its face is reported as not allocated', () => {
  // Room 7 has no zone, but a zone (Room 9) lies 2 m further up: the gap is a room not zoned yet.
  const d = data([el('d', 'W', [[0, 5], [10, 5]])])
  d.zones = [d.zones[0], { id: 'z9', source_id: 's', location_id: 'room9', points: rect(0, 7.5, 10, 9) }]
  const ext = exteriorKeyOf({ id: 's', level_id: 'L1' })
  const r = allocateScopeStep(d, { ...base, layerIds: ['W'], step: 'board_b' })
  assert.equal(r.byLocation.get(ext), undefined)
  assert.ok(near(r.unallocated, 28))
})

test('a neighbour room drawn by hand is not "Exterior": its face counts as covered by the drawing', () => {
  const ext = exteriorKeyOf({ id: 's', level_id: 'L1' })
  const r = allocateScopeStep(dividing, { ...base, layerIds: ['W'], step: 'board_b', productionLocationIds: new Set(['room1']), knownLocationIds: new Set(['room1', 'room7']) })
  assert.equal(r.byLocation.get(ext), undefined)
  assert.equal(r.byLocation.get('room7'), undefined)
  assert.ok(near(r.claimed, 28))
})

test('default predecessors follow the wall sequence, with cross-room links to the carrier', async () => {
  const { defaultPredecessors } = await import('../src/lib/takeoff/stepPredecessors.ts')
  const steps = ['framing', 'board_a', 'joints_a', 'insulation', 'board_b', 'joints_b'].map(s => ({ id: s, takeoff_layer_id: 'L', takeoff_step: s }))
  const of = s => defaultPredecessors(steps.find(x => x.id === s), steps).map(d => `${d.predecessorId}:${d.link}`)
  assert.deepEqual(of('framing'), [])
  assert.deepEqual(of('board_a'), ['framing:carrier_location'])
  assert.deepEqual(of('insulation'), ['framing:carrier_location', 'board_a:carrier_location'])
  assert.deepEqual(of('board_b'), ['insulation:same_location'])
  const noIns = steps.filter(s => s.id !== 'insulation')
  assert.deepEqual(defaultPredecessors(noIns.find(s => s.id === 'board_b'), noIns).map(d => d.predecessorId), ['framing', 'board_a'])
})
