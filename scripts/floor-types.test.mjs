// Tests for floor types (materials per finish). Run: npm run test:floors (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_FLOORS, floorLines, floorMaterials, floorSpecOf, layerFromFloorType, FLOOR_IFC } from '../src/lib/takeoff/floorTypes.ts'

const L = { pieces: 'pç', grout: 'Rejunte', primer: 'Primer', weldRod: 'Cordão de solda', pedestals: 'Pedestal', underlay: 'Manta', mortar: 'Argamassa' }
const spec = code => STANDARD_FLOORS.find(c => c.code === code).spec
const qty = (lines, re) => lines.find(l => re.test(l.mat))?.qty
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`)

test('standard list has FL01…FL12 with valid specs', () => {
  assert.deepEqual(STANDARD_FLOORS.map(c => c.code), Array.from({ length: 12 }, (_, i) => `FL${String(i + 1).padStart(2, '0')}`))
  for (const c of STANDARD_FLOORS) assert.ok(floorSpecOf({ floor: c.spec }), c.code)
})

test('porcelain 60×60: m² and pieces with waste, adhesive, grout, skirting', () => {
  const lines = floorLines(spec('FL01'), 36, 24, L) // 6 × 6 m
  near(lines.find(l => l.unit === 'm²').qty, 39.6) // 36 × 1,10
  assert.equal(qty(lines, /\(pç\)/), Math.ceil(39.6 / 0.36)) // 110
  near(qty(lines, /ACIII/), 180) // 5 kg/m²
  near(qty(lines, /Rejunte/), 36 * (1200 * 2 * 9 * 1.58) / 360000) // ≈ 3,41 kg
  near(qty(lines, /Rodapé/), 26.4) // 24 m × 1,10
})

test('hospital vinyl sheet: weld rod along seams, coved skirting', () => {
  const lines = floorLines(spec('FL04'), 40, 26, L)
  near(qty(lines, /Manta vinílica/), 43.2)
  near(qty(lines, /Cordão/), 20) // 40 / 2 m roll
  assert.ok(qty(lines, /boleado/) > 26)
})

test('raised floor: panels with waste, one pedestal per panel', () => {
  const lines = floorLines(spec('FL06'), 36, 24, L)
  assert.equal(qty(lines, /Placa/), Math.ceil((36 * 1.03) / 0.36))
  assert.equal(qty(lines, /Pedestal/), 100)
})

test('resin: kg = area × thickness × consumption (+waste), primer', () => {
  const lines = floorLines(spec('FL07'), 50, 30, L)
  near(qty(lines, /epóxi/), 50 * 2 * 1.6 * 1.05)
  near(qty(lines, /Primer/), 15)
})

test('screed: m³ from thickness; concrete: area only', () => {
  near(qty(floorLines(spec('FL11'), 100, 40, L), /contrapiso/), 100 * 40 * 1.05 / 1000)
  assert.deepEqual(floorLines(spec('FL12'), 10, 12, L), [{ mat: 'Polimento de concreto', unit: 'm²', qty: 10 }])
})

test('floorMaterials sums floor items only, layerFromFloorType makes a flooring area', () => {
  const k = 20
  const sq = m => [[0, 0], [m * k, 0], [m * k, m * k], [0, m * k]]
  const items = [
    { key: 'f', kind: 'area', name: 'FL03 – x', floor: spec('FL03'), shapes: [{ page: 1, pts: sq(3) }, { page: 1, pts: sq(3) }] },
    { key: 'c', kind: 'area', name: 'Forro', shapes: [{ page: 1, pts: sq(5) }] },
  ]
  const m = floorMaterials(items, k, L)
  near(m.find(x => /ACII/.test(x.mat)).qty, 72) // 18 m² × 4 kg
  const row = layerFromFloorType({ id: 'ft', code: 'FL03', name: 'Cerâmica', thickness_m: 0.008, framing: { floor: spec('FL03') } }, { projectId: 'p', color: '#111111', sortOrder: 10, elevationM: 0 })
  assert.equal(row.framing.meta.ifcType, FLOOR_IFC)
  assert.equal(row.kind, 'area')
  assert.equal(row.wall_type_id, 'ft')
})
