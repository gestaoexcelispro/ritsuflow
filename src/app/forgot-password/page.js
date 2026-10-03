'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

export default function ForgotPasswordPage() {
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

      setMessage('If an account exists for that email, a password reset link has been sent.')
    } catch (error) {
      console.error('Password recovery request failed.', error)
      setErrorMessage('RitsuFlow could not process the password reset request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f7f8', fontFamily: 'Arial, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 440, padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 12px 32px rgba(6,43,84,.12)' }}>
        <h1 style={{ margin: '0 0 8px', color: '#062b54' }}>Reset your password</h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', lineHeight: 1.5 }}>Enter your RitsuFlow email and we’ll send you a secure password reset link.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {message && <div role="status" style={{ padding: 12, borderRadius: 8, background: '#ecfdf5', color: '#166534', lineHeight: 1.45 }}>{message}</div>}
          {errorMessage && <div role="alert" style={{ padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>{errorMessage}</div>}

          <label style={{ color: '#334155', fontWeight: 600 }}>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="Enter your email" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }} />
          </label>

          <button type="submit" disabled={loading} style={{ padding: 14, border: 0, borderRadius: 8, background: loading ? '#94a3b8' : '#062b54', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p style={{ margin: '24px 0 0', textAlign: 'center' }}><Link href="/login" style={{ color: '#0f5f9b', fontWeight: 700, textDecoration: 'none' }}>Back to sign in</Link></p>
      </section>
    </main>
  )
}
