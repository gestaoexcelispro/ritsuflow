// Material list of a set of items, as rows for a report: framing layout (profiles in bars,
// boards in sheets, screws), recipe materials and ceiling / floor build-ups. Pure, so the PDF
// report and tests share it. Quantities of typical floors are multiplied in projectMaterials.
import type { TakeoffItem } from './geometry'
import type { MaterialRequirement } from './recipes'
import { framingTotals, packBars, packSheets } from './framing/framing'

export type MaterialKind = 'profile' | 'board' | 'screws' | 'recipe' | 'ceiling' | 'floor'
/** Stock length of ceiling profiles, angles and tracks: 3 m bars (metric), 12 ft (imperial). */
export const STOCK_BAR: Record<string, number> = { m: 3, ft: 12 }

/** Materials of one item / type, for the report (its name and colour head the group). */
export type MaterialGroup = { name: string; color: [number, number, number]; rows: MaterialRow[] }

export type MaterialRow = { mat: string; kind: MaterialKind; qty: number; unit: string; packs: number | null; packName: string | null }

export function materialRows(
  items: TakeoffItem[],
  ptPerM: number,
  extra: { recipe: MaterialRequirement[]; ceiling: MaterialRequirement[]; floor: MaterialRequirement[] },
  units: { bars: string; sheets: string; un: string },
  fmt: (v: number) => string,
  /** Name of the stock bar a ceiling profile is bought in ("3 m bars"); ceiling profiles in m / ft get a bar count. */
  barName?: (len: number, unit: string) => string,
): MaterialRow[] {
  const rows: MaterialRow[] = []
  if (ptPerM > 0) {
    const T = framingTotals(items, ptPerM)
    for (const g of T.prof.values()) {
      const p = packBars(g.pieces, g.bars)
      for (const [len, n] of Object.entries(p.byLen)) rows.push({ mat: `${g.name} · ${fmt(Number(len))} m`, kind: 'profile', qty: n, unit: units.bars, packs: null, packName: null })
    }
    for (const g of T.boards.values()) {
      const p = packSheets(g.pieces, g.W, g.H)
      if (p.count > 0) rows.push({ mat: `${g.name} · ${fmt(g.W)} × ${fmt(g.H)} m`, kind: 'board', qty: p.count, unit: units.sheets, packs: null, packName: null })
    }
    for (const [name, n] of T.screws) rows.push({ mat: name, kind: 'screws', qty: Math.ceil(n), unit: units.un, packs: null, packName: null })
  }
  const add = (list: MaterialRequirement[], kind: MaterialKind) => {
    for (const m of list) {
      if (!(m.qty > 0)) continue
      const bar = kind === 'ceiling' && barName && m.packs == null ? STOCK_BAR[m.unit] : undefined
      rows.push(bar
        ? { mat: m.mat, kind, qty: m.qty, unit: m.unit, packs: Math.ceil(m.qty / bar - 1e-9), packName: barName!(bar, m.unit) }
        : { mat: m.mat, kind, qty: m.qty, unit: m.unit, packs: m.packs, packName: m.packName })
    }
  }
  add(extra.recipe, 'recipe')
  add(extra.ceiling, 'ceiling')
  add(extra.floor, 'floor')
  return rows
}

/** Project total: the same material (name, kind, unit) summed over the sheets, each × its floors. */
export function projectMaterials(sheets: { rows: MaterialRow[]; multiplier: number }[]): MaterialRow[] {
  const by = new Map<string, MaterialRow>()
  for (const s of sheets) {
    const m = Math.max(1, s.multiplier || 1)
    for (const r of s.rows) {
      const key = `${r.kind}|${r.mat}|${r.unit}`
      const cur = by.get(key)
      if (cur) {
        cur.qty += r.qty * m
        cur.packs = cur.packs == null && r.packs == null ? null : (cur.packs || 0) + (r.packs || 0) * m
      } else by.set(key, { ...r, qty: r.qty * m, packs: r.packs == null ? null : r.packs * m })
    }
  }
  return [...by.values()]
}

/** Project total per type: groups with the same name merged over the sheets, each × its floors. */
export function projectMaterialGroups(sheets: { groups: MaterialGroup[]; multiplier: number }[]): MaterialGroup[] {
  const order: string[] = []
  const by = new Map<string, { color: MaterialGroup['color']; parts: { rows: MaterialRow[]; multiplier: number }[] }>()
  for (const s of sheets) for (const g of s.groups) {
    if (!by.has(g.name)) { by.set(g.name, { color: g.color, parts: [] }); order.push(g.name) }
    by.get(g.name)!.parts.push({ rows: g.rows, multiplier: s.multiplier })
  }
  return order.map(name => ({ name, color: by.get(name)!.color, rows: projectMaterials(by.get(name)!.parts) }))
}

/**
 * A type's materials scaled to the part of it in one location. Whole units (bars, sheets, pieces…)
 * are rounded up per location, so the locations can add up to a little more than the project total.
 */
export function scaleGroup(g: MaterialGroup, fraction: number): MaterialGroup {
  return {
    ...g,
    rows: g.rows.map(r => {
      const whole = Number.isInteger(r.qty)
      const qty = whole ? Math.ceil(r.qty * fraction - 1e-9) : r.qty * fraction
      return { ...r, qty, packs: r.packs == null ? null : Math.ceil(r.packs * fraction - 1e-9) }
    }).filter(r => r.qty > 0),
  }
}
