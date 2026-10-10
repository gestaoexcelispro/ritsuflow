// Materials of planned tasks (RitsuScope › Tarefas): what one activity needs in one location.
// A task is one activity (layer) of an estimated wall. Its materials are its part of that wall's estimate:
//  1. The wall's framing layout (the same engine as the takeoff), cut to the stretch the line covers:
//       framing    → studs (and the corner / tee studs standing in the stretch), tracks, headers, LA screws,
//                    anchors and acoustic band where the framing meets another system (wall's fixings)
//       board_a/_b → boards of that face (packed into whole sheets) and their TA screws
//  2. The wall's recipe lines that belong to the activity (RecipeLine.step, guessed from the material when
//     unset): compound and tape → joints, insulation → insulation… taken in proportion to the stretch
//     (area or length) and split between faces for shared lines (boards, joints).
//  3. Extras typed for the activity (project_scopes.plan_materials), per m² / m / line.
// Quantities are kept both exact (for the estimate × planned × actual comparison) and whole (bars,
// sheets, packs: what the crew takes).
import { dist, polyLen, shapeHeight, type FramingConfig, type TakeoffItem, type TakeoffShape, type Vec2 } from './geometry'
import {
  DEFAULT_LA_PER_STUD_END, alongWall, findJunctions, junctionStudsOnWall, layoutWall, packBars, packSheets, screwsAlong, screwsForWall,
  framingLabelsPtBR, type BoardPiece, type WallLayout,
  fixingsForWall, fixingsOf, type FreeEnds,
} from './framing/framing'
import { stepShare, type RecipeLineQty } from './recipes'

export type PlanMaterial = { name: string; unit: string; per: 'm2' | 'm' | 'un'; coef: number; waste?: number; packSize?: number | null; packName?: string | null }

export type TaskMaterialRow = {
  /** Same product and unit across activities (for the location summary). */
  key: string
  mat: string
  /** Exact quantity in `unit`. */
  exact: number
  unit: string
  /** What the crew takes: whole bars / sheets / packs / units. */
  whole: number
  wholeUnit: string
  source: 'layout' | 'recipe' | 'rate'
}

export type TaskLine = { points: Vec2[]; side?: number | null; height_m?: number | null }

export type TaskMaterialsInput = {
  /** takeoff_step of the activity: framing, board_a, joints_a, insulation, board_b, joints_b, measure (or null). */
  step: string | null
  /** The activity's takeoff item on this sheet (with framing config and shapes); null when it has none. */
  item: TakeoffItem | null
  /** Every takeoff item on the sheet (for corner / tee junctions). */
  sheetItems: TakeoffItem[]
  lines: TaskLine[]
  ptPerM: number
  rates: PlanMaterial[]
  /** Insulation product of the wall type (name, unit, pack), when the activity is insulation. */
  insulation?: { name: string; unit: string; packSize?: number | null; packName?: string | null } | null
  labels: { bars: string; sheets: string; un: string; barLen: (len: number) => string; rolls?: string }
  /** The wall's recipe lines evaluated for the whole item (recipeLineQuantities). */
  recipeLines?: RecipeLineQty[]
  /** The whole item's net face area (m²) and length (m): a line's quantity is shared by the stretch drawn. */
  itemBase?: { area: number; length: number } | null
  /** Free wall ends of the sheet's framed walls (freeEnds), for anchors / band against existing walls. */
  ends?: Map<TakeoffShape, FreeEnds>
}

/** Net face area (m²) and length (m) of task lines, openings of the host walls deducted. */
export type TaskBase = { area: number; length: number; lines: number }

type Host = { shape: TakeoffShape; s0: number; s1: number; face: 'A' | 'B' }

/** The wall stretch a task line covers: its shape, interval along it (m) and face. */
export function hostOf(line: TaskLine, item: TakeoffItem, ptPerM: number): Host | null {
  if (line.points.length < 2 || !(ptPerM > 0)) return null
  const [a, b] = [line.points[0], line.points[line.points.length - 1]]
  const len = dist(a, b)
  if (len < 1e-6) return null
  const u: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const half = ((item.thickness && item.thickness > 0 ? item.thickness : 0.1) / 2 + 0.08) * ptPerM
  let best: { shape: TakeoffShape; d: number; segA: Vec2; segB: Vec2 } | null = null
  for (const sh of item.shapes) {
    for (let i = 1; i < sh.pts.length; i++) {
      const p = sh.pts[i - 1], q = sh.pts[i]
      const L = dist(p, q)
      if (L < 1e-6) continue
      const w: Vec2 = [(q[0] - p[0]) / L, (q[1] - p[1]) / L]
      if (Math.abs(u[0] * w[1] - u[1] * w[0]) > 0.05) continue // not parallel
      const t = ((mid[0] - p[0]) * w[0] + (mid[1] - p[1]) * w[1])
      if (t < -half || t > L + half) continue
      const d = Math.abs((mid[0] - p[0]) * w[1] - (mid[1] - p[1]) * w[0])
      if (d <= half && (!best || d < best.d)) best = { shape: sh, d, segA: p, segB: q }
    }
  }
  if (!best) return null
  const s0 = alongWall(best.shape.pts, a, ptPerM)
  const s1 = alongWall(best.shape.pts, b, ptPerM)
  // Face: the side of the wall the band lies on (face A is on the left of the wall's drawing direction).
  const n: Vec2 = [-u[1], u[0]]
  const side = line.side ? Math.sign(line.side) : 1
  const probe: Vec2 = [mid[0] + n[0] * side * ptPerM * 0.2, mid[1] + n[1] * side * ptPerM * 0.2]
  const cross = (best.segB[0] - best.segA[0]) * (probe[1] - best.segA[1]) - (best.segB[1] - best.segA[1]) * (probe[0] - best.segA[0])
  return { shape: best.shape, s0: Math.min(s0, s1), s1: Math.max(s0, s1), face: cross >= 0 ? 'A' : 'B' }
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/** The part of a wall layout inside [s0, s1] (studs standing there, pieces clipped), one face's boards or none. */
export function sliceLayout(lay: WallLayout, s0: number, s1: number, face: 'A' | 'B' | null): WallLayout {
  const inX = (x: number) => x >= s0 - 1e-6 && x <= s1 + 1e-6
  const clip = <T extends { x0: number; x1: number }>(p: T): T | null => { const x0 = Math.max(p.x0, s0), x1 = Math.min(p.x1, s1); return x1 - x0 > 0.005 ? { ...p, x0, x1 } : null }
  const studs = lay.studs.filter(s => inX(s.x))
  const tracks = lay.tracks.map(clip).filter(Boolean) as WallLayout['tracks']
  const headers = lay.headers.map(clip).filter(Boolean) as WallLayout['headers']
  const boardOf = (f: 'A' | 'B') => (face === f ? (lay.board[f].map(clip).filter(Boolean) as BoardPiece[]) : [])
  return { ...lay, studs, tracks, headers, board: { A: boardOf('A'), B: boardOf('B') }, studLen: [], trackLen: [] }
}

/**
 * The activity of a scope line on a wall: its takeoff step when it was imported from RitsuScope, else
 * guessed from its name (old or typed scope): joints, insulation, boards (face B when it says so), framing.
 */
export function inferStep(step: string | null | undefined, name: string | null | undefined): string | null {
  if (step && step !== 'scope') return step
  const n = (name || '').toLowerCase()
  const faceB = /\b(side|face|lado)\s*b\b/.test(n)
  if (/joint|junta|tratamento|massa|tape|fita|taping|finish/.test(n)) return faceB ? 'joints_b' : 'joints_a'
  if (/insula|isola|(^|\s)l[ãa](\s|$)|wool|batt/.test(n)) return 'insulation'
  if (/board|chapa|placa|gypsum|drywall sheet|sheathing|plasterboard/.test(n)) return faceB ? 'board_b' : 'board_a'
  if (/fram|stud|estrutur|montante|perfil|steel|metal/.test(n)) return 'framing'
  return null
}

/** Net face area and length of the lines (each line's height; openings of the host wall in the stretch deducted). */
export function taskBase(lines: TaskLine[], item: TakeoffItem | null, ptPerM: number): TaskBase {
  let area = 0, length = 0
  for (const l of lines) {
    const L = polyLen(l.points) / (ptPerM || 1)
    length += L
    const H = Number(l.height_m) || 0
    let open = 0
    const host = item ? hostOf(l, item, ptPerM) : null
    if (host) {
      for (const o of host.shape.openings || []) open += overlap(o.off - o.w / 2, o.off + o.w / 2, host.s0, host.s1) * Math.max(0, Math.min(o.h, H - (o.sill || 0)))
    }
    area += Math.max(0, L * H - open)
  }
  return { area, length, lines: lines.length }
}

/** Materials of one activity's lines (in one location). */
export function taskMaterials(input: TaskMaterialsInput): TaskMaterialRow[] {
  const { step, item, sheetItems, lines, ptPerM, rates, insulation, labels } = input
  const rows: TaskMaterialRow[] = []
  const F: FramingConfig | undefined = item?.kind === 'linear' && item.framing?.on ? item.framing : undefined
  const framingStep = step === 'framing'
  const boardFace: 'A' | 'B' | null = step === 'board_a' ? 'A' : step === 'board_b' ? 'B' : null

  if (item && F && (framingStep || boardFace)) {
    const studPieces: number[] = [], trackPieces: number[] = []
    const boards = new Map<string, BoardPiece[]>()
    let ta = 0, la = 0, anchors = 0, bandM = 0
    const fx = framingStep ? fixingsOf(F.fixings) : null
    const layouts = new Map<TakeoffShape, WallLayout>()
    const junctions = framingStep ? findJunctions(sheetItems.length ? sheetItems : [item], ptPerM) : []
    for (const l of lines) {
      const host = hostOf(l, item, ptPerM)
      if (!host) continue
      let lay = layouts.get(host.shape)
      if (!lay) { lay = layoutWall(item, host.shape, ptPerM); layouts.set(host.shape, lay) }
      if (framingStep) {
        const s = sliceLayout(lay, host.s0, host.s1, null)
        for (const st of s.studs) studPieces.push(Math.max(0, st.y1 - st.y0 - (st.kind === 'montante' || st.kind === 'batente' ? F.studGap : 0)))
        for (const tr of s.tracks) trackPieces.push(tr.x1 - tr.x0)
        for (const h of s.headers) trackPieces.push(h.x1 - h.x0)
        la += screwsForWall(s, F).la
        // Corner / tee studs standing in the stretch.
        const H = shapeHeight(item, host.shape) - F.studGap
        for (const j of junctionStudsOnWall(junctions, host.shape, ptPerM)) {
          if (j.x < host.s0 - 1e-6 || j.x > host.s1 + 1e-6 || !(H > 0)) continue
          for (let n = 0; n < j.studs; n++) studPieces.push(H)
          la += j.studs * 2 * (F.laPerStudEnd ?? DEFAULT_LA_PER_STUD_END)
        }
        // Anchors and acoustic band where this stretch meets the slab, the ceiling or an existing wall.
        if (fx) {
          const c = fixingsForWall(lay, fx, input.ends?.get(host.shape) || { start: false, end: false }, [host.s0, host.s1], host.shape.contacts)
          anchors += c.anchors
          bandM += c.bandM
          la += c.screws
        }
      } else if (boardFace) {
        // The face the line lies on is the face this activity boards.
        const s = sliceLayout(lay, host.s0, host.s1, host.face)
        const name = lay.boardName[host.face]
        const list = boards.get(name) || []
        list.push(...s.board[host.face])
        boards.set(name, list)
        ta += screwsForWall(s, F).ta
      }
    }
    if (framingStep) {
      const addProfile = (name: string, pieces: number[]) => {
        if (!pieces.length) return
        const p = packBars(pieces, F.bars)
        for (const [len, n] of Object.entries(p.byLen).sort((x, y) => Number(x[0]) - Number(y[0]))) {
          // Exact metres split over the bar lengths in proportion to what each length carries.
          const share = p.total > 0 ? (Number(len) * n) / p.total : 0
          rows.push({ key: `bar|${name}|${len}`, mat: `${name} · ${labels.barLen(Number(len))}`, exact: p.used * share, unit: 'm', whole: n, wholeUnit: labels.bars, source: 'layout' })
        }
      }
      addProfile(F.studName, studPieces)
      addProfile(F.trackName, trackPieces)
      if (la > 0 && F.screwsFromLayout !== false) { const name = F.laName || framingLabelsPtBR.laScrew!; rows.push({ key: `un|${name}`, mat: name, exact: la, unit: labels.un, whole: Math.ceil(la), wholeUnit: labels.un, source: 'layout' }) }
      if (fx && anchors > 0) rows.push({ key: `un|${fx.anchorName}`, mat: fx.anchorName, exact: anchors, unit: labels.un, whole: Math.ceil(anchors - 1e-9), wholeUnit: labels.un, source: 'layout' })
      if (fx && bandM > 0) {
        const roll = fx.bandRoll && fx.bandRoll > 0 ? fx.bandRoll : null
        rows.push({ key: `m|${fx.bandName}`, mat: fx.bandName, exact: bandM, unit: 'm', whole: roll ? Math.ceil(bandM / roll - 1e-9) : Math.ceil(bandM - 1e-9), wholeUnit: roll ? labels.rolls || 'rolos' : 'm', source: 'layout' })
      }
    }
    if (boardFace) {
      for (const [name, pieces] of boards) {
        if (!pieces.length) continue
        const p = packSheets(pieces, F.boardW, F.boardH)
        const exactSheets = p.used / (F.boardW * F.boardH)
        rows.push({ key: `sheet|${name}|${F.boardW}x${F.boardH}`, mat: `${name} · ${labels.barLen(F.boardW)} × ${labels.barLen(F.boardH)}`, exact: exactSheets, unit: labels.sheets, whole: p.count, wholeUnit: labels.sheets, source: 'layout' })
      }
      if (ta > 0 && F.screwsFromLayout !== false) { const name = F.taName || framingLabelsPtBR.taScrew!; rows.push({ key: `un|${name}`, mat: name, exact: ta, unit: labels.un, whole: Math.ceil(ta), wholeUnit: labels.un, source: 'layout' }) }
    }
  }

  const base = taskBase(lines, item, ptPerM)

  // The wall's recipe lines that belong to this activity, in proportion to the stretch drawn.
  let recipeInsulation = false
  if (item && input.recipeLines?.length && input.itemBase) {
    const layers = { A: F ? F.layersA : 1, B: F ? F.layersB : 1 }
    for (const q of input.recipeLines) {
      const share = step === 'measure' ? (q.step === 'none' ? 0 : 1) : stepShare(q.step, step, layers)
      if (!(share > 0)) continue
      const byLength = q.line.base === 'm'
      const whole = byLength ? input.itemBase.length : input.itemBase.area
      const part = byLength ? base.length : base.area
      if (!(whole > 0) || !(part > 0)) continue
      const exact = q.qty * (part / whole) * share
      if (!(exact > 0)) continue
      if (q.step === 'insulation') recipeInsulation = true
      const pack = q.packSize && q.packSize > 0 ? q.packSize : null
      rows.push({
        key: q.materialId ? `id|${q.materialId}` : `rec|${q.mat.toLowerCase()}|${q.unit}`, mat: q.mat, exact, unit: q.unit,
        whole: pack ? Math.ceil(exact / pack - 1e-9) : Math.ceil(exact - 1e-9), wholeUnit: pack ? q.packName || labels.un : q.unit, source: 'recipe',
      })
    }
  }

  if (step === 'insulation' && insulation && base.area > 0 && !recipeInsulation) {
    const exact = base.area
    const pack = insulation.packSize && insulation.packSize > 0 ? insulation.packSize : null
    rows.push({ key: `ins|${insulation.name}|${insulation.unit}`, mat: insulation.name, exact, unit: insulation.unit || 'm²', whole: pack ? Math.ceil(exact / pack - 1e-9) : Math.ceil(exact - 1e-9), wholeUnit: pack ? insulation.packName || labels.un : insulation.unit || 'm²', source: 'layout' })
  }

  for (const r of rates) {
    if (!r.name || !(r.coef > 0)) continue
    const b = r.per === 'm' ? base.length : r.per === 'un' ? base.lines : base.area
    const exact = b * r.coef * (1 + (Number(r.waste) || 0) / 100)
    if (!(exact > 0)) continue
    const pack = r.packSize && r.packSize > 0 ? r.packSize : null
    rows.push({ key: `rate|${r.name.toLowerCase()}|${r.unit}`, mat: r.name, exact, unit: r.unit, whole: pack ? Math.ceil(exact / pack - 1e-9) : Math.ceil(exact - 1e-9), wholeUnit: pack ? r.packName || labels.un : r.unit, source: 'rate' })
  }
  return rows
}

/** Location summary: the same material across activities, exact and whole quantities added. */
export function sumMaterials(groups: TaskMaterialRow[][]): TaskMaterialRow[] {
  const by = new Map<string, TaskMaterialRow>()
  for (const g of groups) for (const r of g) {
    const e = by.get(r.key)
    if (e) { e.exact += r.exact; e.whole += r.whole } else by.set(r.key, { ...r })
  }
  return [...by.values()].sort((a, b) => a.mat.localeCompare(b.mat))
}

/** Clean list of rates (as stored in project_scopes.plan_materials). */
export function planMaterialsOf(raw: unknown): PlanMaterial[] {
  if (!Array.isArray(raw)) return []
  return raw.map(r => r as Record<string, unknown>).map(r => ({
    name: String(r.name || '').trim(),
    unit: String(r.unit || '').trim(),
    per: (r.per === 'm' || r.per === 'un' ? r.per : 'm2') as PlanMaterial['per'],
    coef: Number(r.coef) || 0,
    waste: Number(r.waste) || 0,
    packSize: Number(r.packSize) > 0 ? Number(r.packSize) : null,
    packName: r.packName ? String(r.packName) : null,
  }))
}

// Used by tests: screws along a stretch.
export { screwsAlong }
