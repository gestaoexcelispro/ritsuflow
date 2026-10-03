export const DEFAULT_LOCALE = 'en-US'

export const SUPPORTED_LOCALES = ['en-US', 'pt-BR', 'es']

export const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'es', label: 'Español' },
]

export function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE
}
