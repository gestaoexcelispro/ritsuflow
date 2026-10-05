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
import fieldopWorkforceEnUS from './messages/fieldopWorkforce.en-US.json'
import fieldopWorkforceEs from './messages/fieldopWorkforce.es.json'
import fieldopWorkforcePtBR from './messages/fieldopWorkforce.pt-BR.json'
import fieldopHubEnUS from './messages/fieldopHub.en-US.json'
import fieldopHubEs from './messages/fieldopHub.es.json'
import fieldopHubPtBR from './messages/fieldopHub.pt-BR.json'
import fieldopReportsEnUS from './messages/fieldopReports.en-US.json'
import fieldopReportsEs from './messages/fieldopReports.es.json'
import fieldopReportsPtBR from './messages/fieldopReports.pt-BR.json'
import projectsEnUS from './messages/projects.en-US.json'
import projectsEs from './messages/projects.es.json'
import projectsPtBR from './messages/projects.pt-BR.json'
import authEnUS from './messages/auth.en-US.json'
import authEs from './messages/auth.es.json'
import authPtBR from './messages/auth.pt-BR.json'
import workspacesEnUS from './messages/workspaces.en-US.json'
import workspacesEs from './messages/workspaces.es.json'
import workspacesPtBR from './messages/workspaces.pt-BR.json'
import settingsEnUS from './messages/settings.en-US.json'
import settingsEs from './messages/settings.es.json'
import settingsPtBR from './messages/settings.pt-BR.json'
import preconEnUS from './messages/precon.en-US.json'
import preconEs from './messages/precon.es.json'
import preconPtBR from './messages/precon.pt-BR.json'

/**
 * One message file per module and language: messages/<namespace>.<language>.json.
 * English (US) is the source; `npm run check:i18n` fails the build if a key is missing
 * in any language. To add a module, add its three files and register them here.
 */
const namespaces = {
  common: { 'en-US': commonEnUS, es: commonEs, 'pt-BR': commonPtBR },
  fieldop: { 'en-US': fieldopEnUS, es: fieldopEs, 'pt-BR': fieldopPtBR },
  fieldopSetup: { 'en-US': fieldopSetupEnUS, es: fieldopSetupEs, 'pt-BR': fieldopSetupPtBR },
  fieldopWorkforce: { 'en-US': fieldopWorkforceEnUS, es: fieldopWorkforceEs, 'pt-BR': fieldopWorkforcePtBR },
  fieldopHub: { 'en-US': fieldopHubEnUS, es: fieldopHubEs, 'pt-BR': fieldopHubPtBR },
  fieldopReports: { 'en-US': fieldopReportsEnUS, es: fieldopReportsEs, 'pt-BR': fieldopReportsPtBR },
  projects: { 'en-US': projectsEnUS, es: projectsEs, 'pt-BR': projectsPtBR },
  auth: { 'en-US': authEnUS, es: authEs, 'pt-BR': authPtBR },
  workspaces: { 'en-US': workspacesEnUS, es: workspacesEs, 'pt-BR': workspacesPtBR },
  settings: { 'en-US': settingsEnUS, es: settingsEs, 'pt-BR': settingsPtBR },
  precon: { 'en-US': preconEnUS, es: preconEs, 'pt-BR': preconPtBR },
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
