// RitsuScope ↔ Location Breakdown. The location tree stays in RitsuFlow (`public.locations`), which
// Daily Reports, FieldOp QR codes, Pull Planning and the Master Plan all point to; RitsuScope draws
// those locations on the sheets and can create them from what is drawn:
//   level → "Floor" location;  Block / Zone / Area / Room zone → building / zone / area / room location,
//   placed under the zone that contains it, or under the sheet's floor.
import type { createClient } from '@/lib/supabase/client'
import type { LevelRow } from './levels'
import type { SourceRow } from './rows'
import { KIND_LOCATION_TYPE, containingZone, kindRank, type ZoneRow } from './zones'

type Supabase = ReturnType<typeof createClient>

export type ProjectLocation = { id: string; name: string; location_type: string; parent_id: string | null; sequence_number: number | null }

export const LOCATION_COLUMNS = 'id, name, location_type, parent_id, sequence_number'

export async function loadLocations(supabase: Supabase, projectId: string): Promise<ProjectLocation[]> {
  const { data, error } = await supabase.from('locations').select(LOCATION_COLUMNS).eq('project_id', projectId).order('sequence_number')
  if (error) throw error
  return (data || []) as ProjectLocation[]
}

/** Locations in tree order with their depth (safe against broken parent links). */
export function locationTree(locations: ProjectLocation[]): { location: ProjectLocation; depth: number }[] {
  const ids = new Set(locations.map(l => l.id))
  const children = new Map<string, ProjectLocation[]>()
  for (const l of locations) {
    const key = l.parent_id && ids.has(l.parent_id) ? l.parent_id : 'root'
    children.set(key, [...(children.get(key) || []), l])
  }
  const out: { location: ProjectLocation; depth: number }[] = []
  const seen = new Set<string>()
  const walk = (key: string, depth: number) => {
    const list = (children.get(key) || []).slice().sort((a, b) => (Number(a.sequence_number) || 0) - (Number(b.sequence_number) || 0) || a.name.localeCompare(b.name))
    for (const l of list) {
      if (seen.has(l.id)) continue
      seen.add(l.id)
      out.push({ location: l, depth })
      walk(l.id, depth + 1)
    }
  }
  walk('root', 0)
  // Anything left (a parent loop) goes at the end, flat.
  for (const l of locations) if (!seen.has(l.id)) out.push({ location: l, depth: 0 })
  return out
}

/** The level a sheet belongs to (its own row: typical floors are levels of their own). */
function sheetLevelOf(sourceId: string, sources: SourceRow[], levels: LevelRow[]): LevelRow | null {
  const source = sources.find(s => s.id === sourceId)
  return source?.level_id ? levels.find(l => l.id === source.level_id) || null : null
}

/**
 * Where a zone's location goes in the tree: under the nearest containing zone that is already a
 * location, otherwise under the sheet's floor (when the level has one), otherwise at the root.
 */
export function suggestedParentId(zone: ZoneRow, zones: ZoneRow[], levels: LevelRow[], sources: SourceRow[]): string | null {
  let container = containingZone(zone, zones)
  while (container) {
    if (container.location_id) return container.location_id
    container = containingZone(container, zones)
  }
  return sheetLevelOf(zone.source_id, sources, levels)?.location_id || null
}

async function recordHistory(supabase: Supabase, projectId: string, location: ProjectLocation, parentName: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('user_profiles').select('full_name,display_name,email').eq('user_id', user.id).maybeSingle()
    const actorName = profile?.full_name || profile?.display_name || profile?.email || user.email || 'RitsuFlow User'
    await supabase.from('project_history').insert({
      project_id: projectId,
      action_type: 'location_added',
      action_label: 'Location added',
      description: `${location.name} was added under ${parentName} from RitsuScope`,
      entity_type: 'location',
      entity_id: location.id,
      performed_by: user.id,
      performed_by_name: actorName,
      metadata: { location_name: location.name, location_type: location.location_type, source: 'ritsuscope' },
    })
  } catch {
    // History is informative only: the location itself is already saved.
  }
}

/** Adds one location to the project's Location Breakdown and returns it. */
export async function createLocation(
  supabase: Supabase,
  input: { projectId: string; name: string; locationType: string; parentId: string | null; locations: ProjectLocation[] },
): Promise<ProjectLocation> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { data: top } = await supabase.from('locations').select('sequence_number').eq('project_id', input.projectId).order('sequence_number', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await supabase.from('locations').insert({
    project_id: input.projectId,
    parent_id: input.parentId,
    name: input.name.trim(),
    location_type: input.locationType,
    sequence_number: (Number(top?.sequence_number) || 0) + 1,
    created_by: user.id,
  }).select(LOCATION_COLUMNS).single()
  if (error || !data) throw error || new Error('The location could not be created.')
  const location = data as ProjectLocation
  const parentName = input.parentId ? input.locations.find(l => l.id === input.parentId)?.name || 'its parent' : 'the project root'
  await recordHistory(supabase, input.projectId, location, parentName)
  return location
}

/**
 * Creates the locations for the given zones (largest kinds first, so a room finds the area that
 * was just created around it) and links each zone to its new location. Zones already linked are
 * skipped. Returns how many were created.
 */
export async function createLocationsForZones(
  supabase: Supabase,
  input: { projectId: string; targets: ZoneRow[]; zones: ZoneRow[]; levels: LevelRow[]; sources: SourceRow[]; locations: ProjectLocation[] },
): Promise<number> {
  const zones = input.zones.map(z => ({ ...z }))
  const locations = [...input.locations]
  const todo = input.targets.filter(z => !z.location_id).slice().sort((a, b) => kindRank(a.zone_kind) - kindRank(b.zone_kind))
  let created = 0
  for (const target of todo) {
    const zone = zones.find(z => z.id === target.id) || target
    const parentId = suggestedParentId(zone, zones, input.levels, input.sources)
    const location = await createLocation(supabase, { projectId: input.projectId, name: zone.name, locationType: KIND_LOCATION_TYPE[zone.zone_kind || 'room'], parentId, locations })
    locations.push(location)
    const { error } = await supabase.from('takeoff_zones').update({ location_id: location.id }).eq('id', zone.id)
    if (error) throw error
    zone.location_id = location.id
    created++
  }
  // Locations already linked to zones but sitting at the root (drawn before their floor or the zone
  // around them existed) move under the place the drawing says they belong to.
  await placeRootLocations(supabase, { zones, levels: input.levels, sources: input.sources, locations })
  return created
}

/**
 * Moves zone locations that sit at the root of the tree under their suggested parent (the zone
 * around them, or the sheet's floor). Locations the user already placed somewhere are left alone.
 * Returns how many were moved.
 */
export async function placeRootLocations(
  supabase: Supabase,
  input: { zones: ZoneRow[]; levels: LevelRow[]; sources: SourceRow[]; locations: ProjectLocation[] },
): Promise<number> {
  const byId = new Map(input.locations.map(l => [l.id, { ...l }] as [string, ProjectLocation]))
  const isDescendant = (candidate: string, of: string) => {
    let cur = byId.get(candidate)
    const seen = new Set<string>()
    while (cur && cur.parent_id && !seen.has(cur.id)) {
      if (cur.parent_id === of) return true
      seen.add(cur.id)
      cur = byId.get(cur.parent_id)
    }
    return false
  }
  let moved = 0
  // Largest kinds first, so a zone is placed before the rooms inside it.
  for (const zone of input.zones.slice().sort((a, b) => kindRank(a.zone_kind) - kindRank(b.zone_kind))) {
    const loc = zone.location_id ? byId.get(zone.location_id) : undefined
    if (!loc || loc.parent_id) continue
    const parentId = suggestedParentId(zone, input.zones, input.levels, input.sources)
    if (!parentId || parentId === loc.id || !byId.has(parentId) || isDescendant(parentId, loc.id)) continue
    const { error } = await supabase.from('locations').update({ parent_id: parentId }).eq('id', loc.id)
    if (error) throw error
    loc.parent_id = parentId
    moved++
  }
  return moved
}

/** Creates a "Floor" location for each level that has none yet (lowest first) and links them. */
export async function createFloorsForLevels(
  supabase: Supabase,
  input: { projectId: string; levels: LevelRow[]; locations: ProjectLocation[] },
): Promise<number> {
  const locations = [...input.locations]
  const todo = input.levels.filter(l => !l.location_id).slice().sort((a, b) => a.elevation_m - b.elevation_m || a.sort_order - b.sort_order)
  let created = 0
  for (const level of todo) {
    const location = await createLocation(supabase, { projectId: input.projectId, name: level.name, locationType: 'floor', parentId: null, locations })
    locations.push(location)
    const { error } = await supabase.from('takeoff_levels').update({ location_id: location.id }).eq('id', level.id)
    if (error) throw error
    created++
  }
  return created
}
