// Tag label placement on the 3D picture. Run: node --experimental-strip-types --import ./scripts/ts-resolve.mjs --test scripts/label-layout.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutLabels } from '../src/lib/takeoff/labelLayout.ts'

const box = l => ({ x0: l.bx - l.w / 2, x1: l.bx + l.w / 2, y0: l.by - l.h / 2, y1: l.by + l.h / 2 })
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

test('labels of anchors packed together never overlap', () => {
  const ls = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, x: 400 + (i % 4) * 30, y: 400 + Math.floor(i / 4) * 12, w: 60, h: 16 }))
  const out = layoutLabels(ls, 1200, 800)
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(!overlap(box(out[i]), box(out[j])), `${out[i].id} × ${out[j].id}`)
})

test('tags along a row of walls: no overlaps, no crossing leaders', () => {
  const r = Array.from({ length: 24 }, (_, i) => ({ id: `r${i}`, x: 150 + i * 45 + (i % 3) * 7, y: 300 + (i % 5) * 25, w: 62, h: 16 }))
  assert.ok(layoutLabels(r, 1300, 700).every(l => l.ok))
})

test('a lone label sits right above its anchor with a vertical leader', () => {
  const [l] = layoutLabels([{ id: 'a', x: 500, y: 500, w: 60, h: 16 }], 1000, 1000)
  assert.equal(l.bx, 500)
  assert.ok(l.by < 500)
  assert.equal(l.lx, 500)
})
