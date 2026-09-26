export function isProductionLocation(location) {
  return Boolean(location) && !new Set(['building', 'floor', 'zone']).has(location.location_type)
}

export function isQrEligibleLocation(location, childrenMap) {
  if (!isProductionLocation(location)) return false
  return (childrenMap.get(location.id) || []).length === 0
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
