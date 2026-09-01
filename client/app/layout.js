import './globals.css'
import { ThemeProvider } from './lib/useTheme'

/**
 * Runs before React hydrates: stamps <html data-theme> from localStorage or
 * the OS preference so the first paint already uses the right palette and
 * there is no flash of the wrong theme.
 */
const themeBootstrap = `
(function() {
  try {
    var stored = localStorage.getItem('techit-theme');
    if (stored !== 'dark' && stored !== 'light') {
      stored = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', stored);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`

export const metadata = {
  title: 'TechIT Inventory',
  description: 'Smart Inventory Management System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
