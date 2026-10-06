'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { TRIAL_COUNTRIES, TRIAL_INTERESTS, TRIAL_PROJECTS, TRIAL_ROLES, type TrialInterest } from '@/lib/trial'
import s from './landing.module.css'

const CONTACT_EMAIL = 'contact@excelispro.com'

/** "Apply for the trial": posts to /api/trial (stored in trial_applications). */
export default function TrialForm() {
  const t = useT('landing')
  const { language } = useLanguage()
  const [interests, setInterests] = useState<TrialInterest[]>([])
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) || '').trim()
    const body = {
      name: get('name'), email: get('email'), company: get('company'), country: get('country'), role: get('role'),
      activeProjects: get('activeProjects'), interests, language, consent: f.get('consent') === 'on', website: get('website'),
    }
    if (!body.name || !body.company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) { setError(t('trial.errRequired')); return }
    if (!body.consent) { setError(t('trial.errConsent')); return }
    setError(''); setState('sending')
    try {
      const r = await fetch('/api/trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error(String(r.status))
      setState('sent')
    } catch {
      setState('idle'); setError(`${t('trial.errSend')} ${CONTACT_EMAIL}.`)
    }
  }

  if (state === 'sent') {
    return (
      <div className={s.form} role="status">
        <strong className={s.formDone}>{t('trial.successTitle')}</strong>
        <p className={s.small}>{t('trial.successText')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </div>
    )
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <label className={s.field}>{t('trial.name')}<input name="name" autoComplete="name" required maxLength={200} /></label>
      <label className={s.field}>{t('trial.email')}<input name="email" type="email" autoComplete="email" required maxLength={320} /></label>
      <label className={s.field}>{t('trial.company')}<input name="company" autoComplete="organization" required maxLength={200} /></label>
      <label className={s.field}>{t('trial.country')}
        <select name="country" defaultValue={language === 'pt-BR' ? 'BR' : language === 'en-US' ? 'US' : 'other'}>
          {TRIAL_COUNTRIES.map(c => <option key={c} value={c}>{t(`trial.country.${c}`)}</option>)}
        </select>
      </label>
      <label className={s.field}>{t('trial.role')}
        <select name="role" defaultValue="estimator">
          {TRIAL_ROLES.map(r => <option key={r} value={r}>{t(`trial.role.${r}`)}</option>)}
        </select>
      </label>
      <label className={s.field}>{t('trial.projects')}
        <select name="activeProjects" defaultValue="1-3">
          {TRIAL_PROJECTS.map(p => <option key={p} value={p}>{t(`trial.projects.${p}`)}</option>)}
        </select>
      </label>
      <fieldset className={s.interests}>
        <legend>{t('trial.interests')}</legend>
        {TRIAL_INTERESTS.map(k => (
          <label key={k}>
            <input type="checkbox" checked={interests.includes(k)} onChange={() => setInterests(v => (v.includes(k) ? v.filter(x => x !== k) : [...v, k]))} />
            {t(`trial.interest.${k}`)}
          </label>
        ))}
      </fieldset>
      {/* Left empty by people; bots that fill every field are ignored by the server. */}
      <label className={s.honeypot} aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className={s.consent}>
        <input type="checkbox" name="consent" />
        <span>{t('trial.consentBefore')} <Link href="/privacy">{t('trial.consentLink')}</Link>.</span>
      </label>
      {error && <p role="alert" className={s.formError}>{error}</p>}
      <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnLarge} ${s.formSubmit}`} disabled={state === 'sending'}>
        {state === 'sending' ? t('trial.sending') : t('trial.submit')}
      </button>
    </form>
  )
}
