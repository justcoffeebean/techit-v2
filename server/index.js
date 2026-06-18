const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters')
  process.exit(1)
}

const authRoutes = require('./routes/auth')
const itemRoutes = require('./routes/items')
const auditRoutes = require('./routes/audit')

const app = express()

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'https://techit-v2.vercel.app',
      'https://techit-eight-.vercel.app',
    ]

app.use(cors({ 
  origin: allowedOrigins,
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
})

app.get('/health', (req, res) => res.json({ status: 'TechIT server running' }))

app.use('/api/auth', authLimiter, authRoutes)
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