'use client'
import { colors } from '../lib/styles'

const toastStyles = {
  success: { background: colors.successBg, border: `1px solid ${colors.successBorder}`, color: colors.success },
  error: { background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, color: colors.error },
  info: { background: colors.card, border: `1px solid ${colors.border}`, color: colors.text },
}

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
          fontSize: 14,
          fontWeight: 500,
          ...(toastStyles[toast.type] || toastStyles.info),
        }}>
          {toast.type === 'success' ? '✓ ' : toast.type === 'error' ? '✕ ' : 'ℹ '}{toast.message}
        </div>
      ))}
    </div>
  )
}
