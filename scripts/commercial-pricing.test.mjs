// Tests for the Commercial pricing engine. Run: npm run test:commercial (Node 22.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPricing, directOf, effective, money, normUnit, priceLabor, priceMaterials, priceNeedGroups, PricingError,
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

test('normUnit(): common spellings compare equal', () => {
  assert.equal(normUnit('m²'), 'm2')
  assert.equal(normUnit(' Pç '), 'un')
  assert.equal(normUnit('EA'), 'un')
  assert.equal(normUnit('kg'), 'kg')
})

test('priceNeedGroups(): first alternative with a price wins', () => {
  const book = [
    { id: 'm1', material_id: null, name: 'Montante 48', unit: 'm', unit_cost: 6, valid_from: '2026-01-01' },
    { id: 'b1', material_id: null, name: 'Chapa ST', unit: 'pç', unit_cost: 40, valid_from: '2026-01-01' },
  ]
  const r = priceNeedGroups([
    [{ mat: 'Montante 48', unit: 'un', qty: 10 }, { mat: 'Montante 48', unit: 'm', qty: 30 }],
    [{ mat: 'Chapa ST', unit: 'un', qty: 5 }, { mat: 'Chapa ST', unit: 'm2', qty: 14.4 }],
    [{ mat: 'Parafuso TA', unit: 'un', qty: 300 }],
  ], book, '2026-10-06')
  assert.equal(money(r.total), 180 + 200)
  assert.deepEqual(r.missing, ['Parafuso TA (un)'])
})

test('proposal: lines, defaults and the selling factor', async () => {
  const { lines, readProposal, sellingFactor } = await import('../src/lib/commercial/proposal.ts')
  assert.deepEqual(lines('- Drywall walls\n\n• Ceilings \n*Joints'), ['Drywall walls', 'Ceilings', 'Joints'])
  const p = readProposal({ scope: 'x', validityDays: 'bad', showItems: false })
  assert.equal(p.scope, 'x'); assert.equal(p.validityDays, 30); assert.equal(p.showItems, false); assert.equal(p.showBuildUp, false)
  assert.equal(money(294365.11 * sellingFactor(294365.11, 381320.54)), 381320.54)
  assert.equal(sellingFactor(0, 10), 1)
})

test('CSV import: Portuguese Excel file with semicolons', async () => {
  const { readPriceCsv, parseMoney, parseDate, priceTemplateCsv } = await import('../src/lib/commercial/csvImport.ts')
  const csv = '﻿Código;Nome;Unidade;Preço unitário;Fornecedor;Tipo;Vigência\nCH-1;Chapa ST 12,5 mm;m2;R$ 1.022,90;Forn A;Material;01/10/2026\n;"Montante 48; galv.";m;6,10;;Equipamento;\n;Sem preço;un;abc;;;\n'
  const r = readPriceCsv(csv, true)
  assert.deepEqual(r.missingColumns, [])
  assert.equal(r.rows.length, 2)
  assert.equal(r.rows[0].unitCost, 1022.9); assert.equal(r.rows[0].validFrom, '2026-10-01'); assert.equal(r.rows[0].code, 'CH-1')
  assert.equal(r.rows[1].name, 'Montante 48; galv.'); assert.equal(r.rows[1].kind, 'equipment'); assert.equal(r.rows[1].validFrom, null)
  assert.deepEqual(r.errors, [{ line: 4, reason: 'cost' }])
  assert.equal(parseMoney('$1,234.50'), 1234.5)
  assert.equal(parseDate('10/01/2026', false), '2026-10-01')
  assert.equal(parseDate('31/02/2026x', true), null)
  for (const lang of ['pt-BR', 'en-US', 'es']) {
    const t = readPriceCsv(priceTemplateCsv(lang), lang !== 'en-US')
    assert.equal(t.rows.length, 2, lang); assert.deepEqual(t.errors, [], lang)
  }
})

test('CSV import: reports missing required columns', async () => {
  const { readPriceCsv } = await import('../src/lib/commercial/csvImport.ts')
  assert.deepEqual(readPriceCsv('Name,Price\nA,1\n', false).missingColumns, ['unit'])
})

test('BDI diferenciado: material priced with its own lines, the rest with the main lines', async () => {
  const { priceWithLines } = await import('../src/lib/commercial/pricing.ts')
  const d = { material: 60000, labor: 40000, equipment: 0, subcontract: 0 }
  const lines = [
    { key: 'ac', label: 'AC', applies_to: 'direct', method: 'percent', rate: 4 },
    { key: 'l', label: 'L', applies_to: 'subtotal', method: 'percent', rate: 7.4 },
    { key: 'iss', label: 'ISS', applies_to: 'subtotal', method: 'divisor', rate: 5 },
    { key: 'mac', label: 'AC mat', applies_to: 'direct', method: 'percent', rate: 2, group: 'material' },
    { key: 'ml', label: 'L mat', applies_to: 'subtotal', method: 'percent', rate: 3, group: 'material' },
  ]
  const r = priceWithLines(d, lines)
  const mat = 60000 * 1.02 * 1.03
  const svc = (40000 * 1.04 * 1.074) / 0.95
  assert.equal(money(r.price), money(mat + svc))
  assert.deepEqual(r.steps.map(s => s.key), ['ac', 'l', 'iss', 'mac', 'ml'])
  // Without material lines it is the plain engine.
  assert.equal(priceWithLines(d, lines.slice(0, 3)).price, applyPricing(d, lines.slice(0, 3)).price)
})

test('sellingFactors(): unit prices add up to the selling price, with and without material BDI', async () => {
  const { sellingFactors, priceWithLines } = await import('../src/lib/commercial/pricing.ts')
  const d = { material: 60000, labor: 30000, equipment: 6000, subcontract: 4000 }
  for (const lines of [BR_TCU, [...BR_TCU, { key: 'm', label: 'M', applies_to: 'direct', method: 'percent', rate: 12, group: 'material' }]]) {
    const f = sellingFactors(d, lines)
    assert.equal(money(d.material * f.material + (d.labor + d.equipment + d.subcontract) * f.services), money(priceWithLines(d, lines).price))
  }
})

test('ABC curve: classes, cumulative share and totals', async () => {
  const { abcOfItems, abcOfInputs } = await import('../src/lib/commercial/abc.ts')
  const item = (id, desc, q, m, l, breakdown = {}) => ({ id, description: desc, unit: 'm2', quantity: q, material_unit_cost: m, labor_unit_cost: l, equipment_unit_cost: 0, subcontract_unit_cost: 0, breakdown })
  const items = [item('a', 'Walls', 100, 50, 20), item('b', 'Ceilings', 50, 30, 10), item('c', 'Trims', 10, 5, 5), item('d', 'Doors', 2, 100, 0)]
  const r = abcOfItems(items)
  assert.deepEqual(r.map(x => x.label), ['Walls', 'Ceilings', 'Doors', 'Trims'])
  assert.deepEqual(r.map(x => x.cls), ['A', 'A', 'C', 'C']) // Ceilings starts at 75% (crosses 80%), so it is still A
  assert.equal(Math.round(r.at(-1).cumulative), 100)
  const withDetail = [item('w', 'Walls', 200, 50, 20, {
    takeoffQuantity: 100,
    materials: [{ label: 'Board', unit: 'm2', qty: 210, unitCost: 20, amount: 4200 }, { label: 'Stud', unit: 'm', qty: 300, unitCost: 2, amount: 600 }],
    labor: [{ label: 'Installer', unit: 'h', qty: 40, unitCost: 50, amount: 2000 }],
  })]
  const inputs = abcOfInputs(withDetail)
  const total = inputs.reduce((s, x) => s + x.amount, 0)
  assert.equal(money(total), money(200 * (50 + 20)))
  assert.equal(inputs[0].label, 'Board'); assert.equal(inputs[0].amount, 8400)
  assert.ok(inputs.some(x => x.label === 'Walls' && x.bucket === 'material'))
})

test('insights: win rate by client, markup of won vs lost, month grid', async () => {
  const { clientStats, markupStats, monthGrid } = await import('../src/lib/commercial/insights.ts')
  const bid = (id, client, status) => ({ project_id: id, status, projects: { client_name: client } })
  const bids = [bid('1', 'Horizonte', 'won'), bid('2', 'horizonte ', 'lost'), bid('3', 'Horizonte', 'submitted'), bid('4', '', 'lost'), bid('5', 'CG', 'won')]
  const est = (id, direct, price) => [id, { project_id: id, revision: 0, direct_total: direct, price_total: price, currency_code: 'BRL' }]
  const latest = new Map([est('1', 100, 125), est('2', 100, 135), est('4', 100, 140), est('5', 200, 240)])
  const s = clientStats(bids, latest, 'No client')
  assert.equal(s[0].client, 'Horizonte'); assert.equal(s[0].bids, 3); assert.equal(s[0].open, 1); assert.equal(s[0].winRate, 50)
  assert.equal(s[0].wonValue.get('BRL'), 125)
  assert.ok(s.some(x => x.client === 'No client' && x.winRate === 0))
  const m = markupStats(bids, latest)
  assert.equal(m.won, 22.5); assert.equal(m.lost, 37.5)
  const g = monthGrid(2026, 9) // October 2026 starts on a Thursday
  assert.deepEqual(g[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  assert.equal(g.flat().filter(Boolean).length, 31)
})

test('loss reasons: counted over lost and declined bids, unrecorded last', async () => {
  const { lossReasons } = await import('../src/lib/commercial/insights.ts')
  const b = (status, outcome_reason = null) => ({ status, outcome_reason })
  const r = lossReasons([b('lost', 'price'), b('lost', 'price'), b('no_bid', 'capacity'), b('lost'), b('won'), b('submitted')])
  assert.deepEqual(r.map(x => [x.reason, x.count]), [['price', 2], ['capacity', 1], ['unknown', 1]])
  assert.equal(r[0].share, 50)
})

test('estimate vs actual: progress, earned value, hours and materials', async () => {
  const { compare } = await import('../src/lib/commercial/actuals.ts')
  const item = (id, layer, qty, m, l, breakdown) => ({ id, description: id, unit: 'm2', quantity: qty, takeoff_layer_id: layer, material_unit_cost: m, labor_unit_cost: l, equipment_unit_cost: 0, subcontract_unit_cost: 0, breakdown })
  const items = [
    item('walls', 'L1', 100, 40, 20, { takeoffQuantity: 100, labor: [{ label: 'Installer', unit: 'h', qty: 50, unitCost: 40, amount: 2000 }], materials: [{ label: 'Chapa ST', unit: 'm2', qty: 210, unitCost: 19, amount: 3990 }] }),
    item('ceiling', 'L2', 50, 30, 10, { takeoffQuantity: 50, labor: [{ label: 'Installer', unit: 'h', qty: 10, unitCost: 50, amount: 500 }] }),
    item('manual', null, 1, 1000, 0, {}),
  ]
  const actuals = { attendanceHours: 20, producedByLayer: new Map([['L1', 40], ['L2', 60]]), received: [{ name: 'chapa st', unit: 'm²', qty: 100 }, { name: 'Fita', unit: 'm', qty: 5 }], reportCount: 3 }
  const c = compare(items, actuals)
  assert.equal(c.items[0].progress, 40); assert.equal(c.items[1].progress, 100); assert.equal(c.items[2].progress, null)
  assert.equal(c.earned, 6000 * 0.4 + 2000)                 // walls 40% of 6000, ceiling 100% of 2000
  assert.equal(c.estimatedHours, 60); assert.equal(c.earnedHours, 20 + 10)
  assert.equal(c.productivity, 30 / 20)
  assert.equal(c.unlinked, 1)
  assert.equal(Math.round(c.progress * 100) / 100, Math.round((4400 / 8000) * 10000) / 100)
  assert.deepEqual(c.materials.map(m => [m.name, m.estimated, m.received]), [['Chapa ST', 210, 100], ['Fita', 0, 5]])
})

// ---------------------------------------------------------------- phase 4: alternates, allowances, actual costs
import { inPrice, sellingPrices, totalsOf } from '../src/lib/commercial/estimates.ts'
import { costPerformance, costVariance, readCostCsv, categoryOf } from '../src/lib/commercial/costs.ts'
import { appendClause } from '../src/lib/commercial/clauses.ts'
import { typeStats } from '../src/lib/commercial/insights.ts'

const item = (id, kind, q, mat, lab, extra = {}) => ({
  id, estimate_id: 'e', project_id: 'p', sort_order: 0, source: 'manual', takeoff_layer_id: null, recipe_id: null,
  description: id, unit: 'm2', quantity: q, quantity_overridden: false, material_unit_cost: mat, labor_unit_cost: lab,
  equipment_unit_cost: 0, subcontract_unit_cost: 0, breakdown: {}, notes: null, kind, organization_work_package_id: null, ...extra,
})

test('alternates stay out of the price; allowances stay in', () => {
  const lines = [{ key: 'm', label: 'Markup', applies_to: 'direct', method: 'percent', rate: 20 }]
  const items = [item('a', 'base', 10, 5, 5), item('b', 'allowance', 1, 100, 0), item('c', 'alternate', 2, 10, 0)]
  assert.deepEqual(inPrice(items).map(i => i.id), ['a', 'b'])
  const t = totalsOf(items, lines)
  assert.equal(t.row.direct_total, 200)
  assert.equal(t.row.price_total, 240)
  const sp = sellingPrices(items, lines)
  assert.equal(sp.get('c'), 24)          // alternate priced with the same markup
  assert.equal(sp.get('a') + sp.get('b'), 240)
  // rows from before item kinds count as base
  assert.equal(inPrice([{ kind: undefined }, { kind: null }]).length, 2)
})

test('cost CSV: Brazilian export with semicolons, item match and categories', () => {
  const csv = 'Data;Histórico;Valor;Natureza;Fornecedor;NF;Item\n06/10/2026;Chapas ST;4.580,00;Material;Forn A;1234;parede DRYWALL\n07/10/2026;Folha;3.200,00;Mão de obra;;;\n32/10/2026;x;1;;;;\n08/10/2026;Devolução;-150,00;material;;;Outra coisa\n'
  const r = readCostCsv(csv, true, [{ id: 'i1', description: 'Parede drywall' }])
  assert.deepEqual(r.missingColumns, [])
  assert.equal(r.rows.length, 3)
  assert.deepEqual(r.errors, [{ line: 4, reason: 'date' }])
  assert.equal(r.rows[0].amount, 4580)
  assert.equal(r.rows[0].itemId, 'i1')
  assert.equal(r.rows[0].incurredOn, '2026-10-06')
  assert.equal(r.rows[1].category, 'labor')
  assert.equal(r.rows[2].amount, -150)
  assert.equal(r.rows[2].itemUnmatched, true)
  assert.deepEqual(readCostCsv('Foo,Bar\n1,2', true, []).missingColumns, ['incurredOn', 'description', 'amount'])
  assert.equal(categoryOf('Subcontrato'), 'subcontract')
})

test('cost variance and earned-value cost performance', () => {
  const items = [item('a', 'base', 10, 10, 5), item('alt', 'alternate', 1, 999, 0)]
  const v = costVariance(items, [
    { estimate_item_id: 'a', category: 'material', amount: 120 },
    { estimate_item_id: null, category: 'labor', amount: 40 },
    { estimate_item_id: null, category: 'other', amount: 10 },
  ])
  assert.equal(v.estimated, 150)
  assert.equal(v.actual, 170)
  assert.equal(v.unlinked, 50)
  assert.equal(v.byItem.get('a'), 120)
  assert.deepEqual(v.byCategory.map(c => c.category), ['material', 'labor', 'other'])
  assert.deepEqual(costPerformance(100, 0), { cpi: null, cv: null })
  const p = costPerformance(120, 100)
  assert.equal(p.cpi, 1.2)
  assert.equal(p.cv, 20)
})

test('clause library appends once', () => {
  assert.equal(appendClause('', 'Taxas'), 'Taxas')
  assert.equal(appendClause('- Licenças\n', 'Taxas'), '- Licenças\nTaxas')
  assert.equal(appendClause('• Taxas', 'Taxas'), '• Taxas')
})

test('win rate by project type', () => {
  const b = (id, status, type) => ({ project_id: id, status, project_type: type, projects: null })
  const rows = typeStats([b('1', 'won', 'industrial'), b('2', 'lost', 'industrial'), b('3', 'draft', null), b('4', 'won', 'residential')], new Map(), k => k.toUpperCase())
  assert.equal(rows[rows.length - 1].type, 'none')
  const ind = rows.find(r => r.type === 'industrial')
  assert.equal(ind.winRate, 50)
  assert.equal(ind.client, 'INDUSTRIAL')
})

test('cost amounts: locale thousands, accounting negatives', async () => {
  const { parseAmount } = await import('../src/lib/commercial/costs.ts')
  assert.equal(parseAmount('4.580', true), 4580)
  assert.equal(parseAmount('1,234', false), 1234)
  assert.equal(parseAmount('1,234', true), 1.234)
  assert.equal(parseAmount('12.50', true), 12.5)
  assert.equal(parseAmount('R$ 1.234,56', true), 1234.56)
  assert.equal(parseAmount('$1,234.56', false), 1234.56)
  assert.equal(parseAmount('(1.234,56)', true), -1234.56)
  assert.equal(parseAmount('1.234,56-', true), -1234.56)
  assert.equal(parseAmount('-150,00', true), -150)
  assert.equal(parseAmount('1.234.567', true), 1234567)
  assert.ok(Number.isNaN(parseAmount('abc', true)))
})
