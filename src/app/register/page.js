'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'
import AuthShell, { AuthField } from '../login/AuthShell'
import styles from '../login/login.module.css'
import { useT } from '../../lib/i18n/useT'

const supabase = createClient()

export default function RegisterPage() {
  const t = useT('auth')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    const normalizedName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (normalizedName.length < 2) return setErrorMessage(t('register.errName'))
    if (password.length < 8) return setErrorMessage(t('errPasswordLength'))
    if (password !== confirmPassword) return setErrorMessage(t('errPasswordMatch'))

    setLoading(true)

    try {
      const emailRedirectTo = `${window.location.origin}/login`
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: normalizedName,
          },
        },
      })

      if (error) throw error
      setSuccess(true)
    } catch (error) {
      console.error('Registration failed.', error)
      setErrorMessage(t('register.errCreate'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title={t('register.title')} subtitle={t('register.subtitle')}>
      {success ? (
        <div className={styles.form}>
          <div role="status" className={styles.success}>{t('register.success')}</div>
          <p className={styles.footLine}><Link href="/login" className={styles.textLink}>{t('continueSignIn')}</Link></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.info}>{t('register.note')}</div>
          {errorMessage && <div role="alert" className={styles.error}>{errorMessage}</div>}
          <AuthField label={t('register.name')} icon="A" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required placeholder={t('register.namePlaceholder')} />
          <AuthField label={t('email')} icon="@" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder={t('emailPlaceholder')} />
          <AuthField label={t('password')} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required placeholder={t('passwordRule')} />
          <AuthField label={t('confirmPassword')} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required placeholder={t('confirmPasswordPlaceholder')} />
          <button type="submit" disabled={loading} className={styles.submitButton}>{loading ? t('register.creating') : t('register.submit')}</button>
        </form>
      )}
      {!success && <p className={styles.footLine}>{t('register.haveAccount')} <Link href="/login" className={styles.textLink}>{t('login.signIn')}</Link></p>}
    </AuthShell>
  )
}
