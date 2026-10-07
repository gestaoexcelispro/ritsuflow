// Places tag labels on a picture so they never overlap each other, never cover another tag's
// anchor and their leader lines never cross another label or leader. Pure (screen pixels in,
// box positions out), so the 3D view, the PDF picture and the tests share it.

export type LabelIn = { id: string; x: number; y: number; w: number; h: number }
export type LabelOut = LabelIn & { bx: number; by: number; lx: number; ly: number; ok: boolean }

type Box = { x0: number; y0: number; x1: number; y1: number }

const boxOf = (cx: number, cy: number, w: number, h: number, pad = 0): Box => ({ x0: cx - w / 2 - pad, y0: cy - h / 2 - pad, x1: cx + w / 2 + pad, y1: cy + h / 2 + pad })
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const inside = (x: number, y: number, b: Box) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1

/** Segments p1-p2 and p3-p4 cross (touching ends do not count). */
function crosses(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) {
  const d = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** A segment passes through a box (either end inside, or it crosses an edge). */
function segHitsBox(p: [number, number], q: [number, number], b: Box) {
  if (inside(p[0], p[1], b) || inside(q[0], q[1], b)) return true
  const c: [number, number][] = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
  for (let i = 0; i < 4; i++) if (crosses(p, q, c[i], c[(i + 1) % 4])) return true
  return false
}

/**
 * Greedy placement: each label tries positions above its anchor (closest first, then shifted
 * sideways, then further up, then below), keeping the first that clears every placed label,
 * every anchor and every leader. Labels with no clear spot take the least-bad one (ok = false).
 */
export function layoutLabels(labels: LabelIn[], width: number, height: number, scale = 1): LabelOut[] {
  const gap = 4 * scale
  const dot = 5 * scale
  const lifts = [34, 56, 80, 106, 134, 164, 196, 230, 266].map(v => v * scale)
  const order = [...labels].sort((a, b) => a.y - b.y || a.x - b.x)
  const placed: { box: Box; leader: [[number, number], [number, number]] }[] = []
  const anchors = labels.map(l => boxOf(l.x, l.y, dot, dot))
  const out = new Map<string, LabelOut>()
  for (const l of order) {
    const step = l.w / 2 + 10 * scale
    const shifts = [0, -step, step, -2 * step, 2 * step, -3 * step, 3 * step, -4 * step, 4 * step]
    const cands: [number, number][] = []
    for (const lift of lifts) for (const sx of shifts) cands.push([l.x + sx, l.y - lift])
    for (const lift of lifts.slice(0, 3)) for (const sx of shifts) cands.push([l.x + sx, l.y + lift])
    let best: { c: [number, number]; leader: [[number, number], [number, number]]; bad: number } | null = null
    for (const c of cands) {
      const box = boxOf(c[0], c[1], l.w, l.h, gap)
      if (box.x0 < 0 || box.y0 < 0 || box.x1 > width || box.y1 > height) continue
      // Leader: from the anchor to the nearest point of the label's facing edge.
      const ly = c[1] < l.y ? c[1] + l.h / 2 : c[1] - l.h / 2
      const lx = Math.max(c[0] - l.w / 2 + 3 * scale, Math.min(c[0] + l.w / 2 - 3 * scale, l.x))
      const leader: [[number, number], [number, number]] = [[l.x, l.y], [lx, ly]]
      let bad = 0
      for (const p of placed) {
        if (overlaps(box, p.box)) bad += 10
        if (segHitsBox(leader[0], leader[1], p.box)) bad += 4
        if (crosses(leader[0], leader[1], p.leader[0], p.leader[1])) bad += 3
        if (segHitsBox(p.leader[0], p.leader[1], box)) bad += 4
      }
      anchors.forEach((a, i) => { if (labels[i].id !== l.id && overlaps(box, a)) bad += 2 })
      if (!best || bad < best.bad) best = { c, leader, bad }
      if (bad === 0) break
    }
    if (!best) {
      const c: [number, number] = [Math.min(width - l.w / 2, Math.max(l.w / 2, l.x)), Math.max(l.h / 2, l.y - lifts[0])]
      best = { c, leader: [[l.x, l.y], [c[0], c[1] + l.h / 2]], bad: 99 }
    }
    placed.push({ box: boxOf(best.c[0], best.c[1], l.w, l.h, gap), leader: best.leader })
    out.set(l.id, { ...l, bx: best.c[0], by: best.c[1], lx: best.leader[1][0], ly: best.leader[1][1], ok: best.bad === 0 })
  }
  return labels.map(l => out.get(l.id)!)
}
