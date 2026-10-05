// User display settings shared by the whole app.
// Stored per user in public.profiles (language, number_format, unit_system), with the
// company default (organizations.default_locale) and the browser as fallbacks.

export const APP_LANGUAGES = ['en-US', 'es', 'pt-BR'] as const
export type AppLanguage = (typeof APP_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: AppLanguage = 'en-US'

/** Names are written in their own language so anyone can find theirs. */
export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: AppLanguage; label: string; short: string }> = [
  { value: 'en-US', label: 'English (US)', short: 'EN' },
  { value: 'es', label: 'Español', short: 'ES' },
  { value: 'pt-BR', label: 'Português (Brasil)', short: 'PT' },
]

export const NUMBER_FORMATS = ['pt-BR', 'en-US'] as const
export type NumberFormat = (typeof NUMBER_FORMATS)[number]

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const
export type UnitSystem = (typeof UNIT_SYSTEMS)[number]

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (APP_LANGUAGES as readonly string[]).includes(value)
}

export function isNumberFormat(value: unknown): value is NumberFormat {
  return typeof value === 'string' && (NUMBER_FORMATS as readonly string[]).includes(value)
}

export function isUnitSystem(value: unknown): value is UnitSystem {
  return typeof value === 'string' && (UNIT_SYSTEMS as readonly string[]).includes(value)
}

/** Browser language -> app language: Portuguese and Spanish map to theirs, anything else to English. */
export function detectLanguage(browserLanguage: string | undefined | null): AppLanguage {
  const value = (browserLanguage || '').toLowerCase()
  if (value.startsWith('pt')) return 'pt-BR'
  if (value.startsWith('es')) return 'es'
  return DEFAULT_LANGUAGE
}
