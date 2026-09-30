'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase/client'
import { DEFAULT_LOCALE, normalizeLocale } from '../i18n/config'
import { messages } from '../i18n/messages'

const LanguageContext = createContext(null)
const supabase = createClient()

function getValue(object, key) {
  return key.split('.').reduce((value, part) => value?.[part], object)
}

export function LanguageProvider({ children, initialLocale = DEFAULT_LOCALE }) {
  const [lang, setLang] = useState(normalizeLocale(initialLocale))
  const [localeReady, setLocaleReady] = useState(false)
  const changeLanguage = useCallback((locale) => setLang(normalizeLocale(locale)), [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!active || !user) return

        const { data: memberships } = await supabase
          .from('organization_members')
          .select('role,status,organizations(default_locale)')
          .eq('user_id', user.id)
          .eq('status', 'active')

        if (!active) return
        const membership = memberships?.find(item => ['owner', 'admin'].includes(item.role)) || memberships?.[0]
        const organizationLocale = membership?.organizations?.default_locale
        if (organizationLocale) setLang(normalizeLocale(organizationLocale))
      } finally {
        if (active) setLocaleReady(true)
      }
    })()
    return () => { active = false }
  }, [])

  const value = useMemo(() => {
    const t = (key, fallback) =>
      getValue(messages[lang], key) ??
      getValue(messages[DEFAULT_LOCALE], key) ??
      fallback ??
      key

    return { lang, locale: lang, localeReady, changeLanguage, t }
  }, [lang, localeReady, changeLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
