'use client'

import { useMemo } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { projectCopy, projectStatusLabels, projectText } from './projects'

export function useProjectCopy() {
  const { locale } = useLanguage()

  return useMemo(() => ({
    locale,
    copy: projectCopy(locale),
    statusLabels: projectStatusLabels(locale),
    text: (key, vars = {}) => projectText(locale, key, vars),
    formatNumber: (value, options = {}) => new Intl.NumberFormat(locale, options).format(value),
    formatCurrency: (value, currency = 'USD') => new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value),
    formatDate: (value, options = {}) => {
      if (!value) return '—'
      const date = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      return new Intl.DateTimeFormat(locale, options).format(date)
    },
  }), [locale])
}
