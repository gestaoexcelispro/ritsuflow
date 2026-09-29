export function isProductionLocation(location) {
  return Boolean(location)
}

export function isQrEligibleLocation(location, childrenMap) {
  // Every canonical location in the Location Breakdown Structure can represent
  // a physical FieldOp identity, regardless of hierarchy level or whether it
  // contains child locations. This keeps QR behavior consistent for buildings,
  // floors/divisions, zones/areas, rooms and custom locations.
  return Boolean(location?.id)
}

export function locationBreadcrumb(location, locationMap, projectName) {
  if (!location) return projectName || ''
  const names = []
  const visited = new Set()
  let current = location

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parent_id ? locationMap.get(current.parent_id) : null
  }

  return [projectName, ...names].filter(Boolean).join(' / ')
}

export function locationQrPath(token) {
  return token ? `/field/scan/${token}` : ''
}
