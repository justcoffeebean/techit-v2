'use client'
import { useState, useEffect } from 'react'
import { inputStyleCompact, labelStyleBlock, modalOverlayStyle, cardStyle, colors } from '../lib/styles'

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

  return (
    <div style={modalOverlayStyle}>
      <div style={{
        ...cardStyle,
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {item?.id ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: colors.subtle,
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyleBlock}>Product Name *</label>
            <input name="name" value={form.name} onChange={handleChange} style={inputStyleCompact} placeholder="e.g. MacBook Pro 14" />
          </div>
          <div>
            <label style={labelStyleBlock}>SKU *</label>
            <input name="sku" value={form.sku} onChange={handleChange} style={inputStyleCompact} placeholder="e.g. MBP-14-M3" />
          </div>
          <div>
            <label style={labelStyleBlock}>Category *</label>
            <input name="category" value={form.category} onChange={handleChange} style={inputStyleCompact} placeholder="e.g. Laptops" />
          </div>
          <div>
            <label style={labelStyleBlock}>Quantity</label>
            <input name="quantity" type="number" value={form.quantity} onChange={handleChange} style={inputStyleCompact} min="0" />
          </div>
          <div>
            <label style={labelStyleBlock}>Price ($)</label>
            <input name="price" type="number" value={form.price} onChange={handleChange} style={inputStyleCompact} min="0" step="0.01" />
          </div>
          <div>
            <label style={labelStyleBlock}>Location</label>
            <input name="location" value={form.location} onChange={handleChange} style={inputStyleCompact} placeholder="e.g. Warehouse A" />
          </div>
          <div>
            <label style={labelStyleBlock}>Supplier</label>
            <input name="supplier" value={form.supplier} onChange={handleChange} style={inputStyleCompact} placeholder="e.g. Apple Inc." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyleBlock}>Low Stock Threshold</label>
            <input name="low_stock_threshold" type="number" value={form.low_stock_threshold} onChange={handleChange} style={inputStyleCompact} min="1" />
            <p style={{ fontSize: 11, color: colors.subtle, marginTop: 4 }}>Alert will trigger when quantity drops to or below this number</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: colors.bg,
            border: `1px solid ${colors.border}`, color: colors.muted,
            borderRadius: 8, cursor: 'pointer', fontSize: 14,
          }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{
            padding: '10px 20px', background: colors.success,
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
