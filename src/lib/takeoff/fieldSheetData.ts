// Field sheet content beyond the plan (RitsuScope › Tarefas): the task table, the framing elevation of each
// wall stretch drawn, the wall type cards and the order of work. Pure: sheet items and task lines in,
// plain data out (the PDF only draws it).
import { polyLen, type TakeoffItem, type TakeoffShape, type Vec2 } from './geometry'
import { layoutWall, fixingsOf } from './framing/framing'
import { hostOf, sliceLayout, taskBase } from './taskMaterials'

export type FieldTaskLine = { id: string; tag: string | null; scope_item_id: string; points: Vec2[]; side?: number | null; height_m?: number | string | null; quantity: number | string | null; unit?: string | null }
export type FieldScope = { id: string; code: string; name: string; color: string; step: string | null; unit: string | null; itemKey: string | null }

export type FieldTaskInfo = {
  id: string
  tag: string
  scopeId: string
  code: string
  color: string
  /** Wall (takeoff item) the line lies on, its face and the stretch along it (m). */
  wall: string | null
  face: 'A' | 'B' | null
  lengthM: number
  heightM: number | null
  /** Doors / windows deducted from the stretch (m²). */
  openingsM2: number
  qty: number
  unit: string
}

type Host = { item: TakeoffItem; shape: TakeoffShape; s0: number; s1: number; face: 'A' | 'B' }

/** The wall a task line lies on: the activity's own takeoff item first, then any wall of the sheet. */
export function hostWall(line: { points: Vec2[]; side?: number | null }, items: TakeoffItem[], ptPerM: number, preferKey: string | null): Host | null {
  const walls = items.filter(it => it.kind === 'linear' && it.shapes.length)
  const ordered = preferKey ? [...walls.filter(it => it.key === preferKey), ...walls.filter(it => it.key !== preferKey)] : walls
  for (const item of ordered) {
    const h = hostOf({ points: line.points, side: line.side }, item, ptPerM)
    if (h) return { item, ...h }
  }
  return null
}

/** One row per task line: tag, wall, face, length × height, openings deducted, quantity. Sorted by tag. */
export function taskInfos(lines: FieldTaskLine[], scopes: FieldScope[], items: TakeoffItem[], ptPerM: number): FieldTaskInfo[] {
  const out: FieldTaskInfo[] = []
  for (const r of lines) {
    const sc = scopes.find(s => s.id === r.scope_item_id)
    if (!sc) continue
    const host = hostWall(r, items, ptPerM, sc.itemKey)
    const L = polyLen(r.points) / (ptPerM || 1)
    const H = Number(r.height_m) > 0 ? Number(r.height_m) : null
    const net = H ? taskBase([{ points: r.points, side: r.side, height_m: H }], host?.item || null, ptPerM).area : 0
    out.push({
      id: r.id, tag: r.tag || sc.code, scopeId: sc.id, code: sc.code, color: sc.color,
      wall: host ? host.item.name : null, face: host ? host.face : null,
      lengthM: L, heightM: H, openingsM2: H ? Math.max(0, L * H - net) : 0,
      qty: Number(r.quantity) || 0, unit: r.unit || sc.unit || '',
    })
  }
  return out.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }))
}

export type ElevationStud = { x: number; y0: number; y1: number; kind: string }
export type FieldElevation = {
  key: string
  /** Tags drawn on this stretch (every activity on the same wall stretch shares one elevation). */
  tags: string[]
  color: string
  wall: string
  lengthM: number
  heightM: number
  spacingM: number
  studs: ElevationStud[]
  tracks: { x0: number; x1: number; y: number }[]
  headers: { x0: number; x1: number; y: number }[]
  openings: { x0: number; x1: number; y0: number; y1: number; kind: string }[]
}

/**
 * Framing elevation of every framed wall stretch drawn in the location: the layout (studs, tracks,
 * headers, openings) cut to the stretch, x measured from the stretch's start. Stretches of the same
 * wall that overlap (framing and board lines on the same stretch) share one elevation.
 */
export function elevationsOf(lines: FieldTaskLine[], scopes: FieldScope[], items: TakeoffItem[], ptPerM: number): FieldElevation[] {
  const groups: { host: Host; tags: string[]; color: string; s0: number; s1: number }[] = []
  for (const r of lines) {
    const sc = scopes.find(s => s.id === r.scope_item_id)
    if (!sc) continue
    const host = hostWall(r, items, ptPerM, sc.itemKey)
    if (!host || !host.item.framing?.on) continue
    const g = groups.find(x => x.host.shape === host.shape && Math.min(x.s1, host.s1) - Math.max(x.s0, host.s0) > 0.05)
    const tag = r.tag || sc.code
    if (g) {
      g.s0 = Math.min(g.s0, host.s0); g.s1 = Math.max(g.s1, host.s1)
      if (!g.tags.includes(tag)) g.tags.push(tag)
      // The framing activity's colour wins (it is the one the elevation is for).
      if (sc.step === 'framing') g.color = sc.color
    } else groups.push({ host, tags: [tag], color: sc.color, s0: host.s0, s1: host.s1 })
  }
  const out: FieldElevation[] = []
  for (const g of groups) {
    const lay = layoutWall(g.host.item, g.host.shape, ptPerM)
    const cut = sliceLayout(lay, g.s0, g.s1, null)
    const rel = (x: number) => Math.max(0, Math.min(g.s1 - g.s0, x - g.s0))
    const openings = lay.segs.flatMap(s => s.ops.map(o => ({ x0: s.start + o.x0, x1: s.start + o.x1, y0: o.y0, y1: o.y1, kind: String(o.kind) })))
      .filter(o => o.x1 > g.s0 + 0.01 && o.x0 < g.s1 - 0.01)
      .map(o => ({ ...o, x0: rel(o.x0), x1: rel(o.x1) }))
    out.push({
      key: `${g.host.shape.id || g.host.item.key}:${g.s0.toFixed(2)}`,
      tags: g.tags.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      color: g.color, wall: g.host.item.name,
      lengthM: g.s1 - g.s0, heightM: lay.H, spacingM: g.host.item.framing!.spacing,
      studs: cut.studs.map(s => ({ x: rel(s.x), y0: s.y0, y1: s.y1, kind: s.kind })).sort((a, b) => a.x - b.x),
      tracks: cut.tracks.map(t => ({ x0: rel(t.x0), x1: rel(t.x1), y: t.y })),
      headers: cut.headers.map(h => ({ x0: rel(h.x0), x1: rel(h.x1), y: h.y })),
      openings,
    })
  }
  return out.sort((a, b) => a.tags[0].localeCompare(b.tags[0], undefined, { numeric: true }))
}

/** Gaps between consecutive stud positions (for the dimension chain), rounded to the centimetre. */
export function studGaps(studs: { x: number }[], lengthM: number): number[] {
  const xs = [...new Set([0, ...studs.map(s => Math.round(s.x * 100) / 100), Math.round(lengthM * 100) / 100])].sort((a, b) => a - b)
  return xs.slice(1).map((x, i) => Math.round((x - xs[i]) * 100) / 100).filter(v => v > 0)
}

export type WallTypeInfo = {
  thickness_m?: number | null
  framing?: { insulation?: string; maxHeightM?: number; doubleStuds?: boolean } | null
  boards?: { side: 'A' | 'B'; count: number; product?: string; thickness_m?: number }[] | null
}

/** What a crew needs to know about a wall type (raw values; the page translates the labels). */
export type WallCard = {
  key: string
  name: string
  color: string
  thicknessMm: number | null
  coreMm: number
  stud: string
  track: string
  spacingM: number
  doubleStuds: boolean
  maxHeightM: number | null
  faceA: { name: string; layers: number; thkMm: number }
  faceB: { name: string; layers: number; thkMm: number }
  insulation: string | null
  screwSpacingM: number | null
  laPerStudEnd: number | null
  anchors: { spacingM: number; edgeM: number; at: string[]; name: string } | null
  band: { at: string[]; name: string } | null
}

/** What a crew needs to know about one wall item (its wall type, framing, boards, fixings). */
export function wallCardOf(it: TakeoffItem, wt: WallTypeInfo | null): WallCard {
  const F = it.framing
  const board = (side: 'A' | 'B') => {
    const b = wt?.boards?.find(x => x.side === side)
    return {
      name: b?.product || (side === 'A' ? F?.boardA : F?.boardB) || '—',
      layers: b ? Number(b.count) || 0 : Number(side === 'A' ? F?.layersA ?? 1 : F?.layersB ?? 1),
      thkMm: Math.round(((b?.thickness_m ?? 0.0125) || 0.0125) * 10000) / 10,
    }
  }
  const coreMatch = F?.studName?.match(/(\d{2,3})\s*mm/)
  const fx = fixingsOf(F?.fixings)
  const places = (p: { floor: boolean; ceiling: boolean; walls: boolean }) => (['floor', 'ceiling', 'walls'] as const).filter(k => p[k])
  return {
    key: it.key, name: it.name, color: it.color,
    thicknessMm: it.thickness ? Math.round(it.thickness * 1000) : wt?.thickness_m ? Math.round(Number(wt.thickness_m) * 1000) : null,
    coreMm: coreMatch ? Number(coreMatch[1]) : Math.max(48, Math.round(((it.thickness || 0.095) - 0.025) * 1000)),
    stud: F?.studName || '—', track: F?.trackName || '—', spacingM: F?.spacing || 0,
    doubleStuds: !!wt?.framing?.doubleStuds, maxHeightM: wt?.framing?.maxHeightM ?? null,
    faceA: board('A'), faceB: board('B'),
    insulation: wt?.framing?.insulation || null,
    screwSpacingM: F?.on && F.screwsFromLayout !== false ? F.screwSpacing ?? 0.25 : null,
    laPerStudEnd: F?.on && F.screwsFromLayout !== false ? F.laPerStudEnd ?? 2 : null,
    anchors: fx && places(fx.anchorAt).length ? { spacingM: fx.anchorSpacing, edgeM: fx.anchorEdge, at: places(fx.anchorAt), name: fx.anchorName } : null,
    band: fx && places(fx.bandAt).length ? { at: places(fx.bandAt), name: fx.bandName } : null,
  }
}

/** Cards of the wall types the location's lines lie on (one per item). */
export function wallCards(lines: FieldTaskLine[], scopes: FieldScope[], items: TakeoffItem[], ptPerM: number, wallTypeOf: (item: TakeoffItem) => WallTypeInfo | null | undefined): WallCard[] {
  const seen = new Map<string, WallCard>()
  for (const r of lines) {
    const sc = scopes.find(s => s.id === r.scope_item_id)
    const host = sc ? hostWall(r, items, ptPerM, sc.itemKey) : null
    const it = host?.item
    if (!it || seen.has(it.key)) continue
    seen.set(it.key, wallCardOf(it, wallTypeOf(it) || null))
  }
  return [...seen.values()]
}

/** Building order of a wall's activities: framing, board A, insulation, (services hold point), board B, joints. */
export const STEP_ORDER = ['framing', 'board_a', 'insulation', 'board_b', 'joints_a', 'joints_b', 'measure']

export type SequenceRow = { kind: 'activity'; scopeId: string; code: string; name: string; color: string; step: string | null } | { kind: 'hold'; hold: 'services' }

/**
 * Order of work in the location: activities by their place in a wall's build-up (then by code); the
 * services hold point (installations checked before the second face is closed) goes before board B,
 * or before insulation when the wall has it.
 */
export function sequenceOf(scopes: FieldScope[]): SequenceRow[] {
  const rank = (s: FieldScope) => { const i = STEP_ORDER.indexOf(s.step || ''); return i < 0 ? STEP_ORDER.length : i }
  const ordered = [...scopes].sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code, undefined, { numeric: true }))
  const out: SequenceRow[] = []
  const closeStep = ordered.some(s => s.step === 'insulation') ? 'insulation' : 'board_b'
  let held = false
  for (const s of ordered) {
    if (!held && s.step === closeStep && ordered.some(o => o.step === 'framing')) { out.push({ kind: 'hold', hold: 'services' }); held = true }
    out.push({ kind: 'activity', scopeId: s.id, code: s.code, name: s.name, color: s.color, step: s.step })
  }
  return out
}
