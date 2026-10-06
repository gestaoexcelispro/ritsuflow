// Commercial pricing engine: direct cost → selling price, for Brazil (BDI, TCU) and the USA (markups).
// Pure functions, no database access, so the same code runs in the estimate screen and in tests.
//
//   1. Unit costs per estimate item:
//        material = Σ consumption × unit cost (price book, latest price valid on the pricing date)
//        labor    = Σ hours × base rate × (1 + burden%)        (labor lines on the RitsuScope recipe)
//   2. Add-on lines, in order:
//        percent lines add (base × rate) to the running subtotal; base = one bucket of the direct
//        cost (direct, material, labor, equipment, subcontract) or the running subtotal;
//        divisor lines (taxes on the selling price) are summed and applied last:
//          price = subtotal / (1 − ΣI)
//      Brazil's TCU formula BDI = [(1+AC+S+R+G)(1+DF)(1+L)/(1−I)] − 1 is AC, S, G, R on `direct`,
//      DF and L on `subtotal`, PIS/COFINS/ISS/CPRB as `divisor`.

export type CostBucket = 'material' | 'labor' | 'equipment' | 'subcontract'
export type AppliesTo = 'direct' | CostBucket | 'subtotal'
export type LineMethod = 'percent' | 'divisor'

export type PricingLine = {
  key: string
  label: string
  applies_to: AppliesTo
  method: LineMethod
  /** Percent: 4 = 4%. */
  rate: number
}

export type DirectCost = Record<CostBucket, number>

export type PricingStep = {
  key: string
  label: string
  method: LineMethod
  rate: number
  /** Amount this line adds. Divisor lines: their share of the selling price. */
  amount: number
  /** Running subtotal after this line (percent lines only). */
  subtotal: number | null
}

export type PricingResult = {
  direct: number
  steps: PricingStep[]
  /** Subtotal after every percent line, before taxes on price. */
  subtotal: number
  /** Sum of divisor rates, in percent. */
  taxOnPricePct: number
  price: number
  /** price ÷ direct − 1, in percent (the BDI in Brazil). Null when the direct cost is 0. */
  markupPct: number | null
}

export const EMPTY_DIRECT: DirectCost = { material: 0, labor: 0, equipment: 0, subcontract: 0 }

export function directTotal(d: DirectCost): number {
  return d.material + d.labor + d.equipment + d.subcontract
}

/** Rounds money to cents (half away from zero), avoiding binary drift such as 1.005 → 1.00. */
export function money(value: number): number {
  const sign = value < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(value) * 100 + 1e-7)) / 100
}

export class PricingError extends Error {}

/** Applies a template's add-on lines to a direct cost. */
export function applyPricing(direct: DirectCost, lines: PricingLine[]): PricingResult {
  const base = directTotal(direct)
  let subtotal = base
  const steps: PricingStep[] = []
  let taxPct = 0

  for (const line of lines) {
    const rate = Number(line.rate) || 0
    if (rate < 0) throw new PricingError(`Negative rate on "${line.label}"`)
    if (line.method === 'divisor') {
      taxPct += rate
      steps.push({ key: line.key, label: line.label, method: 'divisor', rate, amount: 0, subtotal: null })
      continue
    }
    const on = line.applies_to === 'subtotal' ? subtotal : line.applies_to === 'direct' ? base : direct[line.applies_to]
    const amount = on * (rate / 100)
    subtotal += amount
    steps.push({ key: line.key, label: line.label, method: 'percent', rate, amount, subtotal })
  }

  if (taxPct >= 100) throw new PricingError('Taxes on price add up to 100% or more')
  const price = subtotal / (1 - taxPct / 100)
  // Each divisor line's amount = its share of the selling price.
  for (const s of steps) if (s.method === 'divisor') s.amount = price * (s.rate / 100)

  return {
    direct: base,
    steps,
    subtotal,
    taxOnPricePct: taxPct,
    price,
    markupPct: base > 0 ? (price / base - 1) * 100 : null,
  }
}

// ---------------------------------------------------------------- price book and labor rates

export type Dated = { valid_from: string }

/** The row valid on `onDate` (YYYY-MM-DD): the latest `valid_from` not after it. */
export function effective<T extends Dated>(rows: T[], onDate: string): T | null {
  let best: T | null = null
  for (const r of rows) {
    if (r.valid_from > onDate) continue
    if (!best || r.valid_from > best.valid_from) best = r
  }
  return best
}

export type PriceItem = Dated & {
  id: string
  material_id: string | null
  name: string
  unit: string
  unit_cost: number
}

export type LaborRate = Dated & {
  id: string
  trade: string
  name: string
  base_rate_hour: number
  burden_pct: number
}

/** Consumption of one material for one estimate item (from RitsuScope's recipeMaterials). */
export type MaterialNeed = { materialId?: string | null; mat: string; unit: string; qty: number }

export type PricedLine = { label: string; unit: string; qty: number; unitCost: number; amount: number; sourceId: string | null }

export type PricedPart = { total: number; lines: PricedLine[]; missing: string[] }

const norm = (s: string) => s.trim().toLowerCase()

/** Prices material needs: by catalog product first, then by name + unit. Unpriced needs are reported. */
export function priceMaterials(needs: MaterialNeed[], book: PriceItem[], onDate: string): PricedPart {
  const lines: PricedLine[] = []
  const missing: string[] = []
  for (const n of needs) {
    if (!(n.qty > 0)) continue
    const candidates = n.materialId
      ? book.filter(p => p.material_id === n.materialId)
      : book.filter(p => norm(p.name) === norm(n.mat) && norm(p.unit) === norm(n.unit))
    const hit = effective(candidates, onDate)
    if (!hit) { missing.push(`${n.mat} (${n.unit})`); continue }
    lines.push({ label: n.mat, unit: n.unit, qty: n.qty, unitCost: hit.unit_cost, amount: n.qty * hit.unit_cost, sourceId: hit.id })
  }
  return { total: lines.reduce((s, l) => s + l.amount, 0), lines, missing }
}

export type LaborLine = { trade: string; hours: number; base: 'm2' | 'm' | 'un' }

/** Loaded hourly rate: base × (1 + burden%). */
export function loadedRate(r: LaborRate): number {
  return r.base_rate_hour * (1 + r.burden_pct / 100)
}

/** Prices a recipe's labor lines for an item whose base quantities are given (m², m, units). */
export function priceLabor(laborLines: LaborLine[], baseQty: Record<LaborLine['base'], number>, rates: LaborRate[], onDate: string): PricedPart {
  const lines: PricedLine[] = []
  const missing: string[] = []
  for (const l of laborLines) {
    const hours = (Number(l.hours) || 0) * (baseQty[l.base] || 0)
    if (!(hours > 0)) continue
    const hit = effective(rates.filter(r => r.trade === l.trade), onDate)
    if (!hit) { missing.push(l.trade); continue }
    const rate = loadedRate(hit)
    lines.push({ label: hit.name, unit: 'h', qty: hours, unitCost: rate, amount: hours * rate, sourceId: hit.id })
  }
  return { total: lines.reduce((s, l) => s + l.amount, 0), lines, missing }
}

// ---------------------------------------------------------------- estimate items

export type EstimateItem = {
  quantity: number
  material_unit_cost: number
  labor_unit_cost: number
  equipment_unit_cost: number
  subcontract_unit_cost: number
}

/** Direct cost of a set of estimate items, by bucket. */
export function directOf(items: EstimateItem[]): DirectCost {
  const d = { ...EMPTY_DIRECT }
  for (const it of items) {
    const q = Number(it.quantity) || 0
    d.material += q * (Number(it.material_unit_cost) || 0)
    d.labor += q * (Number(it.labor_unit_cost) || 0)
    d.equipment += q * (Number(it.equipment_unit_cost) || 0)
    d.subcontract += q * (Number(it.subcontract_unit_cost) || 0)
  }
  return d
}

/** Unit cost of an item from the priced total for its whole quantity. */
export function unitCost(total: number, quantity: number): number {
  return quantity > 0 ? total / quantity : 0
}
