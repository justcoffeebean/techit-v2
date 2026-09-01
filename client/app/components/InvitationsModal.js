'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../lib/api'
import { useTheme } from '../lib/useTheme'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function InvitationsModal({ onClose }) {
  const { colors, isDark } = useTheme()
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [lastInvite, setLastInvite] = useState(null)

  const statusStyle = (status) => {
    if (status === 'pending')  return { bg: colors.warningBg, border: colors.warningBorder, text: colors.warning, label: 'Pending' }
    if (status === 'redeemed') return { bg: colors.successBg, border: colors.successBorder, text: colors.success, label: 'Accepted' }
    if (status === 'revoked')  return { bg: colors.errorBg, border: colors.errorBorder, text: colors.error, label: 'Revoked' }
    return { bg: colors.inputBg, border: colors.border, text: colors.muted, label: 'Expired' }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/api/invitations')
      setInvitations(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError('Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSend = async () => {
    setError('')
    setLastInvite(null)
    if (!email) return setError('Email is required')

    setSubmitting(true)
    try {
      const res = await apiClient.post('/api/invitations', { email, role })
      setLastInvite(res.data)
      setEmail('')
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this invitation?')) return
    try {
      await apiClient.delete(`/api/invitations/${id}`)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke invitation')
    }
  }

  const labelSx = {
    fontSize: 12, fontWeight: 600, color: colors.subtle,
    textTransform: 'uppercase', letterSpacing: 0.5,
    display: 'block', marginBottom: 6,
  }
  const inputSx = {
    width: '100%', padding: '10px 14px',
    background: colors.inputBg, border: `1px solid ${colors.border}`,
    borderRadius: 8, color: colors.text, fontSize: 14, outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: 16, padding: 32, width: '100%',
        maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>Team Invitations</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: colors.subtle,
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Invite form */}
        <div style={{
          background: colors.inputBg, border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <p style={labelSx}>Invite a teammate</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 10 }}>
            <input
              style={inputSx}
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <select style={inputSx} value={role} onChange={e => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleSend}
              disabled={submitting}
              style={{
                padding: '10px 18px',
                background: submitting ? colors.border : colors.success,
                border: 'none', color: submitting ? colors.subtle : (isDark ? '#000' : '#fff'),
                borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              {submitting ? 'Sending...' : 'Send invite'}
            </button>
          </div>

          {error && <p style={{ color: colors.error, fontSize: 12, marginTop: 8 }}>{error}</p>}

          {lastInvite && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, color: colors.success, fontWeight: 600 }}>
                {lastInvite.emailed
                  ? `Invitation emailed to ${lastInvite.email}`
                  : 'Invitation created, but the email could not be sent. Share this link:'}
              </p>
              {!lastInvite.emailed && (
                <p style={{ fontSize: 11, color: colors.muted, marginTop: 4, wordBreak: 'break-all' }}>
                  {lastInvite.accept_url}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Invitation list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: colors.subtle, textAlign: 'center', padding: 24 }}>Loading...</p>
          ) : invitations.length === 0 ? (
            <p style={{ color: colors.subtle, textAlign: 'center', padding: 24 }}>No invitations yet</p>
          ) : (
            invitations.map(inv => {
              const s = statusStyle(inv.status)
              return (
                <div key={inv.id} style={{
                  padding: '12px 14px', borderBottom: `1px solid ${colors.border}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 600, color: colors.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{inv.email}</p>
                    <p style={{ fontSize: 11, color: colors.subtle, marginTop: 2 }}>
                      {inv.role} · expires {formatDate(inv.expires_at)}
                    </p>
                  </div>

                  <span style={{
                    background: s.bg, border: `1px solid ${s.border}`, color: s.text,
                    padding: '3px 10px', borderRadius: 100,
                    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>{s.label}</span>

                  {inv.status === 'pending' && (
                    <button onClick={() => handleRevoke(inv.id)} style={{
                      padding: '5px 10px', background: colors.errorBg,
                      border: `1px solid ${colors.errorBorder}`, color: colors.error,
                      borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    }}>Revoke</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
