// Scale calibration for PDF sheets: two picked points and the real distance between them.
import { dist, type Vec2 } from './geometry'

/** PDF points per real metre, or null when the input can't give a valid scale. */
export function scaleFromPoints(a: Vec2, b: Vec2, meters: number): number | null {
  const d = dist(a, b)
  if (!(meters > 0) || !(d > 0) || !Number.isFinite(meters)) return null
  return d / meters
}

/** Parses "20", "20,00" or "1.234,5" (pt-BR) and "1,234.5" (en-US) into a number. */
export function parseLocaleNumber(input: string): number {
  const s = String(input).trim().replace(/\s/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return parseFloat(s.replace(/,/g, ''))
}
