// Estimate vs. actual on a converted project, from what FieldOp records (totals read through the
// database function commercial_project_actuals):
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

/**
 * FieldOp totals for the project from public.commercial_project_actuals: anyone who can open the
 * project (and has Commercial) gets the same numbers, without access to the daily reports themselves.
 */
export async function loadActuals(supabase: Supabase, projectId: string): Promise<Actuals> {
  const { data, error } = await supabase.rpc('commercial_project_actuals', { p_project_id: projectId })
  if (error) throw new Error(error.message)
  const d = (data || {}) as { attendance_hours?: number; report_count?: number; produced?: { layer_id: string; qty: number }[]; received?: { name: string; unit: string; qty: number }[] }
  const received = new Map<string, { name: string; unit: string; qty: number }>()
  for (const m of d.received || []) {
    const key = `${m.name.trim().toLowerCase()}|${normUnit(m.unit || '')}`
    const cur = received.get(key) || { name: m.name.trim(), unit: m.unit || '', qty: 0 }
    cur.qty += Number(m.qty) || 0
    received.set(key, cur)
  }
  return {
    attendanceHours: Number(d.attendance_hours) || 0,
    producedByLayer: new Map((d.produced || []).map(p => [p.layer_id, Number(p.qty) || 0])),
    received: [...received.values()],
    reportCount: Number(d.report_count) || 0,
  }
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
