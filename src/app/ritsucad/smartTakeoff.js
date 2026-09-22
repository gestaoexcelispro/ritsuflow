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
