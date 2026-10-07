// Material list for the PDF report. Run: node --experimental-strip-types --import ./scripts/ts-resolve.mjs --test scripts/material-list.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { materialRows, projectMaterials } from '../src/lib/takeoff/materialList.ts'

const U = { bars: 'barras', sheets: 'chapas', un: 'un' }
const m = (mat, qty, unit = 'un', packs = null) => ({ mat, code: null, unit, qty, packs, packName: packs == null ? null : 'cx', from: [] })

test('recipe and surface materials become rows with their kind', () => {
  const rows = materialRows([], 0, { recipe: [m('Fita', 10, 'm')], ceiling: [m('Pendural', 50)], floor: [m('Rejunte', 0, 'kg')] }, U, String)
  assert.deepEqual(rows.map(r => [r.mat, r.kind, r.qty]), [['Fita', 'recipe', 10], ['Pendural', 'ceiling', 50]])
})

test('project total multiplies typical floors and sums the same material', () => {
  const a = materialRows([], 0, { recipe: [m('Massa', 2, 'kg', 1)], ceiling: [], floor: [] }, U, String)
  const t = projectMaterials([{ rows: a, multiplier: 3 }, { rows: a, multiplier: 1 }])
  assert.equal(t.length, 1)
  assert.equal(t[0].qty, 8)
  assert.equal(t[0].packs, 4)
})
