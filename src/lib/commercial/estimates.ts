// Estimate revisions and their items (Supabase rows), and the refresh from takeoff.
import type { createClient } from '@/lib/supabase/client'
import { applyPricing, directOf, money, priceLabor, priceNeedGroups, unitCost, type LaborRate, type PricedLine, type PriceItem, type PricingLine } from './pricing'
import type { TakeoffLine } from './takeoffEstimate'

type Supabase = ReturnType<typeof createClient>

export type EstimateRow = {
  id: string
  project_id: string
  revision: number
  name: string
  status: 'draft' | 'issued'
  is_baseline: boolean
  currency_code: string
  priced_on: string
  pricing_lines: PricingLine[]
  proposal: Record<string, unknown>
  direct_material: number
  direct_labor: number
  direct_equipment: number
  direct_subcontract: number
  direct_total: number
  price_total: number
  issued_at: string | null
}

export const ESTIMATE_COLUMNS = 'id, project_id, revision, name, status, is_baseline, currency_code, priced_on, pricing_lines, proposal, direct_material, direct_labor, direct_equipment, direct_subcontract, direct_total, price_total, issued_at'

export type Breakdown = { materials?: PricedLine[]; labor?: PricedLine[]; missing?: string[]; takeoffQuantity?: number; framed?: boolean }

export type ItemRow = {
  id: string
  estimate_id: string
  project_id: string
  sort_order: number
  source: 'takeoff' | 'manual'
  takeoff_layer_id: string | null
  recipe_id: string | null
  description: string
  unit: string
  quantity: number
  quantity_overridden: boolean
  material_unit_cost: number
  labor_unit_cost: number
  equipment_unit_cost: number
  subcontract_unit_cost: number
  breakdown: Breakdown
  notes: string | null
}

export const ITEM_COLUMNS = 'id, estimate_id, project_id, sort_order, source, takeoff_layer_id, recipe_id, description, unit, quantity, quantity_overridden, material_unit_cost, labor_unit_cost, equipment_unit_cost, subcontract_unit_cost, breakdown, notes'

/** Totals of a revision from its items and add-on lines (what is cached on the estimate row). */
export function totalsOf(items: ItemRow[], lines: PricingLine[]) {
  const d = directOf(items)
  let price = d.material + d.labor + d.equipment + d.subcontract
  let markupPct: number | null = null
  let problem = ''
  try {
    const r = applyPricing(d, lines)
    price = r.price
    markupPct = r.markupPct
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e)
  }
  const direct = d.material + d.labor + d.equipment + d.subcontract
  return {
    direct: d,
    row: {
      direct_material: money(d.material), direct_labor: money(d.labor), direct_equipment: money(d.equipment),
      direct_subcontract: money(d.subcontract), direct_total: money(direct), price_total: money(price),
    },
    markupPct,
    problem,
  }
}

/** Prices one takeoff line: unit costs per unit of the line's quantity, plus the breakdown kept on the item. */
export function priceTakeoffLine(line: TakeoffLine, book: PriceItem[], rates: LaborRate[], onDate: string) {
  const mats = priceNeedGroups(line.materialGroups, book, onDate)
  const labor = priceLabor(line.laborLines, line.base, rates, onDate)
  return {
    material_unit_cost: unitCost(mats.total, line.quantity),
    labor_unit_cost: unitCost(labor.total, line.quantity),
    breakdown: {
      materials: mats.lines, labor: labor.lines, missing: [...mats.missing, ...labor.missing.map(t => `${t} (h)`)],
      takeoffQuantity: line.quantity, framed: line.framed,
    } satisfies Breakdown,
  }
}

/**
 * Refresh from takeoff: one item per takeoff line. Existing takeoff items are updated (a quantity the
 * estimator typed over is kept), new ones are added, and items whose takeoff line is gone are removed.
 * Manual items are never touched.
 */
export async function refreshFromTakeoff(
  supabase: Supabase, estimate: EstimateRow, current: ItemRow[], lines: TakeoffLine[], book: PriceItem[], rates: LaborRate[],
): Promise<{ added: number; updated: number; removed: number; unpriced: number }> {
  const byLayer = new Map(current.filter(i => i.source === 'takeoff' && i.takeoff_layer_id).map(i => [i.takeoff_layer_id!, i]))
  const seen = new Set<string>()
  let added = 0, updated = 0, unpriced = 0
  const inserts: Record<string, unknown>[] = []
  let order = current.reduce((m, i) => Math.max(m, i.sort_order), 0)
  for (const line of lines) {
    seen.add(line.layerId)
    const priced = priceTakeoffLine(line, book, rates, estimate.priced_on)
    if (priced.breakdown.missing.length) unpriced++
    const existing = byLayer.get(line.layerId)
    const patch = {
      description: line.description, unit: line.unit, recipe_id: line.recipeId,
      material_unit_cost: priced.material_unit_cost, labor_unit_cost: priced.labor_unit_cost, breakdown: priced.breakdown,
    }
    if (existing) {
      const { error } = await supabase.from('commercial_estimate_items')
        .update({ ...patch, ...(existing.quantity_overridden ? {} : { quantity: line.quantity }) }).eq('id', existing.id)
      if (error) throw new Error(error.message)
      updated++
    } else {
      inserts.push({ estimate_id: estimate.id, project_id: estimate.project_id, sort_order: ++order, source: 'takeoff', takeoff_layer_id: line.layerId, quantity: line.quantity, ...patch })
      added++
    }
  }
  if (inserts.length) {
    const { error } = await supabase.from('commercial_estimate_items').insert(inserts)
    if (error) throw new Error(error.message)
  }
  const gone = current.filter(i => i.source === 'takeoff' && (!i.takeoff_layer_id || !seen.has(i.takeoff_layer_id))).map(i => i.id)
  if (gone.length) {
    const { error } = await supabase.from('commercial_estimate_items').delete().in('id', gone)
    if (error) throw new Error(error.message)
  }
  return { added, updated, removed: gone.length, unpriced }
}

/** A new draft revision copied from `from` (its lines, proposal and items). */
export async function newRevision(supabase: Supabase, from: EstimateRow, items: ItemRow[], today: string): Promise<string> {
  const { data, error } = await supabase.from('commercial_estimates').insert({
    project_id: from.project_id, revision: from.revision + 1, name: `Rev ${from.revision + 1}`, currency_code: from.currency_code,
    priced_on: today, pricing_lines: from.pricing_lines, proposal: from.proposal,
    direct_material: from.direct_material, direct_labor: from.direct_labor, direct_equipment: from.direct_equipment,
    direct_subcontract: from.direct_subcontract, direct_total: from.direct_total, price_total: from.price_total,
  }).select('id').single()
  if (error) throw new Error(error.message)
  const id = data.id as string
  if (items.length) {
    const copies = items.map(({ id: _id, estimate_id: _e, ...rest }) => ({ ...rest, estimate_id: id }))
    const { error: e2 } = await supabase.from('commercial_estimate_items').insert(copies)
    if (e2) throw new Error(e2.message)
  }
  return id
}
