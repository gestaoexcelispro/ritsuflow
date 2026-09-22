// RitsuCAD Smart Takeoff construction-object catalog.
//
// This catalog is intentionally separate from the drawing UI. Generic CAD
// geometry describes how something is drawn; Smart Takeoff describes what
// that geometry means to the construction workflow.

export const SMART_TAKEOFF_DISCIPLINES = [
  {
    id: 'architecture',
    label: 'Architecture',
    items: [
      {
        id: 'wall',
        label: 'Wall',
        geometry: 'linear',
        quantityUnit: 'm',
        secondaryQuantity: 'm2',
        defaultWorkPackage: 'WAL',
        attributes: [
          { id: 'wallType', label: 'Wall Type', type: 'text' },
          { id: 'height', label: 'Height', type: 'number', unit: 'm' },
          { id: 'thickness', label: 'Thickness', type: 'number', unit: 'm' },
          { id: 'material', label: 'Material', type: 'text' },
        ],
      },
      {
        id: 'floor',
        label: 'Floor',
        geometry: 'area',
        quantityUnit: 'm2',
      },
      {
        id: 'ceiling',
        label: 'Ceiling',
        geometry: 'area',
        quantityUnit: 'm2',
      },
      {
        id: 'door',
        label: 'Door',
        geometry: 'count',
        quantityUnit: 'ea',
      },
      {
        id: 'window',
        label: 'Window',
        geometry: 'count',
        quantityUnit: 'ea',
      },
      {
        id: 'baseboard',
        label: 'Baseboard',
        geometry: 'linear',
        quantityUnit: 'm',
      },
    ],
  },
  {
    id: 'structural',
    label: 'Structural',
    items: [
      { id: 'slab', label: 'Slab', geometry: 'area', quantityUnit: 'm2' },
      { id: 'beam', label: 'Beam', geometry: 'linear', quantityUnit: 'm' },
      { id: 'column', label: 'Column', geometry: 'count', quantityUnit: 'ea' },
      { id: 'foundation', label: 'Foundation', geometry: 'area', quantityUnit: 'm2' },
    ],
  },
  {
    id: 'mep',
    label: 'MEP',
    items: [],
  },
]

export function getSmartTakeoffDiscipline(disciplineId) {
  return (
    SMART_TAKEOFF_DISCIPLINES.find(
      (discipline) => discipline.id === disciplineId
    ) || null
  )
}

export function getSmartTakeoffItem(disciplineId, itemId) {
  const discipline = getSmartTakeoffDiscipline(disciplineId)

  return (
    discipline?.items.find((item) => item.id === itemId) || null
  )
}

export function createSmartTakeoffMetadata({
  disciplineId,
  itemId,
  locationId = null,
  scopeItemId = null,
  workPackageId = null,
  attributes = {},
} = {}) {
  const item = getSmartTakeoffItem(disciplineId, itemId)

  if (!item) {
    return null
  }

  return {
    version: 1,
    discipline: disciplineId,
    elementType: item.id,
    elementLabel: item.label,
    geometryType: item.geometry,
    quantityUnit: item.quantityUnit,
    secondaryQuantity: item.secondaryQuantity || null,
    locationId,
    scopeItemId,
    workPackageId,
    attributes,
  }
}
