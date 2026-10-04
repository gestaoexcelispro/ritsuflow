// Reinforced concrete structure and foundations. Each type is an ordinary takeoff item tagged
// in framing.meta.struct: slab-on-grade (area), grade beams and beams (lines), footings, pile
// caps, piles and columns (points). Quantities: concrete (m³) and formwork (m²); no rebar.
// Sizes and elevations are starting values, changed in each item's ✎ editor.

export type StructGroup = 'foundation' | 'concrete'

export type StructType = {
  key: string
  group: StructGroup
  kind: 'area' | 'linear' | 'count'
  /** Width (lines, points) or diameter (round piles), metres. */
  w: number
  /** Depth of a point element's section, metres (= w when round). */
  d: number
  /** Height (thickness of a slab), metres. */
  h: number
  /** Bottom elevation relative to the level, metres (negative = below the floor). */
  base: number
  round?: boolean
  /** Which faces get formwork: sides only, sides + bottom (beams), or none (piles cast in soil). */
  form: 'sides' | 'sidesBottom' | 'none'
  color: string
  icon: string
}

export const STRUCT_TYPES: StructType[] = [
  { key: 'radier', group: 'foundation', kind: 'area', w: 0, d: 0, h: 0.12, base: -0.12, form: 'sides', color: '#94A3B8', icon: 'slab' },
  { key: 'grade_beam', group: 'foundation', kind: 'linear', w: 0.2, d: 0, h: 0.4, base: -0.4, form: 'sides', color: '#78716C', icon: 'gradeBeam' },
  { key: 'footing', group: 'foundation', kind: 'count', w: 1.0, d: 1.0, h: 0.4, base: -1.0, form: 'sides', color: '#A8A29E', icon: 'footing' },
  { key: 'pile_cap', group: 'foundation', kind: 'count', w: 0.8, d: 0.8, h: 0.6, base: -0.6, form: 'sides', color: '#8B8680', icon: 'pileCap' },
  { key: 'pile', group: 'foundation', kind: 'count', w: 0.3, d: 0.3, h: 6.0, base: -6.6, round: true, form: 'none', color: '#6B7280', icon: 'pile' },
  { key: 'column', group: 'concrete', kind: 'count', w: 0.2, d: 0.3, h: 2.8, base: 0, form: 'sides', color: '#9CA3AF', icon: 'column' },
  { key: 'beam', group: 'concrete', kind: 'linear', w: 0.15, d: 0, h: 0.4, base: 2.4, form: 'sidesBottom', color: '#A1A1AA', icon: 'beam' },
]

export const STRUCT_GROUPS: StructGroup[] = ['foundation', 'concrete']

const BY_KEY = new Map(STRUCT_TYPES.map(s => [s.key, s]))

export function structType(key: string | null | undefined): StructType | null {
  return key ? BY_KEY.get(key) ?? null : null
}

/** Measured amounts of one item: count, length (m), area (m²) and perimeter (m). */
export type StructAmounts = { n: number; len: number; area: number; per: number }

/** Concrete and formwork of a structural item, from its own sizes (falling back to the type's). */
export function structExtra(
  item: { struct?: string | null; kind: string; width?: number; depth?: number; height?: number; thickness?: number },
  q: StructAmounts,
): { concreteM3: number; formworkM2: number } | null {
  const s = structType(item.struct)
  if (!s) return null
  if (item.kind === 'area') {
    const t = item.thickness ?? s.h
    return { concreteM3: q.area * t, formworkM2: s.form === 'none' ? 0 : q.per * t }
  }
  if (item.kind === 'linear') {
    const w = item.thickness ?? s.w
    const h = item.height ?? s.h
    const form = s.form === 'none' ? 0 : s.form === 'sidesBottom' ? q.len * (2 * h + w) : q.len * 2 * h
    return { concreteM3: q.len * w * h, formworkM2: form }
  }
  const w = item.width ?? s.w
  const d = s.round ? w : item.depth ?? s.d
  const h = item.height ?? s.h
  const vol = s.round ? Math.PI * (w / 2) ** 2 * h : w * d * h
  return { concreteM3: q.n * vol, formworkM2: s.form === 'none' ? 0 : q.n * 2 * (w + d) * h }
}
