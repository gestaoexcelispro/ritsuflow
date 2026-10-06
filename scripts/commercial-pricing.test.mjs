// Tests for the Commercial pricing engine. Run: npm run test:commercial (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPricing, directOf, effective, money, priceLabor, priceMaterials, PricingError,
} from '../src/lib/commercial/pricing.ts'

const BR_TCU = [
  { key: 'ac', label: 'AC', applies_to: 'direct', method: 'percent', rate: 4 },
  { key: 's', label: 'S', applies_to: 'direct', method: 'percent', rate: 0.5 },
  { key: 'g', label: 'G', applies_to: 'direct', method: 'percent', rate: 0.3 },
  { key: 'r', label: 'R', applies_to: 'direct', method: 'percent', rate: 1.2 },
  { key: 'df', label: 'DF', applies_to: 'subtotal', method: 'percent', rate: 1.1 },
  { key: 'l', label: 'L', applies_to: 'subtotal', method: 'percent', rate: 7.4 },
  { key: 'pis', label: 'PIS', applies_to: 'subtotal', method: 'divisor', rate: 0.65 },
  { key: 'cofins', label: 'COFINS', applies_to: 'subtotal', method: 'divisor', rate: 3 },
  { key: 'iss', label: 'ISS', applies_to: 'subtotal', method: 'divisor', rate: 3 },
  { key: 'cprb', label: 'CPRB', applies_to: 'subtotal', method: 'divisor', rate: 4.5 },
]

const US_MARKUPS = [
  { key: 'gc', label: 'General conditions', applies_to: 'direct', method: 'percent', rate: 6 },
  { key: 'oh', label: 'Overhead', applies_to: 'subtotal', method: 'percent', rate: 10 },
  { key: 'profit', label: 'Profit', applies_to: 'subtotal', method: 'percent', rate: 8 },
  { key: 'bond', label: 'Bond', applies_to: 'subtotal', method: 'percent', rate: 1.2 },
  { key: 'tax', label: 'Sales tax', applies_to: 'material', method: 'percent', rate: 7 },
]

test('Brazil: engine equals the TCU BDI formula', () => {
  const direct = { material: 186245.64, labor: 108119.47, equipment: 0, subcontract: 0 }
  const r = applyPricing(direct, BR_TCU)
  const ac = 0.04, s = 0.005, g = 0.003, rk = 0.012, df = 0.011, l = 0.074, i = 0.1115
  const bdi = ((1 + ac + s + rk + g) * (1 + df) * (1 + l)) / (1 - i) - 1
  assert.equal(money(r.direct), 294365.11)
  assert.equal(money(r.price), money(294365.11 * (1 + bdi)))
  assert.equal(money(r.price), 381320.54)
  assert.equal(r.markupPct.toFixed(2), '29.54')
  assert.equal(r.taxOnPricePct.toFixed(2), '11.15')
})

test('Brazil: divisor lines are a share of the price, wherever they sit in the list', () => {
  const direct = { material: 1000, labor: 0, equipment: 0, subcontract: 0 }
  const reordered = [BR_TCU[6], ...BR_TCU.slice(0, 6), ...BR_TCU.slice(7)]
  const a = applyPricing(direct, BR_TCU), b = applyPricing(direct, reordered)
  assert.equal(money(a.price), money(b.price))
  const taxes = a.steps.filter(x => x.method === 'divisor').reduce((t, x) => t + x.amount, 0)
  assert.equal(money(a.subtotal + taxes), money(a.price))
})

test('USA: compounding markups, sales tax on material only', () => {
  const r = applyPricing({ material: 60000, labor: 40000, equipment: 0, subcontract: 0 }, US_MARKUPS)
  assert.deepEqual(r.steps.map(x => money(x.subtotal)), [106000, 116600, 125928, 127439.14, 131639.14])
  assert.equal(money(r.price), 131639.14)
})

test('No lines: price equals direct cost', () => {
  const r = applyPricing({ material: 10, labor: 5, equipment: 1, subcontract: 4 }, [])
  assert.equal(r.price, 20)
  assert.equal(r.markupPct, 0)
})

test('Refuses taxes of 100% or more and negative rates', () => {
  const d = { material: 1, labor: 0, equipment: 0, subcontract: 0 }
  assert.throws(() => applyPricing(d, [{ key: 'x', label: 'x', applies_to: 'subtotal', method: 'divisor', rate: 100 }]), PricingError)
  assert.throws(() => applyPricing(d, [{ key: 'x', label: 'x', applies_to: 'direct', method: 'percent', rate: -1 }]), PricingError)
})

test('effective(): latest price valid on the date', () => {
  const rows = [{ valid_from: '2026-01-01', v: 1 }, { valid_from: '2026-07-01', v: 2 }, { valid_from: '2026-12-01', v: 3 }]
  assert.equal(effective(rows, '2026-10-06').v, 2)
  assert.equal(effective(rows, '2026-07-01').v, 2)
  assert.equal(effective(rows, '2025-12-31'), null)
})

test('priceMaterials(): by catalog id, then by name and unit; reports what has no price', () => {
  const book = [
    { id: 'p1', material_id: 'm-board', name: 'Chapa ST 12,5', unit: 'm2', unit_cost: 20, valid_from: '2026-01-01' },
    { id: 'p2', material_id: 'm-board', name: 'Chapa ST 12,5', unit: 'm2', unit_cost: 22, valid_from: '2026-09-01' },
    { id: 'p3', material_id: null, name: 'Fita de papel', unit: 'm', unit_cost: 0.15, valid_from: '2026-01-01' },
  ]
  const r = priceMaterials([
    { materialId: 'm-board', mat: 'Chapa ST 12,5', unit: 'm2', qty: 10 },
    { mat: 'fita de papel ', unit: 'M', qty: 100 },
    { mat: 'Massa', unit: 'kg', qty: 3 },
  ], book, '2026-10-06')
  assert.equal(money(r.total), 235)
  assert.deepEqual(r.lines.map(l => l.sourceId), ['p2', 'p3'])
  assert.deepEqual(r.missing, ['Massa (kg)'])
})

test('priceLabor(): hours × base rate × (1 + burden)', () => {
  const rates = [{ id: 'r1', trade: 'drywall_installer', name: 'Montador', base_rate_hour: 20, burden_pct: 112, valid_from: '2026-01-01' }]
  const r = priceLabor(
    [{ trade: 'drywall_installer', hours: 0.5, base: 'm2' }, { trade: 'taper', hours: 0.1, base: 'm2' }],
    { m2: 100, m: 0, un: 0 }, rates, '2026-10-06')
  assert.equal(money(r.total), 2120)   // 50 h × 20 × 2.12
  assert.deepEqual(r.missing, ['taper'])
})

test('directOf(): sums buckets over items', () => {
  const d = directOf([
    { quantity: 1284.6, material_unit_cost: 58.4, labor_unit_cost: 31.2, equipment_unit_cost: 0, subcontract_unit_cost: 0 },
    { quantity: 214, material_unit_cost: 18.5, labor_unit_cost: 9.2, equipment_unit_cost: 0, subcontract_unit_cost: 0 },
  ])
  assert.equal(money(d.material), money(1284.6 * 58.4 + 214 * 18.5))
  assert.equal(money(d.labor), money(1284.6 * 31.2 + 214 * 9.2))
})
