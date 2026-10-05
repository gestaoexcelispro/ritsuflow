// Pure helpers for translation and number formatting (no React, testable with node:test).
import type { AppLanguage, NumberFormat } from './settings'

export type Messages = Record<string, string>

/** Replaces {name} placeholders. Unknown placeholders are left as-is. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  )
}

/** Looks up a key; falls back to the fallback dictionary, then to the key itself. */
export function translate(
  messages: Messages,
  fallback: Messages,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const template = messages[key] ?? fallback[key] ?? key
  return interpolate(template, vars)
}

/**
 * Number format is a separate setting; when not chosen it follows the language.
 * Spanish uses the comma decimal (1.234,56), the same as Portuguese.
 */
export function resolveNumberFormat(language: AppLanguage, numberFormat: NumberFormat | null): NumberFormat {
  if (numberFormat) return numberFormat
  return language === 'en-US' ? 'en-US' : 'pt-BR'
}

export function formatNumber(value: number, format: NumberFormat, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(format, { maximumFractionDigits }).format(value)
}
