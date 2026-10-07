// Tests for ceiling types (materials per build-up) and tags of everything drawn.
// Run: npm run test:ceilings (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_CEILINGS, ceilingLines, ceilingMaterials, ceilingSpecOf, layerFromCeilingType, CEILING_IFC } from '../src/lib/takeoff/ceilingTypes.ts'
import { computeSegmentTags, layerTagPrefixes, nameCode } from '../src/lib/takeoff/segmentTags.ts'

const L = {
  hangers: 'Pendural', brackets: 'Suporte', perimeterAngle: 'Cantoneira', perimeterTrack: 'Guia', mainTee: 'Perfil principal T24',
  crossTee: 'Travessa T24', shortTee: 'Travessa curta T24', carrier: 'Perfil porta-placa', frame: 'Estrutura', perimeterTrim: 'Acabamento', screws: 'Parafuso', sheets: 'chapas', pieces: 'pç',
}
const spec = code => STANDARD_CEILINGS.find(c => c.code === code).spec
const qty = (lines, re) => lines.find(l => re.test(l.mat))?.qty

test('standard list has CL01…CL13 with valid specs and unique codes', () => {
  assert.equal(STANDARD_CEILINGS.length, 13)
  assert.deepEqual(STANDARD_CEILINGS.map(c => c.code), Array.from({ length: 13 }, (_, i) => `CL${String(i + 1).padStart(2, '0')}`))
  for (const c of STANDARD_CEILINGS) assert.ok(ceilingSpecOf({ ceiling: c.spec }), c.code)
})

test('suspended F530 @ 600: profiles, hangers, perimeter, sheets, screws', () => {
  const lines = ceilingLines(spec('CL01'), 36, 24, L) // 6 × 6 m room
  assert.equal(qty(lines, /F530/), 60) // 36 / 0,6
  assert.equal(qty(lines, /Pendural/), Math.ceil(36 / (0.6 * 1.2))) // 50
  assert.equal(qty(lines, /Cantoneira/), 24)
  assert.equal(qty(lines, /Chapa ST/), Math.ceil(36 / 2.88)) // 13
  assert.equal(qty(lines, /Parafuso/), Math.ceil(36 / 0.6 / 0.3)) // 200
})

test('fire-rated double layer doubles sheets and screws; insulation adds m²', () => {
  const rf = ceilingLines(spec('CL03'), 36, 24, L)
  assert.equal(qty(rf, /Chapa RF/), Math.ceil(72 / 2.88))
  assert.equal(qty(rf, /Parafuso/), Math.ceil((36 / 0.4 / 0.3) * 2))
  assert.equal(qty(ceilingLines(spec('CL04'), 36, 24, L), /Lã de vidro/), 36)
})

test('direct-fixed uses brackets, self-supporting uses a perimeter track, neither has hangers', () => {
  const direct = ceilingLines(spec('CL06'), 36, 24, L)
  assert.ok(qty(direct, /Suporte/) > 0)
  assert.equal(qty(direct, /Pendural/), undefined)
  const self = ceilingLines(spec('CL07'), 36, 24, L)
  assert.equal(qty(self, /Guia/), 24)
  assert.equal(qty(self, /Pendural/), undefined)
})

test('modular 625×625 grid: tiles, main/cross/short tees, hangers', () => {
  const lines = ceilingLines(spec('CL08'), 25, 20, L)
  assert.equal(qty(lines, /fibra mineral/), Math.ceil(25 / 0.390625)) // 64 tiles
  assert.equal(qty(lines, /principal/), Math.ceil(20 / 3.75)) // 25 / 1,25 = 20 m
  assert.equal(qty(lines, /^Travessa T24/), Math.ceil(25 / 0.625 / 1.25)) // 32
  assert.equal(qty(lines, /curta/), Math.ceil(20 / 0.625)) // 32
  assert.equal(qty(lines, /Cantoneira/), 20)
  // 625 × 1250 has no short tees.
  assert.equal(qty(ceilingLines(spec('CL10'), 25, 20, L), /curta/), undefined)
})

test('empty area gives no lines', () => {
  assert.deepEqual(ceilingLines(spec('CL01'), 0, 0, L), [])
})

test('ceilingMaterials sums areas of ceiling items only (sheet points → metres)', () => {
  const k = 50 // pt per m
  const sq = m => [[0, 0], [m * k, 0], [m * k, m * k], [0, m * k]]
  const items = [
    { key: 'a', kind: 'area', name: 'CL01 – x', ceiling: spec('CL01'), shapes: [{ page: 1, pts: sq(6) }, { page: 1, pts: sq(6) }] },
    { key: 'f', kind: 'area', name: 'Floor', shapes: [{ page: 1, pts: sq(10) }] },
  ]
  const m = ceilingMaterials(items, k, L)
  assert.ok(Math.abs(m.find(x => /F530/.test(x.mat)).qty - 120) < 1e-6) // 72 m² / 0,6
  assert.equal(m.find(x => /Cantoneira/.test(x.mat)).qty, 48)
  assert.deepEqual(m.find(x => /F530/.test(x.mat)).from, ['CL01 – x'])
})

test('layerFromCeilingType makes a ceiling area at the given height, linked to the type', () => {
  const ct = { id: 'ct1', code: 'CL02', name: 'Suspenso F530/600/RU12,5', thickness_m: 0.0125, framing: { ceiling: spec('CL02') }, recipe_id: null }
  const row = layerFromCeilingType(ct, { projectId: 'p', color: '#123456', sortOrder: 30, elevationM: 2.6 })
  assert.equal(row.kind, 'area')
  assert.equal(row.name, 'CL02 – Suspenso F530/600/RU12,5')
  assert.equal(row.elevation_m, 2.6)
  assert.equal(row.wall_type_id, 'ct1')
  assert.equal(row.framing.meta.ifcType, CEILING_IFC)
  assert.equal(row.framing.meta.ceiling.board, 'Chapa RU 12,5 mm')
})

test('tags: a ceiling area from CL02 is numbered CL02-01, CL02-02…', () => {
  const layers = [{ id: 'c', kind: 'area', name: 'CL02 – Suspenso', sort_order: 1, wall_type_id: 'ct1' }]
  const prefixes = layerTagPrefixes(layers, [{ id: 'ct1', code: 'CL02' }])
  assert.equal(prefixes.get('c'), 'CL02')
  const els = [
    { id: 'e1', layer_id: 'c', source_id: 's', created_at: '1', points: [[0, 0], [1, 0], [1, 1]] },
    { id: 'e2', layer_id: 'c', source_id: 's', created_at: '2', points: [[0, 0], [1, 0], [1, 1]] },
  ]
  const tags = computeSegmentTags(els, layers, [{ id: 'ct1', code: 'CL02' }], ['s'])
  assert.deepEqual([tags.get('e1').tags[0], tags.get('e2').tags[0]], ['CL02-01', 'CL02-02'])
  assert.equal(nameCode('Reforço para prateleira'), 'RPP')
})
