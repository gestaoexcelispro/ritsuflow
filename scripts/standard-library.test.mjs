// Tests for the US standard library data (scripts/standard-library/us.mjs) against the app's engines.
// Run: npm run test:library (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultFraming, framingTotals } from '../src/lib/takeoff/framing/framing.ts'
import { wallTypeFraming } from '../src/lib/takeoff/wallTypes.ts'
import { FRAMED_MATERIAL_RX, recipeMaterials } from '../src/lib/takeoff/recipes.ts'
import { ceilingSpecOf } from '../src/lib/takeoff/ceilingTypes.ts'
import { floorSpecOf } from '../src/lib/takeoff/floorTypes.ts'
import { usCeilings, usFloors, usWalls } from './standard-library/us.mjs'

const k = 100
const wallItem = w => ({
  key: w.code, kind: 'linear', name: w.code, system: '', color: '#000', height: 3.048, thickness: w.thickness_m, recipeId: 'r',
  framing: wallTypeFraming({ framing: w.framing, boards: w.boards }, defaultFraming({ thickness: w.thickness_m })),
  shapes: [{ id: 'e', page: 1, pts: [[0, 0], [9.144 * k, 0]] }],
})

test('every US wall: the layout uses only the type\'s own studs, tracks and boards', () => {
  for (const w of usWalls()) {
    const T = framingTotals([wallItem(w)], k)
    const boards = [...T.boards.values()].map(g => g.name).sort()
    assert.deepEqual(boards, [...new Set(w.boards.map(b => b.product))].sort(), w.code)
    const profiles = [...T.prof.values()].map(g => g.name)
    assert.ok(profiles.includes(w.framing.studName) && profiles.includes(w.framing.trackName), w.code)
  }
})

test('every US wall recipe: framing lines are skipped with framing on, all other lines are kept', () => {
  for (const w of usWalls()) {
    const layout = w.recipe.lines.filter(l => /framing layout/.test(l.note || ''))
    const kept = w.recipe.lines.filter(l => !/framing layout/.test(l.note || '') && !/screw/i.test(l.mat))
    for (const l of layout) assert.ok(FRAMED_MATERIAL_RX.test(l.mat) || /screw/i.test(l.mat), `${w.code}: ${l.mat}`)
    const out = recipeMaterials([wallItem(w)], k, () => ({ ...w.recipe, id: 'r', mode: 'fixed', status: 'review' })).map(m => m.mat)
    assert.deepEqual(out.sort(), kept.map(l => l.mat).sort(), w.code)
  }
})

test('ceiling and floor types have valid build-ups and imperial output; codes are unique', () => {
  const codes = [...usWalls(), ...usCeilings(), ...usFloors()].map(t => t.code)
  assert.equal(new Set(codes).size, codes.length)
  for (const c of usCeilings()) assert.ok(ceilingSpecOf(c.framing)?.imperial, c.code)
  for (const f of usFloors()) assert.ok(floorSpecOf(f.framing)?.imperial, f.code)
})
