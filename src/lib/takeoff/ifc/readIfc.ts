/* Lightweight IFC (STEP) reader for the Takeoff module.
   Ported from the "Levantamento por Cores" prototype (ifc-reader.js) with the
   same logic. Reads units, storeys, walls (axis + extrusion + material layers),
   openings + fills, doors, windows and coverings. Returns plain data in metres,
   world coordinates. Pure TypeScript: no DOM, no React. */

/* eslint-disable @typescript-eslint/no-explicit-any */
type V = any // STEP values are dynamically shaped: {r}, {s}, {e}, {t,v}, number, array or null

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

export type IfcWarning = { code: 'unsupported_wall' | 'unsupported_covering'; guid: string | null }

export type IfcOpeningFill = {
  guid: string | null
  kind: 'door' | 'window' | 'other'
  name: string
  /** OverallWidth (attribute index 9) in metres, if present. */
  w: number | null
  /** OverallHeight (attribute index 8) in metres, if present. */
  h: number | null
}

export type IfcOpening = {
  guid: string | null
  /** Centre of the opening measured along the wall axis, from point a. */
  off: number
  w: number
  h: number
  sill: number
  fill: IfcOpeningFill | null
}

export type IfcWall = {
  guid: string | null
  name: string
  type: string
  layerSet: string
  layers: { mat: string; t: number }[]
  t: number
  a: Vec2
  b: Vec2
  z0: number
  h: number
  len: number
  storey: number | null
  openings: IfcOpening[]
}

export type IfcLooseFill = {
  guid: string | null
  kind: 'door' | 'window'
  name: string
  w: number
  h: number
  at: Vec2
  sill: number
  storey: number | null
}

export type IfcCovering = {
  guid: string | null
  kind: string
  name: string
  poly: Vec2[]
  z: number
  storey: number | null
}

export type IfcStorey = { id: number; guid: string | null; name: string; elev: number }

export type IfcReadResult = {
  schema: string
  app: string
  project: string
  storeys: IfcStorey[]
  walls: IfcWall[]
  loose: IfcLooseFill[]
  ceilings: IfcCovering[]
  warnings: IfcWarning[]
  entityCount: number
}

export class IfcReadError extends Error {
  code: 'no_data_section' | 'malformed' | 'unterminated_string'
  constructor(code: IfcReadError['code'], message: string) {
    super(message)
    this.code = code
  }
}

type Entity = { id: number; type: string; a: V[] }
type Mat4 = number[] // row-major 4x4

export function readIfc(text: string): IfcReadResult {
  // ---------- STEP parsing ----------
  const E = new Map<number, Entity>()
  const ds = text.indexOf('DATA;')
  if (ds < 0) throw new IfcReadError('no_data_section', 'File has no DATA; section, so it is not an IFC file.')
  let i = ds + 5
  const N = text.length

  function decodeStr(s: string): string {
    return s
      .replace(/\\X2\\([0-9A-F]+)\\X0\\/gi, (_m, h: string) => {
        let o = ''
        for (let k = 0; k < h.length; k += 4) o += String.fromCharCode(parseInt(h.substr(k, 4), 16))
        return o
      })
      .replace(/\\X\\([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\S\\(.)/g, (_m, c: string) => String.fromCharCode(c.charCodeAt(0) + 128))
  }

  function skipWs() {
    while (i < N) {
      const c = text[i]
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t') i++
      else if (c === '/' && text[i + 1] === '*') {
        const e = text.indexOf('*/', i + 2)
        i = e < 0 ? N : e + 2
      } else break
    }
  }

  function parseVal(): V {
    skipWs()
    const c = text[i]
    if (c === '(') {
      i++
      const arr: V[] = []
      skipWs()
      if (text[i] === ')') { i++; return arr }
      for (;;) {
        arr.push(parseVal())
        skipWs()
        if (text[i] === ',') { i++; continue }
        if (text[i] === ')') { i++; break }
        throw new IfcReadError('malformed', `Malformed IFC near character ${i}`)
      }
      return arr
    }
    if (c === "'") {
      i++
      let s = ''
      for (;;) {
        const j = text.indexOf("'", i)
        if (j < 0) throw new IfcReadError('unterminated_string', 'Unterminated string in IFC')
        s += text.slice(i, j)
        if (text[j + 1] === "'") { s += "'"; i = j + 2 } else { i = j + 1; break }
      }
      return { s: decodeStr(s) }
    }
    if (c === '#') {
      i++
      let j = i
      while (j < N && /[0-9]/.test(text[j])) j++
      const r = +text.slice(i, j)
      i = j
      return { r }
    }
    if (c === '.') {
      const j = text.indexOf('.', i + 1)
      const v = text.slice(i + 1, j)
      i = j + 1
      return { e: v }
    }
    if (c === '$' || c === '*') { i++; return null }
    if (/[A-Za-z]/.test(c)) {
      let j = i
      while (j < N && /[A-Za-z0-9_]/.test(text[j])) j++
      const name = text.slice(i, j)
      i = j
      skipWs()
      const v = parseVal()
      return { t: name, v: Array.isArray(v) ? v[0] : v }
    }
    let j = i
    while (j < N && /[-+0-9.Ee]/.test(text[j])) j++
    const num = parseFloat(text.slice(i, j))
    i = j
    return num
  }

  for (;;) {
    skipWs()
    if (i >= N) break
    if (text.startsWith('ENDSEC', i)) break
    if (text[i] !== '#') { const e = text.indexOf(';', i); i = e < 0 ? N : e + 1; continue }
    i++
    let j = i
    while (/[0-9]/.test(text[j])) j++
    const id = +text.slice(i, j)
    i = j
    skipWs()
    if (text[i] !== '=') { const e = text.indexOf(';', i); i = e + 1; continue }
    i++
    skipWs()
    let k = i
    while (/[A-Za-z0-9_]/.test(text[k])) k++
    const type = text.slice(i, k).toUpperCase()
    i = k
    const args = parseVal()
    skipWs()
    if (text[i] === ';') i++
    E.set(id, { id, type, a: args })
  }

  const get = (x: V): Entity | null => (x && x.r != null ? E.get(x.r) ?? null : null)
  const str = (x: V): string | null =>
    x && x.s != null ? x.s : x && x.t ? (x.v && x.v.s != null ? x.v.s : x.v) : null
  const byType = new Map<string, Entity[]>()
  for (const e of E.values()) {
    if (!byType.has(e.type)) byType.set(e.type, [])
    byType.get(e.type)!.push(e)
  }
  const all = (t: string) => byType.get(t) || []

  // ---------- units ----------
  let lenScale = 1
  for (const u of all('IFCSIUNIT')) {
    if (u.a[1] && u.a[1].e === 'LENGTHUNIT') {
      const p = u.a[2] && u.a[2].e
      lenScale = p === 'MILLI' ? 0.001 : p === 'CENTI' ? 0.01 : p === 'DECI' ? 0.1 : p === 'KILO' ? 1000 : 1
    }
  }
  for (const u of all('IFCCONVERSIONBASEDUNIT')) {
    const ut = u.a[1] && u.a[1].e
    if (ut === 'LENGTHUNIT') {
      const mu = get(u.a[3])
      const vc = mu && mu.a[0]
      const f = vc && vc.t ? vc.v : vc
      if (isFinite(f)) lenScale = f
    }
  }

  // ---------- geometry helpers ----------
  const I4 = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const mul = (A: Mat4, B: Mat4): Mat4 => {
    const C = new Array(16).fill(0)
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        let s = 0
        for (let k = 0; k < 4; k++) s += A[r * 4 + k] * B[k * 4 + c]
        C[r * 4 + c] = s
      }
    return C
  }
  const ap = (M: Mat4, p: number[]): Vec3 => [
    M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3],
    M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7],
    M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11],
  ]
  const av = (M: Mat4, v: number[]): Vec3 => [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[4] * v[0] + M[5] * v[1] + M[6] * v[2],
    M[8] * v[0] + M[9] * v[1] + M[10] * v[2],
  ]
  const nrm = (v: number[]): number[] => {
    const l = Math.hypot(...v) || 1
    return v.map(x => x / l)
  }
  const cross = (a: number[], b: number[]): number[] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const pt = (e: Entity): Vec3 => {
    const c = e.a[0]
    return [(c[0] || 0) * lenScale, (c[1] || 0) * lenScale, (c[2] || 0) * lenScale]
  }
  const dir = (e: Entity): Vec3 => {
    const c = e.a[0]
    return [c[0] || 0, c[1] || 0, c[2] || 0]
  }
  function axis3(e: Entity | null): Mat4 {
    if (!e) return I4()
    if (e.type === 'IFCAXIS2PLACEMENT2D') {
      const o = pt(get(e.a[0])!)
      const x = e.a[1] ? nrm(dir(get(e.a[1])!)) : [1, 0, 0]
      return [x[0], -x[1], 0, o[0], x[1], x[0], 0, o[1], 0, 0, 1, 0, 0, 0, 0, 1]
    }
    const o = pt(get(e.a[0])!)
    const z = e.a[1] ? nrm(dir(get(e.a[1])!)) : [0, 0, 1]
    let x = e.a[2] ? nrm(dir(get(e.a[2])!)) : Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    if (!e.a[2] && Math.abs(z[2]) < 0.9) x = nrm(cross([0, 0, 1], z))
    const d = x[0] * z[0] + x[1] * z[1] + x[2] * z[2]
    x = nrm([x[0] - d * z[0], x[1] - d * z[1], x[2] - d * z[2]])
    const y = cross(z, x)
    return [x[0], y[0], z[0], o[0], x[1], y[1], z[1], o[1], x[2], y[2], z[2], o[2], 0, 0, 0, 1]
  }
  const plCache = new Map<number, Mat4>()
  function placement(e: Entity | null): Mat4 {
    if (!e) return I4()
    const cached = plCache.get(e.id)
    if (cached) return cached
    let M = I4()
    if (e.type === 'IFCLOCALPLACEMENT') {
      const rel = get(e.a[0])
      M = mul(rel ? placement(rel) : I4(), axis3(get(e.a[1])))
    }
    plCache.set(e.id, M)
    return M
  }
  const reps = (prod: Entity): Entity[] => {
    const pds = get(prod.a[6])
    if (!pds) return []
    return (pds.a[2] || []).map(get).filter(Boolean) as Entity[]
  }
  const repOf = (prod: Entity, id: string) => reps(prod).find(r => str(r.a[1]) === id)
  function baseSolid(it: Entity | null): Entity | null {
    let k = 0
    while (it && k++ < 10) {
      if (it.type === 'IFCEXTRUDEDAREASOLID') return it
      if (it.type === 'IFCBOOLEANCLIPPINGRESULT' || it.type === 'IFCBOOLEANRESULT') it = get(it.a[1])
      else if (it.type === 'IFCMAPPEDITEM') {
        const map = get(it.a[0])
        const r = map && get(map.a[1])
        it = r ? get((r.a[3] || [])[0]) : null
      } else return null
    }
    return null
  }
  function profilePoly(p: Entity | null): Vec3[] | null {
    if (!p) return null
    if (p.type === 'IFCRECTANGLEPROFILEDEF') {
      const M = axis3(get(p.a[2]))
      const x = (p.a[3] * lenScale) / 2
      const y = (p.a[4] * lenScale) / 2
      return [[-x, -y], [x, -y], [x, y], [-x, y]].map(q => ap(M, [q[0], q[1], 0]))
    }
    if (p.type === 'IFCARBITRARYCLOSEDPROFILEDEF' || p.type === 'IFCARBITRARYPROFILEDEFWITHVOIDS') {
      const c = get(p.a[2])
      if (c && c.type === 'IFCPOLYLINE') return (c.a[0] as V[]).map(get).map(e => pt(e!))
    }
    return null
  }
  function solidCorners(solid: Entity, M: Mat4): Vec3[] | null {
    const prof = profilePoly(get(solid.a[0]))
    if (!prof) return null
    const P = mul(M, axis3(get(solid.a[1])))
    const d = dir(get(solid.a[2])!)
    const D = solid.a[3] * lenScale
    const out: Vec3[] = []
    for (const q of prof) {
      out.push(ap(P, q))
      out.push(ap(P, [q[0] + d[0] * D, q[1] + d[1] * D, q[2] + d[2] * D]))
    }
    return out
  }

  // ---------- relationships ----------
  const typeOf = new Map<number, Entity | null>()
  const matOf = new Map<number, Entity | null>()
  const container = new Map<number, Entity | null>()
  const voids = new Map<number, (Entity | null)[]>()
  const fills = new Map<number, Entity | null>()
  for (const r of all('IFCRELDEFINESBYTYPE')) for (const o of r.a[4] || []) typeOf.set(o.r, get(r.a[5]))
  for (const r of all('IFCRELASSOCIATESMATERIAL')) for (const o of r.a[4] || []) matOf.set(o.r, get(r.a[5]))
  for (const r of all('IFCRELCONTAINEDINSPATIALSTRUCTURE')) for (const o of r.a[4] || []) container.set(o.r, get(r.a[5]))
  for (const r of all('IFCRELVOIDSELEMENT')) {
    const w = r.a[4].r
    if (!voids.has(w)) voids.set(w, [])
    voids.get(w)!.push(get(r.a[5]))
  }
  for (const r of all('IFCRELFILLSELEMENT')) fills.set(r.a[4].r, get(r.a[5]))

  const storeys: IfcStorey[] = all('IFCBUILDINGSTOREY').map(s => ({
    id: s.id,
    guid: str(s.a[0]),
    name: str(s.a[2]) || 'Pavimento',
    elev: (s.a[9] || 0) * lenScale,
  }))
  const storeyOf = (e: Entity): number | null => {
    const c = container.get(e.id)
    return c && c.type === 'IFCBUILDINGSTOREY' ? c.id : null
  }
  const nameOf = (e: Entity) => str(e.a[2]) || ''
  const typeName = (e: Entity): string => {
    const t = typeOf.get(e.id)
    if (t && str(t.a[2])) return str(t.a[2])!
    const n = nameOf(e)
    return n.split(':').slice(0, 2).join(':') || e.type
  }

  type LayerInfo = { name: string; layers: { mat: string; t: number }[]; t: number; sense?: string; offset?: number }
  function layers(e: Entity): LayerInfo | null {
    const m = matOf.get(e.id)
    if (!m) return null
    const readLayers = (list: V[]) =>
      (list || []).map(get).map(l => ({
        mat: str((get(l!.a[0]) || { a: [] as V[] }).a[0]) || '?',
        t: (l!.a[1] || 0) * lenScale,
      }))
    if (m.type === 'IFCMATERIALLAYERSETUSAGE') {
      const ls = get(m.a[0])!
      const L = readLayers(ls.a[0])
      return {
        name: str(ls.a[1]) || '',
        layers: L,
        t: L.reduce((s, l) => s + l.t, 0),
        sense: m.a[2] && m.a[2].e,
        offset: (m.a[3] || 0) * lenScale,
      }
    }
    if (m.type === 'IFCMATERIALLAYERSET') {
      const L = readLayers(m.a[0])
      return { name: str(m.a[1]) || '', layers: L, t: L.reduce((s, l) => s + l.t, 0) }
    }
    if (m.type === 'IFCMATERIAL') return { name: str(m.a[0]) || '', layers: [], t: 0 }
    return null
  }

  // ---------- walls ----------
  const warnings: IfcWarning[] = []
  const walls: IfcWall[] = []
  for (const w of [...all('IFCWALLSTANDARDCASE'), ...all('IFCWALL')]) {
    const M = placement(get(w.a[5]))
    const axr = repOf(w, 'Axis')
    const body = repOf(w, 'Body')
    const solid = body ? baseSolid(get((body.a[3] || [])[0])) : null
    let a: Vec3 | null = null
    let b: Vec3 | null = null
    if (axr) {
      const it = get(axr.a[3][0])
      if (it && it.type === 'IFCPOLYLINE') {
        const P = (it.a[0] as V[]).map(get).map(e => pt(e!))
        a = ap(M, P[0])
        b = ap(M, P[P.length - 1])
      }
    }
    const ly = layers(w)
    let t: number | null = ly && ly.t > 0 ? ly.t : null
    if (solid) {
      const prof = get(solid.a[0])
      if (!t && prof && prof.type === 'IFCRECTANGLEPROFILEDEF') t = prof.a[4] * lenScale
    }
    if (!a || !b || !solid) {
      warnings.push({ code: 'unsupported_wall', guid: str(w.a[0]) })
      continue
    }
    // centre line: shift the axis by the layer offset so the line is the wall centre
    if (ly && ly.offset != null && ly.t) {
      const sgn = ly.sense === 'NEGATIVE' ? -1 : 1
      const c = ly.offset + (sgn * ly.t) / 2
      if (Math.abs(c) > 1e-4) {
        const ny = nrm(av(M, [0, 1, 0]))
        a = [a[0] + ny[0] * c, a[1] + ny[1] * c, a[2]]
        b = [b[0] + ny[0] * c, b[1] + ny[1] * c, b[2]]
      }
    }
    const ed = dir(get(solid.a[2])!)
    const SM = mul(M, axis3(get(solid.a[1])))
    const h = Math.abs(solid.a[3] * lenScale * av(SM, ed)[2])
    const z0 = ap(SM, [0, 0, 0])[2]
    const ux = nrm([b[0] - a[0], b[1] - a[1], 0])
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    // openings along the axis
    const ops: IfcOpening[] = []
    for (const o of voids.get(w.id) || []) {
      if (!o) continue
      const ob = repOf(o, 'Body')
      const os = ob ? baseSolid(get(ob.a[3][0])) : null
      if (!os) continue
      const C = solidCorners(os, placement(get(o.a[5])))
      if (!C) continue
      const along = C.map(p => (p[0] - a![0]) * ux[0] + (p[1] - a![1]) * ux[1])
      const zs = C.map(p => p[2])
      const s0 = Math.max(0, Math.min(...along))
      const s1 = Math.min(len, Math.max(...along))
      const zz0 = Math.max(z0, Math.min(...zs))
      const zz1 = Math.min(z0 + h, Math.max(...zs))
      if (s1 - s0 < 0.01 || zz1 - zz0 < 0.01) continue
      const f = fills.get(o.id)
      ops.push({
        guid: str(o.a[0]),
        off: (s0 + s1) / 2,
        w: s1 - s0,
        h: zz1 - zz0,
        sill: zz0 - z0,
        fill: f
          ? {
              guid: str(f.a[0]),
              kind: f.type === 'IFCDOOR' ? 'door' : f.type === 'IFCWINDOW' ? 'window' : 'other',
              name: typeName(f),
              // IfcDoor / IfcWindow: OverallHeight is attribute 8, OverallWidth is attribute 9.
              w: f.a[9] != null ? f.a[9] * lenScale : null,
              h: f.a[8] != null ? f.a[8] * lenScale : null,
            }
          : null,
      })
    }
    walls.push({
      guid: str(w.a[0]),
      name: nameOf(w),
      type: typeName(w),
      layerSet: ly ? ly.name : '',
      layers: ly ? ly.layers : [],
      t: t || 0.1,
      a: [a[0], a[1]],
      b: [b[0], b[1]],
      z0,
      h,
      len,
      storey: storeyOf(w),
      openings: ops,
    })
  }

  // doors/windows without a host-wall opening (rare) -> by placement
  const hosted = new Set<string | null>()
  walls.forEach(w => w.openings.forEach(o => o.fill && hosted.add(o.fill.guid)))
  const loose: IfcLooseFill[] = []
  for (const d of [...all('IFCDOOR'), ...all('IFCWINDOW')]) {
    const g = str(d.a[0])
    if (hosted.has(g)) continue
    const M = placement(get(d.a[5]))
    const p = ap(M, [0, 0, 0])
    loose.push({
      guid: g,
      kind: d.type === 'IFCDOOR' ? 'door' : 'window',
      name: typeName(d),
      w: (d.a[9] || 0) * lenScale,
      h: (d.a[8] || 0) * lenScale,
      at: [p[0], p[1]],
      sill: p[2],
      storey: storeyOf(d),
    })
  }

  // ---------- ceilings (and other coverings) ----------
  const ceilings: IfcCovering[] = []
  for (const c of all('IFCCOVERING')) {
    const kind = c.a[8] && c.a[8].e
    const M = placement(get(c.a[5]))
    const body = repOf(c, 'Body')
    if (!body) continue
    let poly: Vec2[] | null = null
    let z: number | null = null
    for (const it0 of body.a[3] || []) {
      const it = get(it0)
      if (!it) continue
      if (it.type === 'IFCFACEBASEDSURFACEMODEL') {
        let best: { A: number; P: Vec3[] } | null = null
        for (const fs of it.a[0] || [])
          for (const fc of get(fs)!.a[0] || []) {
            const bnd = get((get(fc)!.a[0] || [])[0])
            const loop = bnd && get(bnd.a[0])
            if (!loop || loop.type !== 'IFCPOLYLOOP') continue
            const P = (loop.a[0] as V[]).map(get).map(e => ap(M, pt(e!)))
            const zr = Math.max(...P.map(p => p[2])) - Math.min(...P.map(p => p[2]))
            if (zr > 0.01) continue
            let A = 0
            for (let k = 0; k < P.length; k++) {
              const p = P[k]
              const q = P[(k + 1) % P.length]
              A += p[0] * q[1] - q[0] * p[1]
            }
            A = Math.abs(A) / 2
            if (!best || A > best.A) best = { A, P }
          }
        if (best) {
          poly = best.P.map(p => [p[0], p[1]] as Vec2)
          z = best.P[0][2]
        }
      } else {
        const s = baseSolid(it)
        if (s) {
          const prof = profilePoly(get(s.a[0]))
          if (prof) {
            const P = mul(M, axis3(get(s.a[1])))
            const W = prof.map(q => ap(P, q))
            poly = W.map(p => [p[0], p[1]] as Vec2)
            z = W[0][2]
          }
        }
      }
    }
    if (poly && z != null) ceilings.push({ guid: str(c.a[0]), kind: kind || 'COVERING', name: typeName(c), poly, z, storey: storeyOf(c) })
    else warnings.push({ code: 'unsupported_covering', guid: str(c.a[0]) })
  }

  const proj = all('IFCPROJECT')[0]
  const schema = (text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/) || [])[1] || '?'
  const app = (text.match(/FILE_NAME\s*\([^;]*?'([^']*Revit[^']*|[^']*ArchiCAD[^']*|[^']*Tekla[^']*)'/i) || [])[1] || ''
  return {
    schema,
    app,
    project: proj ? str(proj.a[2]) || '' : '',
    storeys,
    walls,
    loose,
    ceilings,
    warnings,
    entityCount: E.size,
  }
}
