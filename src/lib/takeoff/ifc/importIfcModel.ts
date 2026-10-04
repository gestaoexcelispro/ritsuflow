// Turns an IFC read result into takeoff layers (items) and elements (shapes).
// Ported from the prototype's importIfc(): board walls modelled as separate thin
// walls are grouped onto their core wall, openings become count layers, and
// coverings become area layers. Sheet coordinates use a fixed 40 pt/m.

import { defaultFraming, framingLabelsPtBR, type FramingLabels } from '../framing/framing'
import type { TakeoffItem, TakeoffShape, Vec2 } from '../geometry'
import type { IfcReadResult, IfcStorey, IfcWall } from './readIfc'

export const IFC_SHEET_PT_PER_M = 40
const SHEET_MARGIN_M = 2

export const LAYER_PALETTE = ['#0F9D8A', '#C2410C', '#2563EB', '#9333EA', '#CA8A04', '#DB2777', '#16A34A', '#0891B2', '#7C3AED', '#DC2626']

export type ImportLabels = {
  locale: string
  door: string
  window: string
  voidOpening: string
  noFill: string
  ceiling: string
  covering: string
  lining: string
  elevation: string
  twoFaces: string
  noBoard: string
  noStorey: string
  face: string
  systems: { masonry: string; drywall: string; other: string; opening: string; ceiling: string; covering: string }
  framing: FramingLabels
}

export const importLabelsPtBR: ImportLabels = {
  locale: 'pt-BR',
  door: 'Porta',
  window: 'Janela',
  voidOpening: 'Vão sem esquadria',
  noFill: '(sem preenchimento)',
  ceiling: 'Forro',
  covering: 'Revestimento',
  lining: 'revestimento',
  elevation: 'cota',
  twoFaces: '2 faces',
  noBoard: '(sem chapa)',
  noStorey: 'Sem pavimento',
  face: 'face',
  systems: { masonry: 'Alvenaria', drywall: 'Drywall', other: 'Outro', opening: 'Esquadria', ceiling: 'Forro', covering: 'Revestimento' },
  framing: framingLabelsPtBR,
}

export const importLabelsEnUS: ImportLabels = {
  locale: 'en-US',
  door: 'Door',
  window: 'Window',
  voidOpening: 'Unfilled opening',
  noFill: '(no fill)',
  ceiling: 'Ceiling',
  covering: 'Covering',
  lining: 'lining',
  elevation: 'elevation',
  twoFaces: '2 faces',
  noBoard: '(no board)',
  noStorey: 'No storey',
  face: 'face',
  systems: { masonry: 'Masonry', drywall: 'Drywall', other: 'Other', opening: 'Opening', ceiling: 'Ceiling', covering: 'Covering' },
  framing: { stud: mm => `Stud ${mm} mm`, track: mm => `Track ${mm} mm`, board: 'ST board 12.5 mm', taScrew: 'TA screw 3.5 × 25 mm', laScrew: 'LA screw 4.2 × 9.5 mm' },
}

export type IfcSheet = {
  storeys: { id: number | null; guid: string | null; name: string; elev: number }[]
  ptPerM: number
  width: number
  height: number
}

export type IfcImport = {
  sheet: IfcSheet
  items: TakeoffItem[]
  /** Number of core + lining wall elements created. */
  linearElements: number
}

/** Board walls thinner than this are treated as face layers, not walls. */
const THIN_WALL_M = 0.03

export function importIfcModel(R: IfcReadResult, labels: ImportLabels = importLabelsPtBR): IfcImport {
  const fmt = (v: number, d = 2) => v.toLocaleString(labels.locale, { minimumFractionDigits: d, maximumFractionDigits: d })
  const fmt3 = (v: number) => v.toLocaleString(labels.locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 })

  const used = new Set<number | null>([...R.walls.map(w => w.storey), ...R.ceilings.map(c => c.storey), ...R.loose.map(d => d.storey)])
  let sts: { id: number | null; guid: string | null; name: string; elev: number }[] = R.storeys.filter((s: IfcStorey) => used.has(s.id)).sort((a, b) => a.elev - b.elev)
  if (!sts.length || used.has(null)) sts = [...sts, { id: null, guid: null, name: labels.noStorey, elev: 0 }]

  const P: Vec2[] = []
  R.walls.forEach(w => { P.push(w.a, w.b) })
  R.ceilings.forEach(c => P.push(...c.poly))
  R.loose.forEach(d => P.push(d.at))
  const minX = Math.min(...P.map(p => p[0]))
  const maxX = Math.max(...P.map(p => p[0]))
  const minY = Math.min(...P.map(p => p[1]))
  const maxY = Math.max(...P.map(p => p[1]))
  const k = IFC_SHEET_PT_PER_M
  const mg = SHEET_MARGIN_M
  const T = (p: Vec2): Vec2 => [(p[0] - minX + mg) * k, (maxY - p[1] + mg) * k]
  const pageOf = (sid: number | null) => Math.max(1, sts.findIndex(s => s.id === sid) + 1)
  const elevOf = (sid: number | null) => (sts.find(s => s.id === sid) || { elev: 0 }).elev
  const nameOf = (sid: number | null) => (sts.find(s => s.id === sid) || { name: '' }).name

  const short = (s: string) => {
    const p = String(s).split(':')
    return (p[1] || p[0]).trim()
  }
  const sysOf = (s: string) =>
    /alvenaria|bloco|tijolo|concrete|concreto|masonry|brick/i.test(s)
      ? labels.systems.masonry
      : /drywall|gypsum|gesso|plaster/i.test(s)
        ? labels.systems.drywall
        : labels.systems.other

  // --- group thin layers onto core walls ---
  const thin = (w: IfcWall) => w.t < THIN_WALL_M
  const cores = R.walls.filter(w => !thin(w))
  const thins = R.walls.filter(thin)
  const att = new Map<string | null, { plus: IfcWall[]; minus: IfcWall[] }>(cores.map(c => [c.guid, { plus: [], minus: [] }]))
  const usedThin = new Set<string | null>()
  for (const tw of thins)
    for (const c of cores) {
      if (c.storey !== tw.storey) continue
      const ux = [(c.b[0] - c.a[0]) / c.len, (c.b[1] - c.a[1]) / c.len]
      const vx = [(tw.b[0] - tw.a[0]) / tw.len, (tw.b[1] - tw.a[1]) / tw.len]
      if (Math.abs(ux[0] * vx[1] - ux[1] * vx[0]) > 0.02) continue // not parallel
      const nx = [-ux[1], ux[0]]
      const mid = [(tw.a[0] + tw.b[0]) / 2, (tw.a[1] + tw.b[1]) / 2]
      const off = (mid[0] - c.a[0]) * nx[0] + (mid[1] - c.a[1]) * nx[1]
      if (Math.abs(off) > (c.t + tw.t) / 2 + 0.012) continue // not touching the core face
      const s1 = (tw.a[0] - c.a[0]) * ux[0] + (tw.a[1] - c.a[1]) * ux[1]
      const s2 = (tw.b[0] - c.a[0]) * ux[0] + (tw.b[1] - c.a[1]) * ux[1]
      if (Math.min(c.len, Math.max(s1, s2)) - Math.max(0, Math.min(s1, s2)) < 0.1) continue // overlap < 0.1 m
      att.get(c.guid)![off > 0 ? 'plus' : 'minus'].push(tw)
      usedThin.add(tw.guid)
    }

  const groups = new Map<string, TakeoffItem>()
  const getItem = (key: string, mk: () => Omit<TakeoffItem, 'key' | 'color' | 'shapes'>): TakeoffItem => {
    if (!groups.has(key)) groups.set(key, { ...mk(), key, color: LAYER_PALETTE[groups.size % LAYER_PALETTE.length], shapes: [] })
    return groups.get(key)!
  }

  const addOpeningCounts = (w: IfcWall, shapeStart: Vec2, u: number[], page: number) => {
    for (const o of w.openings) {
      const f = o.fill
      const kind = f ? f.kind : 'void'
      const ow = f && f.w ? f.w : o.w
      const oh = f && f.h ? f.h : o.h
      const label = kind === 'door' ? labels.door : kind === 'window' ? labels.window : labels.voidOpening
      const key = `count|${kind}|${f ? f.name : ''}|${ow.toFixed(3)}|${oh.toFixed(3)}|${o.sill.toFixed(2)}`
      const it = getItem(key, () => ({
        kind: 'count',
        name: `${label} ${fmt3(ow)} × ${fmt3(oh)} m`,
        system: labels.systems.opening,
        width: ow,
        height: oh,
        sill: o.sill,
        location: nameOf(w.storey),
        ifcType: f ? f.name : labels.noFill,
      }))
      it.shapes.push({ page, pts: [T([shapeStart[0] + u[0] * o.off, shapeStart[1] + u[1] * o.off])], guid: f ? f.guid : o.guid, sill: o.sill })
    }
  }

  for (const c of cores) {
    const a = att.get(c.guid)!
    const tp = a.plus.length ? Math.max(...a.plus.map(x => x.t)) : 0
    const tm = a.minus.length ? Math.max(...a.minus.map(x => x.t)) : 0
    const Tt = c.t + tp + tm
    const shift = (tp - tm) / 2
    const ux = [(c.b[0] - c.a[0]) / c.len, (c.b[1] - c.a[1]) / c.len]
    const nx = [-ux[1], ux[0]]
    const A: Vec2 = [c.a[0] + nx[0] * shift, c.a[1] + nx[1] * shift]
    const B: Vec2 = [c.b[0] + nx[0] * shift, c.b[1] + nx[1] * shift]
    const faceNames = [...new Set([...a.plus, ...a.minus].map(x => short(x.type)))]
    const faces = faceNames.length
      ? ` + ${faceNames.join(' / ')}${a.plus.length && a.minus.length && faceNames.length === 1 ? ` (${labels.twoFaces})` : ''}`
      : ''
    const key = `wall|${c.type}|${faceNames.join(',')}|${a.plus.length ? 1 : 0}${a.minus.length ? 1 : 0}|${Math.round(Tt * 1000)}`
    const it = getItem(key, () => ({
      kind: 'linear',
      name: `${short(c.type)}${faces} · ${Math.round(Tt * 1000)} mm`,
      system: sysOf(c.type + ' ' + c.layerSet),
      thickness: Tt,
      height: c.h,
      location: nameOf(c.storey),
      deductOpenings: true,
      ifcType: c.type,
      layers: [...c.layers.map(l => `${l.mat} ${Math.round(l.t * 1000)} mm`), ...faceNames.map(f => `${f} (${labels.face})`)],
    }))
    if (!it.framing) {
      it.framing = defaultFraming(it, labels.framing)
      const coreMM = Math.round(c.t * 1000)
      it.framing.studName = labels.framing.stud(coreMM)
      it.framing.trackName = labels.framing.track(coreMM)
      const nm = (arr: IfcWall[]) => (arr.length ? `${short(arr[0].type)} ${fmt(arr[0].t * 1000, 1).replace(/[,.]0$/, '')} mm` : labels.noBoard)
      it.framing.boardA = nm(a.plus)
      it.framing.boardB = nm(a.minus)
      it.framing.layersA = a.plus.length ? 1 : 0
      it.framing.layersB = a.minus.length ? 1 : 0
      it.framing.on = it.system === labels.systems.drywall && faceNames.length > 0
    }
    const page = pageOf(c.storey)
    const zrel = c.z0 - elevOf(c.storey)
    const sh: TakeoffShape = {
      page,
      pts: [T(A), T(B)],
      guid: c.guid,
      root: c.guid,
      layerGuids: [...a.plus, ...a.minus].map(x => x.guid),
      zrel,
      openings: c.openings.map(o => ({ off: o.off, w: o.w, h: o.h, sill: o.sill, kind: o.fill ? o.fill.kind : 'void', guid: o.fill ? o.fill.guid : o.guid })),
    }
    if (Math.abs(c.h - (it.height || 0)) > 0.005) sh.h = c.h
    it.shapes.push(sh)
    addOpeningCounts(c, A, ux, page)
  }

  for (const tw of thins) {
    if (usedThin.has(tw.guid)) continue
    const it = getItem(`lining|${tw.type}`, () => ({
      kind: 'linear',
      name: `${short(tw.type)} (${labels.lining}) · ${Math.round(tw.t * 1000)} mm`,
      system: sysOf(tw.type),
      thickness: tw.t,
      height: tw.h,
      location: nameOf(tw.storey),
      deductOpenings: true,
      ifcType: tw.type,
    }))
    it.shapes.push({
      page: pageOf(tw.storey),
      pts: [T(tw.a), T(tw.b)],
      guid: tw.guid,
      root: tw.guid,
      zrel: tw.z0 - elevOf(tw.storey),
      openings: tw.openings.map(o => ({ off: o.off, w: o.w, h: o.h, sill: o.sill, kind: 'void', guid: o.guid })),
    })
  }

  for (const d of R.loose) {
    const label = d.kind === 'door' ? labels.door : labels.window
    const it = getItem(`count|${d.kind}|${d.name}|${d.w.toFixed(3)}|${d.h.toFixed(3)}`, () => ({
      kind: 'count',
      name: `${label} ${fmt3(d.w)} × ${fmt3(d.h)} m`,
      system: labels.systems.opening,
      width: d.w,
      height: d.h,
      sill: d.sill - elevOf(d.storey),
      location: nameOf(d.storey),
    }))
    it.shapes.push({ page: pageOf(d.storey), pts: [T(d.at)], guid: d.guid })
  }

  for (const c of R.ceilings) {
    const z = c.z - elevOf(c.storey)
    const isCeiling = c.kind === 'CEILING'
    const it = getItem(`ceil|${c.name}|${z.toFixed(2)}`, () => ({
      kind: 'area',
      name: `${isCeiling ? labels.ceiling : labels.covering} ${short(c.name)} · ${labels.elevation} ${fmt(z)} m`,
      system: isCeiling ? labels.systems.ceiling : labels.systems.covering,
      thickness: 0.0125,
      elevation: z,
      location: nameOf(c.storey),
    }))
    it.shapes.push({ page: pageOf(c.storey), pts: c.poly.map(T), guid: c.guid })
  }

  const order = { linear: 0, area: 1, count: 2 }
  const items = [...groups.values()].sort((x, y) => order[x.kind] - order[y.kind])
  return {
    sheet: { storeys: sts, ptPerM: k, width: (maxX - minX + 2 * mg) * k, height: (maxY - minY + 2 * mg) * k },
    items,
    linearElements: items.filter(i => i.kind === 'linear').reduce((s, i) => s + i.shapes.length, 0),
  }
}
