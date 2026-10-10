// PreCon by location from the Tasks layer: quantities per location × work package and the Koskela
// "Predecessor" check (same location and carrier room).
// Run: node --experimental-strip-types --import ./scripts/ts-resolve.mjs --test scripts/location-plan.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLocationPlan, progressIndex, waitsFor, normUnit } from '../src/lib/planning/locationPlan.ts'

// Room 1 (below) carries the dividing wall with Room 7 (above); 10 m × 2.8 m, 1 pt = 1 m.
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const data = {
  layers: [{ id: 'W', project_id: 'p', kind: 'linear', name: 'W', system: '', color: '#000', thickness_m: 0.1, height_m: 2.8, elevation_m: 0, deduct_openings: true, framing: {}, is_visible: true, sort_order: 1, recipe_id: null, wall_type_id: null }],
  elements: [{ id: 'd', project_id: 'p', layer_id: 'W', source_id: 's', points: [[0, 5], [10, 5]], height_override_m: null, z_rel_m: 0, ifc_guid: null, root_guid: null, layer_guids: [], openings: [], faces: {} }],
  sources: [{ id: 's', name: 'S', kind: 'pdf_page', scale_pt_per_m: 1, level_id: 'L1' }],
  levels: [],
  zones: [
    { id: 'z1', source_id: 's', location_id: 'room1', points: rect(0, 0.05, 10, 4.95) },
    { id: 'z7', source_id: 's', location_id: 'room7', points: rect(0, 5.05, 10, 7) },
  ],
}
const locations = [
  { id: 'floor', name: 'Floor 1', location_type: 'floor', parent_id: null, sequence_number: 0 },
  { id: 'room1', name: 'Room 1', location_type: 'room', parent_id: 'floor', sequence_number: 1 },
  { id: 'room7', name: 'Room 7', location_type: 'room', parent_id: 'floor', sequence_number: 7 },
]
const line = (id, step, wp) => ({ id, scope_code: id, scope_name: id, unit: 'm2', takeoff_layer_id: 'W', takeoff_step: step, organization_work_package_id: wp })
const scopes = [line('frm', 'framing', 'FRM'), line('ba', 'board_a', 'BRD'), line('ins', 'insulation', 'INS'), line('bb', 'board_b', 'BRD'), line('jb', 'joints_b', 'JNT')]
const plan = buildLocationPlan({ data, scopes, locations, deps: [], drawings: [] })
const near = (a, b) => Math.abs((a || 0) - b) < 0.01
const qty = (loc, wp) => plan.rows.filter(r => r.locationId === loc && r.wpId === wp).reduce((a, r) => a + r.quantity, 0)

test('rows per location × work package with the face / carrier quantities', () => {
  assert.ok(near(qty('room1', 'FRM'), 28) && near(qty('room7', 'FRM'), 0))
  assert.ok(near(qty('room1', 'BRD'), 28) && near(qty('room7', 'BRD'), 28)) // Side A in Room 1, Side B in Room 7
  assert.ok(near(qty('room7', 'INS'), 28) && near(qty('room7', 'JNT'), 28))
  assert.equal(plan.rows[0].locationId, 'room1') // flow order
  assert.equal(normUnit('M2'), 'm²')
})

test('Room 7 insulation waits for framing + Side A in the carrier room (Room 1)', () => {
  const none = progressIndex(plan, [])
  const w = waitsFor(plan, 'INS', 'room7', none)
  assert.deepEqual(w.map(x => `${x.locationId}:${x.wpId}`).sort(), ['room1:BRD', 'room1:FRM'])
  // Same package steps are not checked (BRD Side B waits for INS in Room 7 only).
  assert.deepEqual(waitsFor(plan, 'BRD', 'room7', none).map(x => `${x.locationId}:${x.wpId}`), ['room7:INS'])
  assert.deepEqual(waitsFor(plan, 'FRM', 'room1', none), [])
})

test('progress from the Weekly plan releases the successors', () => {
  const progress = [
    { location_id: 'room1', organization_work_package_id: 'FRM', unit: 'm²', actual_quantity: 28 },
    { location_id: 'room1', organization_work_package_id: 'BRD', unit: 'm2', actual_quantity: 20 },
  ]
  const doneOf = progressIndex(plan, progress)
  assert.ok(near(doneOf('room1', 'BRD'), 20 / 28))
  assert.deepEqual(waitsFor(plan, 'INS', 'room7', doneOf).map(x => x.wpId), ['BRD'])
  const all = progressIndex(plan, [...progress, { location_id: 'room1', organization_work_package_id: 'BRD', unit: 'm²', actual_quantity: null, planned_quantity: 8, execution_result: 'completed' }])
  assert.deepEqual(waitsFor(plan, 'INS', 'room7', all), [])
})

test('drawn task lines replace the automatic quantity of their location', () => {
  const p = buildLocationPlan({ data, scopes, locations, deps: [], drawings: [{ scope_item_id: 'frm', location_id: 'room7', source_id: 's', points: [[0, 9], [3, 9]], quantity: 8.4 }] })
  assert.ok(near(p.scopeQty.get('frm').get('room7'), 8.4))
  assert.ok(near(p.scopeQty.get('frm').get('room1'), 28))
})

test("the planner's predecessors replace the defaults", () => {
  const p = buildLocationPlan({ data, scopes, locations, deps: [{ scope_item_id: 'ins', predecessor_scope_item_id: 'frm', link: 'same_location', lag_days: 0 }], drawings: [] })
  assert.deepEqual(waitsFor(p, 'INS', 'room7', progressIndex(p, [])), []) // no framing in Room 7 itself
})
