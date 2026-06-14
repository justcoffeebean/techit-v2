'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Cookies from 'js-cookie'
import dynamic from 'next/dynamic'
import StatCards from '../components/StatCards'
import ItemsTable from '../components/ItemsTable'
import ItemModal from '../components/ItemModal'
import AuditLog from '../components/AuditLog'
import Toast from '../components/Toast'

const Charts = dynamic(() => import('../components/Charts'), { ssr: false })

const API = 'https://techit-api.onrender.com'

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

  const getToken = () => Cookies.get('token')

  const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` })

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.keyword) params.set('keyword', filters.keyword)
      if (filters.category !== 'all') params.set('category', filters.category)
      if (filters.status !== 'all') params.set('status', filters.status)

      const res = await axios.get(`${API}/api/items?${params}`, { headers: authHeaders() })
      setItems(res.data)
    } catch (err) {
      if (err.response?.status === 401) router.push('/login')
    }
  }, [filters])

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/items/metrics`, { headers: authHeaders() })
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
        await axios.put(`${API}/api/items/${form.id}`, form, { headers: authHeaders() })
        addToast('Item updated successfully')
      } else {
        await axios.post(`${API}/api/items`, form, { headers: authHeaders() })
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
      await axios.delete(`${API}/api/items/${item.id}`, { headers: authHeaders() })
      addToast('Item deleted')
      fetchItems()
      fetchMetrics()
    } catch (err) {
      addToast('Failed to delete item', 'error')
    }
  }

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/api/items/export`, {
        headers: authHeaders(),
        responseType: 'blob',
      })
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
      const res = await axios.get(`${API}/api/audit`, { headers: authHeaders() })
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
      <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#555' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f' }}>
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Navbar */}
      <nav style={{
        height: 60, background: 'rgba(15,15,15,0.95)',
        backdropFilter: 'blur(10px)', borderBottom: '1px solid #2a2a2a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>📦 TechIT</span>
          <span style={{
            background: '#0d2e1f', border: '1px solid #1a5c3a',
            color: '#4ade80', padding: '3px 10px',
            borderRadius: 100, fontSize: 11, fontWeight: 600,
          }}>v2.0</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user?.role === 'admin' && (
            <>
              <button onClick={handleOpenAudit} style={{
                padding: '7px 14px', background: '#1a1a1a',
                border: '1px solid #2a2a2a', color: '#888',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>📋 Audit Log</button>
              <button onClick={handleExport} style={{
                padding: '7px 14px', background: '#1a1a1a',
                border: '1px solid #2a2a2a', color: '#888',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>⬇ Export CSV</button>
              <button onClick={() => { setEditItem(null); setShowModal(true) }} style={{
                padding: '7px 14px', background: '#4ade80',
                border: 'none', color: '#000',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}>+ Add Item</button>
            </>
          )}
          <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>
            👤 {user?.username} {user?.role === 'admin' ? '(Admin)' : ''}
          </span>
          <button onClick={handleLogout} style={{
            padding: '7px 14px', background: 'none',
            border: '1px solid #2a2a2a', color: '#555',
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
          background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 12, padding: 20, marginBottom: 16,
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Search</label>
            <input
              value={filters.keyword}
              onChange={e => setFilters(p => ({ ...p, keyword: e.target.value }))}
              placeholder="Search by name, SKU, supplier..."
              style={{
                width: '100%', padding: '10px 14px',
                background: '#0f0f0f', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Category</label>
            <select
              value={filters.category}
              onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px',
                background: '#0f0f0f', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
              }}
            >
              <option value="all">All Categories</option>
              {metrics.categories?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px',
                background: '#0f0f0f', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
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
          <p style={{ color: '#555', fontSize: 13 }}>{items.length} item{items.length !== 1 ? 's' : ''} found</p>
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