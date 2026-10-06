'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/useT'
import { ui } from '../ui'
import PriceBook from './PriceBook'
import LaborRates from './LaborRates'
import PricingTemplates from './PricingTemplates'
import Clauses from './Clauses'

type Tab = 'prices' | 'labor' | 'templates' | 'clauses'

/** Commercial → Library: what every estimate is priced from. */
export default function LibraryPage() {
  const t = useT('commercial')
  const [tab, setTab] = useState<Tab>('prices')
  const tabs: Tab[] = ['prices', 'labor', 'templates', 'clauses']
  return (
    <section style={ui.page}>
      <div role="tablist" aria-label={t('library.title')} style={ui.tabs}>
        {tabs.map(k => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={tab === k ? ui.tabOn : ui.tab}>
            {t(`library.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'prices' && <PriceBook />}
      {tab === 'labor' && <LaborRates />}
      {tab === 'templates' && <PricingTemplates />}
      {tab === 'clauses' && <Clauses />}
    </section>
  )
}
