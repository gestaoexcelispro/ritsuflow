// Share of items per location. Run: node --experimental-strip-types --import ./scripts/ts-resolve.mjs --test scripts/location-share.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemShareByZone, NONE } from '../src/lib/takeoff/locationShare.ts'

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const zones = [{ id: 'A', points: rect(0, 0, 10, 10) }, { id: 'B', points: rect(10, 0, 20, 10) }]
const near = (a, b) => Math.abs(a - b) < 0.02

test('a wall on the edge between two rooms is split between them; one inside a room stays there', () => {
  const s = itemShareByZone([
    { key: 'shared', kind: 'linear', shapes: [{ pts: [[10, 0], [10, 10]] }] },
    { key: 'inA', kind: 'linear', shapes: [{ pts: [[2, 5], [8, 5]] }] },
    { key: 'out', kind: 'linear', shapes: [{ pts: [[30, 0], [30, 10]] }] },
  ], zones, 1)
  assert.ok(near(s.get('shared').get('A'), 0.5) && near(s.get('shared').get('B'), 0.5))
  assert.ok(near(s.get('inA').get('A'), 1))
  assert.ok(near(s.get('out').get(NONE), 1))
})

test('a ceiling across two rooms is shared by area; points go where they sit', () => {
  const s = itemShareByZone([
    { key: 'clg', kind: 'area', shapes: [{ pts: rect(5, 0, 20, 10) }] },
    { key: 'pt', kind: 'count', shapes: [{ pts: [[15, 5]] }] },
  ], zones, 1)
  assert.ok(near(s.get('clg').get('A'), 1 / 3) && near(s.get('clg').get('B'), 2 / 3))
  assert.equal(s.get('pt').get('B'), 1)
})
