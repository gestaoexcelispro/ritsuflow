// Shared takeoff types and plane geometry. Points are in sheet units (PDF points,
// or the IFC virtual sheet at 40 pt/m); `ptPerM` converts them to metres.

export type Vec2 = [number, number]

export type OpeningKind = 'door' | 'window' | 'void' | 'other'

export type ElementOpening = {
  /** Centre of the opening along the element polyline, in metres from its start. */
  off: number
  w: number
  h: number
  sill: number
  kind: OpeningKind
  guid: string | null
}

export type TakeoffShape = {
  /** Database id of the element, when loaded from storage. */
  id?: string
  page: number
  pts: Vec2[]
  /** Height override in metres (otherwise the layer height applies). */
  h?: number
  zrel?: number
  guid?: string | null
  root?: string | null
  layerGuids?: (string | null)[]
  openings?: ElementOpening[]
  sill?: number
  faceA?: string
  faceB?: string
  flipFaces?: boolean
  /** Tag of each straight stretch (pts[i] → pts[i+1]), e.g. "DW01-03". */
  tags?: string[]
  /** Tag of each opening (door / window / void), aligned with `openings`. */
  openingTags?: string[]
}

export type LayerKind = 'linear' | 'area' | 'count'

export type FramingConfig = {
  on: boolean
  spacing: number
  doorJamb: number
  winJamb: number
  studGap: number
  headerExtra: number
  studName: string
  trackName: string
  /** Commercial bar lengths in metres, ascending (e.g. [3]). */
  bars: number[]
  boardW: number
  boardH: number
  faceOffset: number
  boardA: string
  boardB: string
  layersA: number
  layersB: number
  /** Extra full-height studs at each L-corner between framed walls (default 1). */
  cornerStuds?: number
  /** Extra full-height studs in the continuing wall at each T-junction (default 2). */
  teeStuds?: number
  /** Screws calculated from the layout instead of the recipe (default true). */
  screwsFromLayout?: boolean
  /** Board-to-steel screw spacing along studs and tracks (m, default 0.25). */
  screwSpacing?: number
  /** Steel-to-steel screws per stud end fixed in a track or header (default 2). */
  laPerStudEnd?: number
  taName?: string
  laName?: string
  /** Fixing to other systems (slab, ceiling, existing walls): anchors and acoustic band from the layout. Unset = not counted by the layout. */
  fixings?: FixingsConfig | null
}

/** Where the framing touches another construction system. */
export type ContactPlaces = { floor: boolean; ceiling: boolean; walls: boolean }

export type FixingsConfig = {
  /** Anchor spacing along the track (m). */
  anchorSpacing: number
  /** Largest distance from a track end to its first anchor (m). */
  anchorEdge: number
  anchorAt: ContactPlaces
  anchorName: string
  /** Acoustic band under / against the profiles touching another system. */
  bandAt: ContactPlaces
  bandName: string
  /** Metres per roll (whole quantity); null = sold by the metre. */
  bandRoll?: number | null
}

export type TakeoffItem = {
  key: string
  kind: LayerKind
  name: string
  system: string
  color: string
  thickness?: number
  height?: number
  elevation?: number
  width?: number
  sill?: number
  location?: string
  deductOpenings?: boolean
  /** 3D view: 0 = solid (default) … 0.9 = almost see-through. */
  transparency?: number
  /** Sheet and printed PDF: 0 = opaque … 0.95 = almost invisible; unset = default per kind (see planOpacity.ts). */
  planTransparency?: number
  ifcType?: string
  /** Ceiling-type areas: the build-up (system, profiles, boards/tiles) used for material estimates. */
  ceiling?: import('./ceilingTypes').CeilingSpec
  /** Floor-type areas: the finish build-up (tiles, vinyl, resin…) used for material estimates. */
  floor?: import('./floorTypes').FloorSpec
  /** Building-services type (see mep.ts): reinforcement, outlet, plumbing point… */
  mep?: string
  /** Concrete structure / foundation type (see struct.ts). */
  struct?: string
  /** Lines that must stop exactly at their end points (task bands): flat ends instead of square / round. */
  flatEnds?: boolean
  /** Section depth of a point element (column, footing), metres; width is `width`. */
  depth?: number
  layers?: string[]
  framing?: FramingConfig
  /** Recipe linked to the layer (database id). */
  recipeId?: string | null
  /** Library wall type the item uses (database id). */
  wallTypeId?: string | null
  shapes: TakeoffShape[]
}

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function polyLen(p: Vec2[]): number {
  let L = 0
  for (let i = 1; i < p.length; i++) L += dist(p[i - 1], p[i])
  return L
}

export function polyArea(p: Vec2[]): number {
  let A = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    A += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(A) / 2
}

export function perimeter(p: Vec2[]): number {
  return polyLen(p) + dist(p[p.length - 1], p[0])
}

export const shapeHeight = (it: TakeoffItem, sh: TakeoffShape) => (sh.h != null ? sh.h : it.height || 0)

/** Opening area clipped to the wall height. */
export function shapeOpeningArea(it: TakeoffItem, sh: TakeoffShape): number {
  const H = shapeHeight(it, sh)
  return (sh.openings || []).reduce((s, o) => s + o.w * Math.max(0, Math.min(o.h, H - o.sill)), 0)
}

export type Quantities = {
  len: number
  area: number
  per: number
  n: number
  /** Gross wall area (length × height) for linear layers. */
  wall: number
  open: number
  nOpen: number
  /** Net wall area for linear layers (openings deducted unless the layer says otherwise). */
  net?: number
}

export function layerQuantities(it: TakeoffItem, ptPerM: number): Quantities | null {
  const k = ptPerM
  const q: Quantities = { len: 0, area: 0, per: 0, n: 0, wall: 0, open: 0, nOpen: 0 }
  if (!k) return null
  for (const sh of it.shapes) {
    if (it.kind === 'linear') {
      const L = polyLen(sh.pts) / k
      q.len += L
      q.wall += L * shapeHeight(it, sh)
      q.open += shapeOpeningArea(it, sh)
      q.nOpen += (sh.openings || []).length
    } else if (it.kind === 'area') {
      q.area += polyArea(sh.pts) / (k * k)
      q.per += perimeter(sh.pts) / k
    } else q.n += 1
  }
  if (it.kind === 'linear') q.net = q.wall - (it.deductOpenings === false ? 0 : q.open)
  return q
}
