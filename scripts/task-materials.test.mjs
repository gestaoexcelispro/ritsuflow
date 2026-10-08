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
