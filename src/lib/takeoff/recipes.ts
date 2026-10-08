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
  /** Planning: the activity (task) of the wall that uses this material; unset = guessed from the material (lineStep). */
  step?: RecipeStep | null
}

/**
 * Activities of a wall a material belongs to. 'boards' and 'joints' are shared by both faces
 * (split between the face A and face B activities); 'none' = not used by any planned task.
 */
export type RecipeStep = 'framing' | 'board_a' | 'board_b' | 'boards' | 'insulation' | 'joints_a' | 'joints_b' | 'joints' | 'none'
export const RECIPE_STEPS: RecipeStep[] = ['framing', 'boards', 'board_a', 'board_b', 'insulation', 'joints', 'joints_a', 'joints_b', 'none']

/** Anchors / fasteners into another system: counted by the layout when the item has fixings set. */
export const ANCHOR_RX = /bucha|chumbador|anchor|fastener|finca.?pino|tarugo/i
/** Acoustic band / sealing strip: counted by the layout when the item has fixings set. */
export const BAND_RX = /banda|acoustic(al)?\s*(band|strip|tape)|sealing\s*strip|fita\s*(de\s*)?veda/i

/** The activity a recipe line belongs to: its own `step`, else guessed from its slot and name. */
export function lineStep(l: Pick<RecipeLine, 'step' | 'slot' | 'mat'>): RecipeStep {
  if (l.step && RECIPE_STEPS.includes(l.step)) return l.step
  if (l.slot === 'stud' || l.slot === 'track') return 'framing'
  if (l.slot === 'boardA') return 'board_a'
  if (l.slot === 'boardB') return 'board_b'
  if (l.slot === 'insulation') return 'insulation'
  const m = l.mat || ''
  if (BAND_RX.test(m) || ANCHOR_RX.test(m)) return 'framing'
  if (/\bLA\b|framing screw|metal.?(a|to).?metal|montante|guia|stud|track|runner|perfil|cantoneira de (a|re)fo/i.test(m)) return 'framing'
  if (/massa|compound|fita|tape|rejunte|joint|cantoneira|corner bead|bead/i.test(m)) return 'joints'
  if (/\bTA\b|drywall screw|board screw|cement board screw|chapa|board|placa|cola|adhesive/i.test(m)) return 'boards'
  if (/(^|[\s(])l[ãa]([\s)]|$)|wool|batt|insula|isola/i.test(m)) return 'insulation'
  return 'none'
}

/** Share of a line with this step that a task of `task` step takes (layers per face for boards, faces for joints). */
export function stepShare(lineSt: RecipeStep, task: string | null, layers: { A: number; B: number }): number {
  if (!task || lineSt === 'none') return 0
  if (lineSt === task) return 1
  const a = Math.max(0, layers.A || 0), b = Math.max(0, layers.B || 0)
  if (lineSt === 'boards' && (task === 'board_a' || task === 'board_b')) {
    const tot = a + b
    if (!tot) return 0.5
    return (task === 'board_a' ? a : b) / tot
  }
  if (lineSt === 'joints' && (task === 'joints_a' || task === 'joints_b')) {
    const faces = (a > 0 ? 1 : 0) + (b > 0 ? 1 : 0)
    if (!faces) return 0.5
    return (task === 'joints_a' ? a : b) > 0 ? 1 / faces : 0
  }
  return 0
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

/** One recipe line evaluated for one item: product, quantity (waste included) and the activity it belongs to. */
export type RecipeLineQty = {
  line: RecipeLine
  step: RecipeStep
  materialId: string | null
  mat: string
  code: string | null
  unit: string
  qty: number
  packSize: number | null
  packName: string | null
}

/**
 * Every recipe line of one item with its quantity. Each material has one source: lines the framing
 * layout counts are skipped when framing is on (studs, tracks, boards; screws when the layout counts
 * screws; anchors and acoustic band when the item has fixings set).
 */
export function recipeLineQuantities(item: TakeoffItem, ptPerM: number, recipe: Recipe | null | undefined, ctx: RecipeContext = {}): RecipeLineQty[] {
  const out: RecipeLineQty[] = []
  if (!recipe || !item.shapes.length) return out
  const framed = item.kind === 'linear' && !!item.framing?.on
  const layoutScrews = framed && item.framing!.screwsFromLayout !== false
  const layoutFixings = framed && !!item.framing!.fixings
  const system = recipe.mode === 'system'
  const wt = system ? ctx.wallTypeOf?.(item) || null : null
  const vars = system ? recipeVariables(item, ptPerM, wt) : null
  for (const line of recipe.lines) {
    let qty: number
    if (layoutFixings && (ANCHOR_RX.test(line.mat) || BAND_RX.test(line.mat))) continue
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
    out.push({
      line, step: lineStep(line), materialId: product?.id ?? null,
      mat: product?.name || line.mat, code: product?.code ?? line.code ?? null, unit: product?.unit || line.unit, qty,
      packSize: product?.pack_size ?? line.packSize ?? null, packName: product?.pack_name ?? line.packName ?? null,
    })
  }
  return out
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
    for (const q of recipeLineQuantities(item, ptPerM, recipeOf(item), ctx)) {
      const key = q.materialId ? `id:${q.materialId}` : `${q.mat.toLowerCase()}|${q.unit}`
      const entry = byKey.get(key) || {
        materialId: q.materialId, mat: q.mat, code: q.code, unit: q.unit, qty: 0, packs: null,
        packName: q.packName, packSize: q.packSize, from: [],
      }
      entry.qty += q.qty
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
  /** Activity (task) the material belongs to; '' = guessed from the material. */
  step?: RecipeStep | ''
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
    step: l.step || '',
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
    if (r.step && RECIPE_STEPS.includes(r.step)) line.step = r.step
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
