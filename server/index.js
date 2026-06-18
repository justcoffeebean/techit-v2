const express = require('express')
const cors = require('cors')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const itemRoutes = require('./routes/items')
const auditRoutes = require('./routes/audit')

const app = express()

app.use(cors({ 
  origin: [
    'http://localhost:3000', // Local development
    'http://localhost:3001',
    'http://localhost:3002',
    'https://techit-v2.vercel.app',
    'https://techit-eight-.vercel.app',
  ],
  credentials: false,
}))
app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'TechIT server running' }))

app.use('/api/auth', authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/audit', auditRoutes)

// Global error handler — catches unhandled errors from route handlers
app.use((err, req, res, _next) => {
  console.error('Unhandled server error:', err.stack || err.message)
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  })
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`TechIT server running on http://localhost:${PORT}`)
})