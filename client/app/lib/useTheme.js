'use client'
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { darkColors, lightColors } from './styles'

const STORAGE_KEY = 'techit-theme'
const THEME_DARK = 'dark'
const THEME_LIGHT = 'light'

const ThemeContext = createContext(null)

/**
 * Resolve the theme for the first client render.
 *
 * Reads the attribute the bootstrap script in layout.js already stamped on
 * <html>, so the hook agrees with what has been painted. Falling back to
 * localStorage and prefers-color-scheme covers the case where that script
 * did not run.
 */
function getInitialTheme() {
  if (typeof window === 'undefined') return THEME_DARK

  const stamped = document.documentElement.getAttribute('data-theme')
  if (stamped === THEME_DARK || stamped === THEME_LIGHT) return stamped

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === THEME_DARK || stored === THEME_LIGHT) return stored
  } catch {
    // Storage can throw in private mode; fall through to the media query.
  }

  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return THEME_LIGHT
  }
  return THEME_DARK
}

/**
 * Holds the one theme value the whole tree shares.
 *
 * This has to be a provider rather than a plain hook: useState is per-caller,
 * so a hook alone gives every component its own private copy and toggling in
 * the navbar leaves the rest of the page on the old palette.
 */
export function ThemeProvider({ children }) {
  // Start dark on the server and on the first client render so markup matches
  // and hydration does not warn; the effect below corrects it immediately.
  const [theme, setTheme] = useState(THEME_DARK)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTheme(getInitialTheme())
    setHydrated(true)
  }, [])

  // Persist and reflect onto <html> so CSS variables follow the choice.
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // A failed write only costs persistence, so the toggle still works.
    }
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme, hydrated])

  // Follow the OS while the user has not made an explicit choice.
  useEffect(() => {
    if (!window.matchMedia) return

    let stored = null
    try {
      stored = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      // Treat an unreadable store as no explicit choice.
    }
    if (stored === THEME_DARK || stored === THEME_LIGHT) return

    const query = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = e => setTheme(e.matches ? THEME_LIGHT : THEME_DARK)

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === THEME_DARK ? THEME_LIGHT : THEME_DARK))
  }, [])

  const setThemeExplicit = useCallback(next => {
    if (next === THEME_DARK || next === THEME_LIGHT) setTheme(next)
  }, [])

  const value = useMemo(() => ({
    theme,
    colors: theme === THEME_DARK ? darkColors : lightColors,
    isDark: theme === THEME_DARK,
    toggleTheme,
    setTheme: setThemeExplicit,
  }), [theme, toggleTheme, setThemeExplicit])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Read the shared theme. Every consumer gets the same value, so a toggle
 * anywhere repaints the whole tree.
 */
export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider — add it in app/layout.js')
  }

  return context
}
