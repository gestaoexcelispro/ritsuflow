// Tests for the field sheet helpers (planning layer + PDF layout). Run: npm run test:field-sheet (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fingerprint, fitCrop, planColor, planLabel, printedRatio, tagsOnLongest, userBox, wrapText } from '../src/lib/takeoff/fieldSheet.ts'

test('activity colours cycle and labels read code · quantity unit', () => {
  assert.equal(planColor(0), planColor(12))
  assert.notEqual(planColor(0), planColor(1))
  assert.equal(planLabel('1.1', '16,81', 'm²'), '1.1 · 16,81 m²')
  assert.equal(planLabel(null, '3', ''), '3')
})

test('the label goes on the longest stretch', () => {
  assert.deepEqual(tagsOnLongest([[0, 0], [1, 0], [1, 5], [2, 5]], 'X'), ['', 'X', ''])
  assert.deepEqual(tagsOnLongest([[0, 0]], 'X'), [])
})

test('the fingerprint changes with the drawing, not with the order', () => {
  const a = { id: 'a', quantity: 16.81, height_m: 2.8, points: [[0, 0], [10, 0]] }
  const b = { id: 'b', quantity: 3, height_m: null, points: [[0, 0], [0, 4]] }
  assert.equal(fingerprint([a, b]), fingerprint([b, a]))
  assert.notEqual(fingerprint([a, b]), fingerprint([a]))
  assert.notEqual(fingerprint([a]), fingerprint([{ ...a, quantity: 17 }]))
  assert.notEqual(fingerprint([a]), fingerprint([{ ...a, points: [[0, 0], [11, 0]] }]))
})

test('a viewport box maps to user space (y flipped) and fits the map area', () => {
  // A4 portrait page: viewport y down, user y up (transform of pdf.js at scale 1 is [1,0,0,-1,0,842]; inverse is the same).
  const toUser = [1, 0, 0, -1, 0, 842]
  const box = userBox([100, 100, 300, 200], toUser)
  assert.deepEqual(box, { left: 100, bottom: 642, right: 300, top: 742 })
  const fit = fitCrop(box, { x: 24, y: 24, w: 550, h: 547 })
  assert.equal(fit.k, 2.75)
  assert.deepEqual(fit.map([100, 642]), [24, 24 + (547 - 275) / 2])
  // 51.54 pt/m sheet (1:55) shown 2.75× bigger prints at about 1:20.
  assert.equal(printedRatio(51.54, 2.75), 20)
})

test('long names wrap to two lines and are cut with an ellipsis', () => {
  const width = s => s.length
  assert.deepEqual(wrapText('Metal stud framing 3-5/8 25 ga stud', 20, width), ['Metal stud framing', '3-5/8 25 ga stud'])
  const cut = wrapText('one two three four five six seven eight nine ten', 10, width, 2)
  assert.equal(cut.length, 2)
  assert.ok(cut[1].endsWith('…') && cut[1].length <= 10)
})

test('callout labels never overlap; a label the user moved stays where it was put', async () => {
  const { layoutLabels, leaderEnd } = await import('../src/lib/takeoff/labelLayout.ts')
  // Two tasks on the same stretch (same anchor): the second label goes elsewhere.
  const out = layoutLabels([{ id: 'a', x: 300, y: 300, w: 120, h: 15 }, { id: 'b', x: 302, y: 300, w: 120, h: 15 }], 800, 800)
  const [A, B] = out
  const apart = Math.abs(A.bx - B.bx) >= 120 || Math.abs(A.by - B.by) >= 15
  assert.ok(apart, `labels overlap: ${JSON.stringify(out)}`)
  // A fixed label keeps its centre and the other one avoids it.
  const f = layoutLabels([{ id: 'a', x: 300, y: 300, w: 120, h: 15, fixed: [300, 266] }, { id: 'b', x: 300, y: 300, w: 120, h: 15 }], 800, 800)
  assert.deepEqual([f[0].bx, f[0].by], [300, 266])
  assert.ok(Math.abs(f[1].bx - 300) >= 120 || Math.abs(f[1].by - 266) >= 15)
  // Leader from below meets the bottom edge of the box.
  assert.deepEqual(leaderEnd({ x: 300, y: 300, w: 120, h: 16 }, [300, 250]), [300, 258])
  assert.deepEqual(leaderEnd({ x: 500, y: 250, w: 120, h: 16 }, [300, 250]), [360, 250])
})
