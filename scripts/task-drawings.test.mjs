// Tests for the task view (lines drawn per scope item and location). Run: npm run test:task-drawings (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clipSegment, frameOf, measureTaskLines, takeWallAt, drawnTotals } from '../src/lib/takeoff/taskDrawings.ts'
import { allocateFromTakeoff } from '../src/lib/takeoff/scopeAllocation.ts'

// Sheet at 10 pt = 1 m. Room 1 = x 0…100, Room 2 = x 100…200 (both y 0…100); Corridor = y 100…150.
// One 20 m wall along y = 100 (rooms above, corridor below), 2.8 m high, with a 1 × 2.1 m door 5 m from its start.
const K = 10
const room1 = [[0, 0], [100, 0], [100, 100], [0, 100]]
const room2 = [[100, 0], [200, 0], [200, 100], [100, 100]]
const corridor = [[0, 100], [200, 100], [200, 150], [0, 150]]
const door = { off: 5, w: 1, h: 2.1, sill: 0, kind: 'door', guid: null }
const wall = { pts: [[0, 100], [200, 100]], openings: [door], kind: 'linear' }

test('the frame is the room grown by 1 m on every side', () => {
  assert.deepEqual(frameOf(room1, K, 1), [-10, -10, 110, 110])
  assert.deepEqual(frameOf(room1, K, 0), [0, 0, 100, 100])
})

test('clipping keeps only the part inside the box', () => {
  assert.deepEqual(clipSegment([0, 100], [200, 100], [0, 0, 100, 100]), [[0, 100], [100, 100]])
  assert.equal(clipSegment([0, 200], [50, 200], [0, 0, 100, 100]), null)
})

test('taking a wall gives the stretch along the room, even when the wall sits just outside its outline', () => {
  const near = (a, b) => a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-9 && Math.abs(p[1] - b[i][1]) < 1e-9)
  // Room outline drawn to the wall face (y ≤ 99): the wall centreline at y = 100 is 0.1 m outside it.
  const room1face = [0, 0, 100, 99]
  assert.ok(near(takeWallAt([50, 102], [wall], room1face, K), [[0, 100], [100.8, 100]]))
  assert.equal(takeWallAt([50, 140], [wall], room1face, K), null, 'too far from any wall')
  assert.equal(takeWallAt([50, 102], [{ pts: [[0, 110], [200, 110]] }], room1face, K), null, 'a wall 1.1 m outside the room is not the room\'s')
})

test('a line along the wall is length × height less the door it crosses', () => {
  const m = measureTaskLines([[[0, 100], [100, 100]]], { ptPerM: K, heightM: 2.8, unit: 'm²', walls: [wall] })
  assert.equal(m.length, 10)
  assert.ok(Math.abs(m.gross - 28) < 1e-9)
  assert.ok(Math.abs(m.openings - 2.1) < 1e-9)
  assert.ok(Math.abs(m.quantity - 25.9) < 1e-9)
  const other = measureTaskLines([[[100, 100], [200, 100]]], { ptPerM: K, heightM: 2.8, unit: 'm²', walls: [wall] })
  assert.ok(Math.abs(other.quantity - 28) < 1e-9, 'the door is not on this stretch')
  assert.equal(measureTaskLines([[[0, 100], [100, 100]]], { ptPerM: K, heightM: 2.8, unit: 'm', walls: [wall] }).quantity, 10)
  assert.equal(measureTaskLines([[[0, 0], [1, 1]], [[2, 2], [3, 3]]], { ptPerM: K, heightM: null, unit: 'unit' }).quantity, 2)
})

test('drawn totals add up per item and location', () => {
  const t = drawnTotals([{ scope_item_id: 'a', location_id: 'r1', quantity: 2 }, { scope_item_id: 'a', location_id: 'r1', quantity: 3 }, { scope_item_id: 'a', location_id: 'r2', quantity: 1 }])
  assert.equal(t.get('a:r1'), 5)
  assert.equal(t.get('a:r2'), 1)
})

test('the automatic split skips the stretch already drawn for a location', () => {
  const layer = { id: 'L', project_id: 'p', kind: 'linear', name: 'W', system: null, color: '#000', thickness_m: 0.1, height_m: 2.8, elevation_m: 0, deduct_openings: true, framing: {}, is_visible: true, sort_order: 1, recipe_id: null, wall_type_id: null }
  const element = { id: 'e', project_id: 'p', layer_id: 'L', source_id: 'S', points: wall.pts, height_override_m: null, z_rel_m: 0, ifc_guid: null, root_guid: null, layer_guids: [], openings: [door], faces: {} }
  const zone = (id, pts) => ({ id, project_id: 'p', source_id: 'S', name: id, color: '#000', points: pts, ceiling_height_m: null, location_id: id, is_visible: true, sort_order: 1, zone_kind: 'room' })
  const data = { layers: [layer], elements: [element], sources: [{ id: 'S', project_id: 'p', kind: 'pdf_page', name: 'A', page_number: 1, scale_pt_per_m: K, level_id: null }], levels: [], zones: [zone('R1', room1), zone('R2', room2), zone('C', corridor)] }
  const all = new Set(['R1', 'R2', 'C'])

  const before = allocateFromTakeoff(data, { layerIds: ['L'], unit: 'm²', productionLocationIds: all })
  assert.ok(Math.abs(before.total - 53.9) < 1e-6)
  assert.ok(before.byLocation.get('R1') > 0 && before.byLocation.get('C') > 0)

  // Room 1 is drawn: it leaves the automatic split, and its drawn stretch is claimed.
  const after = allocateFromTakeoff(data, { layerIds: ['L'], unit: 'm²', productionLocationIds: new Set(['R2', 'C']), claimed: [{ source_id: 'S', points: [[0, 100], [100, 100]] }] })
  assert.ok(Math.abs(after.claimed - 26.95) < 0.05, `claimed ${after.claimed}`)
  assert.equal(after.byLocation.get('R1'), undefined)
  assert.ok(Math.abs(after.unallocated) < 0.01, 'nothing left outside: the rest goes to Room 2 and the corridor')
  const rest = [...after.byLocation.values()].reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(rest + after.claimed + after.unallocated - after.total) < 0.01)
  // Lines on another sheet claim nothing.
  const other = allocateFromTakeoff(data, { layerIds: ['L'], unit: 'm²', productionLocationIds: all, claimed: [{ source_id: 'X', points: [[0, 100], [100, 100]] }] })
  assert.equal(other.claimed, 0)
})

test('a task line is projected to the chosen side, against the face', async () => {
  const { projectTaskLine, TASK_BAND_M } = await import('../src/lib/takeoff/taskDrawings.ts')
  // Face drawn along y = 100 (10 pt = 1 m); third click above (y < 100) → band centre 0.05 m above.
  const up = projectTaskLine([0, 100], [100, 100], [50, 80], K)
  assert.ok(Math.abs(up[0][1] - (100 - TASK_BAND_M / 2 * K)) < 1e-9 && Math.abs(up[1][1] - up[0][1]) < 1e-9)
  const down = projectTaskLine([0, 100], [100, 100], [50, 130], K)
  assert.ok(Math.abs(down[0][1] - (100 + TASK_BAND_M / 2 * K)) < 1e-9)
  // Taken wall (centreline, 0.12 m thick): the band starts at the face, 0.06 m + 0.05 m away.
  const taken = projectTaskLine([0, 100], [100, 100], [50, 80], K, 0.12)
  assert.ok(Math.abs(taken[0][1] - (100 - 0.11 * K)) < 1e-9)
})

test('taking a wall also gives its thickness', async () => {
  const { takeWallStretch } = await import('../src/lib/takeoff/taskDrawings.ts')
  const r = takeWallStretch([50, 102], [{ ...wall, thickness: 0.124 }], [0, 0, 100, 99], K)
  assert.equal(r.thicknessM, 0.124)
  assert.equal(takeWallStretch([50, 102], [wall], [0, 0, 100, 99], K).thicknessM, 0)
})

test('tags are numbered per activity and never reuse a gap', async () => {
  const { nextTaskTag } = await import('../src/lib/takeoff/taskDrawings.ts')
  assert.equal(nextTaskTag('1.1', []), 'T1.1-01')
  assert.equal(nextTaskTag('1.1', ['T1.1-01', 'T1.1-03', 'T1.2-07', null]), 'T1.1-04')
  assert.equal(nextTaskTag('', ['TX-09']), 'TX-10')
  assert.equal(nextTaskTag('2.1', ['T2.10-05']), 'T2.1-01', 'a longer code is another activity')
})
