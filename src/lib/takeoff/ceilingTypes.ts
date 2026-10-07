// Ceiling types (CL01, CL02…): build-ups stored in takeoff_wall_types with category 'ceiling'
// (spec in framing.ceiling), drawn as area items (IfcCovering.CEILING) linked by wall_type_id.
// The material quantities are estimates from the build-up: net quantities, no waste (add waste in purchasing).
import { perimeter, polyArea, type TakeoffItem } from './geometry'
import type { MaterialRequirement } from './recipes'
import { toImperial } from './surfaceUnits'

export const CEILING_CATEGORY = 'ceiling' as const
export const CEILING_IFC = 'IfcCovering.CEILING'

export type CeilingSystem = 'suspended' | 'direct' | 'self' | 'grid' | 'clipin' | 'pvc' | 'open'
export const CEILING_SYSTEMS: CeilingSystem[] = ['suspended', 'direct', 'self', 'grid', 'clipin', 'pvc', 'open']

export type CeilingSpec = {
  system: CeilingSystem
  /** Monolithic: profile spacing (m). */
  spacing_m?: number
  /** Distance between hangers / brackets along a profile or main tee (m). */
  hanger_m?: number
  /** Profile name (F530, M70…). */
  profile?: string
  /** Monolithic: board product and number of layers. */
  board?: string
  layers?: number
  /** Modular: tile size (m) and product. */
  tile_w_m?: number
  tile_l_m?: number
  tile?: string
  /** Insulation over the ceiling (e.g. "Lã de vidro 50 mm"); empty = none. */
  insulation?: string | null
  /** Monolithic: board sheet size (m), default 1,20 × 2,40; when set, the board name is shown as is (put the size in it). */
  sheet_w_m?: number
  sheet_l_m?: number
  /** Exposed grid: main tee spacing and length, cross and short tee lengths (m); default 1,25 / 3,75 / 1,25 / 0,625. */
  main_spacing_m?: number
  main_len_m?: number
  cross_len_m?: number
  short_len_m?: number
  /** Exposed grid: full product names of the tees (e.g. 15/16" main tee 12'), instead of the generic label + length. */
  main_name?: string
  cross_name?: string
  short_name?: string
  /** Suspended drywall hung from carrying channels (US): their spacing (m) and name; hangers then sit on them. */
  carrier_m?: number
  carrier_name?: string
  /** Show the estimate in ft, sf and lb (US). */
  imperial?: boolean
}

/** Ceiling type as stored (subset of a takeoff_wall_types row). */
export type CeilingTypeLike = { id?: string; code: string | null; name: string; thickness_m: number | null; framing: Record<string, unknown> | null; notes?: string | null }

export function ceilingSpecOf(framing: unknown): CeilingSpec | null {
  const c = (framing as { ceiling?: CeilingSpec } | null)?.ceiling
  return c && typeof c === 'object' && CEILING_SYSTEMS.includes(c.system) ? c : null
}

export const isMonolithic = (s: CeilingSystem) => s === 'suspended' || s === 'direct' || s === 'self'
export const isModular = (s: CeilingSystem) => s === 'grid' || s === 'clipin'

/** Standard list offered in the library (codes CL01…CL13). Names follow the wall notation: system/profile/spacing/board/insulation. */
export const STANDARD_CEILINGS: { code: string; name: string; thickness_m: number; spec: CeilingSpec; notes: { 'pt-BR': string; 'en-US': string } }[] = [
  { code: 'CL01', name: 'Suspenso F530/600/ST12,5', thickness_m: 0.0125, spec: { system: 'suspended', profile: 'Perfil F530', spacing_m: 0.6, hanger_m: 1.2, board: 'Chapa ST 12,5 mm', layers: 1 },
    notes: { 'pt-BR': 'Forro monolítico em áreas secas: salas, escritórios, circulações.', 'en-US': 'Monolithic ceiling for dry areas: rooms, offices, corridors.' } },
  { code: 'CL02', name: 'Suspenso F530/600/RU12,5', thickness_m: 0.0125, spec: { system: 'suspended', profile: 'Perfil F530', spacing_m: 0.6, hanger_m: 1.2, board: 'Chapa RU 12,5 mm', layers: 1 },
    notes: { 'pt-BR': 'Áreas úmidas: banheiros, copas, áreas de serviço.', 'en-US': 'Wet areas: bathrooms, kitchens, utility rooms.' } },
  { code: 'CL03', name: 'Suspenso F530/400/2×RF12,5', thickness_m: 0.025, spec: { system: 'suspended', profile: 'Perfil F530', spacing_m: 0.4, hanger_m: 1.0, board: 'Chapa RF 12,5 mm', layers: 2 },
    notes: { 'pt-BR': 'Forro resistente ao fogo; conferir o sistema ensaiado do fabricante.', 'en-US': "Fire-rated ceiling; check the manufacturer's tested system." } },
  { code: 'CL04', name: 'Suspenso F530/600/ST12,5/LV50', thickness_m: 0.0125, spec: { system: 'suspended', profile: 'Perfil F530', spacing_m: 0.6, hanger_m: 1.2, board: 'Chapa ST 12,5 mm', layers: 1, insulation: 'Lã de vidro 50 mm' },
    notes: { 'pt-BR': 'Conforto acústico/térmico: enfermarias, salas de reunião.', 'en-US': 'Acoustic/thermal comfort: wards, meeting rooms.' } },
  { code: 'CL05', name: 'Suspenso F530/400/ACU12,5', thickness_m: 0.0125, spec: { system: 'suspended', profile: 'Perfil F530', spacing_m: 0.4, hanger_m: 1.0, board: 'Chapa acústica perfurada 12,5 mm', layers: 1 },
    notes: { 'pt-BR': 'Placa perfurada com véu acústico: auditórios, áreas de espera.', 'en-US': 'Perforated board with acoustic fleece: auditoriums, waiting areas.' } },
  { code: 'CL06', name: 'Aderido F530/600/ST12,5', thickness_m: 0.0125, spec: { system: 'direct', profile: 'Perfil F530', spacing_m: 0.6, hanger_m: 0.6, board: 'Chapa ST 12,5 mm', layers: 1 },
    notes: { 'pt-BR': 'Fixado direto na laje com suportes, sem pendurais: pouco plenum, reformas.', 'en-US': 'Fixed to the slab with brackets, no hangers: low plenum, refurbishments.' } },
  { code: 'CL07', name: 'Autoportante M70/600/ST12,5', thickness_m: 0.0125, spec: { system: 'self', profile: 'Montante M70', spacing_m: 0.6, board: 'Chapa ST 12,5 mm', layers: 1 },
    notes: { 'pt-BR': 'Vão livre de parede a parede, sem pendurais: circulações com muitas instalações.', 'en-US': 'Spans wall to wall, no hangers: corridors packed with services.' } },
  { code: 'CL08', name: 'Modular T24/625×625/Fibra mineral', thickness_m: 0.015, spec: { system: 'grid', tile_w_m: 0.625, tile_l_m: 0.625, hanger_m: 1.2, tile: 'Placa de fibra mineral 625×625' },
    notes: { 'pt-BR': 'Removível em perfil T aparente: escritórios, corredores técnicos.', 'en-US': 'Removable tiles on an exposed T-grid: offices, technical corridors.' } },
  { code: 'CL09', name: 'Modular T24/625×625/Gesso vinílico', thickness_m: 0.008, spec: { system: 'grid', tile_w_m: 0.625, tile_l_m: 0.625, hanger_m: 1.2, tile: 'Placa de gesso revestida em vinil 625×625' },
    notes: { 'pt-BR': 'Lavável: hospitais, áreas limpas, laboratórios.', 'en-US': 'Washable: hospitals, clean areas, labs.' } },
  { code: 'CL10', name: 'Modular T24/625×1250/Lã de vidro', thickness_m: 0.02, spec: { system: 'grid', tile_w_m: 0.625, tile_l_m: 1.25, hanger_m: 1.2, tile: 'Painel de lã de vidro 625×1250' },
    notes: { 'pt-BR': 'Acústico: escritórios abertos, salões.', 'en-US': 'Acoustic: open offices, large rooms.' } },
  { code: 'CL11', name: 'Modular Clip-in/600×600/Metálico', thickness_m: 0.005, spec: { system: 'clipin', tile_w_m: 0.6, tile_l_m: 0.6, hanger_m: 1.2, tile: 'Placa metálica clip-in 600×600' },
    notes: { 'pt-BR': 'Grelha oculta: áreas de higiene e grande circulação.', 'en-US': 'Concealed grid: hygiene and high-traffic areas.' } },
  { code: 'CL12', name: 'Lambril PVC/200', thickness_m: 0.008, spec: { system: 'pvc', spacing_m: 0.5, tile: 'Lambril de PVC 200 mm' },
    notes: { 'pt-BR': 'Baixo custo, lavável: áreas técnicas, garagens.', 'en-US': 'Low cost, washable: utility areas, garages.' } },
  { code: 'CL13', name: 'Linear metálico / baffle', thickness_m: 0.02, spec: { system: 'open', hanger_m: 1.2, tile: 'Painel linear metálico' },
    notes: { 'pt-BR': 'Forro arquitetônico aberto ou semiaberto: halls, áreas nobres.', 'en-US': 'Open or semi-open architectural ceiling: lobbies, feature areas.' } },
]

/** Words used for the material lines (translated by the caller). */
export type CeilingLabels = {
  hangers: string
  brackets: string
  perimeterAngle: string
  perimeterTrack: string
  mainTee: string
  crossTee: string
  shortTee: string
  carrier: string
  frame: string
  perimeterTrim: string
  screws: string
  sheets: string
  pieces: string
}

type Line = { mat: string; unit: string; qty: number }

/** Materials for one ceiling build-up over `areaM2` with `perimeterM` of edges (net quantities). */
export function ceilingLines(spec: CeilingSpec, areaM2: number, perimeterM: number, L: CeilingLabels): Line[] {
  const A = Math.max(0, areaM2)
  const P = Math.max(0, perimeterM)
  if (!A) return []
  const out: Line[] = []
  const s = spec.spacing_m && spec.spacing_m > 0 ? spec.spacing_m : 0.6
  const h = spec.hanger_m && spec.hanger_m > 0 ? spec.hanger_m : 1.2
  const push = (mat: string, unit: string, qty: number) => { if (qty > 0) out.push({ mat, unit, qty }) }
  if (isMonolithic(spec.system)) {
    const layers = Math.max(1, Math.round(spec.layers || 1))
    push(spec.profile || 'Perfil F530', 'm', A / s)
    const carrier = spec.system === 'suspended' && spec.carrier_m && spec.carrier_m > 0 ? spec.carrier_m : 0
    if (carrier) push(spec.carrier_name || L.carrier, 'm', A / carrier)
    if (spec.system === 'suspended') push(L.hangers, 'un', Math.ceil(A / ((carrier || s) * h)))
    if (spec.system === 'direct') push(L.brackets, 'un', Math.ceil(A / (s * h)))
    push(spec.system === 'self' ? L.perimeterTrack : L.perimeterAngle, 'm', P)
    const board = spec.board || 'Chapa ST 12,5 mm'
    const sized = !!(spec.sheet_w_m && spec.sheet_l_m)
    const sheet = sized ? spec.sheet_w_m! * spec.sheet_l_m! : 2.88
    push(sized ? board : `${board} · 1,20 × 2,40 m`, L.sheets, Math.ceil((A * layers) / sheet))
    // Screws every ~30 cm along each profile, per board layer.
    push(L.screws, 'un', Math.ceil((A / s / 0.3) * layers))
  } else if (isModular(spec.system)) {
    const w = spec.tile_w_m && spec.tile_w_m > 0 ? spec.tile_w_m : 0.625
    const l = spec.tile_l_m && spec.tile_l_m > 0 ? spec.tile_l_m : w
    push(spec.tile || `${w * 1000}×${l * 1000}`, 'un', Math.ceil(A / (w * l)))
    if (spec.system === 'grid') {
      // Main tees every main spacing; cross tees (as long as the main spacing) every tile width;
      // short tees between them, mid-way between mains, on square modules smaller than the main spacing.
      const ms = spec.main_spacing_m && spec.main_spacing_m > 0 ? spec.main_spacing_m : 1.25
      const ml = spec.main_len_m && spec.main_len_m > 0 ? spec.main_len_m : 3.75
      const cl = spec.cross_len_m && spec.cross_len_m > 0 ? spec.cross_len_m : ms
      const sl = spec.short_len_m && spec.short_len_m > 0 ? spec.short_len_m : 0.625
      const len = (v: number) => `${String(Math.round(v * 1000) / 1000).replace('.', ',')} m`
      const main = A / ms
      push(spec.main_name || `${L.mainTee} ${len(ml)}`, 'un', Math.ceil(main / ml))
      push(spec.cross_name || `${L.crossTee} ${len(cl)}`, 'un', Math.ceil(A / w / cl))
      if (Math.abs(w - l) < 1e-6 && w < ms - 1e-6) push(spec.short_name || `${L.shortTee} ${len(sl)}`, 'un', Math.ceil(main / sl))
      push(L.hangers, 'un', Math.ceil(main / h))
    } else {
      push(L.carrier, 'm', A / 1.2)
      push(L.hangers, 'un', Math.ceil(A / (1.2 * h)))
    }
    push(L.perimeterAngle, 'm', P)
  } else if (spec.system === 'pvc') {
    push(spec.tile || 'Lambril de PVC', 'm²', A)
    push(L.frame, 'm', A / s)
    push(L.perimeterTrim, 'm', P)
  } else {
    push(spec.tile || 'Painel', 'm²', A)
    push(L.hangers, 'un', Math.ceil(A / (1.2 * h)))
  }
  if (spec.insulation) push(spec.insulation, 'm²', A)
  return spec.imperial ? toImperial(out) : out
}

/** Ceiling materials of every ceiling-type area in `items`, summed by material. */
export function ceilingMaterials(items: TakeoffItem[], ptPerM: number, L: CeilingLabels): MaterialRequirement[] {
  if (!(ptPerM > 0)) return []
  const acc = new Map<string, MaterialRequirement>()
  for (const it of items) {
    if (it.kind !== 'area' || !it.ceiling) continue
    let A = 0
    let P = 0
    for (const sh of it.shapes) {
      if (sh.pts.length < 3) continue
      A += polyArea(sh.pts) / (ptPerM * ptPerM)
      P += perimeter(sh.pts) / ptPerM
    }
    for (const line of ceilingLines(it.ceiling, A, P, L)) {
      const key = `${line.mat}|${line.unit}`
      const cur = acc.get(key)
      if (cur) { cur.qty += line.qty; if (!cur.from.includes(it.name)) cur.from.push(it.name) }
      else acc.set(key, { mat: line.mat, code: null, unit: line.unit, qty: line.qty, packs: null, packName: null, from: [it.name] })
    }
  }
  return [...acc.values()]
}

/** Row to insert into takeoff_layers when the user picks a ceiling type: an area at the ceiling height. */
export function layerFromCeilingType(
  ct: CeilingTypeLike & { id: string; recipe_id?: string | null },
  opts: { projectId: string; color: string; sortOrder: number; elevationM: number },
) {
  const spec = ceilingSpecOf(ct.framing)
  const colour = (ct.framing as { color?: unknown } | null)?.color
  return {
    project_id: opts.projectId,
    kind: 'area' as const,
    name: ct.code ? `${ct.code} – ${ct.name}` : ct.name,
    color: typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour) ? colour : opts.color,
    elevation_m: Math.round(Math.max(0, opts.elevationM) * 1000) / 1000,
    thickness_m: ct.thickness_m && ct.thickness_m > 0 ? ct.thickness_m : 0.0125,
    framing: { meta: { ifcType: CEILING_IFC, ...(spec ? { ceiling: spec } : {}) } },
    recipe_id: ct.recipe_id ?? null,
    wall_type_id: ct.id,
    sort_order: opts.sortOrder,
  }
}
