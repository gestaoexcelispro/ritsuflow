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
  /**
   * 'material': part of a separate BDI applied to material only (Brazil, "BDI diferenciado").
   * When any line has it, the other lines apply to labor, equipment and subcontract only.
   */
  group?: 'material' | null
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

/**
 * Applies the add-on lines, with a separate set for materials when some lines are marked
 * group 'material' (BDI diferenciado): material is priced with those lines, everything else with
 * the rest, and the two prices are added. Steps come back in the order of `lines`.
 */
export function priceWithLines(direct: DirectCost, lines: PricingLine[]): PricingResult {
  const matLines = lines.filter(l => l.group === 'material')
  if (!matLines.length) return applyPricing(direct, lines)
  const svcLines = lines.filter(l => l.group !== 'material')
  const m = applyPricing({ ...EMPTY_DIRECT, material: direct.material }, matLines)
  const s = applyPricing({ ...direct, material: 0 }, svcLines)
  const byKey = new Map([...m.steps, ...s.steps].map(x => [x.key, x]))
  const base = directTotal(direct)
  const price = m.price + s.price
  return {
    direct: base,
    steps: lines.map(l => byKey.get(l.key)!).filter(Boolean),
    subtotal: m.subtotal + s.subtotal,
    taxOnPricePct: s.taxOnPricePct,
    price,
    markupPct: base > 0 ? (price / base - 1) * 100 : null,
  }
}

/**
 * Selling factors for unit prices with BDI: material and services (labor, equipment, subcontract)
 * get their own factor when there is a material BDI; otherwise both are price ÷ direct.
 */
export function sellingFactors(direct: DirectCost, lines: PricingLine[]): { material: number; services: number } {
  const total = directTotal(direct)
  if (!lines.some(l => l.group === 'material')) {
    const f = total > 0 ? applyPricing(direct, lines).price / total : 1
    return { material: f, services: f }
  }
  const services = direct.labor + direct.equipment + direct.subcontract
  const m = applyPricing({ ...EMPTY_DIRECT, material: direct.material }, lines.filter(l => l.group === 'material'))
  const s = applyPricing({ ...direct, material: 0 }, lines.filter(l => l.group !== 'material'))
  return { material: direct.material > 0 ? m.price / direct.material : 1, services: services > 0 ? s.price / services : 1 }
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

const UNIT_ALIASES: Record<string, string> = {
  'm²': 'm2', 'm^2': 'm2', 'm³': 'm3', 'm^3': 'm3', 'ml': 'm', 'mt': 'm',
  'und': 'un', 'unid': 'un', 'unid.': 'un', 'pç': 'un', 'pc': 'un', 'pç.': 'un', 'peça': 'un', 'ea': 'un', 'each': 'un', 'pcs': 'un', 'u': 'un',
}

/** Unit as compared for pricing: lower case, "m²" = "m2", "pç" / "und" / "ea" = "un". */
export function normUnit(u: string): string {
  const k = norm(u)
  return UNIT_ALIASES[k] || k
}

/** Prices material needs: by catalog product first, then by name + unit. Unpriced needs are reported. */
export function priceMaterials(needs: MaterialNeed[], book: PriceItem[], onDate: string): PricedPart {
  const lines: PricedLine[] = []
  const missing: string[] = []
  for (const n of needs) {
    if (!(n.qty > 0)) continue
    const candidates = n.materialId
      ? book.filter(p => p.material_id === n.materialId)
      : book.filter(p => norm(p.name) === norm(n.mat) && normUnit(p.unit) === normUnit(n.unit))
    const hit = effective(candidates, onDate)
    if (!hit) { missing.push(`${n.mat} (${n.unit})`); continue }
    lines.push({ label: n.mat, unit: n.unit, qty: n.qty, unitCost: hit.unit_cost, amount: n.qty * hit.unit_cost, sourceId: hit.id })
  }
  return { total: lines.reduce((s, l) => s + l.amount, 0), lines, missing }
}

/**
 * Prices groups of alternatives: each group is one product that can be bought in more than one
 * unit (a stud by the bar or by the metre; a board by the sheet or by m²). The first alternative
 * with a price wins; a group with none is reported once, by its first alternative.
 */
export function priceNeedGroups(groups: MaterialNeed[][], book: PriceItem[], onDate: string): PricedPart {
  const lines: PricedLine[] = []
  const missing: string[] = []
  for (const options of groups) {
    const usable = options.filter(o => o.qty > 0)
    if (!usable.length) continue
    let hit: PricedPart | null = null
    for (const o of usable) {
      const r = priceMaterials([o], book, onDate)
      if (r.lines.length) { hit = r; break }
    }
    if (hit) lines.push(...hit.lines)
    else missing.push(`${usable[0].mat} (${usable[0].unit})`)
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
