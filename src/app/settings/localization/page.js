'use client'

import { AppShell, Panel, Segments } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { LANGUAGE_OPTIONS } from '../../../lib/i18n/settings'
import { useSignedIn } from '../useSignedIn'
import styles from './localization.module.css'

const SAMPLE = 1234567.89

/** Personal display preferences. Saved on the user's profile (and this browser) as soon as they change. */
export default function LocalizationSettings() {
  const t = useT('settings')
  const ready = useSignedIn()
  const { language, setLanguage, numberFormat, numberFormatChoice, setNumberFormat, unitSystem, setUnitSystem } = useLanguage()
  const sample = (format) => new Intl.NumberFormat(format, { minimumFractionDigits: 2 }).format(SAMPLE)
  const today = new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(new Date())

  return <AppShell module="settings" active="localization">
    {!ready ? <p className={styles.muted}>{t('loading')}</p> : <div className={styles.stack}>
      <p className={styles.intro}>{t('loc.intro')}</p>

      <Panel title={t('loc.languageTitle')} text={t('loc.languageText')}>
        <div className={styles.options} role="radiogroup" aria-label={t('loc.languageTitle')}>
          {LANGUAGE_OPTIONS.map((option) => <button key={option.value} type="button" role="radio" aria-checked={language === option.value} className={`${styles.option} ${language === option.value ? styles.optionOn : ''}`} onClick={() => setLanguage(option.value)}>
            <b>{option.short}</b><span>{option.label}</span>
          </button>)}
        </div>
        <p className={styles.preview}>{t('loc.preview')}: <strong>{today}</strong></p>
      </Panel>

      <Panel title={t('loc.numbersTitle')} text={t('loc.numbersText')}>
        <Segments value={numberFormatChoice || 'auto'} onChange={(v) => setNumberFormat(v === 'auto' ? null : v)} items={[
          { value: 'auto', label: t('loc.numbersAuto') },
          { value: 'en-US', label: sample('en-US') },
          { value: 'pt-BR', label: sample('pt-BR') },
        ]} />
        <p className={styles.preview}>{t('loc.preview')}: <strong>{sample(numberFormat)}</strong></p>
      </Panel>

      <Panel title={t('loc.unitsTitle')} text={t('loc.unitsText')}>
        <Segments value={unitSystem} onChange={setUnitSystem} items={[
          { value: 'metric', label: t('loc.metric') },
          { value: 'imperial', label: t('loc.imperial') },
        ]} />
      </Panel>

      <p className={styles.note}>{t('loc.note')}</p>
    </div>}
  </AppShell>
}
