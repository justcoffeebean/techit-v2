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
    'https://localhost:3001',
    'https://localhost:3002',
    'https://techit-v2.vercel.app',
  ],
  
}))
app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'TechIT server running' }))

app.use('/api/auth', authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/audit', auditRoutes)

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`TechIT server running on http://localhost:${PORT}`)
})