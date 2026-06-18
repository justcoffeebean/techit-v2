const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'

const mockFrom = jest.fn()
jest.mock('../../services/supabase', () => ({
  from: (...args) => mockFrom(...args),
}))

const express = require('express')
const auditRoutes = require('../../routes/audit')
const app = express()
app.use(express.json())
app.use('/api/audit', auditRoutes)

const http = require('http')
let server
let baseUrl

const adminToken = jwt.sign({ id: 'admin-1', username: 'admin', role: 'admin' }, process.env.JWT_SECRET)
const userToken = jwt.sign({ id: 'user-1', username: 'viewer', role: 'user' }, process.env.JWT_SECRET)

beforeAll((done) => {
  server = app.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`
    done()
  })
})

afterAll((done) => {
  server.close(done)
})

beforeEach(() => {
  jest.clearAllMocks()
})

async function request(method, path, { token } = {}) {
  const url = `${baseUrl}${path}`
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(data) })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

describe('GET /api/audit', () => {
  it('returns 401 without a token', async () => {
    const res = await request('GET', '/api/audit')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request('GET', '/api/audit', { token: userToken })
    expect(res.status).toBe(403)
  })

  it('returns audit logs for admin users', async () => {
    const mockLogs = [
      { id: '1', username: 'admin', action: 'ADD_ITEM', item_name: 'Widget', created_at: '2024-01-01' },
      { id: '2', username: 'admin', action: 'DELETE_ITEM', item_name: 'Gadget', created_at: '2024-01-02' },
    ]
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
        }),
      }),
    })

    const res = await request('GET', '/api/audit', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].action).toBe('ADD_ITEM')
  })

  it('returns 500 when supabase returns an error', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    const res = await request('GET', '/api/audit', { token: adminToken })
    expect(res.status).toBe(500)
  })
})
