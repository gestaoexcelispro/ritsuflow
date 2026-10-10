'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'
import AuthShell, { AuthField } from '../login/AuthShell'
import styles from '../login/login.module.css'
import { useT } from '../../lib/i18n/useT'

const supabase = createClient()

export default function ForgotPasswordPage() {
  const t = useT('auth')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setErrorMessage('')

    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })

      if (error) {
        console.error('Password recovery request failed.', error)
      }

      setMessage(t('forgot.sent'))
    } catch (error) {
      console.error('Password recovery request failed.', error)
      setErrorMessage(t('forgot.err'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.subtitle')}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {message && <div role="status" className={styles.success}>{message}</div>}
        {errorMessage && <div role="alert" className={styles.error}>{errorMessage}</div>}
        <AuthField label={t('email')} icon="@" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder={t('emailPlaceholder')} />
        <button type="submit" disabled={loading} className={styles.submitButton}>{loading ? t('forgot.sending') : t('forgot.submit')}</button>
      </form>
      <p className={styles.footLine}><Link href="/login" className={styles.textLink}>{t('backToSignIn')}</Link></p>
    </AuthShell>
  )
}
