'use client'

import { useCallback } from 'react'
import { useLanguage } from './LanguageProvider'
import takeoffPtBR, { type TakeoffMessageKey } from './messages/takeoff.pt-BR'
import takeoffEnUS from './messages/takeoff.en-US'
import { translate } from './translate'
import type { AppLanguage } from './settings'

const takeoffMessages: Record<AppLanguage, Record<TakeoffMessageKey, string>> = {
  'pt-BR': takeoffPtBR,
  'en-US': takeoffEnUS,
}

/** Translator for the Takeoff module: t('list.title'), t('workspace.uploading', { name }). */
export function useTakeoffT() {
  const { language } = useLanguage()
  return useCallback(
    (key: TakeoffMessageKey, vars?: Record<string, string | number>) =>
      translate(takeoffMessages[language], takeoffPtBR, key, vars),
    [language],
  )
}
