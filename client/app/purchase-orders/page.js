'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { apiClient, getToken, API_BASE } from '../lib/api'
import { useTheme } from '../lib/useTheme'
import Toast from '../components/Toast'

const STATUSES = ['all', 'open', 'sent', 'received', 'cancelled']

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { colors, isDark, toggleTheme } = useTheme()

  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState(null)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  const statusStyle = (s) => {
    if (s === 'received')  return { bg: colors.successBg, border: colors.successBorder, text: colors.success }
    if (s === 'sent')      return { bg: colors.successBg, border: colors.successBorder, text: colors.success }
    if (s === 'cancelled') return { bg: colors.errorBg, border: colors.errorBorder, text: colors.error }
    return { bg: colors.warningBg, border: colors.warningBorder, text: colors.warning }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/api/purchase-orders', {
        params: { status, limit: 50 },
      })
      setOrders(res.data.items || [])
    } catch (err) {
      if (err.response?.status === 401) router.push('/login')
      else addToast('Failed to load purchase orders', 'error')
    } finally {
      setLoading(false)
    }
  }, [status, router])

  useEffect(() => {
    const userData = Cookies.get('user')
    if (!userData || !getToken()) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(userData)
      if (parsed.role !== 'admin') {
        router.push('/dashboard')
        return
      }
      setUser(parsed)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => { if (user) load() }, [user, load])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await apiClient.post('/api/purchase-orders/generate')
      addToast(res.data.message, res.data.created?.length ? 'success' : 'info')
      await load()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to generate orders', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleExpand = async (order) => {
    if (expanded === order.id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(order.id)
    setDetail(null)
    try {
      const res = await apiClient.get(`/api/purchase-orders/${order.id}`)
      setDetail(res.data)
    } catch {
      addToast('Failed to load order detail', 'error')
    }
  }

  const handleAction = async (order, action, label) => {
    try {
      const res = await apiClient.post(`/api/purchase-orders/${order.id}/${action}`)
      if (action === 'resend') {
        addToast(res.data.emailed ? 'Order emailed to supplier' : 'Email failed — check supplier address', res.data.emailed ? 'success' : 'error')
      } else {
        addToast(label)
      }
      await load()
      if (expanded === order.id) {
        const fresh = await apiClient.get(`/api/purchase-orders/${order.id}`)
        setDetail(fresh.data)
      }
    } catch (err) {
      addToast(err.response?.data?.error || `Failed to ${action} order`, 'error')
    }
  }

  // The PDF endpoint needs the auth header, so fetch it as a blob rather than
  // pointing the browser straight at the URL.
  const handleDownload = async (order) => {
    try {
      const res = await apiClient.get(`/api/purchase-orders/${order.id}/pdf`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${order.reference}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      addToast('Failed to download PDF', 'error')
    }
  }

  const btn = (extra = {}) => ({
    padding: '6px 12px', background: colors.card,
    border: `1px solid ${colors.border}`, color: colors.muted,
    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    ...extra,
  })

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtle }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <Toast toasts={toasts} removeToast={removeToast} />

      <nav style={{
        height: 60, background: colors.navBg,
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            onClick={() => router.push('/dashboard')}
            style={{ fontSize: 20, fontWeight: 800, cursor: 'pointer' }}
          >TechIT</span>
          <span style={{ color: colors.subtle, fontSize: 13 }}>/ Purchase Orders</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push('/dashboard')} style={btn()}>Dashboard</button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={btn({
              background: generating ? colors.border : colors.success,
              border: 'none',
              color: generating ? colors.subtle : (isDark ? '#000' : '#fff'),
              fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
            })}
          >
            {generating ? 'Checking...' : 'Generate from low stock'}
          </button>
          <button onClick={toggleTheme} aria-label="Toggle color theme" style={btn({ fontSize: 14 })}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={btn({
                background: status === s ? colors.success : colors.card,
                border: `1px solid ${status === s ? colors.successBorder : colors.border}`,
                color: status === s ? (isDark ? '#000' : '#fff') : colors.muted,
                fontWeight: 700,
                textTransform: 'capitalize',
              })}
            >{s}</button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: colors.subtle, textAlign: 'center', padding: 40 }}>Loading...</p>
        ) : orders.length === 0 ? (
          <div style={{
            background: colors.card, border: `1px solid ${colors.border}`,
            borderRadius: 12, padding: 60, textAlign: 'center',
          }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
            <p style={{ color: colors.subtle, fontSize: 16 }}>No purchase orders</p>
            <p style={{ color: colors.subtle, fontSize: 13, marginTop: 4, opacity: 0.7 }}>
              Orders are raised automatically when stock drops below its reorder threshold
            </p>
          </div>
        ) : (
          <div style={{
            background: colors.card, border: `1px solid ${colors.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {orders.map((order, i) => {
              const s = statusStyle(order.status)
              const isOpen = expanded === order.id
              return (
                <div key={order.id} style={{
                  borderBottom: i === orders.length - 1 ? 'none' : `1px solid ${colors.border}`,
                  background: i % 2 === 0 ? colors.card : colors.tableRowAlt,
                }}>
                  <div style={{
                    padding: '16px 20px', display: 'flex',
                    alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  }}>
                    <div style={{ minWidth: 110 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: colors.text, fontFamily: 'monospace' }}>
                        {order.reference}
                      </p>
                      <p style={{ fontSize: 11, color: colors.subtle, marginTop: 2 }}>
                        {formatDate(order.created_at)}
                      </p>
                    </div>

                    <div style={{ flex: 1, minWidth: 160 }}>
                      <p style={{ fontSize: 14, color: colors.text }}>{order.supplier_name}</p>
                      <p style={{ fontSize: 11, color: colors.subtle, marginTop: 2 }}>
                        {order.supplier_email || 'No email on file'}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: colors.success }}>
                        ${parseFloat(order.total_cost).toFixed(2)}
                      </p>
                      <p style={{ fontSize: 11, color: colors.subtle, marginTop: 2 }}>
                        {order.line_count} item{order.line_count === 1 ? '' : 's'} · {order.unit_count} units
                      </p>
                    </div>

                    <span style={{
                      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
                      padding: '4px 12px', borderRadius: 100,
                      fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                    }}>{order.status}</span>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleExpand(order)} style={btn()}>
                        {isOpen ? 'Hide' : 'View'}
                      </button>
                      <button onClick={() => handleDownload(order)} style={btn()}>PDF</button>
                      {order.status !== 'received' && order.status !== 'cancelled' && (
                        <>
                          <button onClick={() => handleAction(order, 'resend', 'Sent')} style={btn()}>
                            Resend
                          </button>
                          <button
                            onClick={() => handleAction(order, 'receive', 'Stock received')}
                            style={btn({
                              background: colors.successBg,
                              border: `1px solid ${colors.successBorder}`,
                              color: colors.success,
                            })}
                          >Receive</button>
                          <button
                            onClick={() => handleAction(order, 'cancel', 'Order cancelled')}
                            style={btn({
                              background: colors.errorBg,
                              border: `1px solid ${colors.errorBorder}`,
                              color: colors.error,
                            })}
                          >Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {order.email_error && (
                    <div style={{
                      padding: '8px 20px 12px', fontSize: 11, color: colors.error,
                    }}>
                      Email not delivered: {order.email_error}
                    </div>
                  )}

                  {isOpen && (
                    <div style={{
                      padding: '0 20px 20px',
                      borderTop: `1px solid ${colors.border}`,
                      marginTop: 4, paddingTop: 16,
                    }}>
                      {!detail ? (
                        <p style={{ color: colors.subtle, fontSize: 13 }}>Loading lines...</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {['SKU', 'Item', 'Ordered', 'Unit cost', 'Total', 'At order'].map(h => (
                                <th key={h} style={{
                                  textAlign: h === 'Item' || h === 'SKU' ? 'left' : 'right',
                                  padding: '6px 8px', fontSize: 10, fontWeight: 700,
                                  color: colors.subtle, textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detail.lines.map(line => (
                              <tr key={line.id}>
                                <td style={{ padding: '6px 8px', fontSize: 12, color: colors.subtle, fontFamily: 'monospace' }}>
                                  {line.sku}
                                </td>
                                <td style={{ padding: '6px 8px', fontSize: 13, color: colors.text }}>
                                  {line.item_name}
                                </td>
                                <td style={{ padding: '6px 8px', fontSize: 13, color: colors.text, textAlign: 'right' }}>
                                  {line.quantity_ordered}
                                </td>
                                <td style={{ padding: '6px 8px', fontSize: 13, color: colors.muted, textAlign: 'right' }}>
                                  ${parseFloat(line.unit_cost).toFixed(2)}
                                </td>
                                <td style={{ padding: '6px 8px', fontSize: 13, color: colors.text, textAlign: 'right', fontWeight: 700 }}>
                                  ${parseFloat(line.line_total).toFixed(2)}
                                </td>
                                <td style={{ padding: '6px 8px', fontSize: 11, color: colors.subtle, textAlign: 'right' }}>
                                  {line.quantity_at_order} / {line.threshold_at_order}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
