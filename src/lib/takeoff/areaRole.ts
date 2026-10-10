// What an area item is (floor, ceiling or slab): its IFC type when it was made with the
// Floor / Ceiling / Slab tools, else its name ("Laje", "Piso", "Forro"…) for items made by hand.
export type AreaRole = 'floor' | 'ceiling' | 'slab'

export const AREA_IFC: Record<AreaRole, string> = { floor: 'IfcCovering.FLOORING', ceiling: 'IfcCovering.CEILING', slab: 'IfcSlab' }

const NAMES: [AreaRole, RegExp][] = [
  ['slab', /\b(laje|lajes|slab|slabs|losa)\b/i],
  ['ceiling', /\b(forro|forros|ceiling|ceilings|teto|cielorraso)\b/i],
  ['floor', /\b(piso|pisos|floor|floors|flooring|pavimenta[cç][aã]o)\b/i],
]

export function areaRole(item: { kind: string; name?: string | null; ifcType?: string | null }): AreaRole | null {
  if (item.kind !== 'area') return null
  if (item.ifcType) return (Object.keys(AREA_IFC) as AreaRole[]).find(r => AREA_IFC[r] === item.ifcType) ?? null
  const name = (item.name || '').normalize('NFC')
  return NAMES.find(([, re]) => re.test(name))?.[0] ?? null
}
