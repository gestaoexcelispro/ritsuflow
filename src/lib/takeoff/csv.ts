// CSV export of layer quantities and the framing purchase list.
// pt-BR uses ";" as separator and "," as decimal mark (what Excel expects in Brazil);
// en-US uses "," and ".".
import { framingTotals, packBars, packSheets } from './framing/framing'
import { dist, layerQuantities, shapeHeight, type TakeoffItem } from './geometry'
import type { MaterialRequirement } from './recipes'

export type CsvLabels = {
  layer: string
  kind: Record<TakeoffItem['kind'], string>
  system: string
  elements: string
  length: string
  grossArea: string
  openings: string
  netArea: string
  area: string
  perimeter: string
  count: string
  material: string
  type: string
  profile: string
  board: string
  quantity: string
  unit: string
  bars: string
  sheets: string
  waste: string
  splices: string
  /** Header for the recipe materials section. */
  recipe?: string
  packages?: string
  screws?: string
  /** Headers of the wall stretches section (one row per tagged stretch). */
  tag?: string
  height?: string
}

export function buildQuantitiesCsv(
  items: TakeoffItem[],
  ptPerM: number,
  numberFormat: 'pt-BR' | 'en-US',
  L: CsvLabels,
  materials: MaterialRequirement[] = [],
): string {
  const sep = numberFormat === 'pt-BR' ? ';' : ','
  const num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', numberFormat === 'pt-BR' ? ',' : '.') : '')
  const cell = (v: string | number) => {
    const s = typeof v === 'number' ? String(v) : v
    return s.includes(sep) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const row = (cells: (string | number)[]) => cells.map(cell).join(sep)

  const lines: string[] = []
  lines.push(row([L.layer, L.type, L.system, L.elements, `${L.length} (m)`, `${L.grossArea} (m²)`, `${L.openings} (m²)`, `${L.netArea} (m²)`, `${L.area} (m²)`, `${L.perimeter} (m)`, L.count]))
  for (const it of items) {
    const q = layerQuantities(it, ptPerM)
    if (!q) continue
    const lin = it.kind === 'linear'
    const area = it.kind === 'area'
    lines.push(row([
      it.name,
      L.kind[it.kind],
      it.system,
      it.shapes.length,
      lin ? num(q.len) : '',
      lin ? num(q.wall) : '',
      lin ? num(q.open) : '',
      lin ? num(q.net ?? 0) : '',
      area ? num(q.area) : '',
      area ? num(q.per) : '',
      it.kind === 'count' ? q.n : '',
    ]))
  }

  // Wall stretches: one row per straight stretch, with its tag (DW01-03…), length, height and gross area.
  const stretches = items.filter(it => it.kind === 'linear').flatMap(it => it.shapes.flatMap(sh =>
    (sh.tags || []).map((tag, i) => ({ tag, it, len: dist(sh.pts[i], sh.pts[i + 1]) / ptPerM, h: shapeHeight(it, sh) }))))
  if (L.tag && stretches.length) {
    lines.push('')
    lines.push(row([L.tag, L.layer, `${L.length} (m)`, `${L.height || ''} (m)`, `${L.grossArea} (m²)`]))
    const byTag = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })
    for (const s of stretches.sort((a, b) => byTag(a.tag, b.tag))) {
      lines.push(row([s.tag, s.it.name, num(s.len), num(s.h), num(s.len * s.h)]))
    }
  }

  const T = framingTotals(items, ptPerM)
  if (T.prof.size || T.boards.size) {
    lines.push('')
    lines.push(row([L.material, L.type, L.quantity, L.unit, `${L.waste} (%)`, L.splices]))
    for (const g of T.prof.values()) {
      const p = packBars(g.pieces, g.bars)
      for (const [len, n] of Object.entries(p.byLen)) {
        lines.push(row([`${g.name} · ${num(Number(len))} m`, L.profile, n, L.bars, num(p.waste * 100, 1), p.splices]))
      }
    }
    for (const g of T.boards.values()) {
      const p = packSheets(g.pieces, g.W, g.H)
      lines.push(row([`${g.name} · ${num(g.W)} × ${num(g.H)} m`, L.board, p.count, L.sheets, num(p.waste * 100, 1), '']))
    }
    for (const [name, n] of T.screws) lines.push(row([name, L.screws || '', Math.ceil(n), 'un', '', '']))
  }
  if (materials.length) {
    lines.push('')
    lines.push(row([L.material, L.type, L.quantity, L.unit, L.packages || '', '']))
    for (const m of materials) {
      lines.push(row([m.mat, L.recipe || '', num(m.qty), m.unit, m.packs == null ? '' : `${m.packs}${m.packName ? ` ${m.packName}` : ''}`, '']))
    }
  }
  // BOM so Excel opens UTF-8 accents correctly.
  return '\ufeff' + lines.join('\r\n') + '\r\n'
}
