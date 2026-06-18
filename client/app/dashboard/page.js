'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import dynamic from 'next/dynamic'
import { apiClient, getToken } from '../lib/api'
import { inputStyle, labelStyle, colors } from '../lib/styles'
import StatCards from '../components/StatCards'
import ItemsTable from '../components/ItemsTable'
import ItemModal from '../components/ItemModal'
import AuditLog from '../components/AuditLog'
import Toast from '../components/Toast'

const Charts = dynamic(() => import('../components/Charts'), { ssr: false })

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [metrics, setMetrics] = useState({ total_items: 0, low_stock: 0, out_of_stock: 0, total_value: 0, by_category: {}, by_status: {} })
  const [filters, setFilters] = useState({ keyword: '', category: 'all', status: 'all' })
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showAudit, setShowAudit] = useState(false)
  const [auditLogs, setAuditLogs] = useState([])
  const [toasts, setToasts] = useState([])
  const [loading, setLoading] = useState(true)

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.keyword) params.set('keyword', filters.keyword)
      if (filters.category !== 'all') params.set('category', filters.category)
      if (filters.status !== 'all') params.set('status', filters.status)

      const res = await apiClient.get(`/api/items?${params}`)
      setItems(res.data)
    } catch (err) {
      if (err.response?.status === 401) router.push('/login')
    }
  }, [filters])

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/items/metrics')
      setMetrics(res.data)
    } catch (err) {}
  }, [])

  useEffect(() => {
    const userData = Cookies.get('user')
    if (!userData || !getToken()) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!loading) {
      fetchItems()
      fetchMetrics()
    }
  }, [loading, filters])

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await apiClient.put(`/api/items/${form.id}`, form)
        addToast('Item updated successfully')
      } else {
        await apiClient.post('/api/items', form)
        addToast('Item added successfully')
      }
      setShowModal(false)
      setEditItem(null)
      fetchItems()
      fetchMetrics()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save item', 'error')
    }
  }

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      await apiClient.delete(`/api/items/${item.id}`)
      addToast('Item deleted')
      fetchItems()
      fetchMetrics()
    } catch (err) {
      addToast('Failed to delete item', 'error')
    }
  }

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/api/items/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'techit-inventory.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      addToast('CSV exported successfully')
    } catch (err) {
      addToast('Export failed', 'error')
    }
  }

  const handleOpenAudit = async () => {
    try {
      const res = await apiClient.get('/api/audit')
      setAuditLogs(res.data)
      setShowAudit(true)
    } catch (err) {
      addToast('Failed to load audit log', 'error')
    }
  }

  const handleLogout = () => {
    Cookies.remove('token')
    Cookies.remove('user')
    router.push('/login')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtle }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg }}>
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Navbar */}
      <nav style={{
        height: 60, background: 'rgba(15,15,15,0.95)',
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>TechIT</span>
          <span style={{
            background: colors.successBg, border: `1px solid ${colors.successBorder}`,
            color: colors.success, padding: '3px 10px',
            borderRadius: 100, fontSize: 11, fontWeight: 600,
          }}>v2.0</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user?.role === 'admin' && (
            <>
              <button onClick={handleOpenAudit} style={{
                padding: '7px 14px', background: colors.card,
                border: `1px solid ${colors.border}`, color: colors.muted,
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>Audit Log</button>
              <button onClick={handleExport} style={{
                padding: '7px 14px', background: colors.card,
                border: `1px solid ${colors.border}`, color: colors.muted,
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>Export CSV</button>
              <button onClick={() => { setEditItem(null); setShowModal(true) }} style={{
                padding: '7px 14px', background: colors.success,
                border: 'none', color: '#000',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}>+ Add Item</button>
            </>
          )}
          <span style={{ fontSize: 12, color: colors.subtle, marginLeft: 8 }}>
            {user?.username} {user?.role === 'admin' ? '(Admin)' : ''}
          </span>
          <button onClick={handleLogout} style={{
            padding: '7px 14px', background: 'none',
            border: `1px solid ${colors.border}`, color: colors.subtle,
            borderRadius: 7, cursor: 'pointer', fontSize: 12,
          }}>Logout</button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>

        <StatCards metrics={metrics} />
        <Charts metrics={metrics} />

        {/* Filters */}
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: 20, marginBottom: 16,
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>Search</label>
            <input
              value={filters.keyword}
              onChange={e => setFilters(p => ({ ...p, keyword: e.target.value }))}
              placeholder="Search by name, SKU, supplier..."
              style={{
                ...inputStyle,
                marginTop: 0,
                padding: '10px 14px',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>Category</label>
            <select
              value={filters.category}
              onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
              style={{
                ...inputStyle,
                marginTop: 0,
                padding: '10px 14px',
                fontSize: 14,
              }}
            >
              <option value="all">All Categories</option>
              {metrics.categories?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              style={{
                ...inputStyle,
                marginTop: 0,
                padding: '10px 14px',
                fontSize: 14,
              }}
            >
              <option value="all">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Items count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ color: colors.subtle, fontSize: 13 }}>{items.length} item{items.length !== 1 ? 's' : ''} found</p>
        </div>

        <ItemsTable
          items={items}
          role={user?.role}
          onEdit={(item) => { setEditItem(item); setShowModal(true) }}
          onDelete={handleDelete}
        />
      </div>

      {showModal && (
        <ItemModal
          item={editItem}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditItem(null) }}
        />
      )}

      {showAudit && (
        <AuditLog logs={auditLogs} onClose={() => setShowAudit(false)} />
      )}
    </div>
  )
}
