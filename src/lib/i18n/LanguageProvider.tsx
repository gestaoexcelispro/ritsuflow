'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AppLanguage,
  DEFAULT_LANGUAGE,
  NumberFormat,
  UnitSystem,
  detectLanguage,
  isAppLanguage,
  isNumberFormat,
  isUnitSystem,
} from './settings'
import { formatNumber as formatNumberWith, resolveNumberFormat } from './translate'

export type { AppLanguage, NumberFormat, UnitSystem } from './settings'

type LanguageContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  isPortuguese: boolean
  isEnglish: boolean
  isSpanish: boolean
  /** Effective number format (follows the language unless the user chose one). */
  numberFormat: NumberFormat
  /** The user's explicit choice; null means "follow the language". */
  numberFormatChoice: NumberFormat | null
  setNumberFormat: (format: NumberFormat | null) => void
  unitSystem: UnitSystem
  setUnitSystem: (system: UnitSystem) => void
  formatNumber: (value: number, maximumFractionDigits?: number) => string
}

const STORAGE_KEY = 'ritsuflow-language'
const NUMBER_FORMAT_KEY = 'ritsuflow-number-format'
const UNIT_SYSTEM_KEY = 'ritsuflow-unit-system'
// Keys RitsuScope used before the language system became app-wide; read once so nobody loses their choice.
const LEGACY_KEYS: Record<string, string> = {
  [STORAGE_KEY]: 'ritsuscope-language',
  [NUMBER_FORMAT_KEY]: 'ritsuscope-number-format',
  [UNIT_SYSTEM_KEY]: 'ritsuscope-unit-system',
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? (LEGACY_KEYS[key] ? window.localStorage.getItem(LEGACY_KEYS[key]) : null)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the in-memory value still applies.
  }
}

/** Saves settings on the signed-in user's profile. Silent no-op when signed out. */
async function saveToProfile(fields: Record<string, string | null>) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id)
    if (error) console.warn('Could not save display settings to profile:', error.message)
  } catch (error) {
    console.warn('Could not save display settings to profile:', error)
  }
}

/** The company's default language, used when the user has not chosen one. */
async function loadCompanyLanguage(supabase: ReturnType<typeof createClient>, userId: string): Promise<AppLanguage | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organizations(default_locale)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const organization = (data as { organizations?: { default_locale?: unknown } | { default_locale?: unknown }[] | null }).organizations
  const locale = Array.isArray(organization) ? organization[0]?.default_locale : organization?.default_locale
  return isAppLanguage(locale) ? locale : null
}

/**
 * Language order: the user's own choice (profile, then this browser), then the company
 * default, then the browser language.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE)
  const [numberFormatChoice, setNumberFormatChoice] = useState<NumberFormat | null>(null)
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric')

  const applyLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next)
    document.documentElement.lang = next
  }, [])

  useEffect(() => {
    const saved = readStorage(STORAGE_KEY)
    const savedLanguage = isAppLanguage(saved) ? saved : null
    applyLanguage(savedLanguage ?? detectLanguage(window.navigator.language))

    const savedFormat = readStorage(NUMBER_FORMAT_KEY)
    if (isNumberFormat(savedFormat)) setNumberFormatChoice(savedFormat)

    const savedUnits = readStorage(UNIT_SYSTEM_KEY)
    if (isUnitSystem(savedUnits)) setUnitSystemState(savedUnits)

    let cancelled = false

    async function loadAccountSettings() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data, error } = await supabase
          .from('profiles')
          .select('language, number_format, unit_system')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled) return
        const profile = error ? null : data
        if (isAppLanguage(profile?.language)) {
          applyLanguage(profile.language)
          writeStorage(STORAGE_KEY, profile.language)
        } else if (!savedLanguage) {
          const companyLanguage = await loadCompanyLanguage(supabase, user.id)
          if (companyLanguage && !cancelled) applyLanguage(companyLanguage)
        }
        if (isNumberFormat(profile?.number_format)) {
          setNumberFormatChoice(profile.number_format)
          writeStorage(NUMBER_FORMAT_KEY, profile.number_format)
        }
        if (isUnitSystem(profile?.unit_system)) {
          setUnitSystemState(profile.unit_system)
          writeStorage(UNIT_SYSTEM_KEY, profile.unit_system)
        }
      } catch {
        // Supabase not configured on this host (e.g. public share links): keep local settings.
      }
    }

    loadAccountSettings()
    return () => { cancelled = true }
  }, [applyLanguage])

  const setLanguage = useCallback((next: AppLanguage) => {
    applyLanguage(next)
    writeStorage(STORAGE_KEY, next)
    void saveToProfile({ language: next })
  }, [applyLanguage])

  const setNumberFormat = useCallback((format: NumberFormat | null) => {
    setNumberFormatChoice(format)
    writeStorage(NUMBER_FORMAT_KEY, format)
    void saveToProfile({ number_format: format })
  }, [])

  const setUnitSystem = useCallback((system: UnitSystem) => {
    setUnitSystemState(system)
    writeStorage(UNIT_SYSTEM_KEY, system)
    void saveToProfile({ unit_system: system })
  }, [])

  const value = useMemo<LanguageContextValue>(() => {
    const numberFormat = resolveNumberFormat(language, numberFormatChoice)
    return {
      language,
      setLanguage,
      isPortuguese: language === 'pt-BR',
      isEnglish: language === 'en-US',
      isSpanish: language === 'es',
      numberFormat,
      numberFormatChoice,
      setNumberFormat,
      unitSystem,
      setUnitSystem,
      formatNumber: (value: number, maximumFractionDigits = 2) =>
        formatNumberWith(value, numberFormat, maximumFractionDigits),
    }
  }, [language, numberFormatChoice, unitSystem, setLanguage, setNumberFormat, setUnitSystem])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}

/** Legacy two-language helper. New code uses useT() message files; Spanish falls back to English here. */
export function localized<T>(language: AppLanguage, ptBR: T, enUS: T): T {
  return language === 'pt-BR' ? ptBR : enUS
}
