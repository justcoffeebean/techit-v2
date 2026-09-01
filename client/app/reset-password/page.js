'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '../lib/api'
import { useTheme } from '../lib/useTheme'
import { labelStyle, errorAlertStyle, successAlertStyle, pageWrapperStyle, cardStyle } from '../lib/styles'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { colors, isDark } = useTheme()

  // 'checking' until the token is validated, so an expired link says so
  // before the user bothers typing a password.
  const [status, setStatus] = useState('checking')
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    let cancelled = false

    apiClient.get(`/api/auth/reset-password/${encodeURIComponent(token)}`)
      .then(() => { if (!cancelled) setStatus('valid') })
      .catch(() => { if (!cancelled) setStatus('invalid') })

    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async () => {
    setError('')
    if (!form.password || !form.confirm) return setError('Please fill in both fields')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')

    setLoading(true)
    try {
      const res = await apiClient.post('/api/auth/reset-password', {
        token, password: form.password,
      })
      setDone(res.data.message)
      setTimeout(() => router.push('/login'), 1800)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset your password')
    } finally {
      setLoading(false)
    }
  }

  const inputSx = {
    width: '100%', padding: '12px 16px',
    background: colors.inputBg, border: `1px solid ${colors.border}`,
    borderRadius: 8, color: colors.text, fontSize: 15, outline: 'none',
    marginTop: 6,
  }

  return (
    <div style={{ ...pageWrapperStyle, background: colors.bg }}>
      <div style={{ ...cardStyle, background: colors.card, border: `1px solid ${colors.border}`, padding: 40, maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🔑</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: colors.text }}>
            Choose a new password
          </h1>
        </div>

        {status === 'checking' && (
          <p style={{ color: colors.subtle, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            Checking your link...
          </p>
        )}

        {status === 'invalid' && (
          <>
            <div style={errorAlertStyle}>
              This reset link is invalid or has expired.
            </div>
            <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Reset links last an hour and can only be used once. Request a new one
              and it will replace any earlier link.
            </p>
            <button
              onClick={() => router.push('/forgot-password')}
              style={{
                width: '100%', padding: '13px', background: colors.success,
                border: 'none', color: isDark ? '#000' : '#fff',
                borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700,
              }}
            >Request a new link</button>
          </>
        )}

        {status === 'valid' && (
          <>
            {error && <div style={errorAlertStyle}>{error}</div>}
            {done && <div style={successAlertStyle}>{done}</div>}

            {!done && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>New password</label>
                  <input
                    style={inputSx}
                    type="password"
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  />
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>Confirm new password</label>
                  <input
                    style={inputSx}
                    type="password"
                    placeholder="Repeat your password"
                    value={form.confirm}
                    onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
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
                  {loading ? 'Updating...' : 'Update password'}
                </button>

                <p style={{ fontSize: 12, color: colors.subtle, marginTop: 14, lineHeight: 1.6, textAlign: 'center' }}>
                  Setting a new password signs you out everywhere else.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#0f0f0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>Loading...</div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
