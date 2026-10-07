// Ceiling types and floor types share one library screen and one picker; a "family" says what
// differs: table category, code prefix, systems, build-up fields, standard list, materials and texts.
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import type { TakeoffItem } from '@/lib/takeoff/geometry'
import type { MaterialRequirement } from '@/lib/takeoff/recipes'
import {
  CEILING_CATEGORY, CEILING_SYSTEMS, STANDARD_CEILINGS, ceilingLines, ceilingMaterials, ceilingSpecOf, layerFromCeilingType, type CeilingLabels, type CeilingSpec,
} from '@/lib/takeoff/ceilingTypes'
import {
  FLOOR_CATEGORY, FLOOR_SYSTEMS, STANDARD_FLOORS, floorLines, floorMaterials, floorSpecOf, layerFromFloorType, type FloorLabels, type FloorSpec,
} from '@/lib/takeoff/floorTypes'

export type FamilyId = 'ceiling' | 'floor'
export type SurfaceLabels = { ceiling: CeilingLabels; floor: FloorLabels }
type Spec = { system: string } & Record<string, unknown>
type Line = { mat: string; unit: string; qty: number }

/** One build-up field of the type form, shown for the listed systems. */
export type SpecField = {
  key: string
  label: TakeoffMessageKey | ((system: string) => TakeoffMessageKey)
  type: 'text' | 'number' | 'int'
  placeholder?: string
  systems: string[] | 'all'
  /** Numbers that may be zero (e.g. waste %). */
  allowZero?: boolean
}

type Msg =
  | 'title' | 'subtitle' | 'new' | 'newName' | 'addStandard' | 'standardHint' | 'standardAdded' | 'standardAll' | 'empty' | 'select' | 'saved'
  | 'confirmDelete' | 'needsMigration' | 'pickButton' | 'pickTitle' | 'openLibrary' | 'pickEmpty' | 'height' | 'heightInvalid' | 'itemCreated'
  | 'preview' | 'previewHint' | 'materials' | 'materialsNote' | 'thisMaterials'

export type SurfaceFamily = {
  id: FamilyId
  /** takeoff_wall_types.category */
  category: string
  codePrefix: string
  color: string
  defaultThickness: number
  systems: string[]
  systemKey: Record<string, TakeoffMessageKey>
  fields: SpecField[]
  standard: { code: string; name: string; thickness_m: number; spec: Spec; notes: { 'pt-BR': string; 'en-US': string } }[]
  msg: Record<Msg, TakeoffMessageKey>
  /** Key of the build-up in takeoff_wall_types.framing and in the layer's framing.meta. */
  specKey: 'ceiling' | 'floor'
  specOf: (framing: unknown) => Spec | null
  lines: (spec: Spec, areaM2: number, perimeterM: number, labels: SurfaceLabels) => Line[]
  materials: (items: TakeoffItem[], ptPerM: number, labels: SurfaceLabels) => MaterialRequirement[]
  layerFrom: (t: { id: string; code: string | null; name: string; thickness_m: number | null; framing: Record<string, unknown> | null; recipe_id?: string | null }, opts: { projectId: string; color: string; sortOrder: number; elevationM: number }) => Record<string, unknown>
  /** Default level for a new item: ceilings just below the walls, floors at 0. */
  defaultHeight: (wallTop: number) => number
  /** Whether the picker asks for a height (ceilings) or not (floors sit on the level). */
  asksHeight: boolean
}

const mono = ['suspended', 'direct', 'self']

export const CEILING_FAMILY: SurfaceFamily = {
  id: 'ceiling',
  category: CEILING_CATEGORY,
  codePrefix: 'CL',
  color: '#7C3AED',
  defaultThickness: 0.0125,
  systems: CEILING_SYSTEMS,
  systemKey: {
    suspended: 'ceiling.system.suspended', direct: 'ceiling.system.direct', self: 'ceiling.system.self', grid: 'ceiling.system.grid',
    clipin: 'ceiling.system.clipin', pvc: 'ceiling.system.pvc', open: 'ceiling.system.open',
  },
  fields: [
    { key: 'profile', label: 'ceiling.profile', type: 'text', placeholder: 'Perfil F530', systems: mono },
    { key: 'spacing_m', label: 'ceiling.spacing', type: 'number', placeholder: '0,6', systems: [...mono, 'pvc'] },
    { key: 'hanger_m', label: s => (s === 'direct' ? 'ceiling.bracketSpacing' : 'ceiling.hangerSpacing'), type: 'number', placeholder: '1,2', systems: ['suspended', 'direct', 'grid', 'clipin', 'open'] },
    { key: 'board', label: 'ceiling.board', type: 'text', placeholder: 'Chapa ST 12,5 mm', systems: mono },
    { key: 'layers', label: 'ceiling.layers', type: 'int', placeholder: '1', systems: mono },
    { key: 'tile', label: 'ceiling.tile', type: 'text', systems: ['grid', 'clipin', 'pvc', 'open'] },
    { key: 'tile_w_m', label: 'ceiling.tileW', type: 'number', placeholder: '0,625', systems: ['grid', 'clipin'] },
    { key: 'tile_l_m', label: 'ceiling.tileL', type: 'number', placeholder: '0,625', systems: ['grid', 'clipin'] },
    { key: 'insulation', label: 'ceiling.insulation', type: 'text', systems: 'all' },
  ],
  standard: STANDARD_CEILINGS as SurfaceFamily['standard'],
  msg: {
    title: 'ceiling.title', subtitle: 'ceiling.subtitle', new: 'ceiling.new', newName: 'ceiling.newName', addStandard: 'ceiling.addStandard',
    standardHint: 'ceiling.standardHint', standardAdded: 'ceiling.standardAdded', standardAll: 'ceiling.standardAll', empty: 'ceiling.empty',
    select: 'ceiling.select', saved: 'ceiling.saved', confirmDelete: 'ceiling.confirmDelete', needsMigration: 'ceiling.needsMigration',
    pickButton: 'ceiling.pickButton', pickTitle: 'ceiling.pickTitle', openLibrary: 'ceiling.openLibrary', pickEmpty: 'ceiling.pickEmpty',
    height: 'ceiling.height', heightInvalid: 'ceiling.heightInvalid', itemCreated: 'ceiling.itemCreated', preview: 'ceiling.preview',
    previewHint: 'ceiling.previewHint', materials: 'ceiling.materials', materialsNote: 'ceiling.materialsNote', thisMaterials: 'ceiling.thisMaterials',
  },
  specKey: 'ceiling',
  specOf: f => ceilingSpecOf(f) as Spec | null,
  lines: (spec, A, P, L) => ceilingLines(spec as unknown as CeilingSpec, A, P, L.ceiling),
  materials: (items, k, L) => ceilingMaterials(items, k, L.ceiling),
  layerFrom: (t, o) => layerFromCeilingType(t, o),
  defaultHeight: wallTop => Math.min(2.6, wallTop ? wallTop - 0.2 : 2.6),
  asksHeight: true,
}

export const FLOOR_FAMILY: SurfaceFamily = {
  id: 'floor',
  category: FLOOR_CATEGORY,
  codePrefix: 'FL',
  color: '#B7791F',
  defaultThickness: 0.01,
  systems: FLOOR_SYSTEMS,
  systemKey: {
    tile: 'floortype.system.tile', vinyl_sheet: 'floortype.system.vinyl_sheet', vinyl_tile: 'floortype.system.vinyl_tile', raised: 'floortype.system.raised',
    resin: 'floortype.system.resin', laminate: 'floortype.system.laminate', carpet: 'floortype.system.carpet', screed: 'floortype.system.screed', other: 'floortype.system.other',
  },
  fields: [
    { key: 'product', label: 'floortype.product', type: 'text', systems: 'all' },
    { key: 'tile_w_m', label: 'floortype.tileW', type: 'number', placeholder: '0,6', systems: ['tile', 'vinyl_tile', 'raised', 'carpet'] },
    { key: 'tile_l_m', label: 'floortype.tileL', type: 'number', placeholder: '0,6', systems: ['tile', 'vinyl_tile', 'raised', 'carpet'] },
    { key: 'joint_mm', label: 'floortype.joint', type: 'number', placeholder: '2', systems: ['tile'] },
    { key: 'tile_mm', label: 'floortype.tileThickness', type: 'number', placeholder: '9', systems: ['tile'] },
    { key: 'adhesive', label: 'floortype.adhesive', type: 'text', systems: ['tile', 'vinyl_sheet', 'vinyl_tile', 'carpet'] },
    { key: 'adhesive_kg_m2', label: 'floortype.adhesiveKg', type: 'number', placeholder: '5', systems: ['tile', 'vinyl_sheet', 'vinyl_tile', 'carpet'] },
    { key: 'roll_w_m', label: 'floortype.rollWidth', type: 'number', placeholder: '2', systems: ['vinyl_sheet'] },
    { key: 'thickness_mm', label: 'floortype.thicknessMm', type: 'number', placeholder: '2', systems: ['resin', 'screed'] },
    { key: 'kg_m2_mm', label: 'floortype.consumption', type: 'number', placeholder: '1,6', systems: ['resin'] },
    { key: 'underlay', label: 'floortype.underlay', type: 'text', systems: ['laminate'] },
    { key: 'skirting', label: 'floortype.skirting', type: 'text', systems: 'all' },
    { key: 'waste_pct', label: 'floortype.waste', type: 'number', placeholder: '10', systems: 'all', allowZero: true },
  ],
  standard: STANDARD_FLOORS as SurfaceFamily['standard'],
  msg: {
    title: 'floortype.title', subtitle: 'floortype.subtitle', new: 'floortype.new', newName: 'floortype.newName', addStandard: 'floortype.addStandard',
    standardHint: 'floortype.standardHint', standardAdded: 'floortype.standardAdded', standardAll: 'floortype.standardAll', empty: 'floortype.empty',
    select: 'floortype.select', saved: 'floortype.saved', confirmDelete: 'floortype.confirmDelete', needsMigration: 'floortype.needsMigration',
    pickButton: 'floortype.pickButton', pickTitle: 'floortype.pickTitle', openLibrary: 'floortype.openLibrary', pickEmpty: 'floortype.pickEmpty',
    height: 'floortype.height', heightInvalid: 'floortype.heightInvalid', itemCreated: 'floortype.itemCreated', preview: 'floortype.preview',
    previewHint: 'floortype.previewHint', materials: 'floortype.materials', materialsNote: 'floortype.materialsNote', thisMaterials: 'floortype.thisMaterials',
  },
  specKey: 'floor',
  specOf: f => floorSpecOf(f) as Spec | null,
  lines: (spec, A, P, L) => floorLines(spec as unknown as FloorSpec, A, P, L.floor),
  materials: (items, k, L) => floorMaterials(items, k, L.floor),
  layerFrom: (t, o) => layerFromFloorType(t, o),
  defaultHeight: () => 0,
  asksHeight: false,
}

export const FAMILIES: Record<FamilyId, SurfaceFamily> = { ceiling: CEILING_FAMILY, floor: FLOOR_FAMILY }

/** Ceiling and floor materials of the items, each list on its own. */
export function surfaceMaterials(items: TakeoffItem[], ptPerM: number, labels: SurfaceLabels): { family: SurfaceFamily; materials: MaterialRequirement[] }[] {
  return [CEILING_FAMILY, FLOOR_FAMILY].map(family => ({ family, materials: family.materials(items, ptPerM, labels) })).filter(x => x.materials.length > 0)
}

/** Missing-migration errors (category check) read as a hint instead of a raw constraint message. */
export const familyDbError = (message: string) => /category/i.test(message) && /check|constraint/i.test(message)
