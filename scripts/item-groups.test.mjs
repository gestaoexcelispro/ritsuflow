// Item list groups (discipline / feature). Run: node --experimental-strip-types --import ./scripts/ts-resolve.mjs --test scripts/item-groups.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemGroup, groupRows } from '../src/lib/takeoff/itemGroups.ts'
test('groups', () => {
  assert.deepEqual(itemGroup({ kind: 'linear' }), { group: 'arch', sub: 'walls' })
  assert.deepEqual(itemGroup({ kind: 'area', ifcType: 'IfcCovering.CEILING' }), { group: 'arch', sub: 'ceilings' })
  assert.deepEqual(itemGroup({ kind: 'area', ifcType: 'IfcSlab' }), { group: 'struct' })
  assert.deepEqual(itemGroup({ kind: 'count', mep: 'outlet_low' }), { group: 'electrical' })
  assert.deepEqual(itemGroup({ kind: 'area' }), { group: 'other' })
  const g = groupRows([{ kind: 'area', floor: {} }, { kind: 'count' }, { kind: 'linear' }, { kind: 'linear', struct: 'beam' }], x => x)
  assert.deepEqual(g.map(x => [x.group, x.subs.map(s => [s.sub, s.rows.length])]), [['arch', [['walls', 1], ['floors', 1]]], ['struct', [[null, 1]]], ['other', [[null, 1]]]])
})
