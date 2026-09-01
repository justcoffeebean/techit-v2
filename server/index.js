const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')
const { apiLimiter } = require('./middleware/rateLimiter')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const itemRoutes = require('./routes/items')
const auditRoutes = require('./routes/audit')
const salesRoutes = require('./routes/sales')
const expenseRoutes = require('./routes/expenses')
const invitationRoutes = require('./routes/invitations')
const movementRoutes = require('./routes/movements')
const purchaseOrderRoutes = require('./routes/purchaseOrders')

const app = express()

// Render terminates TLS at its proxy: trust one hop so req.ip is the real
// client address rather than the proxy's, which rate limiting keys on.
app.set('trust proxy', 1)

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

// Baseline limit for all API traffic; auth and expensive routes add their own.
app.use('/api', apiLimiter)

app.use('/api/auth', authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/movements', movementRoutes)
app.use('/api/purchase-orders', purchaseOrderRoutes)

// Must come after every route: an unmatched path falls through to the 404,
// and any thrown error to the handler.
app.use(notFoundHandler)
app.use(errorHandler)

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`TechIT server running on http://localhost:${PORT}`)
})