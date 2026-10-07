// How see-through each takeoff item is drawn on the sheet (screen) and in the printed PDF.
// Each item can set its own transparency (framing.meta.planTransparency, 0…0.95); without it,
// the defaults below keep the plan readable: light area fills, strong wall lines, solid points.
import type { LayerKind } from './geometry'

/** Default opacity per kind and medium (what an item gets when it sets no transparency). */
export const DEFAULT_PLAN_OPACITY: Record<'screen' | 'print', Record<LayerKind, number>> = {
  screen: { area: 0.18, linear: 0.85, count: 1 },
  print: { area: 0.2, linear: 0.6, count: 1 },
}

/** Transparency shown in the item editor when the item hasn't set one (percent, screen default). */
export function defaultPlanTransparencyPct(kind: LayerKind): number {
  return Math.round((1 - DEFAULT_PLAN_OPACITY.screen[kind]) * 20) * 5
}

/** Opacity (0…1) to draw an item with: its own transparency when set, otherwise the default. */
export function planOpacity(item: { kind: LayerKind; planTransparency?: number }, medium: 'screen' | 'print'): number {
  if (typeof item.planTransparency === 'number') return Math.max(0.05, Math.min(1, 1 - item.planTransparency))
  return DEFAULT_PLAN_OPACITY[medium][item.kind]
}
