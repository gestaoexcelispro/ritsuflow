// Tests for task materials (framing layout cut to the drawn stretch + rates). Run: npm run test:task-materials (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hostOf, sliceLayout, sumMaterials, taskBase, taskMaterials } from '../src/lib/takeoff/taskMaterials.ts'
import { defaultFraming, layoutWall } from '../src/lib/takeoff/framing/framing.ts'

// 10 pt = 1 m. A 10 m wall along y = 100 (left → right), 0.1 m thick, 2.8 m high, a 0.8 × 2.1 m door centred at 7 m.
const K = 10
const framing = { ...defaultFraming({ thickness: 0.1 }), on: true, spacing: 0.4, layersA: 1, layersB: 1, boardW: 1.2, boardH: 2.8, bars: [3, 6], studGap: 0, screwsFromLayout: true }
const wall = {
  key: 'L', kind: 'linear', name: 'DW03', system: '', color: '#000', thickness: 0.1, height: 2.8, framing,
  shapes: [{ id: 'w', page: 1, pts: [[0, 100], [100, 100]], openings: [{ off: 7, w: 0.8, h: 2.1, sill: 0, kind: 'door', guid: null }] }],
}
const labels = { bars: 'barras', sheets: 'placas', un: 'un', barLen: v => `${v} m` }
// Task face lines along the wall face (0.05 m off the centreline), first 5 m, on each side.
const above = { points: [[0, 99.5], [50, 99.5]], side: -1, height_m: 2.8 } // band goes up (y−): face on that side
const below = { points: [[0, 100.5], [50, 100.5]], side: 1, height_m: 2.8 }

test('a task line finds its wall, the stretch it covers and the face', () => {
  const h1 = hostOf(above, wall, K), h2 = hostOf(below, wall, K)
  assert.ok(h1 && h2)
  assert.ok(Math.abs(h1.s0) < 1e-6 && Math.abs(h1.s1 - 5) < 1e-6)
  assert.notEqual(h1.face, h2.face, 'opposite sides are opposite faces')
  assert.equal(hostOf({ points: [[0, 130], [50, 130]], side: 1 }, wall, K), null, 'too far from the wall')
  assert.equal(hostOf({ points: [[20, 0], [20, 90]], side: 1 }, wall, K), null, 'not parallel')
})

test('the layout cut to half the wall keeps about half the studs and track', () => {
  const lay = layoutWall(wall, wall.shapes[0], K)
  const half = sliceLayout(lay, 0, 5, null)
  assert.ok(half.studs.length > 0 && half.studs.length < lay.studs.length)
  assert.equal(half.studs.every(s => s.x <= 5 + 1e-6), true)
  assert.equal(half.board.A.length + half.board.B.length, 0, 'no boards unless a face is asked')
  const top = half.tracks.find(t => t.kind === 'guia superior')
  assert.ok(top && Math.abs(top.x1 - top.x0 - 5) < 1e-6)
})

test('framing gives studs, tracks (whole bars + exact m) and LA screws; boards only for the board step', () => {
  const rows = taskMaterials({ step: 'framing', item: wall, sheetItems: [wall], lines: [above], ptPerM: K, rates: [], labels })
  const studs = rows.filter(r => r.mat.startsWith(framing.studName))
  const tracks = rows.filter(r => r.mat.startsWith(framing.trackName))
  assert.ok(studs.length && tracks.length)
  const trackM = tracks.reduce((a, r) => a + r.exact, 0)
  assert.ok(Math.abs(trackM - 10) < 0.05, `top + bottom track over 5 m = 10 m, got ${trackM}`)
  for (const r of [...studs, ...tracks]) assert.ok(Number.isInteger(r.whole) && r.whole >= 1)
  assert.ok(!rows.some(r => r.unit === 'placas'))
})

test('board A / B take only the face the line is on, as whole sheets with the exact figure kept', () => {
  const a = taskMaterials({ step: 'board_a', item: wall, sheetItems: [wall], lines: [above], ptPerM: K, rates: [], labels })
  const sheets = a.find(r => r.unit === 'placas')
  assert.ok(sheets)
  assert.ok(Math.abs(sheets.exact - (5 * 2.8) / (1.2 * 2.8)) < 0.01, `5 m of one face = 4.17 sheets, got ${sheets.exact}`)
  assert.equal(sheets.whole, 5)
  assert.ok(a.some(r => r.unit === 'un' && r.exact > 0), 'board screws')
  // The same stretch drawn as a "board B" task on the other side gives the other face's board.
  const b = taskMaterials({ step: 'board_b', item: wall, sheetItems: [wall], lines: [below], ptPerM: K, rates: [], labels })
  assert.ok(b.find(r => r.unit === 'placas'))
})

test('rates use the net area (door deducted), length or line count; insulation by area; summary adds up', () => {
  const doorStretch = { points: [[50, 99.5], [100, 99.5]], side: -1, height_m: 2.8 }
  const base = taskBase([doorStretch], wall, K)
  assert.ok(Math.abs(base.area - (5 * 2.8 - 0.8 * 2.1)) < 1e-6)
  const rates = [
    { name: 'Massa para juntas', unit: 'kg', per: 'm2', coef: 0.5, waste: 10, packSize: 25, packName: 'balde' },
    { name: 'Fita de papel', unit: 'm', per: 'm2', coef: 1.4 },
    { name: 'Selante', unit: 'tubo', per: 'm', coef: 0.2 },
  ]
  const rows = taskMaterials({ step: 'joints_a', item: wall, sheetItems: [wall], lines: [doorStretch], ptPerM: K, rates, labels })
  const massa = rows.find(r => r.mat === 'Massa para juntas')
  assert.ok(Math.abs(massa.exact - base.area * 0.5 * 1.1) < 1e-9)
  assert.equal(massa.whole, 1)
  assert.equal(massa.wholeUnit, 'balde')
  assert.ok(Math.abs(rows.find(r => r.mat === 'Selante').exact - 1) < 1e-9)
  const ins = taskMaterials({ step: 'insulation', item: wall, sheetItems: [wall], lines: [above], ptPerM: K, rates: [], labels, insulation: { name: 'Lã de vidro 50 mm', unit: 'm²' } })
  assert.ok(Math.abs(ins[0].exact - 14) < 1e-9 && ins[0].whole === 14)
  const sum = sumMaterials([rows, rows])
  assert.ok(Math.abs(sum.find(r => r.mat === 'Fita de papel').exact - 2 * base.area * 1.4) < 1e-9)
})

test('anchors along a track: first and last at most 10 cm from the ends, at most 60 cm apart', async () => {
  const { anchorsAlong } = await import('../src/lib/takeoff/framing/framing.ts')
  assert.equal(anchorsAlong(3, 0.6, 0.1), 6) // 2.8 m between end anchors → 5 gaps
  assert.equal(anchorsAlong(0.2, 0.6, 0.1), 1)
  assert.equal(anchorsAlong(0.8, 0.6, 0.1), 2)
  assert.equal(anchorsAlong(0, 0.6, 0.1), 0)
})

test('the framing task carries anchors and acoustic band at floor, ceiling and free ends (always)', async () => {
  const { defaultFixings, freeEnds } = await import('../src/lib/takeoff/framing/framing.ts')
  // Stored ticks are ignored: the rule is floor + ceiling + free ends for anchors and band.
  const fx = { ...defaultFixings(), bandAt: { floor: true, ceiling: false, walls: false }, anchorAt: { floor: true, ceiling: false, walls: false } }
  const w = { ...wall, framing: { ...framing, fixings: fx } }
  const ends = freeEnds([w], K)
  assert.deepEqual(ends.get(w.shapes[0]), { start: true, end: true }, 'a lone wall stops against other systems at both ends')
  const rows = taskMaterials({ step: 'framing', item: w, sheetItems: [w], lines: [above], ptPerM: K, rates: [], labels, ends })
  const anchors = rows.find(r => r.mat === fx.anchorName)
  const band = rows.find(r => r.mat === fx.bandName)
  assert.ok(anchors && band)
  // Bottom track 0…6.6 m (door at 6.6…7.4): 5/6.6 of its anchors; top track 0…10 m: half; start wall end: 2.8 m of stud (6 anchors).
  const exp = (n, len, part) => Math.ceil((len - 0.2) / 0.6 - 1e-9) + 1 === n ? n * part / len : NaN
  const expected = exp(12, 6.6, 5) + exp(18, 10, 5) + 6
  assert.ok(Math.abs(anchors.exact - expected) < 1e-6, `anchors ${anchors.exact} vs ${expected}`)
  assert.ok(Math.abs(band.exact - (5 + 5 + 2.8)) < 1e-6, `band = 5 m floor + 5 m ceiling + 2.8 m at the free end, got ${band.exact}`)
  // No fixings set: nothing counted (old walls keep their estimate).
  assert.ok(!taskMaterials({ step: 'framing', item: wall, sheetItems: [wall], lines: [above], ptPerM: K, rates: [], labels }).some(r => r.mat === fx.anchorName))
  // Boards do not carry fixings.
  assert.ok(!taskMaterials({ step: 'board_a', item: w, sheetItems: [w], lines: [above], ptPerM: K, rates: [], labels, ends }).some(r => r.mat === fx.anchorName))
})

test('a wall end that meets another framed wall is not free', async () => {
  const { freeEnds } = await import('../src/lib/takeoff/framing/framing.ts')
  const other = { ...wall, key: 'M', shapes: [{ id: 'v', page: 1, pts: [[100, 100], [100, 0]], openings: [] }] }
  const ends = freeEnds([wall, other], K)
  assert.deepEqual(ends.get(wall.shapes[0]), { start: true, end: false })
  assert.deepEqual(ends.get(other.shapes[0]), { start: false, end: true })
})

test('recipe lines go to their task, shared by the stretch and split between faces', async () => {
  const { lineStep, recipeLineQuantities, ANCHOR_RX } = await import('../src/lib/takeoff/recipes.ts')
  assert.equal(lineStep({ mat: 'Massa para juntas' }), 'joints')
  assert.equal(lineStep({ mat: 'Fita de papel microperfurada' }), 'joints')
  assert.equal(lineStep({ mat: 'Banda acústica 48 mm' }), 'framing')
  assert.equal(lineStep({ mat: 'Bucha de nylon S6 + parafuso' }), 'framing')
  assert.equal(lineStep({ mat: 'Parafuso LA 4,2 x 9,5 mm' }), 'framing')
  assert.equal(lineStep({ mat: 'Parafuso TA 3,5 x 25 mm' }), 'boards')
  assert.equal(lineStep({ mat: 'Lã de vidro 50 mm' }), 'insulation')
  assert.equal(lineStep({ mat: 'Massa', step: 'joints_a' }), 'joints_a')
  assert.ok(ANCHOR_RX.test('Powder-actuated fastener for runners'))

  const recipe = { id: 'r', name: 'DW', maker: null, system: null, kind: 'linear', heightBasisM: null, wasteIncludedPct: 0, status: 'review', mode: 'fixed', lines: [
    { mat: 'Massa para juntas', unit: 'kg', coef: 0.7, base: 'm2', waste: 0, packSize: 30, packName: 'balde' },
    { mat: 'Fita de papel', unit: 'm', coef: 3, base: 'm2', waste: 0 },
    { mat: 'Bucha de nylon S6 + parafuso', unit: 'un', coef: 3.4, base: 'm', waste: 0 },
    { mat: 'Montante 48 mm', unit: 'm', coef: 2.3, base: 'm2', waste: 0 },
  ] }
  const { defaultFixings } = await import('../src/lib/takeoff/framing/framing.ts')
  const w = { ...wall, framing: { ...framing, fixings: defaultFixings() } }
  const q = recipeLineQuantities(w, K, recipe)
  assert.deepEqual(q.map(x => x.mat), ['Massa para juntas', 'Fita de papel'], 'studs and anchors come from the layout, not the recipe')
  const itemArea = 10 * 2.8 - 0.8 * 2.1
  const itemBase = { area: itemArea, length: 10 }
  const jA = taskMaterials({ step: 'joints_a', item: w, sheetItems: [w], lines: [above], ptPerM: K, rates: [], labels, recipeLines: q, itemBase })
  const massa = jA.find(r => r.mat === 'Massa para juntas')
  // 5 m stretch, no opening: 14 m² of face; the wall's compound is shared by both faces.
  assert.ok(Math.abs(massa.exact - 0.7 * 14 / 2) < 1e-6, `got ${massa.exact}`)
  assert.equal(massa.whole, 1)
  assert.equal(massa.wholeUnit, 'balde')
  assert.equal(massa.source, 'recipe')
  // The framing task does not take joint materials.
  assert.ok(!taskMaterials({ step: 'framing', item: w, sheetItems: [w], lines: [above], ptPerM: K, rates: [], labels, recipeLines: q, itemBase }).some(r => r.source === 'recipe'))
  // Whole wall drawn on both faces = the wall's estimate.
  const full = (pts, side, st) => taskMaterials({ step: st, item: w, sheetItems: [w], lines: [{ points: pts, side, height_m: 2.8 }], ptPerM: K, rates: [], labels, recipeLines: q, itemBase })
  const tot = [full([[0, 99.5], [100, 99.5]], -1, 'joints_a'), full([[0, 100.5], [100, 100.5]], 1, 'joints_b')].flat().filter(r => r.mat === 'Massa para juntas').reduce((a, r) => a + r.exact, 0)
  assert.ok(Math.abs(tot - 0.7 * itemArea) < 1e-6, `both faces = estimate, got ${tot}`)
})

test('the activity of an old or typed scope line is guessed from its name', async () => {
  const { inferStep } = await import('../src/lib/takeoff/taskMaterials.ts')
  assert.equal(inferStep('board_b', 'whatever'), 'board_b', 'an imported step wins')
  assert.equal(inferStep(null, 'Metal stud framing – 3-5/8" 25 ga (18 mil) stud'), 'framing')
  assert.equal(inferStep(null, 'Gypsum board installation – Side A (1× 5/8" Type X gypsum board 4\'×12\')'), 'board_a')
  assert.equal(inferStep(null, 'Gypsum board installation – Side B'), 'board_b')
  assert.equal(inferStep(null, 'Joint treatment – Side B'), 'joints_b')
  assert.equal(inferStep(null, 'Tratamento de juntas'), 'joints_a')
  assert.equal(inferStep(null, 'Isolamento acústico'), 'insulation')
  assert.equal(inferStep(null, 'Estruturação'), 'framing')
  assert.equal(inferStep(null, 'Pintura'), null)
})

test('double studs (MD) double the regular studs and their framing screws, not the board screws', async () => {
  const { layoutWall, screwsForWall } = await import('../src/lib/takeoff/framing/framing.ts')
  const single = layoutWall(wall, wall.shapes[0], K)
  const dbl = { ...wall, framing: { ...framing, doubleStuds: true } }
  const double = layoutWall(dbl, dbl.shapes[0], K)
  const regular = single.studs.filter(s => s.kind === 'montante').length
  assert.equal(double.studs.length, single.studs.length + regular)
  const a = screwsForWall(single, framing), b = screwsForWall(double, dbl.framing)
  assert.equal(b.ta, a.ta, 'boards are screwed once')
  assert.ok(b.la > a.la, 'each twin is fixed in the tracks')
})

test('per-wall contacts override the automatic free ends and set what the top and floor meet', async () => {
  const { defaultFixings, fixingsForWall, endsWithContacts, layoutWall: lw } = await import('../src/lib/takeoff/framing/framing.ts')
  const fx = defaultFixings()
  const lay = lw(wall, wall.shapes[0], K)
  const free = { start: true, end: true }
  const base = fixingsForWall(lay, fx, free)
  // Both ends against a drywall wall: no end anchors, no end band (2 × 2.8 m less band).
  const dry = fixingsForWall(lay, fx, free, undefined, { start: 'drywall', end: 'none' })
  assert.ok(Math.abs(base.bandM - dry.bandM - 2 * 2.8) < 1e-6)
  assert.ok(base.anchors - dry.anchors === 12, 'two end studs of 2.8 m carry 6 anchors each')
  // An end the detection missed: 'system' forces the fixing.
  assert.deepEqual(endsWithContacts({ start: false, end: false }, { start: 'system' }), { start: true, end: false })
  // Drywall ceiling: the top track's fixings become screws, band stays.
  const dc = fixingsForWall(lay, fx, { start: false, end: false }, undefined, { top: 'drywall_ceiling' })
  const slab = fixingsForWall(lay, fx, { start: false, end: false })
  assert.ok(dc.screws > 0 && Math.abs(dc.anchors + dc.screws - slab.anchors) < 1e-6 && Math.abs(dc.bandM - slab.bandM) < 1e-6)
  // Wall stopping below the ceiling: nothing at the top.
  const open = fixingsForWall(lay, fx, { start: false, end: false }, undefined, { top: 'none' })
  assert.ok(open.screws === 0 && open.anchors < slab.anchors && open.bandM < slab.bandM)
})
