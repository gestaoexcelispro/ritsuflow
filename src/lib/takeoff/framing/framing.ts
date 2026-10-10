// Drywall framing and board layout per wall, plus global cut optimisation.
// Ported from the prototype (layoutWall, packBars, packSheets, framingTotals)
// with the same rules and tolerances.

import {
  dist,
  polyLen,
  shapeHeight,
  shapeOpeningArea,
  type FixingsConfig,
  type FramingConfig,
  type OpeningKind,
  type TakeoffItem,
  type TakeoffShape,
  type Vec2,
} from '../geometry'

export type FramingLabels = {
  stud: (coreMm: number) => string
  track: (coreMm: number) => string
  board: string
  taScrew?: string
  laScrew?: string
}

export const framingLabelsPtBR: FramingLabels = {
  stud: mm => `Montante ${mm} mm`,
  track: mm => `Guia ${mm} mm`,
  board: 'Chapa ST 12,5 mm',
  taScrew: 'Parafuso TA 3,5 x 25 mm',
  laScrew: 'Parafuso LA 4,2 x 9,5 mm',
}

/** Screw rules confirmed by Eduardo: from the layout, TA every 0.25 m, LA 2 per stud end. */
export const DEFAULT_SCREW_SPACING = 0.25
export const DEFAULT_LA_PER_STUD_END = 2

/** Junction rules confirmed by Eduardo: 1 extra stud per L-corner, 2 per T-junction. */
export const DEFAULT_CORNER_STUDS = 1
export const DEFAULT_TEE_STUDS = 2

/** Fixing rules agreed with Eduardo: anchors every 0.60 m, the first at most 0.10 m from each track end. */
export const DEFAULT_ANCHOR_SPACING = 0.6
export const DEFAULT_ANCHOR_EDGE = 0.1

/**
 * Rule confirmed by Eduardo: where the framing meets another construction system it is always fixed
 * and sealed — anchors and acoustic band at the floor (bottom track), the ceiling (top track) and the
 * walls (end studs at free ends, i.e. against masonry, concrete…). Not a per-wall-type choice.
 */
export const FIXING_PLACES_ALWAYS = { floor: true, ceiling: true, walls: true } as const

/** Default fixings: anchors and acoustic band wherever the framing meets another system. */
export function defaultFixings(names: { anchor?: string; band?: string } = {}): FixingsConfig {
  return {
    anchorSpacing: DEFAULT_ANCHOR_SPACING,
    anchorEdge: DEFAULT_ANCHOR_EDGE,
    anchorAt: { ...FIXING_PLACES_ALWAYS },
    anchorName: names.anchor || 'Bucha de nylon S6 + parafuso (fixação da guia)',
    bandAt: { ...FIXING_PLACES_ALWAYS },
    bandName: names.band || 'Banda acústica',
    bandRoll: null,
  }
}

/** Valid fixings or null (stored JSON may be partial). */
export function fixingsOf(raw: unknown): FixingsConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = defaultFixings()
  const pos = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : def)
  return {
    anchorSpacing: pos(r.anchorSpacing, d.anchorSpacing),
    anchorEdge: typeof r.anchorEdge === 'number' && r.anchorEdge >= 0 ? r.anchorEdge : d.anchorEdge,
    // Places are fixed by the rule above (older wall types stored their own ticks: ignored).
    anchorAt: { ...FIXING_PLACES_ALWAYS },
    anchorName: typeof r.anchorName === 'string' && r.anchorName.trim() ? r.anchorName.trim() : d.anchorName,
    bandAt: { ...FIXING_PLACES_ALWAYS },
    bandName: typeof r.bandName === 'string' && r.bandName.trim() ? r.bandName.trim() : d.bandName,
    bandRoll: typeof r.bandRoll === 'number' && r.bandRoll > 0 ? r.bandRoll : null,
  }
}

/** Anchors along a straight piece: the first and last at most `edge` from the ends, none further apart than `spacing`. */
export function anchorsAlong(len: number, spacing: number, edge: number): number {
  if (!(len > 0.005)) return 0
  const sp = spacing > 0 ? spacing : DEFAULT_ANCHOR_SPACING
  const span = len - 2 * Math.max(0, edge)
  if (span <= 1e-9) return 1
  return Math.ceil(span / sp - 1e-9) + 1
}

/** Which ends of a wall stop against another system (no framed wall there). */
export type FreeEnds = { start: boolean; end: boolean }

export type FixingCount = { anchors: number; bandM: number }

/**
 * Anchors and acoustic band of one wall (or of the stretch [s0, s1] of it, metres along the wall).
 * Floor = bottom tracks, ceiling = top tracks, walls = end studs at free ends (full height).
 * A stretch takes its share of each track's anchors (by length), so cutting a wall in tasks
 * does not add end anchors.
 */
export function fixingsForWall(lay: WallLayout, fx: FixingsConfig, ends: FreeEnds, range?: [number, number]): FixingCount {
  const [s0, s1] = range || [-Infinity, Infinity]
  let anchors = 0, bandM = 0
  for (const tr of lay.tracks) {
    const place = tr.kind === 'guia inferior' ? 'floor' : 'ceiling'
    const len = tr.x1 - tr.x0
    if (!(len > 0.005)) continue
    const inside = Math.max(0, Math.min(tr.x1, s1) - Math.max(tr.x0, s0))
    if (!(inside > 0)) continue
    if (fx.anchorAt[place]) anchors += anchorsAlong(len, fx.anchorSpacing, fx.anchorEdge) * (inside / len)
    if (fx.bandAt[place]) bandM += inside
  }
  const endAt = (x: number) => x >= s0 - 1e-6 && x <= s1 + 1e-6
  for (const [free, x] of [[ends.start, 0], [ends.end, lay.L]] as const) {
    if (!free || !endAt(x)) continue
    if (fx.anchorAt.walls) anchors += anchorsAlong(lay.H, fx.anchorSpacing, fx.anchorEdge)
    if (fx.bandAt.walls) bandM += lay.H
  }
  return { anchors, bandM }
}

/** Free ends of every framed wall: ends that do not touch another framed wall (they stop against another system). */
export function freeEnds(items: TakeoffItem[], ptPerM: number): Map<TakeoffShape, FreeEnds> {
  const walls: { item: TakeoffItem; shape: TakeoffShape; halfT: number }[] = []
  for (const item of items) {
    if (item.kind !== 'linear' || !item.framing?.on) continue
    for (const shape of item.shapes) if (shape.pts.length >= 2) walls.push({ item, shape, halfT: ((item.thickness || 0.1) / 2) * ptPerM })
  }
  const slack = 0.02 * ptPerM
  const touches = (w: (typeof walls)[number], p: Vec2) => walls.some(o => {
    if (o === w || o.shape.page !== w.shape.page) return false
    const tol = w.halfT + o.halfT + slack
    for (let i = 1; i < o.shape.pts.length; i++) {
      const r = projectOnSegment(p, o.shape.pts[i - 1], o.shape.pts[i])
      const t = Math.max(0, Math.min(1, r.t))
      const a = o.shape.pts[i - 1], b = o.shape.pts[i]
      const q: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      if (dist(p, q) <= tol) return true
    }
    return false
  })
  const out = new Map<TakeoffShape, FreeEnds>()
  for (const w of walls) out.set(w.shape, { start: !touches(w, w.shape.pts[0]), end: !touches(w, w.shape.pts[w.shape.pts.length - 1]) })
  return out
}

/** Prototype defaults: 0.60 m spacing, door jambs 2, window jambs 1, 3.00 m bars, 1.20 × 2.40 m boards. */
export function defaultFraming(it: Pick<TakeoffItem, 'thickness'>, labels: FramingLabels = framingLabelsPtBR): FramingConfig {
  const core = Math.max(48, Math.round(((it.thickness || 0.095) - 0.025) * 1000))
  return {
    on: false,
    spacing: 0.6,
    doorJamb: 2,
    winJamb: 1,
    studGap: 0,
    headerExtra: 0,
    studName: labels.stud(core),
    trackName: labels.track(core),
    bars: [3],
    boardW: 1.2,
    boardH: 2.4,
    faceOffset: 0.6,
    boardA: labels.board,
    boardB: labels.board,
    layersA: 1,
    layersB: 1,
    cornerStuds: DEFAULT_CORNER_STUDS,
    teeStuds: DEFAULT_TEE_STUDS,
    screwsFromLayout: true,
    screwSpacing: DEFAULT_SCREW_SPACING,
    laPerStudEnd: DEFAULT_LA_PER_STUD_END,
    taName: labels.taScrew || framingLabelsPtBR.taScrew,
    laName: labels.laScrew || framingLabelsPtBR.laScrew,
  }
}

/** Parses "3,00" / "2,40; 3,00" / "3.00" into ascending bar lengths in metres. */
export function parseBars(s: string): number[] {
  const parseNum = (v: string) => {
    let t = v.trim().replace(/\s/g, '')
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
    return parseFloat(t)
  }
  return String(s || '')
    .split(/[;/ ]+/)
    .map(parseNum)
    .filter(x => x > 0)
    .sort((a, b) => a - b)
}

export type StudKind = 'montante' | 'batente' | 'complemento'
/** twin: the second stud of a double-stud pair (same place; boards are screwed to the first one). */
export type Stud = { x: number; y0: number; y1: number; kind: StudKind; twin?: boolean }
export type TrackPiece = { x0: number; x1: number; y: number; kind: 'guia superior' | 'guia inferior' }
export type HeaderPiece = { x0: number; x1: number; y: number; kind: 'verga' | 'contraverga' }
export type BoardPiece = { x0: number; x1: number; y0: number; y1: number; layer: number; notch: boolean }

type SegOpening = { kind: OpeningKind; x0: number; x1: number; y0: number; y1: number }
type Segment = { L: number; ops: SegOpening[]; start: number }

export type WallLayout = {
  H: number
  L: number
  segs: Segment[]
  studs: Stud[]
  tracks: TrackPiece[]
  headers: HeaderPiece[]
  board: { A: BoardPiece[]; B: BoardPiece[] }
  studLen: number[]
  trackLen: number[]
  boardName: { A: string; B: string }
}

export function wallSegments(it: TakeoffItem, sh: TakeoffShape, ptPerM: number): Segment[] {
  const k = ptPerM
  const segs: Segment[] = []
  let acc = 0
  for (let i = 1; i < sh.pts.length; i++) {
    const L = dist(sh.pts[i - 1], sh.pts[i]) / k
    if (L < 1e-4) continue
    const ops = (sh.openings || [])
      .filter(o => o.off >= acc - 1e-6 && o.off < acc + L + 1e-6)
      .map(o => ({
        kind: o.kind,
        x0: Math.max(0, o.off - o.w / 2 - acc),
        x1: Math.min(L, o.off + o.w / 2 - acc),
        y0: o.sill,
        y1: Math.min(shapeHeight(it, sh), o.sill + o.h),
      }))
      .sort((a, b) => a.x0 - b.x0)
    segs.push({ L, ops, start: acc })
    acc += L
  }
  return segs
}

export function layoutWall(it: TakeoffItem, sh: TakeoffShape, ptPerM: number): WallLayout {
  const F = it.framing!
  const H = shapeHeight(it, sh)
  const sp = Math.max(0.1, F.spacing)
  const segs = wallSegments(it, sh, ptPerM)
  const studs: Stud[] = []
  const tracks: TrackPiece[] = []
  const headers: HeaderPiece[] = []
  const board: WallLayout['board'] = { A: [], B: [] }
  const flip = !!sh.flipFaces

  for (const s of segs) {
    const L = s.L
    const X = s.start
    const jambs: number[] = []
    for (const o of s.ops) {
      const n = o.kind === 'door' ? F.doorJamb : F.winJamb
      jambs.push(o.x0, o.x1)
      for (let j = 0; j < n; j++) {
        studs.push({ x: X + o.x0 - j * 0.05, y0: 0, y1: H, kind: 'batente' })
        studs.push({ x: X + o.x1 + j * 0.05, y0: 0, y1: H, kind: 'batente' })
      }
      if (o.y1 < H - 0.05) headers.push({ x0: X + o.x0 - F.headerExtra, x1: X + o.x1 + F.headerExtra, y: o.y1, kind: 'verga' })
      if (o.y0 > 0.05) headers.push({ x0: X + o.x0 - F.headerExtra, x1: X + o.x1 + F.headerExtra, y: o.y0, kind: 'contraverga' })
    }
    const grid: number[] = []
    for (let x = 0; x < L - 1e-6; x += sp) grid.push(x)
    if (L - grid[grid.length - 1] > 0.02) grid.push(L)
    for (const x of grid) {
      if (jambs.some(j => Math.abs(j - x) < 0.05)) continue
      const o = s.ops.find(o => x > o.x0 + 0.02 && x < o.x1 - 0.02)
      if (!o) {
        studs.push({ x: X + x, y0: 0, y1: H, kind: 'montante' })
        if (F.doubleStuds) studs.push({ x: X + x, y0: 0, y1: H, kind: 'montante', twin: true })
        continue
      }
      if (H - o.y1 > 0.05) studs.push({ x: X + x, y0: o.y1, y1: H, kind: 'complemento' })
      if (o.y0 > 0.05) studs.push({ x: X + x, y0: 0, y1: o.y0, kind: 'complemento' })
    }
    tracks.push({ x0: X, x1: X + L, y: H, kind: 'guia superior' })
    let cur = 0
    for (const o of s.ops.filter(o => o.y0 < 0.05)) {
      if (o.x0 - cur > 0.01) tracks.push({ x0: X + cur, x1: X + o.x0, y: 0, kind: 'guia inferior' })
      cur = o.x1
    }
    if (L - cur > 0.01) tracks.push({ x0: X + cur, x1: X + L, y: 0, kind: 'guia inferior' })

    for (const face of ['A', 'B'] as const) {
      const off = (face === 'B') !== flip ? F.faceOffset % F.boardW : 0
      const layers = face === 'A' ? F.layersA : F.layersB
      for (let ly = 0; ly < layers; ly++) {
        const shift = (off + (ly * F.boardW) / 2) % F.boardW
        for (let x = -shift; x < L - 1e-6; x += F.boardW) {
          const c0 = Math.max(0, x)
          const c1 = Math.min(L, x + F.boardW)
          if (c1 - c0 < 0.01) continue
          for (let y = 0; y < H - 1e-6; y += F.boardH) {
            let rects: (Omit<BoardPiece, 'layer' | 'notch'> & { notch?: boolean })[] = [
              { x0: c0, x1: c1, y0: y, y1: Math.min(H, y + F.boardH) },
            ]
            for (const o of s.ops) {
              const nx: typeof rects = []
              for (const r of rects) {
                if (o.x1 <= r.x0 + 1e-6 || o.x0 >= r.x1 - 1e-6 || o.y1 <= r.y0 + 1e-6 || o.y0 >= r.y1 - 1e-6) { nx.push(r); continue }
                const fullW = o.x0 <= r.x0 + 1e-6 && o.x1 >= r.x1 - 1e-6
                const fullH = o.y0 <= r.y0 + 1e-6 && o.y1 >= r.y1 - 1e-6
                if (fullW && fullH) continue
                if (fullW) {
                  if (o.y0 - r.y0 > 0.01) nx.push({ ...r, y1: o.y0 })
                  if (r.y1 - o.y1 > 0.01) nx.push({ ...r, y0: o.y1 })
                } else if (fullH) {
                  if (o.x0 - r.x0 > 0.01) nx.push({ ...r, x1: o.x0 })
                  if (r.x1 - o.x1 > 0.01) nx.push({ ...r, x0: o.x1 })
                } else nx.push({ ...r, notch: true })
              }
              rects = nx
            }
            rects.forEach(r => board[face].push({ x0: X + r.x0, x1: X + r.x1, y0: r.y0, y1: r.y1, layer: ly, notch: !!r.notch }))
          }
        }
      }
    }
  }
  const studLen = studs.map(s => Math.max(0, s.y1 - s.y0 - (s.kind === 'montante' || s.kind === 'batente' ? F.studGap : 0)))
  const trackLen = [...tracks.map(t => t.x1 - t.x0), ...headers.map(h => h.x1 - h.x0)]
  return {
    H,
    L: segs.reduce((a, s) => a + s.L, 0),
    segs,
    studs,
    tracks,
    headers,
    board,
    studLen,
    trackLen,
    boardName: { A: sh.faceA || (flip ? F.boardB : F.boardA), B: sh.faceB || (flip ? F.boardA : F.boardB) },
  }
}

export type BarPacking = { count: number; byLen: Record<string, number>; total: number; used: number; waste: number; splices: number }

/** First-fit-decreasing (best-fit bin) bar packing. Pieces longer than the longest bar count as splices. */
export function packBars(pieces: number[], barsList: number[]): BarPacking {
  const bars = barsList.length ? barsList : [3]
  const max = bars[bars.length - 1]
  const open: { len: number; rem: number }[] = []
  let splices = 0
  const P = [...pieces].filter(p => p > 0.005).sort((a, b) => b - a)
  for (let p of P) {
    while (p > max + 1e-6) { open.push({ len: max, rem: 0 }); p -= max; splices++ }
    let best: { len: number; rem: number } | null = null
    for (const b of open) if (b.rem >= p - 1e-6 && (!best || b.rem < best.rem)) best = b
    if (best) best.rem -= p
    else {
      const len = bars.find(b => b >= p - 1e-6) || max
      open.push({ len, rem: len - p })
    }
  }
  const byLen: Record<string, number> = {}
  open.forEach(b => { byLen[b.len] = (byLen[b.len] || 0) + 1 })
  const total = open.reduce((s, b) => s + b.len, 0)
  const used = P.reduce((s, p) => s + p, 0)
  return { count: open.length, byLen, total, used, waste: total ? 1 - used / total : 0, splices }
}

export type SheetPacking = { count: number; used: number; total: number; waste: number; pieces: number }

/** Guillotine sheet packing, largest pieces first. */
export function packSheets(pieces: { x0: number; x1: number; y0: number; y1: number }[], W: number, Hs: number): SheetPacking {
  type Free = { x: number; y: number; w: number; h: number }
  const sheets: { free: Free[] }[] = []
  const P = pieces
    .map(p => ({ w: p.x1 - p.x0, h: p.y1 - p.y0 }))
    .filter(p => p.w > 0.005 && p.h > 0.005)
    .sort((a, b) => b.w * b.h - a.w * a.h)
  for (const p of P) {
    let placed = false
    for (const s of sheets) {
      const i = s.free.findIndex(r => p.w <= r.w + 1e-6 && p.h <= r.h + 1e-6)
      if (i < 0) continue
      const r = s.free.splice(i, 1)[0]
      const a = { x: r.x + p.w, y: r.y, w: r.w - p.w, h: p.h }
      const b = { x: r.x, y: r.y + p.h, w: r.w, h: r.h - p.h }
      ;[a, b].forEach(f => { if (f.w > 0.02 && f.h > 0.02) s.free.push(f) })
      s.free.sort((x, y) => x.w * x.h - y.w * y.h)
      placed = true
      break
    }
    if (!placed) {
      const s: { free: Free[] } = { free: [] }
      const a = { x: p.w, y: 0, w: W - p.w, h: p.h }
      const b = { x: 0, y: p.h, w: W, h: Hs - p.h }
      ;[a, b].forEach(f => { if (f.w > 0.02 && f.h > 0.02) s.free.push(f) })
      sheets.push(s)
    }
  }
  const used = P.reduce((s, p) => s + p.w * p.h, 0)
  return { count: sheets.length, used, total: sheets.length * W * Hs, waste: sheets.length ? 1 - used / (sheets.length * W * Hs) : 0, pieces: P.length }
}

export type ProfileGroup = { name: string; pieces: number[]; from: Set<string>; bars: number[] }
export type BoardGroup = { name: string; pieces: BoardPiece[]; from: Set<string>; W: number; H: number }
export type ItemFramingSummary = { studs: number; studM: number; trackM: number; faceA: number; faceB: number; faces: Map<string, number> }

/** Collects pieces per material name across every framed linear layer (global optimisation). */
export type ScrewCount = { ta: number; la: number }

/** Anchors (un) or acoustic band (m) totals; roll = metres per roll for the band. */
export type FixingTotal = { name: string; unit: 'un' | 'm'; qty: number; roll: number | null }

/** Screws along one straight line of steel that a board covers: one every `spacing`, ends included. */
export function screwsAlong(overlap: number, spacing: number): number {
  if (!(overlap > 0.005)) return 0
  return Math.floor(overlap / spacing + 1e-9) + 1
}

/**
 * Screws for one wall from its layout.
 * TA (board to steel): for every board piece of every layer and face, screws every
 * `screwSpacing` along each stud inside the board's width and along each track or
 * header inside its height.
 * LA (steel to steel): `laPerStudEnd` at each stud end that sits in a track or header.
 * Junction studs are not included here (see junctionScrews).
 */
export function screwsForWall(lay: WallLayout, F: FramingConfig): ScrewCount {
  const spacing = F.screwSpacing && F.screwSpacing > 0 ? F.screwSpacing : DEFAULT_SCREW_SPACING
  const laEnd = F.laPerStudEnd ?? DEFAULT_LA_PER_STUD_END
  const horizontals = [...lay.tracks, ...lay.headers]
  let ta = 0
  for (const face of ['A', 'B'] as const) {
    for (const b of lay.board[face]) {
      for (const st of lay.studs) {
        if (st.twin || st.x < b.x0 - 1e-6 || st.x > b.x1 + 1e-6) continue
        ta += screwsAlong(Math.min(b.y1, st.y1) - Math.max(b.y0, st.y0), spacing)
      }
      for (const h of horizontals) {
        if (h.y < b.y0 - 1e-6 || h.y > b.y1 + 1e-6) continue
        ta += screwsAlong(Math.min(b.x1, h.x1) - Math.max(b.x0, h.x0), spacing)
      }
    }
  }
  const fixedEnd = (x: number, y: number) =>
    horizontals.some(h => Math.abs(h.y - y) < 0.06 && x >= Math.min(h.x0, h.x1) - 1e-6 && x <= Math.max(h.x0, h.x1) + 1e-6)
  let la = 0
  for (const st of lay.studs) {
    if (fixedEnd(st.x, st.y0)) la += laEnd
    if (fixedEnd(st.x, st.y1)) la += laEnd
  }
  return { ta, la }
}

export type Junction = {
  kind: 'corner' | 'tee'
  /** Wall that receives the extra studs. */
  host: { item: TakeoffItem; shape: TakeoffShape }
  /** The other wall at the junction. */
  other: { item: TakeoffItem; shape: TakeoffShape }
  at: Vec2
  studs: number
}

type FramedWall = { item: TakeoffItem; shape: TakeoffShape; halfT: number }

function projectOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L2 = dx * dx + dy * dy
  const t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0
  const q: Vec2 = [a[0] + dx * t, a[1] + dy * t]
  return { t, d: Math.hypot(p[0] - q[0], p[1] - q[1]), len: Math.sqrt(L2) }
}

function direction(pts: Vec2[], atStart: boolean): Vec2 {
  const [a, b] = atStart ? [pts[0], pts[1]] : [pts[pts.length - 1], pts[pts.length - 2]]
  const l = dist(a, b) || 1
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
}

/**
 * Finds L-corners and T-junctions between framed walls on the same sheet.
 * Wall ends are grouped into nodes (within the wall thicknesses):
 *   2 walls at an angle             -> L-corner (cornerStuds on one wall)
 *   2 walls collinear               -> split joint, nothing added
 *   3 walls, 2 of them collinear    -> T (Revit often splits the continuing wall);
 *                                      teeStuds on one of the collinear walls
 *   4 walls in two collinear pairs  -> cross, counted as two T's
 * A wall end that lands on another wall away from its ends is also a T.
 */
export function findJunctions(items: TakeoffItem[], ptPerM: number): Junction[] {
  const walls: FramedWall[] = []
  for (const item of items) {
    if (item.kind !== 'linear' || !item.framing?.on) continue
    for (const shape of item.shapes) if (shape.pts.length >= 2) walls.push({ item, shape, halfT: ((item.thickness || 0.1) / 2) * ptPerM })
  }
  const slack = 0.02 * ptPerM
  type End = { w: FramedWall; at: Vec2; dir: Vec2 }
  const ends: End[] = []
  for (const w of walls) {
    ends.push({ w, at: w.shape.pts[0], dir: direction(w.shape.pts, true) })
    ends.push({ w, at: w.shape.pts[w.shape.pts.length - 1], dir: direction(w.shape.pts, false) })
  }

  // Group ends into nodes.
  const nodes: End[][] = []
  for (const e of ends) {
    const node = nodes.find(n => n[0].w.shape.page === e.w.shape.page && n.some(o => o.w !== e.w && dist(o.at, e.at) <= o.w.halfT + e.w.halfT + slack))
    if (node) node.push(e)
    else nodes.push([e])
  }

  const collinear = (a: End, b: End) => Math.abs(a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0]) < 0.3
  const out: Junction[] = []
  const inNode = new Set<End>()
  for (const node of nodes) {
    if (node.length < 2) continue
    node.forEach(e => inNode.add(e))
    const pairs: [End, End][] = []
    const used = new Set<End>()
    for (let i = 0; i < node.length; i++)
      for (let j = i + 1; j < node.length; j++)
        if (!used.has(node[i]) && !used.has(node[j]) && collinear(node[i], node[j])) { pairs.push([node[i], node[j]]); used.add(node[i]); used.add(node[j]) }
    const loose = node.filter(e => !used.has(e))
    const tee = (host: End, other: End) => {
      const n = host.w.item.framing!.teeStuds ?? DEFAULT_TEE_STUDS
      if (n > 0) out.push({ kind: 'tee', host: host.w, other: other.w, at: other.at, studs: n })
    }
    const corner = (host: End, other: End) => {
      const n = host.w.item.framing!.cornerStuds ?? DEFAULT_CORNER_STUDS
      if (n > 0) out.push({ kind: 'corner', host: host.w, other: other.w, at: host.at, studs: n })
    }
    if (pairs.length === 1 && loose.length === 1) tee(pairs[0][0], loose[0])
    else if (pairs.length === 2 && loose.length === 0) { tee(pairs[0][0], pairs[1][0]); tee(pairs[1][0], pairs[0][0]) }
    else if (pairs.length === 0 && loose.length === 2) corner(loose[0], loose[1])
    else if (pairs.length === 0 && loose.length > 2) for (let k = 1; k < loose.length; k++) corner(loose[0], loose[k])
    // pairs only (split joints): nothing
  }

  // T where a wall end lands on the middle of a continuous wall.
  for (const e of ends) {
    if (inNode.has(e)) continue
    for (const B of walls) {
      if (B === e.w || B.shape.page !== e.w.shape.page) continue
      const tol = e.w.halfT + B.halfT + slack
      let hit = false
      for (let k = 1; k < B.shape.pts.length && !hit; k++) {
        const a = B.shape.pts[k - 1]
        const b = B.shape.pts[k]
        const r = projectOnSegment(e.at, a, b)
        const along = r.t * r.len
        if (r.d > tol || along < tol || along > r.len - tol) continue
        const segDir: Vec2 = [(b[0] - a[0]) / (r.len || 1), (b[1] - a[1]) / (r.len || 1)]
        if (Math.abs(e.dir[0] * segDir[1] - e.dir[1] * segDir[0]) < 0.3) continue
        const n = B.item.framing!.teeStuds ?? DEFAULT_TEE_STUDS
        if (n > 0) out.push({ kind: 'tee', host: B, other: e.w, at: e.at, studs: n })
        hit = true
      }
      if (hit) break
    }
  }
  return out
}

export function framingTotals(items: TakeoffItem[], ptPerM: number) {
  const prof = new Map<string, ProfileGroup>()
  const boards = new Map<string, BoardGroup>()
  const perItem = new Map<TakeoffItem, ItemFramingSummary>()
  const screws = new Map<string, number>()
  const addScrews = (name: string, n: number) => { if (n > 0) screws.set(name, (screws.get(name) || 0) + n) }
  // Anchors (un) and acoustic band (m) where the framing meets another system.
  const fixings = new Map<string, FixingTotal>()
  const addFixing = (name: string, unit: 'un' | 'm', qty: number, roll: number | null = null) => {
    if (!(qty > 0)) return
    const key = `${unit}|${name}`
    const e = fixings.get(key) || { name, unit, qty: 0, roll }
    e.qty += qty
    fixings.set(key, e)
  }
  const ends = freeEnds(items, ptPerM)
  for (const it of items) {
    if (it.kind !== 'linear' || !it.framing || !it.framing.on) continue
    const F = it.framing
    const agg: ItemFramingSummary = { studs: 0, studM: 0, trackM: 0, faceA: 0, faceB: 0, faces: new Map() }
    for (const sh of it.shapes) {
      const lay = layoutWall(it, sh, ptPerM)
      const addProfile = (name: string, arr: number[]) => {
        if (!prof.has(name)) prof.set(name, { name, pieces: [], from: new Set(), bars: F.bars })
        const e = prof.get(name)!
        e.pieces.push(...arr)
        e.from.add(it.name)
      }
      addProfile(F.studName, lay.studLen)
      if (F.screwsFromLayout !== false) {
        const sc = screwsForWall(lay, F)
        addScrews(F.taName || framingLabelsPtBR.taScrew!, sc.ta)
        addScrews(F.laName || framingLabelsPtBR.laScrew!, sc.la)
      }
      addProfile(F.trackName, lay.trackLen)
      const fx = fixingsOf(F.fixings)
      if (fx) {
        const c = fixingsForWall(lay, fx, ends.get(sh) || { start: false, end: false })
        addFixing(fx.anchorName, 'un', c.anchors)
        addFixing(fx.bandName, 'm', c.bandM, fx.bandRoll ?? null)
      }
      for (const f of ['A', 'B'] as const) {
        // One-sided walls (furring, shaft): no boards on that face, so no empty "0 sheets" group either.
        if (!lay.board[f].length) continue
        const name = lay.boardName[f]
        if (!boards.has(name)) boards.set(name, { name, pieces: [], from: new Set(), W: F.boardW, H: F.boardH })
        const e = boards.get(name)!
        e.pieces.push(...lay.board[f])
        e.from.add(it.name)
      }
      agg.studs += lay.studs.length
      agg.studM += lay.studLen.reduce((a, b) => a + b, 0)
      agg.trackM += lay.trackLen.reduce((a, b) => a + b, 0)
      const net = (polyLen(sh.pts) / ptPerM) * shapeHeight(it, sh) - shapeOpeningArea(it, sh)
      agg.faceA += net
      agg.faceB += net
      for (const f of ['A', 'B'] as const) {
        const nl = f === 'A' ? F.layersA : F.layersB
        if (!nl) continue
        const key = `${f}|${lay.boardName[f]}`
        agg.faces.set(key, (agg.faces.get(key) || 0) + net * nl)
      }
    }
    perItem.set(it, agg)
  }
  const junctions = findJunctions(items, ptPerM)
  for (const j of junctions) {
    const F = j.host.item.framing!
    const H = shapeHeight(j.host.item, j.host.shape) - F.studGap
    const group = prof.get(F.studName)
    if (!group || !(H > 0)) continue
    for (let n = 0; n < j.studs; n++) group.pieces.push(H)
    const agg = perItem.get(j.host.item)
    if (agg) { agg.studs += j.studs; agg.studM += H * j.studs }
    if (F.screwsFromLayout !== false) {
      // Junction studs carry the other wall's boards: TA along their height on each face layer,
      // and LA at both ends.
      const spacing = F.screwSpacing && F.screwSpacing > 0 ? F.screwSpacing : DEFAULT_SCREW_SPACING
      const layers = Math.max(1, (F.layersA || 0) + (F.layersB || 0))
      addScrews(F.taName || framingLabelsPtBR.taScrew!, j.studs * screwsAlong(H, spacing) * layers / 2)
      addScrews(F.laName || framingLabelsPtBR.laScrew!, j.studs * 2 * (F.laPerStudEnd ?? DEFAULT_LA_PER_STUD_END))
    }
  }
  return { prof, boards, perItem, junctions, screws, fixings }
}

/** Distance in metres along a wall polyline to the point closest to p. */
export function alongWall(pts: Vec2[], p: Vec2, ptPerM: number): number {
  let acc = 0
  let best = { d: Infinity, along: 0 }
  for (let i = 1; i < pts.length; i++) {
    const r = projectOnSegment(p, pts[i - 1], pts[i])
    const t = Math.max(0, Math.min(1, r.t))
    const q: Vec2 = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
    const d = dist(p, q)
    if (d < best.d) best = { d, along: (acc + t * r.len) / ptPerM }
    acc += r.len
  }
  return best.along
}

/** Junction studs that belong to one wall, as positions along it (metres). */
export function junctionStudsOnWall(junctions: Junction[], shape: TakeoffShape, ptPerM: number) {
  return junctions
    .filter(j => j.host.shape === shape)
    .map(j => ({ x: alongWall(shape.pts, j.at, ptPerM), kind: j.kind, studs: j.studs }))
}

/** Project-wide framing defaults (stored in takeoff_framing_defaults.settings). Names and layer counts stay per layer. */
export type FramingDefaults = Partial<Pick<FramingConfig,
  'spacing' | 'doorJamb' | 'winJamb' | 'studGap' | 'headerExtra' | 'bars' | 'boardW' | 'boardH' | 'faceOffset' |
  'cornerStuds' | 'teeStuds' | 'screwsFromLayout' | 'screwSpacing' | 'laPerStudEnd'>>

const DEFAULT_KEYS = ['spacing', 'doorJamb', 'winJamb', 'studGap', 'headerExtra', 'bars', 'boardW', 'boardH', 'faceOffset', 'cornerStuds', 'teeStuds', 'screwsFromLayout', 'screwSpacing', 'laPerStudEnd'] as const

/** Keeps only valid values: positive numbers (zero allowed where it makes sense), ascending bars, booleans. */
export function sanitizeFramingDefaults(raw: unknown): FramingDefaults {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: FramingDefaults = {}
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0
  const nonNeg = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
  if (pos(r.spacing)) out.spacing = r.spacing as number
  if (nonNeg(r.doorJamb)) out.doorJamb = Math.round(r.doorJamb as number)
  if (nonNeg(r.winJamb)) out.winJamb = Math.round(r.winJamb as number)
  if (nonNeg(r.studGap)) out.studGap = r.studGap as number
  if (nonNeg(r.headerExtra)) out.headerExtra = r.headerExtra as number
  if (Array.isArray(r.bars)) { const b = r.bars.filter(pos).map(Number).sort((a, c) => a - c); if (b.length) out.bars = b }
  if (pos(r.boardW)) out.boardW = r.boardW as number
  if (pos(r.boardH)) out.boardH = r.boardH as number
  if (nonNeg(r.faceOffset)) out.faceOffset = r.faceOffset as number
  if (nonNeg(r.cornerStuds)) out.cornerStuds = Math.round(r.cornerStuds as number)
  if (nonNeg(r.teeStuds)) out.teeStuds = Math.round(r.teeStuds as number)
  if (typeof r.screwsFromLayout === 'boolean') out.screwsFromLayout = r.screwsFromLayout
  if (pos(r.screwSpacing)) out.screwSpacing = r.screwSpacing as number
  if (nonNeg(r.laPerStudEnd)) out.laPerStudEnd = Math.round(r.laPerStudEnd as number)
  return out
}

/** Applies project defaults on top of a layer's framing (used for new layers and IFC imports). */
export function applyFramingDefaults(base: FramingConfig, defaults: FramingDefaults): FramingConfig {
  const out: FramingConfig = { ...base }
  for (const key of DEFAULT_KEYS) {
    const v = defaults[key]
    if (v !== undefined) (out as Record<string, unknown>)[key] = Array.isArray(v) ? [...v] : v
  }
  return out
}
