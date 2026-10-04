// User display settings shared by the whole app.
// Stored per user in public.profiles (language, number_format, unit_system),
// with localStorage as the fallback before login.

export const APP_LANGUAGES = ['pt-BR', 'en-US'] as const
export type AppLanguage = (typeof APP_LANGUAGES)[number]

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

/** Browser language -> app language. Anything English goes to en-US, otherwise pt-BR. */
export function detectLanguage(browserLanguage: string | undefined | null): AppLanguage {
  return (browserLanguage || '').toLowerCase().startsWith('en') ? 'en-US' : 'pt-BR'
}
