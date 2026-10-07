// Tags for everything drawn in a project: one per straight stretch of a wall/line ("DW01-03"),
// one per area (floor, ceiling…: "FLOOR-02") and one per counted point ("RPP-07").
// Numbered automatically per item code across the whole project (sheet order, then drawing order),
// so a tag never repeats; a tag renamed by the user (takeoff_elements.segment_tags) replaces the
// automatic one and keeps its number taken, so renaming one does not renumber the others.

import type { ElementRow, LayerRow } from './rows'

type LayerLike = Pick<LayerRow, 'id' | 'kind' | 'name' | 'sort_order'> & { wall_type_id?: string | null }
type WallTypeLike = { id: string; code?: string | null }

/** Short code from a name: "Floor" → FLOOR, "Reforço para prateleira" → RPP, "Parede detectada 12" → PD12. */
export function nameCode(name: string): string {
  const clean = name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const words = clean.split(/[\s_/]+/).filter(Boolean)
  if (words.length === 1 && /^[\p{L}\d.-]{1,8}$/u.test(words[0])) return words[0].toUpperCase()
  // Numbers and short codes with digits stay whole (12, P1); other words give their first letter.
  const code = words.map(w => (/\d/.test(w) && w.length <= 4 ? w : (w.match(/\p{L}|\d/u)?.[0] || ''))).join('').toUpperCase()
  return code.slice(0, 8)
}

/**
 * Short code for each item: its wall type's code, else the name before " – " (when short), else a code
 * built from the name. Codes built from names are made unique (RPP, RPP2…) so two items never share numbers;
 * items of the same wall type share its code on purpose (one numbering for that type).
 */
export function layerTagPrefixes(layers: LayerLike[], wallTypes: WallTypeLike[]): Map<string, string> {
  const codeOf = new Map(wallTypes.map(w => [w.id, (w.code || '').trim()]))
  const out = new Map<string, string>()
  const taken = new Map<string, string>() // prefix → the layer or wall type that owns it
  let fallback = 0
  for (const l of [...layers].sort((a, b) => a.sort_order - b.sort_order)) {
    const fromType = l.wall_type_id ? codeOf.get(l.wall_type_id) || '' : ''
    if (fromType) { out.set(l.id, fromType); taken.set(fromType, `wt:${l.wall_type_id}`); continue }
    const head = l.name.split(/\s[–—-]\s/)[0].trim()
    let base = head && head !== l.name.trim() && head.length <= 12 && !/\s/.test(head) ? head : nameCode(l.name)
    if (!base) base = `T${++fallback}`
    let p = base
    for (let n = 2; taken.has(p) && taken.get(p) !== l.id; n++) p = `${base}${n}`
    taken.set(p, l.id)
    out.set(l.id, p)
  }
  return out
}

/** Custom tag at an index (segment for lines; 0 for areas and counts), or null for the automatic one. */
export function customTag(e: Pick<ElementRow, 'segment_tags'>, i: number): string | null {
  const v = Array.isArray(e.segment_tags) ? e.segment_tags[i] : null
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export type ElementTags = { tags: string[]; auto: string[] }

/** How many tags an element has: one per segment for lines, one for an area or a counted point. */
export function tagSlots(kind: LayerRow['kind'], points: unknown[]): number {
  if (!Array.isArray(points) || !points.length) return 0
  if (kind === 'linear') return Math.max(0, points.length - 1)
  if (kind === 'area') return points.length >= 3 ? 1 : 0
  return 1
}

/**
 * Tags of every element: element id → final tag and automatic tag per slot (see tagSlots).
 * `sourceOrder` lists sheet ids in their display order; elements keep their drawing order inside a sheet.
 */
export function computeSegmentTags(elements: ElementRow[], layers: LayerLike[], wallTypes: WallTypeLike[], sourceOrder: string[]): Map<string, ElementTags> {
  const prefix = layerTagPrefixes(layers, wallTypes)
  const kindOf = new Map(layers.map(l => [l.id, l.kind]))
  const sheetRank = new Map(sourceOrder.map((id, i) => [id, i]))
  const ordered = elements
    .filter(e => prefix.has(e.layer_id) && tagSlots(kindOf.get(e.layer_id)!, e.points) > 0)
    .map((e, i) => ({ e, i, slots: tagSlots(kindOf.get(e.layer_id)!, e.points) }))
    .sort((a, b) =>
      (sheetRank.get(a.e.source_id) ?? 1e9) - (sheetRank.get(b.e.source_id) ?? 1e9)
      || String(a.e.created_at || '').localeCompare(String(b.e.created_at || ''))
      || a.i - b.i)
  // Count first, so numbers are padded the same way for the whole item (01…09 or 001…120).
  const total = new Map<string, number>()
  for (const { e, slots } of ordered) {
    const p = prefix.get(e.layer_id)!
    total.set(p, (total.get(p) || 0) + slots)
  }
  const next = new Map<string, number>()
  const out = new Map<string, ElementTags>()
  for (const { e, slots } of ordered) {
    const p = prefix.get(e.layer_id)!
    const digits = Math.max(2, String(total.get(p) || 0).length)
    const tags: string[] = []
    const auto: string[] = []
    for (let i = 0; i < slots; i++) {
      const n = (next.get(p) || 0) + 1
      next.set(p, n)
      const a = `${p}-${String(n).padStart(digits, '0')}`
      auto.push(a)
      tags.push(customTag(e, i) || a)
    }
    out.set(e.id, { tags, auto })
  }
  return out
}

/** Tag letter of each kind of opening (D / W / O in English, P / J / V in Portuguese). */
export type OpeningTagPrefixes = { door: string; window: string; void: string }

/**
 * Doors, windows and plain openings numbered across the project, per kind (D-01, D-02… W-01…):
 * sheet order, then drawing order, then along each wall. Returns each wall's tags, aligned with its openings.
 */
export function computeOpeningTags(elements: ElementRow[], sourceOrder: string[], prefixes: OpeningTagPrefixes): Map<string, string[]> {
  const sheetRank = new Map(sourceOrder.map((id, i) => [id, i]))
  const kindKey = (k: string) => (k === 'door' || k === 'window' ? k : 'void') as keyof OpeningTagPrefixes
  const ordered = elements
    .map((e, i) => ({ e, i }))
    .filter(x => Array.isArray(x.e.openings) && x.e.openings.length > 0)
    .sort((a, b) =>
      (sheetRank.get(a.e.source_id) ?? 1e9) - (sheetRank.get(b.e.source_id) ?? 1e9)
      || String(a.e.created_at || '').localeCompare(String(b.e.created_at || ''))
      || a.i - b.i)
  const total = { door: 0, window: 0, void: 0 }
  for (const { e } of ordered) for (const o of e.openings) total[kindKey(o.kind)]++
  const next = { door: 0, window: 0, void: 0 }
  const out = new Map<string, string[]>()
  for (const { e } of ordered) {
    const tags: string[] = new Array(e.openings.length).fill('')
    // Along the wall from its first point.
    const byOffset = e.openings.map((o, idx) => ({ o, idx })).sort((a, b) => a.o.off - b.o.off)
    for (const { o, idx } of byOffset) {
      const k = kindKey(o.kind)
      next[k]++
      tags[idx] = `${prefixes[k]}-${String(next[k]).padStart(Math.max(2, String(total[k]).length), '0')}`
    }
    out.set(e.id, tags)
  }
  return out
}

/** Elements with their final tags attached (`tag_labels`, `tag_auto`, `opening_tags`), for rowsToItems. */
export function withSegmentTags(elements: ElementRow[], tags: Map<string, ElementTags>, openingTags?: Map<string, string[]>): ElementRow[] {
  return elements.map(e => {
    const t = tags.get(e.id)
    const o = openingTags?.get(e.id)
    if (!t && !o) return e
    return { ...e, ...(t ? { tag_labels: t.tags, tag_auto: t.auto } : {}), ...(o ? { opening_tags: o } : {}) }
  })
}
