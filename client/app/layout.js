import './globals.css'

/**
 * Inline script that runs before React hydrates. It reads localStorage
 * (or prefers-color-scheme) and stamps <html data-theme="…"> so the body
 * uses the right background on first paint — no white flash.
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
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
