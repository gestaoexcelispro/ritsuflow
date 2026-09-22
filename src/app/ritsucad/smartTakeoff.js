// RitsuCAD Smart Takeoff catalog
// Construction semantics sit above the native geometry engine.

export const SMART_TAKEOFF_TYPES = [
  { id: 'wall', label: 'Wall', discipline: 'Architectural', measurementTool: 'polyline', quantityBasis: 'length-height', unit: 'area', icon: 'polyline', defaults: { height: null, thickness: null } },
  { id: 'floor', label: 'Floor', discipline: 'Architectural', measurementTool: 'area', quantityBasis: 'area', unit: 'area', icon: 'area' },
  { id: 'ceiling', label: 'Ceiling', discipline: 'Architectural', measurementTool: 'area', quantityBasis: 'area', unit: 'area', icon: 'area' },
  { id: 'door', label: 'Door', discipline: 'Architectural', measurementTool: 'count', quantityBasis: 'count', unit: 'ea', icon: 'count', defaults: { width: null, height: null } },
  { id: 'window', label: 'Window', discipline: 'Architectural', measurementTool: 'count', quantityBasis: 'count', unit: 'ea', icon: 'count', defaults: { width: null, height: null } },
  { id: 'baseboard', label: 'Baseboard', discipline: 'Architectural', measurementTool: 'polyline', quantityBasis: 'length', unit: 'length', icon: 'polyline' },
  { id: 'painting', label: 'Painting', discipline: 'Architectural', measurementTool: 'area', quantityBasis: 'area', unit: 'area', icon: 'area' },
  { id: 'slab', label: 'Slab', discipline: 'Structural', measurementTool: 'area', quantityBasis: 'area-thickness', unit: 'volume', icon: 'area', defaults: { thickness: null } },
  { id: 'beam', label: 'Beam', discipline: 'Structural', measurementTool: 'polyline', quantityBasis: 'length-section', unit: 'volume', icon: 'polyline', defaults: { width: null, height: null } },
  { id: 'column', label: 'Column', discipline: 'Structural', measurementTool: 'count', quantityBasis: 'count-section-height', unit: 'ea', icon: 'rectangle', defaults: { width: null, depth: null, height: null } },
  { id: 'footing', label: 'Footing', discipline: 'Structural', measurementTool: 'count', quantityBasis: 'count-dimensions', unit: 'ea', icon: 'rectangle', defaults: { width: null, length: null, depth: null } },
  { id: 'pipe', label: 'Pipe', discipline: 'MEP', measurementTool: 'polyline', quantityBasis: 'length', unit: 'length', icon: 'polyline', defaults: { diameter: null } },
  { id: 'duct', label: 'Duct', discipline: 'MEP', measurementTool: 'polyline', quantityBasis: 'length-section', unit: 'length', icon: 'polyline', defaults: { width: null, height: null } },
  { id: 'fixture', label: 'Fixture', discipline: 'MEP', measurementTool: 'count', quantityBasis: 'count', unit: 'ea', icon: 'count' },
  { id: 'equipment', label: 'Equipment', discipline: 'MEP', measurementTool: 'count', quantityBasis: 'count', unit: 'ea', icon: 'count' },
  { id: 'generic-linear', label: 'Linear', discipline: 'Geometry', measurementTool: 'polyline', quantityBasis: 'length', unit: 'length', icon: 'polyline' },
  { id: 'generic-area', label: 'Area', discipline: 'Geometry', measurementTool: 'area', quantityBasis: 'area', unit: 'area', icon: 'area' },
  { id: 'generic-count', label: 'Count', discipline: 'Geometry', measurementTool: 'count', quantityBasis: 'count', unit: 'ea', icon: 'count' },
]

export const SMART_TAKEOFF_GROUPS = ['Architectural', 'Structural', 'MEP', 'Geometry']

export function getSmartTakeoffType(id) {
  return SMART_TAKEOFF_TYPES.find((item) => item.id === id) || null
}

export function getSmartTakeoffGroups() {
  return SMART_TAKEOFF_GROUPS.map((name) => ({
    name,
    items: SMART_TAKEOFF_TYPES.filter((item) => item.discipline === name),
  }))
}

export function createSmartTakeoffMetadata(typeId, overrides = {}) {
  const definition = getSmartTakeoffType(typeId)
  if (!definition) return null

  return {
    version: 1,
    typeId: definition.id,
    typeLabel: definition.label,
    discipline: definition.discipline,
    measurementTool: definition.measurementTool,
    quantityBasis: definition.quantityBasis,
    unit: definition.unit,
    properties: {
      ...(definition.defaults || {}),
      ...(overrides.properties || {}),
    },
    locationId: overrides.locationId || null,
    workPackageId: overrides.workPackageId || null,
    scopeItemId: overrides.scopeItemId || null,
    specification: overrides.specification || '',
  }
}

// Attach construction meaning to an ordinary RitsuCAD geometry entity without
// changing the native entity type. This keeps selection, snapping, undo/redo,
// rendering, and legacy saved drawings backward compatible.
export function decorateEntityWithSmartTakeoff(entity, context) {
  if (!entity || !context?.typeId) return entity

  const metadata = createSmartTakeoffMetadata(context.typeId, context)
  if (!metadata) return entity

  return {
    ...entity,
    category: entity.category || 'takeoff',
    smartTakeoff: metadata,
  }
}

export function isSmartTakeoffEntity(entity) {
  return Boolean(entity?.smartTakeoff?.typeId)
}

export function getSmartTakeoffEntityLabel(entity) {
  return entity?.smartTakeoff?.typeLabel || null
}

// Quantity helpers intentionally receive already-calibrated geometry values.
// They do not know anything about PDF scale; that remains the native CAD
// engine's responsibility.
export function calculateSmartTakeoffQuantity(entity, measured = {}) {
  const smart = entity?.smartTakeoff
  if (!smart) return null

  const length = finiteOrNull(measured.length)
  const area = finiteOrNull(measured.area)
  const count = finiteOrNull(measured.count)
  const height = positiveOrNull(smart.properties?.height)
  const thickness = positiveOrNull(smart.properties?.thickness)
  const width = positiveOrNull(smart.properties?.width)
  const depth = positiveOrNull(smart.properties?.depth)

  switch (smart.quantityBasis) {
    case 'length-height':
      return length !== null && height !== null
        ? { primary: length * height, unit: 'area', components: { length, height } }
        : { primary: null, unit: 'area', components: { length, height } }

    case 'length':
      return { primary: length, unit: 'length', components: { length } }

    case 'area':
      return { primary: area, unit: 'area', components: { area } }

    case 'area-thickness':
      return area !== null && thickness !== null
        ? { primary: area * thickness, unit: 'volume', components: { area, thickness } }
        : { primary: null, unit: 'volume', components: { area, thickness } }

    case 'length-section':
      return length !== null && width !== null && height !== null
        ? { primary: length * width * height, unit: 'volume', components: { length, width, height } }
        : { primary: null, unit: smart.unit, components: { length, width, height } }

    case 'count':
      return { primary: count, unit: 'ea', components: { count } }

    case 'count-section-height':
      return count !== null && width !== null && depth !== null && height !== null
        ? { primary: count * width * depth * height, unit: 'volume', components: { count, width, depth, height } }
        : { primary: null, unit: smart.unit, components: { count, width, depth, height } }

    case 'count-dimensions': {
      const itemLength = positiveOrNull(smart.properties?.length)
      return count !== null && width !== null && itemLength !== null && depth !== null
        ? { primary: count * width * itemLength * depth, unit: 'volume', components: { count, width, length: itemLength, depth } }
        : { primary: null, unit: smart.unit, components: { count, width, length: itemLength, depth } }
    }

    default:
      return null
  }
}

export function updateSmartTakeoffProperties(entity, properties = {}) {
  if (!isSmartTakeoffEntity(entity)) return entity

  return {
    ...entity,
    smartTakeoff: {
      ...entity.smartTakeoff,
      properties: {
        ...(entity.smartTakeoff.properties || {}),
        ...properties,
      },
    },
  }
}

function finiteOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function positiveOrNull(value) {
  const number = finiteOrNull(value)
  return number !== null && number > 0 ? number : null
}
