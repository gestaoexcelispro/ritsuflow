'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AppLanguage,
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
  /** Effective number format (follows the language unless the user chose one). */
  numberFormat: NumberFormat
  /** The user's explicit choice; null means "follow the language". */
  numberFormatChoice: NumberFormat | null
  setNumberFormat: (format: NumberFormat | null) => void
  unitSystem: UnitSystem
  setUnitSystem: (system: UnitSystem) => void
  formatNumber: (value: number, maximumFractionDigits?: number) => string
}

// RitsuScope keeps display settings in the browser (RitsuFlow profiles have no columns for them).
const STORAGE_KEY = 'ritsuscope-language'
const NUMBER_FORMAT_KEY = 'ritsuscope-number-format'
const UNIT_SYSTEM_KEY = 'ritsuscope-unit-system'
const SYNC_PROFILE = false

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
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
  if (!SYNC_PROFILE) return
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('pt-BR')
  const [numberFormatChoice, setNumberFormatChoice] = useState<NumberFormat | null>(null)
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric')

  const applyLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next)
    document.documentElement.lang = next
  }, [])

  // 1) Before login: browser storage, then browser language.
  // 2) After login: the profile wins when it has a value.
  useEffect(() => {
    const saved = readStorage(STORAGE_KEY)
    applyLanguage(isAppLanguage(saved) ? saved : detectLanguage(window.navigator.language))

    const savedFormat = readStorage(NUMBER_FORMAT_KEY)
    if (isNumberFormat(savedFormat)) setNumberFormatChoice(savedFormat)

    const savedUnits = readStorage(UNIT_SYSTEM_KEY)
    if (isUnitSystem(savedUnits)) setUnitSystemState(savedUnits)

    let cancelled = false

    async function loadProfileSettings() {
      if (!SYNC_PROFILE) return
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data, error } = await supabase
          .from('profiles')
          .select('language, number_format, unit_system')
          .eq('id', user.id)
          .single()
        if (error || !data || cancelled) return
        if (isAppLanguage(data.language)) {
          applyLanguage(data.language)
          writeStorage(STORAGE_KEY, data.language)
        }
        if (isNumberFormat(data.number_format)) {
          setNumberFormatChoice(data.number_format)
          writeStorage(NUMBER_FORMAT_KEY, data.number_format)
        }
        if (isUnitSystem(data.unit_system)) {
          setUnitSystemState(data.unit_system)
          writeStorage(UNIT_SYSTEM_KEY, data.unit_system)
        }
      } catch {
        // Supabase not configured on this host (e.g. public site): keep local settings.
      }
    }

    loadProfileSettings()
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

/** Legacy two-language helper used by existing pages. New modules use message files. */
export function localized<T>(language: AppLanguage, ptBR: T, enUS: T): T {
  return language === 'en-US' ? enUS : ptBR
}
