// Material recipes: coefficients per m², per metre or per unit, applied to layer quantities.
// When a layer has drywall framing on, recipe lines for studs, tracks and boards are
// skipped because the framing engine calculates those from the real layout.

import { layerQuantities, type TakeoffItem } from './geometry'
import { checkFormula, compileFormula } from './formula'
import { RECIPE_SLOTS, RECIPE_VARIABLE_NAMES, recipeVariables, type MaterialRow, type RecipeSlot, type WallTypeLike } from './systemRecipes'

export type RecipeBase = 'm2' | 'm' | 'un'

export type RecipeLine = {
  mat: string
  code?: string | null
  unit: string
  coef: number
  base: RecipeBase
  /** Extra waste in % on top of the coefficient (0 when the catalog already includes it). */
  waste?: number
  packSize?: number | null
  packName?: string | null
  note?: string | null
  /** Unit as printed in the catalog, when it differs from `unit`. */
  printedUnit?: string | null
  /** Catalog product this line buys (name, unit and package come from it). */
  materialId?: string | null
  /** System recipes: the product comes from the wall type (its stud, track, face A/B board, insulation). */
  slot?: RecipeSlot | null
  /** System recipes: quantity formula over the item's values (area, length, layers_a…). */
  qty?: string | null
  /** Counted by the framing layout when the item has framing on (studs, tracks, boards, screws): skipped then. */
  layoutCovered?: boolean
}

export type Recipe = {
  id: string
  name: string
  maker: string | null
  system: string | null
  kind: TakeoffItem['kind']
  /** Height the catalog consumption was calculated for (m), if stated. */
  heightBasisM: number | null
  /** Waste already included in the coefficients (%), for information. */
  wasteIncludedPct: number
  status: 'draft' | 'review' | 'approved'
  /** 'fixed': catalog coefficients per m²/m/un. 'system': formula lines over the wall type (one recipe per system family). */
  mode?: 'fixed' | 'system'
  lines: RecipeLine[]
}

/** Lines the framing engine replaces (studs, tracks, boards). */
export const FRAMED_MATERIAL_RX = /montante|guia|chapa|stud|track|board/i

/** Screw lines, replaced by the layout count when the layer calculates screws from the layout. */
export const SCREW_RX = /parafuso|screw/i

export type MaterialRequirement = {
  /** Catalog product, when the line points at one. */
  materialId?: string | null
  mat: string
  code: string | null
  unit: string
  qty: number
  packs: number | null
  packName: string | null
  from: string[]
}

/** Base quantity of a layer for a recipe line: m² of net wall or area, m of length or perimeter, or a count. */
export function baseQuantity(item: TakeoffItem, ptPerM: number, base: RecipeBase): number {
  const q = layerQuantities(item, ptPerM)
  if (!q) return 0
  if (item.kind === 'linear') return base === 'm' ? q.len : base === 'm2' ? q.net ?? 0 : item.shapes.length
  if (item.kind === 'area') return base === 'm' ? q.per : base === 'm2' ? q.area : item.shapes.length
  return q.n
}

/** Context for system recipes: the item's wall type and the material catalog. */
export type RecipeContext = {
  wallTypeOf?: (item: TakeoffItem) => WallTypeLike | null | undefined
  catalog?: Map<string, MaterialRow>
}

/**
 * Aggregates recipe materials across layers. `recipeOf` returns the recipe linked to each layer.
 * Fixed recipes multiply a base quantity by a coefficient; system recipes evaluate each line's
 * formula with the item's values and take the product from the wall type (slot) or the catalog.
 * Each material has one source: lines the framing layout counts are skipped when framing is on.
 */
export function recipeMaterials(
  items: TakeoffItem[],
  ptPerM: number,
  recipeOf: (item: TakeoffItem) => Recipe | null | undefined,
  ctx: RecipeContext = {},
): MaterialRequirement[] {
  const byKey = new Map<string, MaterialRequirement & { packSize: number | null }>()
  for (const item of items) {
    const recipe = recipeOf(item)
    if (!recipe || !item.shapes.length) continue
    const framed = item.kind === 'linear' && !!item.framing?.on
    const layoutScrews = framed && item.framing!.screwsFromLayout !== false
    const system = recipe.mode === 'system'
    const wt = system ? ctx.wallTypeOf?.(item) || null : null
    const vars = system ? recipeVariables(item, ptPerM, wt) : null
    for (const line of recipe.lines) {
      let qty: number
      if (system) {
        if (framed && line.layoutCovered) continue
        let f
        try { f = compileFormula(line.qty || '0') } catch { continue }
        qty = f.run(vars!) * (1 + (line.waste || 0) / 100)
      } else {
        if (framed && FRAMED_MATERIAL_RX.test(line.mat)) continue
        if (layoutScrews && SCREW_RX.test(line.mat)) continue
        qty = baseQuantity(item, ptPerM, line.base) * line.coef * (1 + (line.waste || 0) / 100)
      }
      if (!(qty > 0)) continue
      // Product: the wall type's slot (skipped when the wall type has none, e.g. no insulation),
      // else the line's catalog product, else the typed name.
      let productId: string | null = line.materialId || null
      if (system && line.slot && RECIPE_SLOTS.includes(line.slot)) {
        productId = wt?.materials?.[line.slot] || null
        if (!productId) continue
      }
      const product = productId ? ctx.catalog?.get(productId) : undefined
      const mat = product?.name || line.mat
      const unit = product?.unit || line.unit
      const key = product ? `id:${product.id}` : `${mat.toLowerCase()}|${unit}`
      const entry = byKey.get(key) || {
        materialId: product?.id ?? null, mat, code: product?.code ?? line.code ?? null, unit, qty: 0, packs: null,
        packName: product?.pack_name ?? line.packName ?? null, packSize: product?.pack_size ?? line.packSize ?? null, from: [],
      }
      entry.qty += qty
      if (!entry.from.includes(item.name)) entry.from.push(item.name)
      byKey.set(key, entry)
    }
  }
  return [...byKey.values()]
    .map(({ packSize, ...e }) => ({ ...e, packs: packSize && packSize > 0 ? Math.ceil(e.qty / packSize - 1e-9) : null }))
    .sort((a, b) => a.mat.localeCompare(b.mat))
}

/**
 * Catálogo Técnico Gypsum Drywall (2014), Parede Simples, "Tabela de Consumo (m²)",
 * column "Montantes Simples 600 mm". PDF page 36, printed page 34. Consumption per m²
 * of wall, calculated for a 2.50 m ceiling height, 5% waste already included.
 * The catalog prints "2,10m" for Chapa BR; the coherent unit is m².
 */
export const GYPSUM_2014_PAREDE_SIMPLES_600: Omit<Recipe, 'id'> & { source: Record<string, unknown>; notes: string } = {
  name: 'Parede Simples · montantes simples a 600 mm',
  maker: 'Gypsum',
  system: 'Drywall',
  kind: 'linear',
  heightBasisM: 2.5,
  wasteIncludedPct: 5,
  status: 'review',
  notes: 'Catálogo de 2014: confirmar se ainda está vigente. Consumo calculado para pé-direito de 2,50 m.',
  source: {
    file: 'catalogo-tecnico-gypsum_.pdf',
    catalog: 'Catálogo Técnico Gypsum Drywall 2014',
    pdfPage: 36,
    printedPage: 34,
    table: 'Tabela de Consumo (m²)',
    column: 'Montantes Simples 600 mm',
  },
  lines: [
    { mat: 'Chapa BR', unit: 'm²', coef: 2.1, base: 'm2', waste: 0, printedUnit: 'm' },
    { mat: 'Guia', unit: 'm', coef: 0.9, base: 'm2', waste: 0 },
    { mat: 'Montante', unit: 'm', coef: 2.3, base: 'm2', waste: 0 },
    { mat: 'Parafuso TA 3,5 x 25 mm', unit: 'un', coef: 25, base: 'm2', waste: 0 },
    { mat: 'Parafuso LA 4,2 x 9,5 mm', unit: 'un', coef: 2, base: 'm2', waste: 0 },
    { mat: 'Massa de Rejunte Gypsum 90', unit: 'kg', coef: 0.7, base: 'm2', waste: 0 },
    { mat: 'Fita JT', unit: 'm', coef: 3, base: 'm2', waste: 0 },
    { mat: 'Lã de Vidro', unit: 'm²', coef: 1.05, base: 'm2', waste: 0 },
    { mat: 'Banda Acústica 3 mm', unit: 'm²', coef: 0.9, base: 'm2', waste: 0 },
    { mat: 'Cola Gypsum', unit: 'kg', coef: 0.1, base: 'm2', waste: 0 },
  ],
}

export type RecipeRow = {
  id: string
  name: string
  maker: string | null
  system: string | null
  kind: TakeoffItem['kind']
  height_basis_m: number | null
  waste_included_pct: number
  status: Recipe['status']
  mode?: 'fixed' | 'system' | null
  lines: RecipeLine[]
  source?: Record<string, unknown>
  notes?: string | null
}

export function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    maker: row.maker,
    system: row.system,
    kind: row.kind,
    heightBasisM: row.height_basis_m == null ? null : Number(row.height_basis_m),
    wasteIncludedPct: Number(row.waste_included_pct || 0),
    status: row.status,
    mode: row.mode === 'system' ? 'system' : 'fixed',
    lines: (row.lines || []).map(l => ({ ...l, coef: Number(l.coef) || 0, waste: l.waste == null ? 0 : Number(l.waste) })),
  }
}

/** Editable line as typed in the form (numbers as text, any decimal mark). */
export type RecipeLineForm = {
  mat: string
  code: string
  unit: string
  coef: string
  base: RecipeBase
  waste: string
  packSize: string
  packName: string
  printedUnit?: string | null
  note?: string | null
  materialId?: string
  slot?: RecipeSlot | ''
  qty?: string
  layoutCovered?: boolean
}

export function lineToForm(l: RecipeLine, fmt: (v: number) => string): RecipeLineForm {
  return {
    mat: l.mat,
    code: l.code || '',
    unit: l.unit,
    coef: fmt(l.coef),
    base: l.base,
    waste: l.waste ? fmt(l.waste) : '',
    packSize: l.packSize ? fmt(l.packSize) : '',
    packName: l.packName || '',
    printedUnit: l.printedUnit ?? null,
    note: l.note ?? null,
    materialId: l.materialId || '',
    slot: l.slot || '',
    qty: l.qty || '',
    layoutCovered: !!l.layoutCovered,
  }
}

/**
 * Converts form lines into stored lines. Empty rows are dropped. Returns the 1-based
 * index of the first invalid row: fixed recipes need material, unit and a coefficient > 0;
 * system recipes need a product (slot, catalog or typed name), a unit (or the product's)
 * and a valid formula.
 */
export function formToLines(
  rows: RecipeLineForm[],
  parse: (s: string) => number,
  mode: 'fixed' | 'system' = 'fixed',
  unitOf: (materialId: string) => string | null = () => null,
): { lines: RecipeLine[]; invalidRow: number | null } {
  const lines: RecipeLine[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const empty = !r.mat.trim() && !r.unit.trim() && !r.coef.trim() && !(r.qty || '').trim() && !r.materialId && !r.slot
    if (empty) continue
    const waste = r.waste.trim() ? parse(r.waste) : 0
    const packSize = r.packSize.trim() ? parse(r.packSize) : NaN
    let line: RecipeLine
    if (mode === 'system') {
      const qty = (r.qty || '').trim()
      const unit = r.unit.trim() || (r.materialId ? unitOf(r.materialId) || '' : '')
      const hasProduct = !!r.slot || !!r.materialId || !!r.mat.trim()
      if (!hasProduct || !unit || !qty || checkFormula(qty, RECIPE_VARIABLE_NAMES)) return { lines: [], invalidRow: i + 1 }
      line = { mat: r.mat.trim(), unit, coef: 0, base: r.base, qty, waste: Number.isFinite(waste) && waste > 0 ? waste : 0 }
      if (r.slot) line.slot = r.slot
      if (r.layoutCovered) line.layoutCovered = true
    } else {
      const coef = parse(r.coef)
      if (!r.mat.trim() || !r.unit.trim() || !(coef > 0)) return { lines: [], invalidRow: i + 1 }
      line = { mat: r.mat.trim(), unit: r.unit.trim(), coef, base: r.base, waste: Number.isFinite(waste) && waste > 0 ? waste : 0 }
    }
    if (r.materialId && !r.slot) line.materialId = r.materialId
    if (r.code.trim()) line.code = r.code.trim()
    if (packSize > 0) line.packSize = packSize
    if (r.packName.trim()) line.packName = r.packName.trim()
    if (r.printedUnit) line.printedUnit = r.printedUnit
    if (r.note) line.note = r.note
    lines.push(line)
  }
  return { lines, invalidRow: null }
}
