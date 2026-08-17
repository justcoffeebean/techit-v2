/** Dark palette — current TechIT look. */
export const darkColors = {
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
  navBg: 'rgba(15,15,15,0.95)',
  inputBg: '#0f0f0f',
  tableRowAlt: '#161616',
}

/** Light palette — same shape, inverted neutrals, slightly darker green for contrast. */
export const lightColors = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  subtle: '#94a3b8',
  success: '#16a34a',
  successBg: '#dcfce7',
  successBorder: '#86efac',
  warning: '#ea580c',
  warningBg: '#ffedd5',
  warningBorder: '#fdba74',
  error: '#dc2626',
  errorBg: '#fee2e2',
  errorBorder: '#fca5a5',
  info: '#2563eb',
  navBg: 'rgba(248,250,252,0.95)',
  inputBg: '#f1f5f9',
  tableRowAlt: '#f8fafc',
}

/** Default export for legacy components — points to the dark palette. */
export const colors = darkColors

/** Standard text input style for dark forms. Works in light too (color values are theme-neutral). */
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
