'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../lib/useTheme'

/**
 * Camera barcode scanner.
 *
 * @zxing/library is imported lazily inside the effect rather than at module
 * scope: it touches browser APIs, and a static import would pull it into the
 * server bundle during Next's prerender.
 */
export default function BarcodeScanner({ onDetected, onClose }) {
  const { colors, isDark } = useTheme()
  const videoRef = useRef(null)
  const controlsRef = useRef(null)

  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState(null)
  const [manualSku, setManualSku] = useState('')

  // Guards against a late decode firing after the modal has closed
  const handledRef = useRef(false)

  const handleResult = useCallback((text) => {
    if (handledRef.current) return
    handledRef.current = true
    onDetected(String(text).trim())
  }, [onDetected])

  useEffect(() => {
    let cancelled = false
    let reader = null

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library')

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser does not support camera access')
        }

        reader = new BrowserMultiFormatReader()

        // Prompt for permission before enumerating, otherwise device labels
        // come back empty and the picker is unusable.
        const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        probe.getTracks().forEach(t => t.stop())

        const cameras = (await navigator.mediaDevices.enumerateDevices())
          .filter(d => d.kind === 'videoinput')

        if (cancelled) return
        setDevices(cameras)

        // Prefer a rear-facing camera, which is what a barcode is held up to
        const rear = cameras.find(d => /back|rear|environment/i.test(d.label))
        const chosen = deviceId || rear?.deviceId || cameras[0]?.deviceId || null
        setDeviceId(chosen)

        await reader.decodeFromVideoDevice(chosen, videoRef.current, (result, err) => {
          if (result) handleResult(result.getText())
          // NotFoundException fires on every frame without a barcode, so it
          // is expected noise rather than a failure worth surfacing.
        })

        controlsRef.current = reader
        if (!cancelled) setStarting(false)
      } catch (err) {
        if (cancelled) return
        const message = err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow access, or type the SKU below.'
          : err?.message || 'Could not start the camera'
        setError(message)
        setStarting(false)
      }
    }

    start()

    return () => {
      cancelled = true
      try {
        if (controlsRef.current?.reset) controlsRef.current.reset()
        if (reader?.reset) reader.reset()
      } catch {
        // Teardown races with an in-flight decode; nothing useful to do.
      }
      // Stop any track the reader left running, so the camera light goes out.
      const stream = videoRef.current?.srcObject
      if (stream?.getTracks) stream.getTracks().forEach(t => t.stop())
    }
  }, [deviceId, handleResult])

  const submitManual = () => {
    const sku = manualSku.trim()
    if (sku) handleResult(sku)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: 20,
    }}>
      <div style={{
        background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>Scan a barcode</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: colors.subtle,
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Viewfinder */}
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '4 / 3',
          background: '#000', borderRadius: 12, overflow: 'hidden',
          border: `1px solid ${colors.border}`,
        }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
            playsInline
          />

          {/* Alignment guide */}
          {!error && !starting && (
            <div style={{
              position: 'absolute', inset: '25% 12%',
              border: `2px solid ${colors.success}`, borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }} />
          )}

          {(starting || error) && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24, textAlign: 'center',
            }}>
              <p style={{ color: error ? colors.error : colors.subtle, fontSize: 13 }}>
                {error || 'Starting camera...'}
              </p>
            </div>
          )}
        </div>

        {devices.length > 1 && !error && (
          <select
            value={deviceId || ''}
            onChange={e => { setStarting(true); setDeviceId(e.target.value) }}
            style={{
              width: '100%', marginTop: 12, padding: '8px 12px',
              background: colors.inputBg, border: `1px solid ${colors.border}`,
              borderRadius: 8, color: colors.text, fontSize: 13, outline: 'none',
            }}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}

        {/* Manual entry — the fallback when the camera is unavailable or the
            barcode is damaged. */}
        <div style={{ marginTop: 16 }}>
          <p style={{
            fontSize: 12, fontWeight: 600, color: colors.subtle,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
          }}>Or enter a SKU</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={manualSku}
              onChange={e => setManualSku(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitManual()}
              placeholder="e.g. MBP-14-M3"
              style={{
                flex: 1, padding: '10px 14px',
                background: colors.inputBg, border: `1px solid ${colors.border}`,
                borderRadius: 8, color: colors.text, fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={submitManual}
              style={{
                padding: '10px 18px', background: colors.success,
                border: 'none', color: isDark ? '#000' : '#fff',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}
            >Look up</button>
          </div>
        </div>
      </div>
    </div>
  )
}
