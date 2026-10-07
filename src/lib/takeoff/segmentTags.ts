// Tags for each straight stretch (segment) of the walls drawn in a project: "DW01-01", "DW01-02"…
// Numbered automatically per item code across the whole project (sheet order, then drawing order),
// so a tag never repeats; a tag renamed by the user (takeoff_elements.segment_tags) replaces the
// automatic one and keeps its number taken, so renaming one stretch does not renumber the others.

import type { ElementRow, LayerRow } from './rows'

type LayerLike = Pick<LayerRow, 'id' | 'kind' | 'name' | 'sort_order'> & { wall_type_id?: string | null }
type WallTypeLike = { id: string; code?: string | null }

/** Short code for an item: its wall type's code, else the name before " – ", else T1, T2… */
export function layerTagPrefixes(layers: LayerLike[], wallTypes: WallTypeLike[]): Map<string, string> {
  const codeOf = new Map(wallTypes.map(w => [w.id, (w.code || '').trim()]))
  const out = new Map<string, string>()
  let fallback = 0
  for (const l of [...layers].filter(x => x.kind === 'linear').sort((a, b) => a.sort_order - b.sort_order)) {
    const fromType = l.wall_type_id ? codeOf.get(l.wall_type_id) || '' : ''
    const head = l.name.split(/\s[–—-]\s/)[0].trim()
    const fromName = head && head !== l.name.trim() && head.length <= 12 ? head : ''
    out.set(l.id, fromType || fromName || `T${++fallback}`)
  }
  return out
}

/** Custom tag at a segment index, or null for the automatic one. */
export function customTag(e: Pick<ElementRow, 'segment_tags'>, i: number): string | null {
  const v = Array.isArray(e.segment_tags) ? e.segment_tags[i] : null
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export type ElementTags = { tags: string[]; auto: string[] }

/**
 * Tags of every segment of every linear element: element id → final tag and automatic tag per segment (points[i] → points[i+1]).
 * `sourceOrder` lists sheet ids in their display order; elements keep their drawing order inside a sheet.
 */
export function computeSegmentTags(elements: ElementRow[], layers: LayerLike[], wallTypes: WallTypeLike[], sourceOrder: string[]): Map<string, ElementTags> {
  const prefix = layerTagPrefixes(layers, wallTypes)
  const sheetRank = new Map(sourceOrder.map((id, i) => [id, i]))
  const ordered = elements
    .filter(e => prefix.has(e.layer_id) && Array.isArray(e.points) && e.points.length >= 2)
    .map((e, i) => ({ e, i }))
    .sort((a, b) =>
      (sheetRank.get(a.e.source_id) ?? 1e9) - (sheetRank.get(b.e.source_id) ?? 1e9)
      || String(a.e.created_at || '').localeCompare(String(b.e.created_at || ''))
      || a.i - b.i)
  // Count first, so numbers are padded the same way for the whole item (01…09 or 001…120).
  const total = new Map<string, number>()
  for (const { e } of ordered) {
    const p = prefix.get(e.layer_id)!
    total.set(p, (total.get(p) || 0) + e.points.length - 1)
  }
  const next = new Map<string, number>()
  const out = new Map<string, ElementTags>()
  for (const { e } of ordered) {
    const p = prefix.get(e.layer_id)!
    const digits = Math.max(2, String(total.get(p) || 0).length)
    const tags: string[] = []
    const auto: string[] = []
    for (let i = 0; i < e.points.length - 1; i++) {
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

/** Elements with their final tags attached (`tag_labels`), for rowsToItems. */
export function withSegmentTags(elements: ElementRow[], tags: Map<string, ElementTags>): ElementRow[] {
  return elements.map(e => {
    const t = tags.get(e.id)
    return t ? { ...e, tag_labels: t.tags, tag_auto: t.auto } : e
  })
}
