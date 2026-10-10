// Takeoff → estimate: reads a bid's RitsuScope takeoff with the same engine RitsuScope uses and
// returns one estimate line per takeoff item (layer): its quantity, the materials its recipe
// consumes and the labor hours its recipe calls for. Prices are applied afterwards (pricing.ts).
import type { createClient } from '@/lib/supabase/client'
import { DEFAULT_LA_PER_STUD_END, DEFAULT_SCREW_SPACING, findJunctions, framingLabelsPtBR, framingTotals, packBars, packSheets, screwsAlong, type Junction } from '@/lib/takeoff/framing/framing'
import { layerQuantities, shapeHeight, type TakeoffItem } from '@/lib/takeoff/geometry'
import { LEVEL_COLUMNS, fillLevelHeights, normalizeLevels, wallHeightOf, withTypicalCopies, type LevelRow } from '@/lib/takeoff/levels'
import { recipeMaterials, rowToRecipe, type Recipe, type RecipeContext, type RecipeRow } from '@/lib/takeoff/recipes'
import { projectItemsInMetres, type ElementRow, type LayerRow, type SourceRow } from '@/lib/takeoff/rows'
import { MATERIAL_COLUMNS, RECIPE_SLOTS, type MaterialRow, type WallTypeLike } from '@/lib/takeoff/systemRecipes'
import type { LaborLine, MaterialNeed } from './pricing'

type Supabase = ReturnType<typeof createClient>

export type TakeoffLine = {
  layerId: string
  recipeId: string | null
  recipeName: string | null
  description: string
  unit: 'm2' | 'm' | 'un'
  quantity: number
  /** Base quantities a recipe line can use (m² of net wall or area, m of length, units). */
  base: Record<'m2' | 'm' | 'un', number>
  /** Each group = one product, in the units it can be bought in (first priced wins). */
  materialGroups: MaterialNeed[][]
  laborLines: LaborLine[]
  /** Equipment and subcontract lines of the recipe (priced by name and unit from the price book). */
  equipmentGroups: MaterialNeed[][]
  subcontractGroups: MaterialNeed[][]
  framed: boolean
}

/** Commercial cost lines kept with the labor lines on the recipe (takeoff_recipes.labor). */
type CostLine = { bucket: 'equipment' | 'subcontract'; name: string; unit: string; coef: number; base: 'm2' | 'm' | 'un' }
const isCost = (l: unknown): l is CostLine => !!l && typeof l === 'object' && ((l as CostLine).bucket === 'equipment' || (l as CostLine).bucket === 'subcontract')

export type TakeoffRead = { lines: TakeoffLine[]; uncalibrated: number; noRecipe: number }

type RecipeRowWithLabor = RecipeRow & { labor?: (LaborLine | CostLine)[] | null }

/** Wall types and catalog products the recipes need (same as RitsuScope's useRecipeContext). */
async function recipeContext(supabase: Supabase, items: TakeoffItem[], recipeOf: (it: TakeoffItem) => Recipe | null | undefined): Promise<RecipeContext> {
  const wtIds = [...new Set(items.map(it => it.wallTypeId).filter((x): x is string => !!x))]
  const wallTypes = new Map<string, WallTypeLike>()
  if (wtIds.length) {
    const { data } = await supabase.from('takeoff_wall_types').select('id, thickness_m, framing, boards, materials').in('id', wtIds)
    for (const w of (data || []) as (WallTypeLike & { id: string })[]) wallTypes.set(w.id, w)
  }
  const ids = new Set<string>()
  for (const it of items) for (const l of recipeOf(it)?.lines || []) if (l.materialId) ids.add(l.materialId)
  for (const w of wallTypes.values()) for (const sl of RECIPE_SLOTS) { const id = w.materials?.[sl]; if (id) ids.add(id) }
  const catalog = new Map<string, MaterialRow>()
  if (ids.size) {
    const { data } = await supabase.from('takeoff_materials').select(MATERIAL_COLUMNS).in('id', [...ids])
    for (const m of (data || []) as MaterialRow[]) catalog.set(m.id, m)
  }
  return { wallTypeOf: (it: TakeoffItem) => (it.wallTypeId ? wallTypes.get(it.wallTypeId) : null), catalog }
}

/**
 * Studs, tracks, boards and screws of a framed wall, from RitsuScope's framing engine. The item is
 * laid out on its own (junctions between its own walls included); `shared` are the L and T
 * junctions where this item hosts the extra studs for a wall of another item, added the same way
 * RitsuScope's framingTotals adds them.
 */
function framingNeeds(item: TakeoffItem, shared: Junction[]): MaterialNeed[][] {
  const totals = framingTotals([item], 1)
  const F = item.framing!
  for (const j of shared) {
    const H = shapeHeight(j.host.item, j.host.shape) - F.studGap
    const group = totals.prof.get(F.studName)
    if (!group || !(H > 0)) continue
    for (let n = 0; n < j.studs; n++) group.pieces.push(H)
    if (F.screwsFromLayout !== false) {
      const spacing = F.screwSpacing && F.screwSpacing > 0 ? F.screwSpacing : DEFAULT_SCREW_SPACING
      const layers = Math.max(1, (F.layersA || 0) + (F.layersB || 0))
      const ta = F.taName || framingLabelsPtBR.taScrew!
      const la = F.laName || framingLabelsPtBR.laScrew!
      totals.screws.set(ta, (totals.screws.get(ta) || 0) + j.studs * screwsAlong(H, spacing) * layers / 2)
      totals.screws.set(la, (totals.screws.get(la) || 0) + j.studs * 2 * (F.laPerStudEnd ?? DEFAULT_LA_PER_STUD_END))
    }
  }
  const groups: MaterialNeed[][] = []
  for (const g of totals.prof.values()) {
    const pk = packBars(g.pieces, g.bars)
    groups.push([{ mat: g.name, unit: 'un', qty: pk.count }, { mat: g.name, unit: 'm', qty: pk.total }])
  }
  for (const g of totals.boards.values()) {
    const ps = packSheets(g.pieces, g.W, g.H)
    groups.push([{ mat: g.name, unit: 'un', qty: ps.count }, { mat: g.name, unit: 'm2', qty: ps.count * g.W * g.H }])
  }
  for (const [name, n] of totals.screws) groups.push([{ mat: name, unit: 'un', qty: Math.ceil(n) }])
  // Anchors and acoustic band (the item alone: ends touching another item's wall count as free here).
  for (const f of totals.fixings.values()) groups.push([{ mat: f.name, unit: f.unit, qty: f.unit === 'm' ? f.qty : Math.ceil(f.qty - 1e-9) }])
  return groups
}

function costGroups(lines: CostLine[], bucket: CostLine['bucket'], base: Record<'m2' | 'm' | 'un', number>): MaterialNeed[][] {
  return lines.filter(c => c.bucket === bucket).map(c => [{ mat: c.name, unit: c.unit, qty: (Number(c.coef) || 0) * (base[c.base] || 0) }])
}

export async function readTakeoff(supabase: Supabase, projectId: string): Promise<TakeoffRead> {
  const [s, l, e, lv] = await Promise.all([
    supabase.from('takeoff_sources')
      .select('id, project_id, kind, name, file_path, page_number, ifc_storey_guid, scale_pt_per_m, metadata, sort_order, level_id')
      .eq('project_id', projectId).order('sort_order').order('created_at'),
    supabase.from('takeoff_layers')
      .select('id, project_id, kind, name, system, color, thickness_m, height_m, elevation_m, deduct_openings, framing, is_visible, sort_order, recipe_id, wall_type_id')
      .eq('project_id', projectId).order('sort_order').order('created_at'),
    supabase.from('takeoff_elements')
      .select('id, project_id, layer_id, source_id, points, height_override_m, z_rel_m, ifc_guid, root_guid, layer_guids, openings, faces')
      .eq('project_id', projectId),
    supabase.from('takeoff_levels').select(LEVEL_COLUMNS).eq('project_id', projectId),
  ])
  const failure = s.error || l.error || e.error
  if (failure) throw new Error(failure.message)
  const sources = (s.data || []) as SourceRow[]
  const layers = (l.data || []) as LayerRow[]
  const elements = (e.data || []) as ElementRow[]
  const levels: LevelRow[] = lv.error ? [] : normalizeLevels((lv.data || []) as Partial<LevelRow>[])

  const recipeIds = [...new Set(layers.map(x => x.recipe_id).filter((x): x is string => !!x))]
  const recipeRows: RecipeRowWithLabor[] = []
  if (recipeIds.length) {
    const { data, error } = await supabase.from('takeoff_recipes')
      .select('id, name, maker, system, kind, height_basis_m, waste_included_pct, status, lines, mode, labor').in('id', recipeIds)
    if (error) throw new Error(error.message)
    recipeRows.push(...((data || []) as RecipeRowWithLabor[]))
  }
  const recipeById = new Map(recipeRows.map(r => [r.id, rowToRecipe(r)] as [string, Recipe]))
  const laborById = new Map(recipeRows.map(r => [r.id, (Array.isArray(r.labor) ? r.labor : []).filter((x): x is LaborLine => !isCost(x) && typeof (x as LaborLine).trade === 'string')] as [string, LaborLine[]]))
  const costsById = new Map(recipeRows.map(r => [r.id, (Array.isArray(r.labor) ? r.labor : []).filter(isCost)] as [string, CostLine[]]))
  const recipeOf = (it: TakeoffItem) => (it.recipeId ? recipeById.get(it.recipeId) : null)

  // Same pipeline as RitsuScope's purchase list: metres, typical floors, level heights.
  const r = projectItemsInMetres(layers, withTypicalCopies(elements, sources, levels), sources)
  const byId = new Map(levels.map(x => [x.id, x] as [string, LevelRow]))
  const hOfPage = new Map<number, number | null>()
  for (const src of sources) {
    const pg = r.pageOfSource.get(src.id)
    if (pg != null) hOfPage.set(pg, wallHeightOf(src.level_id ? byId.get(src.level_id) : null))
  }
  const items = fillLevelHeights(r.items, pg => hOfPage.get(pg) ?? null).filter(it => it.shapes.length > 0)
  const ctx = await recipeContext(supabase, items, recipeOf)
  // Junctions between different framed items (same sheet): the host item gets the extra studs.
  const framedItems = items.filter(it => it.kind === 'linear' && !!it.framing?.on)
  const sharedOf = new Map<TakeoffItem, Junction[]>()
  for (const j of findJunctions(framedItems, 1)) {
    if (j.host.item === j.other.item) continue
    sharedOf.set(j.host.item, [...(sharedOf.get(j.host.item) || []), j])
  }

  const lines: TakeoffLine[] = []
  let noRecipe = 0
  for (const it of items) {
    const q = layerQuantities(it, 1)
    if (!q) continue
    const base = {
      m2: it.kind === 'linear' ? q.net ?? 0 : it.kind === 'area' ? q.area : 0,
      m: it.kind === 'linear' ? q.len : it.kind === 'area' ? q.per : 0,
      un: it.kind === 'count' ? q.n : it.shapes.length,
    }
    const unit: TakeoffLine['unit'] = it.kind === 'count' ? 'un' : it.kind === 'area' ? 'm2' : q.wall > 0 ? 'm2' : 'm'
    const quantity = unit === 'un' ? base.un : unit === 'm2' ? base.m2 : base.m
    const recipe = recipeOf(it)
    if (!recipe) noRecipe++
    const framed = it.kind === 'linear' && !!it.framing?.on
    const fromRecipe = recipe ? recipeMaterials([it], 1, recipeOf, ctx).map(m => [{ materialId: m.materialId ?? null, mat: m.mat, unit: m.unit, qty: m.qty }]) : []
    lines.push({
      layerId: it.key,
      recipeId: recipe?.id ?? null,
      recipeName: recipe?.name ?? null,
      description: it.system ? `${it.name} · ${it.system}` : it.name,
      unit,
      quantity,
      base,
      materialGroups: [...fromRecipe, ...(framed ? framingNeeds(it, sharedOf.get(it) || []) : [])],
      laborLines: recipe ? laborById.get(recipe.id) || [] : [],
      equipmentGroups: costGroups(recipe ? costsById.get(recipe.id) || [] : [], 'equipment', base),
      subcontractGroups: costGroups(recipe ? costsById.get(recipe.id) || [] : [], 'subcontract', base),
      framed,
    })
  }
  const uncalibrated = sources.filter(x => !(Number(x.scale_pt_per_m) > 0)).length
  return { lines, uncalibrated, noRecipe }
}
