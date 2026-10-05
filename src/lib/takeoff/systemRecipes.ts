// System recipes: one recipe per system family (e.g. "Drywall partition – Brazil") whose lines
// are formulas over the item's values and its wall type's build-up, with the products taken
// from the wall type (stud, track, face A/B board, insulation) or from the material catalog.
import { layerQuantities, shapeHeight, type FramingConfig, type TakeoffItem } from './geometry'
import { compileFormula, type FormulaError } from './formula'
import type { Recipe } from './recipes'

export type MaterialCategory = 'board' | 'stud' | 'track' | 'screw' | 'compound' | 'tape' | 'insulation' | 'profile' | 'accessory' | 'other'
export const MATERIAL_CATEGORIES: MaterialCategory[] = ['board', 'stud', 'track', 'screw', 'compound', 'tape', 'insulation', 'profile', 'accessory', 'other']

export type MaterialRow = {
  id: string
  country_code: string
  code: string | null
  name: string
  category: MaterialCategory
  unit: string
  pack_size: number | null
  pack_name: string | null
  manufacturer: string | null
  /** Who sells it (e.g. Espaço Smart); `code` is then the supplier's code. */
  supplier?: string | null
  notes: string | null
  status: 'draft' | 'review' | 'approved'
}
export const MATERIAL_COLUMNS = 'id, country_code, code, name, category, unit, pack_size, pack_name, manufacturer, supplier, notes, status'

/** Products a wall type defines, which system recipe lines can refer to. */
export type RecipeSlot = 'stud' | 'track' | 'boardA' | 'boardB' | 'insulation'
export const RECIPE_SLOTS: RecipeSlot[] = ['stud', 'track', 'boardA', 'boardB', 'insulation']
/** Catalog category expected for each slot (used to filter the product pickers). */
export const SLOT_CATEGORY: Record<RecipeSlot, MaterialCategory> = { stud: 'stud', track: 'track', boardA: 'board', boardB: 'board', insulation: 'insulation' }

/** What a system recipe needs from a wall type. */
export type WallTypeLike = {
  thickness_m?: number | null
  framing?: Partial<FramingConfig> | null
  boards?: { side: 'A' | 'B'; count: number }[] | null
  materials?: Partial<Record<RecipeSlot, string | null>> | null
}

/** Values a formula can use, with what they mean (shown in the recipe editor). */
export const RECIPE_VARIABLES: { name: string; pt: string; en: string }[] = [
  { name: 'area', pt: 'área líquida da parede (uma face), m² — ou área do item de área', en: 'net wall area (one face), m² — or the area item area' },
  { name: 'gross', pt: 'área bruta da parede (sem descontar vãos), m²', en: 'gross wall area (openings not deducted), m²' },
  { name: 'length', pt: 'comprimento das paredes, m', en: 'wall length, m' },
  { name: 'height', pt: 'altura média, m', en: 'average height, m' },
  { name: 'perimeter', pt: 'perímetro (itens de área), m', en: 'perimeter (area items), m' },
  { name: 'count', pt: 'número de elementos desenhados', en: 'number of drawn elements' },
  { name: 'openings', pt: 'número de vãos (portas, janelas, vãos)', en: 'number of openings (doors, windows, voids)' },
  { name: 'doors', pt: 'número de portas', en: 'number of doors' },
  { name: 'windows', pt: 'número de janelas', en: 'number of windows' },
  { name: 'openings_area', pt: 'área dos vãos, m²', en: 'openings area, m²' },
  { name: 'openings_perimeter', pt: 'perímetro dos vãos, m (requadros)', en: 'openings perimeter, m (reveals)' },
  { name: 'layers_a', pt: 'camadas de chapa na face A', en: 'board layers on face A' },
  { name: 'layers_b', pt: 'camadas de chapa na face B', en: 'board layers on face B' },
  { name: 'layers', pt: 'camadas de chapa nas duas faces', en: 'board layers, both faces' },
  { name: 'spacing', pt: 'espaçamento dos montantes, m', en: 'stud spacing, m' },
  { name: 'stud_factor', pt: '2 para montantes duplos (MD), 1 para simples (MS)', en: '2 for double studs, 1 for single studs' },
  { name: 'thickness', pt: 'espessura da parede, m', en: 'wall thickness, m' },
  { name: 'board_w', pt: 'largura da chapa, m', en: 'board width, m' },
  { name: 'board_h', pt: 'altura da chapa, m', en: 'board height, m' },
  { name: 'insulated', pt: '1 se o tipo de parede tem isolamento, senão 0', en: '1 if the wall type has insulation, else 0' },
]
export const RECIPE_VARIABLE_NAMES = new Set(RECIPE_VARIABLES.map(v => v.name))

/** Formula values for one item (all its drawn elements together) and its wall type. */
export function recipeVariables(item: TakeoffItem, ptPerM: number, wt: WallTypeLike | null | undefined): Record<string, number> {
  const q = layerQuantities(item, ptPerM)
  const f = { ...(item.framing || {}), ...(wt?.framing || {}) } as Partial<FramingConfig>
  const boardCount = (side: 'A' | 'B', fallback: number | undefined) => {
    const b = wt?.boards?.find(x => x.side === side)
    return b ? Number(b.count) || 0 : Number(fallback ?? 1)
  }
  const layersA = boardCount('A', f.layersA)
  const layersB = boardCount('B', f.layersB)
  let doors = 0, windows = 0, openings = 0, openArea = 0, openPer = 0
  if (item.kind === 'linear') {
    for (const sh of item.shapes) {
      const H = shapeHeight(item, sh)
      for (const o of sh.openings || []) {
        openings++
        if (o.kind === 'door') doors++
        else if (o.kind === 'window') windows++
        const h = Math.max(0, Math.min(o.h, H - o.sill))
        openArea += o.w * h
        openPer += 2 * (o.w + h)
      }
    }
  }
  const length = q?.len || 0
  const gross = q?.wall || 0
  return {
    area: item.kind === 'linear' ? q?.net ?? 0 : item.kind === 'area' ? q?.area ?? 0 : 0,
    gross,
    length,
    height: length > 0 ? gross / length : item.height || 0,
    perimeter: q?.per || 0,
    count: item.kind === 'count' ? q?.n || 0 : item.shapes.length,
    openings, doors, windows,
    openings_area: openArea,
    openings_perimeter: openPer,
    layers_a: layersA,
    layers_b: layersB,
    layers: layersA + layersB,
    spacing: Number(f.spacing) || 0.6,
    stud_factor: (f as { doubleStuds?: boolean }).doubleStuds ? 2 : 1,
    thickness: item.thickness || Number(wt?.thickness_m) || 0,
    board_w: Number(f.boardW) || 1.2,
    board_h: Number(f.boardH) || 2.4,
    insulated: wt?.materials?.insulation ? 1 : 0,
  }
}

export type PreviewLine = { line: number; name: string; unit: string; perM2: number; layoutCovered: boolean; skipped: 'no_product' | null; error: FormulaError | null }

/**
 * Consumption per m² of a wall type with a system recipe: evaluated on a 1 m long wall of the
 * given height without openings, divided by its area. Lines the layout counts are flagged.
 */
export function previewPerM2(recipe: Recipe, wt: WallTypeLike, catalog: Map<string, MaterialRow>, heightM = 2.8): PreviewLine[] {
  const H = heightM > 0 ? heightM : 2.8
  const k = 100 // any scale: the sample wall is 1 m long
  const sample: TakeoffItem = {
    key: 'preview', kind: 'linear', name: 'preview', system: '', color: '#000', height: H,
    thickness: wt.thickness_m ?? undefined, framing: (wt.framing || undefined) as FramingConfig | undefined,
    shapes: [{ page: 1, pts: [[0, 0], [k, 0]] }],
  }
  const vars = recipeVariables(sample, k, wt)
  return recipe.lines.map((l, i) => {
    let error: FormulaError | null = null
    let perM2 = 0
    if (recipe.mode === 'system') {
      try { perM2 = compileFormula(l.qty || '0').run(vars) / H } catch (e) { error = e as FormulaError }
    } else {
      perM2 = l.base === 'm2' ? l.coef : l.base === 'm' ? l.coef / H : 0
    }
    perM2 *= 1 + (l.waste || 0) / 100
    const productId = l.slot ? wt.materials?.[l.slot] || null : l.materialId || null
    const product = productId ? catalog.get(productId) : undefined
    return {
      line: i,
      name: product?.name || l.mat || (l.slot ? `{${l.slot}}` : ''),
      unit: product?.unit || l.unit,
      perM2,
      layoutCovered: !!l.layoutCovered,
      skipped: l.slot && !productId ? 'no_product' : null,
      error,
    }
  })
}
