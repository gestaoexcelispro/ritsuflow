// ABC curve (Curva ABC) of an estimate: what makes up the direct cost, largest first, with the
// cumulative share and the class (A up to 80%, B up to 95%, C the rest, by default).
import type { ItemRow } from './estimates'

export type AbcRow = { key: string; label: string; unit: string; bucket: 'material' | 'labor' | 'equipment' | 'subcontract' | 'mixed'; qty: number | null; amount: number; share: number; cumulative: number; cls: 'A' | 'B' | 'C' }

type Acc = { label: string; unit: string; bucket: AbcRow['bucket']; qty: number | null; amount: number }

function classify(list: Acc[], cutA: number, cutB: number): AbcRow[] {
  const total = list.reduce((s, r) => s + r.amount, 0)
  let run = 0
  return [...list].filter(r => r.amount > 0).sort((a, b) => b.amount - a.amount).map((r, i) => {
    const before = run
    run += r.amount
    const share = total > 0 ? (r.amount / total) * 100 : 0
    const cumulative = total > 0 ? (run / total) * 100 : 0
    // A row belongs to the class in which it starts, so the item that crosses 80% is still A.
    const startPct = total > 0 ? (before / total) * 100 : 0
    const cls = startPct < cutA ? 'A' : startPct < cutB ? 'B' : 'C'
    return { key: `${i}-${r.label}`, label: r.label, unit: r.unit, bucket: r.bucket, qty: r.qty, amount: r.amount, share, cumulative, cls }
  })
}

/** ABC of the estimate items (services): each item's quantity × its total unit cost. */
export function abcOfItems(items: ItemRow[], cutA = 80, cutB = 95): AbcRow[] {
  return classify(items.map(i => {
    const unit = i.material_unit_cost + i.labor_unit_cost + i.equipment_unit_cost + i.subcontract_unit_cost
    return { label: i.description, unit: i.unit, bucket: 'mixed' as const, qty: i.quantity, amount: i.quantity * unit }
  }), cutA, cutB)
}

/**
 * ABC of inputs (insumos): materials, labor trades, equipment and subcontracts summed across all
 * items, from each item's priced detail. The part of an item with no detail (manual items, typed
 * unit costs) is kept as the item itself, per cost bucket, so the curve always adds up to the
 * direct cost.
 */
export function abcOfInputs(items: ItemRow[], cutA = 80, cutB = 95): AbcRow[] {
  const acc = new Map<string, Acc>()
  const add = (key: string, a: Acc) => {
    const cur = acc.get(key)
    if (!cur) { acc.set(key, { ...a }); return }
    cur.amount += a.amount
    cur.qty = cur.qty != null && a.qty != null && cur.unit === a.unit ? cur.qty + a.qty : null
  }
  const buckets = [['material', 'material_unit_cost', 'materials'], ['labor', 'labor_unit_cost', 'labor'], ['equipment', 'equipment_unit_cost', 'equipment'], ['subcontract', 'subcontract_unit_cost', 'subcontract']] as const
  for (const it of items) {
    // Detail was priced for the takeoff quantity; scale it to the item's current quantity.
    const scale = it.breakdown?.takeoffQuantity ? it.quantity / it.breakdown.takeoffQuantity : 1
    for (const [bucket, field, detailKey] of buckets) {
      const bucketTotal = it.quantity * (Number(it[field]) || 0)
      const detail = it.breakdown?.[detailKey] || []
      const detailTotal = detail.reduce((s, l) => s + l.amount * scale, 0)
      for (const l of detail) add(`${bucket}|${l.label.toLowerCase()}|${l.unit}`, { label: l.label, unit: l.unit, bucket, qty: l.qty * scale, amount: l.amount * scale })
      // Whatever the detail does not explain (typed or adjusted unit costs) stays with the item.
      const rest = bucketTotal - detailTotal
      if (Math.abs(rest) > 0.005) add(`${bucket}|item|${it.id}`, { label: it.description, unit: it.unit, bucket, qty: null, amount: rest })
    }
  }
  return classify([...acc.values()], cutA, cutB)
}
