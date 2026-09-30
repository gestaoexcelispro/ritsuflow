'use client'

import { useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function LocaleDocumentSync() {
  const { locale } = useLanguage()

  useEffect(() => {
    const languageTag = locale || 'en-US'
    document.documentElement.lang = languageTag
    document.documentElement.dataset.locale = languageTag
  }, [locale])

  return null
}
