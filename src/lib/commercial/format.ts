// Display helpers for Commercial (money, rates, dates) in the user's number format.
import type { NumberFormat } from '@/lib/i18n/settings'

export function formatMoney(value: number | null | undefined, currency: string, format: NumberFormat): string {
  if (value == null || !Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(format, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

/** Unit costs can need more than cents (0.1525 per metre of tape). */
export function formatUnitCost(value: number | null | undefined, currency: string, format: NumberFormat): string {
  if (value == null || !Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(format, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
  } catch {
    return `${currency} ${value}`
  }
}

export function formatPct(value: number | null | undefined, format: NumberFormat, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat(format, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}%`
}

export function formatQty(value: number | null | undefined, format: NumberFormat, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(format, { maximumFractionDigits: digits }).format(value)
}

/** A YYYY-MM-DD date in the user's language, without time-zone shifts. */
export function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '—'
  const d = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(d)
}

/** Number as typed in a form, in the user's decimal separator. */
export function toInput(value: number | null | undefined, format: NumberFormat): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(value).replace('.', format === 'pt-BR' ? ',' : '.')
}
