'use client'

import { useCallback } from 'react'
import { useLanguage } from './LanguageProvider'
import { translate, type Messages } from './translate'
import type { AppLanguage } from './settings'

import commonEnUS from './messages/common.en-US.json'
import commonEs from './messages/common.es.json'
import commonPtBR from './messages/common.pt-BR.json'
import fieldopEnUS from './messages/fieldop.en-US.json'
import fieldopEs from './messages/fieldop.es.json'
import fieldopPtBR from './messages/fieldop.pt-BR.json'
import fieldopSetupEnUS from './messages/fieldopSetup.en-US.json'
import fieldopSetupEs from './messages/fieldopSetup.es.json'
import fieldopSetupPtBR from './messages/fieldopSetup.pt-BR.json'

/**
 * One message file per module and language: messages/<namespace>.<language>.json.
 * English (US) is the source; `npm run check:i18n` fails the build if a key is missing
 * in any language. To add a module, add its three files and register them here.
 */
const namespaces = {
  common: { 'en-US': commonEnUS, es: commonEs, 'pt-BR': commonPtBR },
  fieldop: { 'en-US': fieldopEnUS, es: fieldopEs, 'pt-BR': fieldopPtBR },
  fieldopSetup: { 'en-US': fieldopSetupEnUS, es: fieldopSetupEs, 'pt-BR': fieldopSetupPtBR },
} satisfies Record<string, Record<AppLanguage, Messages>>

export type Namespace = keyof typeof namespaces

/** Translator for one module: const t = useT('fieldop'); t('nav.projects'), t('x', { count }). */
export function useT(namespace: Namespace) {
  const { language } = useLanguage()
  return useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(namespaces[namespace][language], namespaces[namespace]['en-US'], key, vars),
    [language, namespace],
  )
}
