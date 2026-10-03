'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, normalizeLocale } from '../i18n/config'
import { messages } from '../i18n/messages'

const LanguageContext = createContext(null)

function getValue(object, key) {
  return key.split('.').reduce((value, part) => value?.[part], object)
}

export function LanguageProvider({ children, initialLocale = DEFAULT_LOCALE }) {
  const [lang, setLang] = useState(normalizeLocale(initialLocale))

  const value = useMemo(() => {
    const changeLanguage = (locale) => setLang(normalizeLocale(locale))

    const t = (key, fallback) =>
      getValue(messages[lang], key) ??
      getValue(messages[DEFAULT_LOCALE], key) ??
      fallback ??
      key

    return { lang, locale: lang, changeLanguage, t }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }

  return context
}
