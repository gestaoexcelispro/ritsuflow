// What RitsuScope knows about each location of the Location Breakdown: the outlines drawn for it
// (takeoff_zones.location_id), their area from each sheet's calibrated scale, and the levels
// linked to it as a floor (takeoff_levels.location_id).

function polyArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    sum += x0 * y1 - x1 * y0
  }
  return Math.abs(sum) / 2
}

/** { [locationId]: { areaM2, hasArea, zones: [...], levels: [...] } } */
export function buildRitsuScopeSpatial({ zones = [], sources = [], levels = [] }) {
  const sourceById = new Map(sources.map(s => [s.id, s]))
  const levelById = new Map(levels.map(l => [l.id, l]))
  const out = {}
  const entry = id => (out[id] ||= { areaM2: 0, hasArea: false, zones: [], levels: [] })
  for (const z of zones) {
    if (!z.location_id) continue
    const sheet = sourceById.get(z.source_id)
    const scale = Number(sheet?.scale_pt_per_m) || 0
    const area = scale > 0 ? polyArea(z.points) / (scale * scale) : null
    const level = sheet?.level_id ? levelById.get(sheet.level_id) : null
    const e = entry(z.location_id)
    if (area != null) { e.areaM2 += area; e.hasArea = true }
    e.zones.push({ id: z.id, name: z.name, kind: z.zone_kind || 'room', sheet: sheet?.name || '', level: level?.name || null, areaM2: area })
  }
  for (const l of levels) {
    if (!l.location_id) continue
    entry(l.location_id).levels.push({ id: l.id, name: l.name, elevation: Number(l.elevation_m) || 0, sheets: sources.filter(s => s.level_id === l.id).length })
  }
  return out
}
