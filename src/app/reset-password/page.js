'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let mounted = true
    let subscription = null
    let timer = null

    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && mounted) {
        setSessionReady(true)
        return
      }

      const listener = supabase.auth.onAuthStateChange((event, currentSession) => {
        if (!mounted) return
        if (event === 'PASSWORD_RECOVERY' || currentSession) {
          setSessionReady(true)
          setErrorMessage('')
        }
      })
      subscription = listener.data.subscription

      timer = window.setTimeout(async () => {
        if (!mounted) return
        const { data: { session: refreshedSession } } = await supabase.auth.getSession()
        if (refreshedSession) setSessionReady(true)
        else setErrorMessage('This password reset link is invalid or has expired. Please request a new one.')
      }, 1500)
    }

    initialize()
    return () => {
      mounted = false
      if (timer) window.clearTimeout(timer)
      subscription?.unsubscribe()
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!sessionReady) return setErrorMessage('The password recovery session is not ready.')
    if (password.length < 8) return setErrorMessage('Password must contain at least 8 characters.')
    if (password !== confirmPassword) return setErrorMessage('The passwords do not match.')

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
    } catch (error) {
      console.error('Password update failed.', error)
      setErrorMessage(error.message || 'Your password could not be updated.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f7f8', fontFamily: 'Arial, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 440, padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 12px 32px rgba(6,43,84,.12)' }}>
        <h1 style={{ margin: '0 0 8px', color: '#062b54' }}>Create a new password</h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', lineHeight: 1.5 }}>Choose a new password for your RitsuFlow account.</p>

        {success ? (
          <div>
            <div role="status" style={{ padding: 12, borderRadius: 8, background: '#ecfdf5', color: '#166534', lineHeight: 1.45 }}>Your password has been updated successfully.</div>
            <p style={{ margin: '24px 0 0', textAlign: 'center' }}><Link href="/login" style={{ color: '#0f5f9b', fontWeight: 700, textDecoration: 'none' }}>Continue to sign in</Link></p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {errorMessage && <div role="alert" style={{ padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b', lineHeight: 1.45 }}>{errorMessage}</div>}
            {!sessionReady && !errorMessage && <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', color: '#475569', textAlign: 'center' }}>Validating reset link...</div>}

            <label style={{ color: '#334155', fontWeight: 600 }}>New Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required disabled={!sessionReady || loading} style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }} /></label>
            <label style={{ color: '#334155', fontWeight: 600 }}>Confirm Password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required disabled={!sessionReady || loading} style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }} /></label>

            <button type="submit" disabled={!sessionReady || loading} style={{ padding: 14, border: 0, borderRadius: 8, background: !sessionReady || loading ? '#94a3b8' : '#062b54', color: '#fff', fontWeight: 700, cursor: !sessionReady || loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Updating...' : 'Update password'}</button>
          </form>
        )}
      </section>
    </main>
  )
}
