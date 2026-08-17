'use client'
import { useState, useEffect, useCallback } from 'react'
import { darkColors, lightColors } from './styles'

const STORAGE_KEY = 'techit-theme'
const THEME_DARK = 'dark'
const THEME_LIGHT = 'light'

/**
 * Read the user's stored theme, falling back to prefers-color-scheme.
 * Only runs in the browser — returns THEME_DARK during SSR to match
 * the body's default background and avoid a white flash.
 */
function getInitialTheme() {
  if (typeof window === 'undefined') return THEME_DARK

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === THEME_DARK || stored === THEME_LIGHT) return stored

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return THEME_LIGHT
  }
  return THEME_DARK
}

/**
 * useTheme — returns the active palette and a toggle helper.
 * Writes the choice to localStorage and to <html data-theme="…"> so
 * globals.css can theme the body before paint.
 */
export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === THEME_DARK ? THEME_LIGHT : THEME_DARK))
  }, [])

  const colors = theme === THEME_DARK ? darkColors : lightColors

  return { theme, colors, toggleTheme, isDark: theme === THEME_DARK }
}
