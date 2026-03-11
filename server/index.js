const express = require('express')
const cors = require('cors')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const itemRoutes = require('./routes/items')
const auditRoutes = require('./routes/audit')

const app = express()

app.use(cors({ origin: '*', credentials: false }))
app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'TechIT server running' }))

app.use('/api/auth', authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/audit', auditRoutes)

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`TechIT server running on http://localhost:${PORT}`)
})