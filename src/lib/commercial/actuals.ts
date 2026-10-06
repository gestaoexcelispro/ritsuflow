// Estimate vs. actual on a converted project, from what FieldOp records:
//   * hours worked: check-in / check-out sessions (field_attendance_sessions);
//   * quantities produced: daily report production, per FieldOp activity, linked to the RitsuScope
//     item through takeoff_layers.scope_activity_id;
//   * materials received: daily report materials (movement "received").
// RitsuFlow has no actual costs in money, so the comparison is in progress, hours and quantities,
// with earned value (baseline direct cost × progress) as the money view.
import type { createClient } from '@/lib/supabase/client'
import type { ItemRow } from './estimates'
import { normUnit } from './pricing'

type Supabase = ReturnType<typeof createClient>

export type Actuals = {
  /** Hours from check-in / check-out sessions. */
  attendanceHours: number
  /** Quantity produced per takeoff layer (through its FieldOp activity). */
  producedByLayer: Map<string, number>
  /** Materials received, by name + unit. */
  received: { name: string; unit: string; qty: number }[]
  reportCount: number
}

export async function loadActuals(supabase: Supabase, projectId: string): Promise<Actuals> {
  const [att, reports, layers] = await Promise.all([
    supabase.from('field_attendance_sessions').select('worked_minutes').eq('project_id', projectId),
    supabase.from('daily_reports').select('id').eq('project_id', projectId),
    supabase.from('takeoff_layers').select('id, scope_activity_id').eq('project_id', projectId).not('scope_activity_id', 'is', null),
  ])
  for (const r of [att, reports, layers]) if (r.error) throw new Error(r.error.message)
  const attendanceHours = ((att.data || []) as { worked_minutes: number | null }[]).reduce((s, x) => s + (Number(x.worked_minutes) || 0), 0) / 60
  const reportIds = ((reports.data || []) as { id: string }[]).map(r => r.id)

  const producedByActivity = new Map<string, number>()
  const received = new Map<string, { name: string; unit: string; qty: number }>()
  if (reportIds.length) {
    const [prod, mats] = await Promise.all([
      supabase.from('daily_report_production').select('fieldop_activity_id, actual_quantity').in('daily_report_id', reportIds).not('fieldop_activity_id', 'is', null),
      supabase.from('daily_report_materials').select('material_name, unit, quantity, movement_type').in('daily_report_id', reportIds),
    ])
    if (prod.error) throw new Error(prod.error.message)
    if (mats.error) throw new Error(mats.error.message)
    for (const p of (prod.data || []) as { fieldop_activity_id: string; actual_quantity: number | null }[]) {
      producedByActivity.set(p.fieldop_activity_id, (producedByActivity.get(p.fieldop_activity_id) || 0) + (Number(p.actual_quantity) || 0))
    }
    for (const m of (mats.data || []) as { material_name: string | null; unit: string | null; quantity: number | null; movement_type: string | null }[]) {
      if ((m.movement_type || 'received') !== 'received' || !m.material_name) continue
      const key = `${m.material_name.trim().toLowerCase()}|${normUnit(m.unit || '')}`
      const cur = received.get(key) || { name: m.material_name.trim(), unit: m.unit || '', qty: 0 }
      cur.qty += Number(m.quantity) || 0
      received.set(key, cur)
    }
  }
  const producedByLayer = new Map<string, number>()
  for (const l of (layers.data || []) as { id: string; scope_activity_id: string }[]) {
    const q = producedByActivity.get(l.scope_activity_id)
    if (q != null) producedByLayer.set(l.id, q)
  }
  return { attendanceHours, producedByLayer, received: [...received.values()], reportCount: reportIds.length }
}

export type ItemProgress = {
  id: string
  description: string
  unit: string
  estimatedQty: number
  producedQty: number | null
  /** 0–100, capped; null when the item has no link to FieldOp production. */
  progress: number | null
  direct: number
  earned: number
  estimatedHours: number
  earnedHours: number
}

export type Comparison = {
  items: ItemProgress[]
  /** Progress weighted by direct cost, over the items that report production. */
  progress: number | null
  direct: number
  earned: number
  estimatedHours: number
  earnedHours: number
  actualHours: number
  /** earned hours ÷ actual hours: above 1 the crews produce faster than estimated. */
  productivity: number | null
  /** Items with no FieldOp link (their progress is unknown). */
  unlinked: number
  materials: { name: string; unit: string; estimated: number; received: number }[]
}

const scaleOf = (it: ItemRow) => (it.breakdown?.takeoffQuantity ? it.quantity / it.breakdown.takeoffQuantity : 1)

export function compare(items: ItemRow[], a: Actuals): Comparison {
  const rows: ItemProgress[] = items.map(it => {
    const direct = it.quantity * (it.material_unit_cost + it.labor_unit_cost + it.equipment_unit_cost + it.subcontract_unit_cost)
    const estimatedHours = (it.breakdown?.labor || []).reduce((s, l) => s + l.qty, 0) * scaleOf(it)
    const produced = it.takeoff_layer_id ? a.producedByLayer.get(it.takeoff_layer_id) ?? null : null
    const progress = produced == null ? null : it.quantity > 0 ? Math.min(100, (produced / it.quantity) * 100) : 100
    const f = (progress ?? 0) / 100
    return { id: it.id, description: it.description, unit: it.unit, estimatedQty: it.quantity, producedQty: produced, progress, direct, earned: direct * f, estimatedHours, earnedHours: estimatedHours * f }
  })
  const linked = rows.filter(r => r.progress != null)
  const linkedDirect = linked.reduce((s, r) => s + r.direct, 0)
  const sum = (k: 'direct' | 'earned' | 'estimatedHours' | 'earnedHours') => rows.reduce((s, r) => s + r[k], 0)
  const earnedHours = sum('earnedHours')

  const estMats = new Map<string, { name: string; unit: string; estimated: number }>()
  for (const it of items) for (const m of it.breakdown?.materials || []) {
    const key = `${m.label.trim().toLowerCase()}|${normUnit(m.unit)}`
    const cur = estMats.get(key) || { name: m.label, unit: m.unit, estimated: 0 }
    cur.estimated += m.qty * scaleOf(it)
    estMats.set(key, cur)
  }
  const receivedBy = new Map(a.received.map(r => [`${r.name.trim().toLowerCase()}|${normUnit(r.unit)}`, r]))
  const keys = new Set([...estMats.keys(), ...receivedBy.keys()])
  const materials = [...keys].map(k => {
    const e = estMats.get(k), r = receivedBy.get(k)
    return { name: e?.name || r!.name, unit: e?.unit || r!.unit, estimated: e?.estimated || 0, received: r?.qty || 0 }
  }).sort((x, y) => y.estimated - x.estimated || x.name.localeCompare(y.name))

  return {
    items: rows,
    progress: linkedDirect > 0 ? (linked.reduce((s, r) => s + r.earned, 0) / linkedDirect) * 100 : null,
    direct: sum('direct'),
    earned: sum('earned'),
    estimatedHours: sum('estimatedHours'),
    earnedHours,
    actualHours: a.attendanceHours,
    productivity: a.attendanceHours > 0 && earnedHours > 0 ? earnedHours / a.attendanceHours : null,
    unlinked: rows.length - linked.length,
    materials,
  }
}
