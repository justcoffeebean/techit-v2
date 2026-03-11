'use client'
import { useState, useEffect } from 'react'

export default function ItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', sku: '', category: '', quantity: 0,
    price: 0, location: '', supplier: '', low_stock_threshold: 10,
  })

  useEffect(() => {
    if (item) setForm(item)
  }, [item])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    background: '#0f0f0f', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#fff', fontSize: 14,
    outline: 'none',
  }

  const labelStyle = {
    display: 'block', marginBottom: 6,
    fontSize: 12, fontWeight: 600,
    color: '#555', textTransform: 'uppercase', letterSpacing: 0.5,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #2a2a2a',
        borderRadius: 16, padding: 32, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {item?.id ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#555',
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Product Name *</label>
            <input name="name" value={form.name} onChange={handleChange} style={inputStyle} placeholder="e.g. MacBook Pro 14" />
          </div>
          <div>
            <label style={labelStyle}>SKU *</label>
            <input name="sku" value={form.sku} onChange={handleChange} style={inputStyle} placeholder="e.g. MBP-14-M3" />
          </div>
          <div>
            <label style={labelStyle}>Category *</label>
            <input name="category" value={form.category} onChange={handleChange} style={inputStyle} placeholder="e.g. Laptops" />
          </div>
          <div>
            <label style={labelStyle}>Quantity</label>
            <input name="quantity" type="number" value={form.quantity} onChange={handleChange} style={inputStyle} min="0" />
          </div>
          <div>
            <label style={labelStyle}>Price ($)</label>
            <input name="price" type="number" value={form.price} onChange={handleChange} style={inputStyle} min="0" step="0.01" />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input name="location" value={form.location} onChange={handleChange} style={inputStyle} placeholder="e.g. Warehouse A" />
          </div>
          <div>
            <label style={labelStyle}>Supplier</label>
            <input name="supplier" value={form.supplier} onChange={handleChange} style={inputStyle} placeholder="e.g. Apple Inc." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Low Stock Threshold</label>
            <input name="low_stock_threshold" type="number" value={form.low_stock_threshold} onChange={handleChange} style={inputStyle} min="1" />
            <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Alert will trigger when quantity drops to or below this number</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: '#0f0f0f',
            border: '1px solid #2a2a2a', color: '#888',
            borderRadius: 8, cursor: 'pointer', fontSize: 14,
          }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{
            padding: '10px 20px', background: '#4ade80',
            border: 'none', color: '#000',
            borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
          }}>
            {item?.id ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}