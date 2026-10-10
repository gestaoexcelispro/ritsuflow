// Openings (doors, windows, unfilled openings) on a wall, measured along the wall.
import type { ElementOpening, OpeningKind } from './geometry'

/** Typical starting sizes when adding an opening by hand; the user can change them. */
export const OPENING_PRESETS: Record<'door' | 'window' | 'void', { w: number; h: number; sill: number }> = {
  door: { w: 0.8, h: 2.1, sill: 0 },
  window: { w: 1.2, h: 1.2, sill: 1.0 },
  void: { w: 1.0, h: 2.1, sill: 0 },
}

export type OpeningError = 'size' | 'outside_length' | 'outside_height' | 'overlap'

/**
 * Checks an opening against its wall. `off` is the distance from the wall start to the
 * opening centre. Openings may not overlap each other (1 mm tolerance).
 */
export function validateOpening(o: Pick<ElementOpening, 'off' | 'w' | 'h' | 'sill'>, wallLengthM: number, wallHeightM: number, others: Pick<ElementOpening, 'off' | 'w'>[]): OpeningError | null {
  if (!(o.w > 0) || !(o.h > 0) || !(o.sill >= 0)) return 'size'
  const x0 = o.off - o.w / 2
  const x1 = o.off + o.w / 2
  if (x0 < -1e-3 || x1 > wallLengthM + 1e-3) return 'outside_length'
  if (o.sill + o.h > wallHeightM + 1e-3) return 'outside_height'
  for (const p of others) {
    const p0 = p.off - p.w / 2
    const p1 = p.off + p.w / 2
    if (x0 < p1 - 1e-3 && p0 < x1 - 1e-3) return 'overlap'
  }
  return null
}

export function addOpening(list: ElementOpening[], o: Omit<ElementOpening, 'guid'> & { kind: OpeningKind }): ElementOpening[] {
  return [...list, { ...o, guid: null }].sort((a, b) => a.off - b.off)
}
