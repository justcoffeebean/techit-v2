const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const itemRoutes = require('./routes/items')
const auditRoutes = require('./routes/audit')
const salesRoutes = require('./routes/sales')
const expenseRoutes = require('./routes/expenses')
const invitationRoutes = require('./routes/invitations')

const app = express()

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.endsWith('.vercel.app') || origin.includes('localhost')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

// Use helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://techit-v2.onrender.com", "https://techit-v2.vercel.app"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))

app.use(express.json())
app.use(cookieParser())

app.get('/health', (req, res) => res.json({ status: 'TechIT server running' }))

app.use('/api/auth', authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/invitations', invitationRoutes)

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`TechIT server running on http://localhost:${PORT}`)
})