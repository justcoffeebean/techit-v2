/** Shared color palette used across the app */
export const colors = {
  bg: '#0f0f0f',
  card: '#1a1a1a',
  border: '#2a2a2a',
  text: '#ffffff',
  muted: '#888',
  subtle: '#555',
  success: '#4ade80',
  successBg: '#0d2e1f',
  successBorder: '#1a5c3a',
  warning: '#fb923c',
  warningBg: '#2e1f0d',
  warningBorder: '#6e3a1a',
  error: '#f87171',
  errorBg: '#3a0d0d',
  errorBorder: '#6e1a1a',
  info: '#60a5fa',
}

/** Standard text input style for dark forms */
export const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  color: colors.text,
  fontSize: 15,
  outline: 'none',
  marginTop: 6,
}

/** Compact variant for modals/inline forms */
export const inputStyleCompact = {
  ...inputStyle,
  padding: '10px 14px',
  fontSize: 14,
  marginTop: 0,
}

/** Uppercase label style for form fields */
export const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: colors.subtle,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

/** Block-level label (with display: block and spacing) */
export const labelStyleBlock = {
  ...labelStyle,
  display: 'block',
  marginBottom: 6,
}

/** Error alert box */
export const errorAlertStyle = {
  padding: '12px 16px',
  background: colors.errorBg,
  border: `1px solid ${colors.errorBorder}`,
  borderRadius: 8,
  color: colors.error,
  fontSize: 14,
  marginBottom: 16,
}

/** Success alert box */
export const successAlertStyle = {
  padding: '12px 16px',
  background: colors.successBg,
  border: `1px solid ${colors.successBorder}`,
  borderRadius: 8,
  color: colors.success,
  fontSize: 14,
  marginBottom: 16,
}

/** Full-page centered wrapper (auth pages, loading screens) */
export const pageWrapperStyle = {
  minHeight: '100vh',
  background: colors.bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}

/** Modal overlay */
export const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20,
}

/** Card container (used in modals, auth forms) */
export const cardStyle = {
  background: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  padding: 32,
  width: '100%',
}
