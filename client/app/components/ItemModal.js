'use client'
import { useState, useEffect } from 'react'
import { useTheme } from '../lib/useTheme'

export default function ItemModal({ item, onSave, onClose }) {
  const { colors, isDark } = useTheme()
  const [form, setForm] = useState({
    name: '', sku: '', category: '', quantity: 0,
    price: 0, location: '', supplier: '', low_stock_threshold: 10,
  })

  // Merge rather than replace: a scan of an unknown barcode passes only
  // { sku }, and assigning that directly would leave the other fields
  // undefined and turn their inputs uncontrolled.
  useEffect(() => {
    if (item) setForm(prev => ({ ...prev, ...item }))
  }, [item])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
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
        maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
            {item?.id ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: colors.subtle,
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelSx}>Product Name *</label>
            <input name="name" value={form.name} onChange={handleChange} style={inputSx} placeholder="e.g. MacBook Pro 14" />
          </div>
          <div>
            <label style={labelSx}>SKU *</label>
            <input name="sku" value={form.sku} onChange={handleChange} style={inputSx} placeholder="e.g. MBP-14-M3" />
          </div>
          <div>
            <label style={labelSx}>Category *</label>
            <input name="category" value={form.category} onChange={handleChange} style={inputSx} placeholder="e.g. Laptops" />
          </div>
          <div>
            <label style={labelSx}>Quantity</label>
            <input name="quantity" type="number" value={form.quantity} onChange={handleChange} style={inputSx} min="0" />
          </div>
          <div>
            <label style={labelSx}>Price ($)</label>
            <input name="price" type="number" value={form.price} onChange={handleChange} style={inputSx} min="0" step="0.01" />
          </div>
          <div>
            <label style={labelSx}>Location</label>
            <input name="location" value={form.location} onChange={handleChange} style={inputSx} placeholder="e.g. Warehouse A" />
          </div>
          <div>
            <label style={labelSx}>Supplier</label>
            <input name="supplier" value={form.supplier} onChange={handleChange} style={inputSx} placeholder="e.g. Apple Inc." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelSx}>Low Stock Threshold</label>
            <input name="low_stock_threshold" type="number" value={form.low_stock_threshold} onChange={handleChange} style={inputSx} min="1" />
            <p style={{ fontSize: 11, color: colors.subtle, marginTop: 4 }}>Alert will trigger when quantity drops to or below this number</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: colors.inputBg,
            border: `1px solid ${colors.border}`, color: colors.muted,
            borderRadius: 8, cursor: 'pointer', fontSize: 14,
          }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{
            padding: '10px 20px', background: colors.success,
            border: 'none', color: isDark ? '#000' : '#fff',
            borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
          }}>
            {item?.id ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
