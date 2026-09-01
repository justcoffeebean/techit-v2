'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../lib/api'
import { useTheme } from '../lib/useTheme'

const MOVEMENT_TYPES = ['received', 'sold', 'damaged', 'returned', 'adjusted']

function formatWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MovementsModal({ item, onClose }) {
  const { colors, isDark } = useTheme()
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Manual movement form
  const [type, setType] = useState('received')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentQty, setCurrentQty] = useState(item?.quantity ?? 0)

  const typeStyle = (t) => {
    if (t === 'received' || t === 'returned') {
      return { bg: colors.successBg, border: colors.successBorder, text: colors.success }
    }
    if (t === 'damaged') {
      return { bg: colors.errorBg, border: colors.errorBorder, text: colors.error }
    }
    if (t === 'sold') {
      return { bg: colors.successBg, border: colors.successBorder, text: colors.success }
    }
    return { bg: colors.warningBg, border: colors.warningBorder, text: colors.warning }
  }

  const load = useCallback(async () => {
    if (!item?.id) return
    setLoading(true)
    try {
      const res = await apiClient.get(`/api/movements/item/${item.id}`, { params: { limit: 100 } })
      setMovements(res.data.items || [])
    } catch (err) {
      setError('Failed to load movement history')
    } finally {
      setLoading(false)
    }
  }, [item?.id])

  useEffect(() => { load() }, [load])

  const handleRecord = async () => {
    setError('')
    const qty = Math.abs(parseInt(quantity) || 0)
    if (qty === 0) return setError('Quantity must be greater than zero')

    setSubmitting(true)
    try {
      const res = await apiClient.post('/api/movements', {
        item_id: item.id,
        movement_type: type,
        quantity: qty,
        reason,
      })
      setCurrentQty(res.data.item.quantity)
      setQuantity('')
      setReason('')
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record movement')
    } finally {
      setSubmitting(false)
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
        maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>{item?.name}</h2>
            <p style={{ fontSize: 12, color: colors.subtle, marginTop: 2, fontFamily: 'monospace' }}>
              {item?.sku} · {currentQty} on hand
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: colors.subtle,
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Record a movement */}
        <div style={{
          background: colors.inputBg, border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <p style={labelSx}>Record a movement</p>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 100px 1fr auto', gap: 10 }}>
            <select style={inputSx} value={type} onChange={e => setType(e.target.value)}>
              {MOVEMENT_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <input
              style={inputSx}
              type="number"
              min="1"
              placeholder="Qty"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
            <input
              style={inputSx}
              placeholder="Reason (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRecord()}
            />
            <button
              onClick={handleRecord}
              disabled={submitting}
              style={{
                padding: '10px 18px',
                background: submitting ? colors.border : colors.success,
                border: 'none', color: submitting ? colors.subtle : (isDark ? '#000' : '#fff'),
                borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              {submitting ? 'Saving...' : 'Record'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: colors.subtle, marginTop: 8 }}>
            Received and returned add stock; sold, damaged and adjusted remove it.
          </p>
          {error && <p style={{ color: colors.error, fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>

        {/* History */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: colors.subtle, textAlign: 'center', padding: 24 }}>Loading...</p>
          ) : movements.length === 0 ? (
            <p style={{ color: colors.subtle, textAlign: 'center', padding: 24 }}>
              No movements recorded yet
            </p>
          ) : (
            movements.map(m => {
              const s = typeStyle(m.movement_type)
              const positive = m.quantity_change > 0
              return (
                <div key={m.id} style={{
                  padding: '12px 14px', borderBottom: `1px solid ${colors.border}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{
                    background: s.bg, border: `1px solid ${s.border}`, color: s.text,
                    padding: '3px 10px', borderRadius: 100,
                    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 78,
                    textAlign: 'center',
                  }}>{m.movement_type}</span>

                  <span style={{
                    fontSize: 15, fontWeight: 800, minWidth: 52,
                    color: positive ? colors.success : colors.error,
                  }}>
                    {positive ? '+' : ''}{m.quantity_change}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: colors.text }}>
                      {m.quantity_before} → {m.quantity_after}
                    </p>
                    {m.reason && (
                      <p style={{
                        fontSize: 11, color: colors.subtle, marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{m.reason}</p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <p style={{ fontSize: 11, color: colors.subtle }}>{formatWhen(m.created_at)}</p>
                    {m.created_by_username && (
                      <p style={{ fontSize: 11, color: colors.subtle, opacity: 0.7 }}>
                        {m.created_by_username}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
