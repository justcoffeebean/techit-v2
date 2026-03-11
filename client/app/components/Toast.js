'use client'
import { useEffect } from 'react'

export default function Toast({ toasts, removeToast }) {
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map(toast => (
        <div key={toast.id} onClick={() => removeToast(toast.id)} style={{
          padding: '14px 20px',
          borderRadius: 10,
          cursor: 'pointer',
          animation: 'slideIn 0.3s ease forwards',
          minWidth: 280,
          background: toast.type === 'success' ? '#0d2e1f'
            : toast.type === 'error' ? '#3a0d0d'
            : '#1a1a1a',
          border: `1px solid ${toast.type === 'success' ? '#1a5c3a'
            : toast.type === 'error' ? '#6e1a1a'
            : '#2a2a2a'}`,
          color: toast.type === 'success' ? '#4ade80'
            : toast.type === 'error' ? '#f87171'
            : '#fff',
          fontSize: 14,
          fontWeight: 500,
        }}>
          {toast.type === 'success' ? '✓ ' : toast.type === 'error' ? '✕ ' : 'ℹ '}{toast.message}
        </div>
      ))}
    </div>
  )
}