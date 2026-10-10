// Building services placed on walls and ceilings (MEP): drywall reinforcements (blocking),
// electrical points and light fixtures, plumbing points and fixtures. Each type is a count item
// tagged in framing.meta.mep, with a default width, height and mounting height (sill), so it
// sits in the wall in 3D, is counted per level (×N on typical floors) and shows in the PDFs.
// Defaults are starting values only; each item's ✎ editor changes them.

export type MepGroup = 'blocking' | 'electrical' | 'plumbing'

export type MepType = {
  key: string
  group: MepGroup
  /** Width along the wall, metres. */
  w: number
  /** Height, metres. */
  h: number
  /** Mounting height of the bottom edge above the floor, metres. */
  sill: number
  color: string
  icon: string
}

export const MEP_TYPES: MepType[] = [
  // Drywall reinforcements (blocking / backing) behind what hangs on the wall.
  { key: 'blocking_tv', group: 'blocking', w: 1.2, h: 0.6, sill: 1.0, color: '#A16207', icon: 'blocking' },
  { key: 'blocking_cabinet', group: 'blocking', w: 1.2, h: 0.4, sill: 1.6, color: '#B45309', icon: 'blocking' },
  { key: 'blocking_sink', group: 'blocking', w: 0.8, h: 0.4, sill: 0.7, color: '#C2410C', icon: 'blocking' },
  { key: 'blocking_grabbar', group: 'blocking', w: 0.9, h: 0.3, sill: 0.65, color: '#9A3412', icon: 'blocking' },
  { key: 'blocking_shelf', group: 'blocking', w: 1.0, h: 0.3, sill: 1.5, color: '#92400E', icon: 'blocking' },
  // Electrical.
  { key: 'outlet_low', group: 'electrical', w: 0.1, h: 0.1, sill: 0.3, color: '#DC2626', icon: 'outlet' },
  { key: 'outlet_mid', group: 'electrical', w: 0.1, h: 0.1, sill: 1.1, color: '#E11D48', icon: 'outlet' },
  { key: 'outlet_high', group: 'electrical', w: 0.1, h: 0.1, sill: 2.2, color: '#BE123C', icon: 'outlet' },
  { key: 'switch', group: 'electrical', w: 0.1, h: 0.1, sill: 1.1, color: '#7C3AED', icon: 'switch' },
  { key: 'data_point', group: 'electrical', w: 0.1, h: 0.1, sill: 0.3, color: '#2563EB', icon: 'data' },
  { key: 'light_fixture', group: 'electrical', w: 0.3, h: 0.05, sill: 2.6, color: '#EAB308', icon: 'light' },
  // Plumbing.
  { key: 'water_cold', group: 'plumbing', w: 0.05, h: 0.05, sill: 0.6, color: '#0284C7', icon: 'water' },
  { key: 'water_hot', group: 'plumbing', w: 0.05, h: 0.05, sill: 0.6, color: '#EA580C', icon: 'water' },
  { key: 'drain', group: 'plumbing', w: 0.1, h: 0.1, sill: 0.5, color: '#57534E', icon: 'drain' },
  { key: 'gas', group: 'plumbing', w: 0.05, h: 0.05, sill: 1.2, color: '#CA8A04', icon: 'gas' },
  { key: 'fixture_toilet', group: 'plumbing', w: 0.4, h: 0.4, sill: 0, color: '#64748B', icon: 'toilet' },
  { key: 'fixture_washbasin', group: 'plumbing', w: 0.5, h: 0.2, sill: 0.8, color: '#0EA5E9', icon: 'basin' },
  { key: 'fixture_kitchen_sink', group: 'plumbing', w: 1.2, h: 0.2, sill: 0.85, color: '#0891B2', icon: 'basin' },
  { key: 'fixture_shower', group: 'plumbing', w: 0.2, h: 0.2, sill: 2.1, color: '#06B6D4', icon: 'shower' },
  { key: 'fixture_laundry', group: 'plumbing', w: 0.6, h: 0.3, sill: 0.8, color: '#0E7490', icon: 'basin' },
]

export const MEP_GROUPS: MepGroup[] = ['blocking', 'electrical', 'plumbing']

const BY_KEY = new Map(MEP_TYPES.map(m => [m.key, m]))

export function mepType(key: string | null | undefined): MepType | null {
  return key ? BY_KEY.get(key) ?? null : null
}

/** Reinforcements also count in metres (along the wall) and m² (of backing board). */
export function mepExtra(item: { mep?: string | null; width?: number; height?: number }, count: number): { lengthM: number; areaM2: number } | null {
  const m = mepType(item.mep)
  if (!m || m.group !== 'blocking') return null
  const w = item.width ?? m.w
  const h = item.height ?? m.h
  return { lengthM: count * w, areaM2: count * w * h }
}
