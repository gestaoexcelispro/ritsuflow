'use client'

import Link from 'next/link'
import { ui } from '../fieldop/ui'
import { useT } from '../../lib/i18n/useT'

/** "Continue to PreCon →" tab-bar action (client, so server pages can use it translated). */
export default function ContinueToPrecon({ projectId }) {
  const t = useT('projects')
  return <Link className={ui.btnPrimary} href={`/planning/pre-planning?projectId=${projectId}`}>{t('scope.continuePrecon')}</Link>
}
