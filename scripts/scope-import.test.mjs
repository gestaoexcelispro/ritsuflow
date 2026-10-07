// Tests for the Projects › Scope ← RitsuScope import planner. Run: npm run test:scope-import (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planImport, wallSteps } from '../src/lib/takeoff/scopeImport.ts'

const labels = {
  framing: 'Metal stud framing – {stud}',
  board_a: 'Gypsum board – Side A ({count}× {product})',
  joints_a: 'Joint treatment – Side A',
  insulation: 'Insulation',
  board_b: 'Gypsum board – Side B ({count}× {product})',
  joints_b: 'Joint treatment – Side B',
}

const board = { product: '5/8" Type X', thickness_m: 0.016 }
const rated = { framing: { studName: '3-5/8" 20 ga' }, boards: [{ side: 'A', count: 2, ...board }, { side: 'B', count: 2, ...board }], materials: { insulation: 'mw' } }
const plain = { framing: { studName: '3-5/8" 25 ga' }, boards: [{ side: 'A', count: 1, ...board }, { side: 'B', count: 1, ...board }], materials: {} }
const shaft = { framing: { studName: 'CH stud' }, boards: [{ side: 'A', count: 2, ...board }], materials: {} }

test('wall steps follow installation order and skip what the type does not have', () => {
  assert.deepEqual(wallSteps(rated, labels).map((s) => s.step), ['framing', 'board_a', 'joints_a', 'insulation', 'board_b', 'joints_b'])
  assert.deepEqual(wallSteps(plain, labels).map((s) => s.step), ['framing', 'board_a', 'joints_a', 'board_b', 'joints_b'])
  assert.deepEqual(wallSteps(shaft, labels).map((s) => s.step), ['framing', 'board_a', 'joints_a'])
  assert.equal(wallSteps(rated, labels)[1].name, 'Gypsum board – Side A (2× 5/8" Type X)')
  assert.equal(wallSteps(plain, labels)[0].name, 'Metal stud framing – 3-5/8" 25 ga')
})

// One sheet at 1 pt = 1 m: a 10 m wall, 2.8 m high, with a 1 m × 2 m door → 28 − 2 = 26 m² per face.
const layer = (id, extra = {}) => ({ id, project_id: 'p', kind: 'linear', name: `Wall ${id}`, system: null, color: '#000', thickness_m: 0.1, height_m: 2.8, elevation_m: 0, deduct_openings: true, framing: {}, is_visible: true, sort_order: 1, recipe_id: null, wall_type_id: null, ...extra })
const element = (id, layerId, extra = {}) => ({ id, project_id: 'p', layer_id: layerId, source_id: 's1', points: [[0, 0], [10, 0]], height_override_m: null, z_rel_m: 0, ifc_guid: null, root_guid: null, layer_guids: [], openings: [{ off: 2, kind: 'door', w: 1, h: 2, sill: 0, guid: null }], faces: {}, ...extra })
const data = {
  layers: [layer('L1', { wall_type_id: 'WT1' }), layer('L2'), layer('L3', { wall_type_id: 'WT1' })],
  elements: [element('e1', 'L1'), element('e2', 'L2', { openings: [] })],
  sources: [{ id: 's1', project_id: 'p', kind: 'pdf_page', name: 'A-101', file_path: 'x', page_number: 1, scale_pt_per_m: 1, calibration: {}, metadata: {}, sort_order: 1, level_id: null }],
  levels: [],
  zones: [],
}
const wallTypes = new Map([['WT1', rated]])

test('a fresh import creates one scope per item and measures each face', () => {
  const plan = planImport(data, wallTypes, [], labels)
  assert.deepEqual(plan.empty, ['Wall L3'])
  assert.equal(plan.scopes.length, 2)
  const [wall, other] = plan.scopes
  assert.equal(wall.items.length, 6)
  for (const i of wall.items) { assert.equal(i.quantity, 26); assert.equal(i.unit, 'm²'); assert.equal(i.action, 'create') }
  assert.deepEqual(other.items.map((i) => [i.step, i.name, i.quantity]), [['measure', 'Wall L2', 28]])
  assert.deepEqual(plan.counts, { create: 9, update: 0, same: 0 })
})

test('re-import updates changed quantities, keeps the rest, and flags steps that disappeared', () => {
  const existing = [
    { id: 'S1', item_type: 'scope', parent_scope_id: null, scope_code: '1', scope_name: 'My PT04', quantity: null, unit: 'm²', takeoff_layer_id: 'L1', takeoff_step: 'scope' },
    { id: 'I1', item_type: 'item', parent_scope_id: 'S1', scope_code: '1.1', scope_name: 'Framing (renamed)', quantity: 26, unit: 'm²', takeoff_layer_id: 'L1', takeoff_step: 'framing' },
    { id: 'I2', item_type: 'item', parent_scope_id: 'S1', scope_code: '1.2', scope_name: 'Board A', quantity: 20, unit: 'm²', takeoff_layer_id: 'L1', takeoff_step: 'board_a' },
    { id: 'I9', item_type: 'item', parent_scope_id: 'S1', scope_code: '1.9', scope_name: 'Old step', quantity: 5, unit: 'm²', takeoff_layer_id: 'L1', takeoff_step: 'stale_step' },
  ]
  const plan = planImport(data, wallTypes, existing, labels)
  const wall = plan.scopes[0]
  assert.equal(wall.action, 'existing')
  assert.equal(wall.name, 'My PT04')
  const byStep = Object.fromEntries(wall.items.map((i) => [i.step, i]))
  assert.equal(byStep.framing.action, 'same')
  assert.equal(byStep.framing.name, 'Framing (renamed)')
  assert.equal(byStep.board_a.action, 'update')
  assert.equal(byStep.board_a.previousQuantity, 20)
  assert.equal(byStep.joints_a.action, 'create')
  assert.deepEqual(plan.stale.map((r) => r.id), ['I9'])
})

test('sheets without a scale are reported, not measured', () => {
  const d = { ...data, sources: [{ ...data.sources[0], scale_pt_per_m: null }] }
  const plan = planImport(d, wallTypes, [], labels)
  assert.equal(plan.scopes.length, 0)
  assert.deepEqual(plan.uncalibratedSheets, ['A-101'])
})
