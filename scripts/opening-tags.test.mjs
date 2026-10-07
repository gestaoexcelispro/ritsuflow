// Door / window / opening tags. Run: node --experimental-strip-types --import ./scripts/ts-resolve.mjs --test scripts/opening-tags.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeOpeningTags } from '../src/lib/takeoff/segmentTags.ts'

const o = (kind, off) => ({ kind, off, w: 0.8, h: 2.1, sill: 0, guid: null })
test('numbered per kind across the project: sheet order, drawing order, along each wall', () => {
  const els = [
    { id: 'b', source_id: 's2', created_at: '1', openings: [o('door', 1)] },
    { id: 'a', source_id: 's1', created_at: '2', openings: [o('window', 3), o('door', 1), o('void', 2)] },
    { id: 'c', source_id: 's1', created_at: '3', openings: [] },
  ]
  const t = computeOpeningTags(els, ['s1', 's2'], { door: 'D', window: 'W', void: 'O' })
  assert.deepEqual(t.get('a'), ['W-01', 'D-01', 'O-01'])
  assert.deepEqual(t.get('b'), ['D-02'])
  assert.equal(t.has('c'), false)
})
