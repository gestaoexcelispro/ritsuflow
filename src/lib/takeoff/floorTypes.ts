// Floor types (FL01, FL02…): finishes stored in takeoff_wall_types with category 'floor'
// (spec in framing.floor), drawn as area items (IfcCovering.FLOORING) linked by wall_type_id.
// Quantities are estimates from the build-up; the covering includes the type's cutting waste,
// setting materials (adhesive, grout, primer…) are net.
import { perimeter, polyArea, type TakeoffItem } from './geometry'
import type { MaterialRequirement } from './recipes'
import { toImperial } from './surfaceUnits'

export const FLOOR_CATEGORY = 'floor' as const
export const FLOOR_IFC = 'IfcCovering.FLOORING'

export type FloorSystem = 'tile' | 'vinyl_sheet' | 'vinyl_tile' | 'raised' | 'resin' | 'laminate' | 'carpet' | 'screed' | 'other'
export const FLOOR_SYSTEMS: FloorSystem[] = ['tile', 'vinyl_sheet', 'vinyl_tile', 'raised', 'resin', 'laminate', 'carpet', 'screed', 'other']

export type FloorSpec = {
  system: FloorSystem
  /** Covering product (tile, sheet, plank, panel, resin…). */
  product?: string
  /** Tiles / panels / carpet tiles: piece size (m). */
  tile_w_m?: number
  tile_l_m?: number
  /** Tiles: joint width and tile thickness (mm), for the grout estimate. */
  joint_mm?: number
  tile_mm?: number
  /** Setting adhesive (kg/m², or `adhesive_unit` per m²) and its product name. */
  adhesive_kg_m2?: number
  adhesive?: string
  /** Unit of the adhesive rate when it is not kg (e.g. 'gal' per m² for US vinyl adhesives). */
  adhesive_unit?: string
  /** Vinyl sheet: roll width (m), for the weld rod along the seams. */
  roll_w_m?: number
  /** Resin / screed: thickness (mm); resin consumption (kg per m² per mm). */
  thickness_mm?: number
  kg_m2_mm?: number
  /** Laminate / wood: underlay product. */
  underlay?: string
  /** Skirting along the perimeter (empty = none). */
  skirting?: string
  /** Cutting waste on the covering (%). */
  waste_pct?: number
  /** Show the estimate in ft, sf, lb and yd³ (US). */
  imperial?: boolean
}

export type FloorTypeLike = { id?: string; code: string | null; name: string; thickness_m: number | null; framing: Record<string, unknown> | null; notes?: string | null }

export function floorSpecOf(framing: unknown): FloorSpec | null {
  const f = (framing as { floor?: FloorSpec } | null)?.floor
  return f && typeof f === 'object' && FLOOR_SYSTEMS.includes(f.system) ? f : null
}

/** Standard list offered in the library (codes FL01…FL12). */
export const STANDARD_FLOORS: { code: string; color: string; name: string; thickness_m: number; spec: FloorSpec; notes: { 'pt-BR': string; 'en-US': string } }[] = [
  { code: 'FL01', color: '#EA580C', name: 'Porcelanato 60×60 retificado', thickness_m: 0.009,
    spec: { system: 'tile', product: 'Porcelanato 60×60', tile_w_m: 0.6, tile_l_m: 0.6, joint_mm: 2, tile_mm: 9, adhesive_kg_m2: 5, adhesive: 'Argamassa colante ACIII', skirting: 'Rodapé porcelanato h=7 cm', waste_pct: 10 },
    notes: { 'pt-BR': 'Áreas secas e circulações; dupla colagem.', 'en-US': 'Dry areas and corridors; back-buttered.' } },
  { code: 'FL02', color: '#9F1239', name: 'Porcelanato 90×90 retificado', thickness_m: 0.01,
    spec: { system: 'tile', product: 'Porcelanato 90×90', tile_w_m: 0.9, tile_l_m: 0.9, joint_mm: 2, tile_mm: 10, adhesive_kg_m2: 6, adhesive: 'Argamassa colante ACIII', skirting: 'Rodapé porcelanato h=7 cm', waste_pct: 12 },
    notes: { 'pt-BR': 'Halls e áreas nobres; mais perda de corte.', 'en-US': 'Lobbies and feature areas; more cutting waste.' } },
  { code: 'FL03', color: '#EAB308', name: 'Cerâmica 45×45 áreas molhadas', thickness_m: 0.008,
    spec: { system: 'tile', product: 'Cerâmica 45×45 PEI 4', tile_w_m: 0.45, tile_l_m: 0.45, joint_mm: 3, tile_mm: 8, adhesive_kg_m2: 4, adhesive: 'Argamassa colante ACII', waste_pct: 10 },
    notes: { 'pt-BR': 'Banheiros, copas e áreas de serviço (rodapé pelo revestimento de parede).', 'en-US': 'Bathrooms, kitchens and utility rooms (skirting comes with the wall tiling).' } },
  { code: 'FL04', color: '#854D0E', name: 'Vinílico manta hospitalar 2,0 mm soldada', thickness_m: 0.002,
    spec: { system: 'vinyl_sheet', product: 'Manta vinílica hospitalar 2,0 mm', roll_w_m: 2, adhesive_kg_m2: 0.35, adhesive: 'Adesivo acrílico para vinílico', skirting: 'Rodapé vinílico boleado (meia-cana)', waste_pct: 8 },
    notes: { 'pt-BR': 'Hospitais: emendas soldadas a quente e rodapé boleado, sem frestas.', 'en-US': 'Hospitals: heat-welded seams and coved skirting, no gaps.' } },
  { code: 'FL05', color: '#78716C', name: 'Vinílico LVT régua 3 mm colado', thickness_m: 0.003,
    spec: { system: 'vinyl_tile', product: 'Régua vinílica LVT 3 mm', adhesive_kg_m2: 0.35, adhesive: 'Adesivo acrílico para vinílico', skirting: 'Rodapé vinílico h=7 cm', waste_pct: 8 },
    notes: { 'pt-BR': 'Consultórios, quartos e escritórios.', 'en-US': 'Consulting rooms, bedrooms and offices.' } },
  { code: 'FL06', color: '#EF4444', name: 'Piso elevado 600×600', thickness_m: 0.03,
    spec: { system: 'raised', product: 'Placa de piso elevado 600×600', tile_w_m: 0.6, tile_l_m: 0.6, waste_pct: 3 },
    notes: { 'pt-BR': 'Salas técnicas, TI e CPD (altura pelos pedestais).', 'en-US': 'Technical rooms, IT and data rooms (height set by the pedestals).' } },
  { code: 'FL07', color: '#9A3412', name: 'Epóxi autonivelante 2 mm', thickness_m: 0.002,
    spec: { system: 'resin', product: 'Resina epóxi autonivelante', thickness_mm: 2, kg_m2_mm: 1.6, skirting: 'Rodapé epóxi meia-cana', waste_pct: 5 },
    notes: { 'pt-BR': 'Laboratórios, áreas limpas e técnicas.', 'en-US': 'Labs, clean and technical areas.' } },
  { code: 'FL08', color: '#D97706', name: 'Poliuretano cimentício 6 mm', thickness_m: 0.006,
    spec: { system: 'resin', product: 'Poliuretano cimentício', thickness_mm: 6, kg_m2_mm: 2, skirting: 'Rodapé PU meia-cana', waste_pct: 5 },
    notes: { 'pt-BR': 'Cozinhas industriais e áreas de lavagem (CME, expurgo).', 'en-US': 'Industrial kitchens and wash-down areas.' } },
  { code: 'FL09', color: '#44403C', name: 'Laminado flutuante 7 mm', thickness_m: 0.007,
    spec: { system: 'laminate', product: 'Piso laminado 7 mm', underlay: 'Manta de polietileno 2 mm', skirting: 'Rodapé MDF h=7 cm', waste_pct: 8 },
    notes: { 'pt-BR': 'Áreas administrativas secas.', 'en-US': 'Dry administrative areas.' } },
  { code: 'FL10', color: '#7F1D1D', name: 'Carpete em placas 50×50', thickness_m: 0.006,
    spec: { system: 'carpet', product: 'Carpete em placas 50×50', tile_w_m: 0.5, tile_l_m: 0.5, adhesive_kg_m2: 0.15, adhesive: 'Adesivo fixador (tackifier)', skirting: 'Rodapé MDF h=7 cm', waste_pct: 5 },
    notes: { 'pt-BR': 'Escritórios, auditórios e salas de reunião.', 'en-US': 'Offices, auditoriums and meeting rooms.' } },
  { code: 'FL11', color: '#CA8A04', name: 'Contrapiso argamassa 4 cm', thickness_m: 0.04,
    spec: { system: 'screed', product: 'Argamassa de contrapiso', thickness_mm: 40, waste_pct: 5 },
    notes: { 'pt-BR': 'Regularização sob o revestimento.', 'en-US': 'Levelling screed under the finish.' } },
  { code: 'FL12', color: '#B45309', name: 'Concreto polido', thickness_m: 0.001,
    spec: { system: 'other', product: 'Polimento de concreto' },
    notes: { 'pt-BR': 'Garagens, depósitos e áreas industriais.', 'en-US': 'Car parks, storage and industrial areas.' } },
]

export type FloorLabels = {
  pieces: string
  grout: string
  primer: string
  weldRod: string
  pedestals: string
  underlay: string
  mortar: string
}

type Line = { mat: string; unit: string; qty: number }

/** Materials for one floor build-up over `areaM2` with `perimeterM` of edges. */
export function floorLines(spec: FloorSpec, areaM2: number, perimeterM: number, L: FloorLabels): Line[] {
  const A = Math.max(0, areaM2)
  const P = Math.max(0, perimeterM)
  if (!A) return []
  const out: Line[] = []
  const push = (mat: string, unit: string, qty: number) => { if (qty > 0) out.push({ mat, unit, qty }) }
  const waste = 1 + Math.max(0, spec.waste_pct || 0) / 100
  const product = spec.product || ''
  const w = spec.tile_w_m && spec.tile_w_m > 0 ? spec.tile_w_m : 0
  const l = spec.tile_l_m && spec.tile_l_m > 0 ? spec.tile_l_m : w
  const adhUnit = spec.adhesive_unit || 'kg'
  const pieces = (name: string) => { if (w > 0) push(`${name} (${L.pieces})`, 'un', Math.ceil((A * waste) / (w * l))) }
  switch (spec.system) {
    case 'tile': {
      push(product || 'Revestimento', 'm²', A * waste)
      pieces(product || 'Revestimento')
      if (spec.adhesive_kg_m2) push(spec.adhesive || 'Argamassa colante', adhUnit, A * spec.adhesive_kg_m2)
      // Grout (kg/m²) = (C + L) × joint × thickness × 1,58 / (C × L), sizes in mm.
      if (w > 0 && spec.joint_mm && spec.tile_mm) {
        const C = w * 1000
        const Lm = l * 1000
        push(L.grout, 'kg', A * ((C + Lm) * spec.joint_mm * spec.tile_mm * 1.58) / (C * Lm))
      }
      break
    }
    case 'vinyl_sheet':
      push(product || 'Manta vinílica', 'm²', A * waste)
      if (spec.adhesive_kg_m2) push(spec.adhesive || 'Adesivo', adhUnit, A * spec.adhesive_kg_m2)
      // Weld rod along the seams between rolls (and up the coved skirting joints, ignored here).
      push(L.weldRod, 'm', A / (spec.roll_w_m && spec.roll_w_m > 0 ? spec.roll_w_m : 2))
      break
    case 'vinyl_tile':
    case 'carpet':
      push(product || 'Revestimento', 'm²', A * waste)
      pieces(product || 'Revestimento')
      if (spec.adhesive_kg_m2) push(spec.adhesive || 'Adesivo', adhUnit, A * spec.adhesive_kg_m2)
      break
    case 'raised': {
      const pw = w || 0.6
      const pl = l || pw
      push(`${product || 'Placa de piso elevado'} (${L.pieces})`, 'un', Math.ceil((A * waste) / (pw * pl)))
      // One pedestal per panel corner, shared by four panels.
      push(L.pedestals, 'un', Math.ceil(A / (pw * pl)))
      break
    }
    case 'resin': {
      const t = spec.thickness_mm && spec.thickness_mm > 0 ? spec.thickness_mm : 2
      const c = spec.kg_m2_mm && spec.kg_m2_mm > 0 ? spec.kg_m2_mm : 1.6
      push(product || 'Resina', 'kg', A * t * c * waste)
      push(L.primer, 'kg', A * 0.3)
      break
    }
    case 'laminate':
      push(product || 'Piso laminado', 'm²', A * waste)
      push(spec.underlay || L.underlay, 'm²', A * 1.05)
      break
    case 'screed': {
      const t = spec.thickness_mm && spec.thickness_mm > 0 ? spec.thickness_mm : 40
      push(product || L.mortar, 'm³', (A * t * waste) / 1000)
      break
    }
    default:
      push(product || 'Piso', 'm²', A)
  }
  if (spec.skirting) push(spec.skirting, 'm', P * waste)
  return spec.imperial ? toImperial(out) : out
}

/** Floor materials of every floor-type area in `items`, summed by material. */
export function floorMaterials(items: TakeoffItem[], ptPerM: number, L: FloorLabels): MaterialRequirement[] {
  if (!(ptPerM > 0)) return []
  const acc = new Map<string, MaterialRequirement>()
  for (const it of items) {
    if (it.kind !== 'area' || !it.floor) continue
    let A = 0
    let P = 0
    for (const sh of it.shapes) {
      if (sh.pts.length < 3) continue
      A += polyArea(sh.pts) / (ptPerM * ptPerM)
      P += perimeter(sh.pts) / ptPerM
    }
    for (const line of floorLines(it.floor, A, P, L)) {
      const key = `${line.mat}|${line.unit}`
      const cur = acc.get(key)
      if (cur) { cur.qty += line.qty; if (!cur.from.includes(it.name)) cur.from.push(it.name) }
      else acc.set(key, { mat: line.mat, code: null, unit: line.unit, qty: line.qty, packs: null, packName: null, from: [it.name] })
    }
  }
  return [...acc.values()]
}

/** Row to insert into takeoff_layers when the user picks a floor type: an area at the floor level. */
export function layerFromFloorType(
  ft: FloorTypeLike & { id: string; recipe_id?: string | null },
  opts: { projectId: string; color: string; sortOrder: number; elevationM: number },
) {
  const spec = floorSpecOf(ft.framing)
  const colour = (ft.framing as { color?: unknown } | null)?.color
  return {
    project_id: opts.projectId,
    kind: 'area' as const,
    name: ft.code ? `${ft.code} – ${ft.name}` : ft.name,
    color: typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour) ? colour : opts.color,
    elevation_m: Math.round(Math.max(0, opts.elevationM) * 1000) / 1000,
    thickness_m: ft.thickness_m && ft.thickness_m > 0 ? ft.thickness_m : 0.01,
    framing: { meta: { ifcType: FLOOR_IFC, ...(spec ? { floor: spec } : {}) } },
    recipe_id: ft.recipe_id ?? null,
    wall_type_id: ft.id,
    sort_order: opts.sortOrder,
  }
}
