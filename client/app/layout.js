import './globals.css'

export const metadata = {
  title: 'TechIT Inventory',
  description: 'Smart Inventory Management System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}