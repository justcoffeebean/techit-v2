'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '../lib/api'
import { useTheme } from '../lib/useTheme'
import { labelStyle, errorAlertStyle, successAlertStyle, pageWrapperStyle, cardStyle } from '../lib/styles'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { colors, isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email.trim()) return setError('Please enter your email address')

    setLoading(true)
    try {
      const res = await apiClient.post('/api/auth/forgot-password', { email: email.trim() })
      // The API answers identically whether or not the address is registered,
      // so the confirmation is deliberately non-committal.
      setSent(res.data.message)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send the reset link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...pageWrapperStyle, background: colors.bg }}>
      <div style={{ ...cardStyle, background: colors.card, border: `1px solid ${colors.border}`, padding: 40, maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🔑</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: colors.text }}>
            Forgot your password?
          </h1>
          <p style={{ color: colors.muted, fontSize: 14, lineHeight: 1.6 }}>
            Enter the email on your account and we&rsquo;ll send you a link to choose a new password.
          </p>
        </div>

        {error && <div style={errorAlertStyle}>{error}</div>}

        {sent ? (
          <>
            <div style={successAlertStyle}>{sent}</div>
            <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              The link expires in an hour and can only be used once. If it does not
              arrive, check your spam folder before requesting another.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{
                width: '100%', padding: '13px', background: colors.success,
                border: 'none', color: isDark ? '#000' : '#fff',
                borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700,
              }}
            >Back to sign in</button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email address</label>
              <input
                style={{
                  width: '100%', padding: '12px 16px',
                  background: colors.inputBg, border: `1px solid ${colors.border}`,
                  borderRadius: 8, color: colors.text, fontSize: 15, outline: 'none',
                  marginTop: 6,
                }}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? colors.border : colors.success,
                border: 'none', color: loading ? colors.subtle : (isDark ? '#000' : '#fff'),
                borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 15, fontWeight: 700,
              }}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: colors.subtle }}>
              Remembered it?{' '}
              <span
                onClick={() => router.push('/login')}
                style={{ color: colors.success, cursor: 'pointer', fontWeight: 600 }}
              >Sign in</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
