const jwt = require('jsonwebtoken')
const { mockTable, mockTables } = require('../helpers/supabaseMock')

process.env.JWT_SECRET = 'test-secret'

const mockFrom = jest.fn()
jest.mock('../../services/supabase', () => ({
  from: (...args) => mockFrom(...args),
}))

jest.mock('../../services/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../services/email', () => ({
  sendLowStockAlert: jest.fn().mockResolvedValue(undefined),
}))

// Movement and reorder writes are fire-and-forget side effects of a stock
// change; these tests assert the response, so both are stubbed out.
jest.mock('../../services/movements', () => ({
  recordMovement: jest.fn().mockResolvedValue(null),
  recordQuantityChange: jest.fn().mockResolvedValue(null),
}))

jest.mock('../../services/reorder', () => ({
  triggerReorderIfLow: jest.fn().mockResolvedValue([]),
}))

const { logAction } = require('../../services/audit')
const { sendLowStockAlert } = require('../../services/email')
const { recordMovement, recordQuantityChange } = require('../../services/movements')
const { triggerReorderIfLow } = require('../../services/reorder')

const express = require('express')
const itemRoutes = require('../../routes/items')
const app = express()
app.use(express.json())
app.use('/api/items', itemRoutes)

const http = require('http')
let server
let baseUrl

// Every request is scoped to an organization, so the token must carry one.
const ORG = 'org-1'
const adminPayload = { id: 'admin-1', username: 'admin', role: 'admin', organization_id: ORG }
const userPayload = { id: 'user-1', username: 'viewer', role: 'user', organization_id: ORG }
const adminToken = jwt.sign(adminPayload, process.env.JWT_SECRET)
const userToken = jwt.sign(userPayload, process.env.JWT_SECRET)

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

async function request(method, path, { body, token } = {}) {
  const url = `${baseUrl}${path}`
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed = data
        try { parsed = JSON.parse(data) } catch { /* CSV and plain text */ }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers })
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

const ITEMS = [
  { id: '1', name: 'A', sku: 'SKU-A', quantity: 50, low_stock_threshold: 10, price: 10, cost_price: 5, category: 'Electronics' },
  { id: '2', name: 'B', sku: 'SKU-B', quantity: 5, low_stock_threshold: 10, price: 20, cost_price: 8, category: 'Electronics' },
  { id: '3', name: 'C', sku: 'SKU-C', quantity: 0, low_stock_threshold: 10, price: 30, cost_price: 12, category: 'Office' },
]

describe('GET /api/items', () => {
  it('returns 401 without a token', async () => {
    const res = await request('GET', '/api/items')
    expect(res.status).toBe(401)
  })

  it('returns items with computed status and pagination', async () => {
    mockFrom.mockImplementation(mockTable({ data: ITEMS, error: null, count: 3 }))

    const res = await request('GET', '/api/items', { token: adminToken })

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(3)
    expect(res.body.items[0].status).toBe('In Stock')
    expect(res.body.items[1].status).toBe('Low Stock')
    expect(res.body.items[2].status).toBe('Out of Stock')
    expect(res.body.pagination).toMatchObject({
      page: 1, limit: 20, total: 3, totalPages: 1,
      hasNextPage: false, hasPrevPage: false,
    })
  })

  it('filters items by status query param', async () => {
    mockFrom.mockImplementation(mockTable({ data: ITEMS, error: null, count: 3 }))

    const res = await request('GET', '/api/items?status=Out%20of%20Stock', { token: adminToken })

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('C')
  })

  it('scopes the query to the caller organization', async () => {
    const chain = { data: ITEMS, error: null, count: 3 }
    const eq = jest.fn()
    mockFrom.mockImplementation(() => {
      const c = mockTable(chain)()
      const originalEq = c.eq
      c.eq = jest.fn((col, val) => { eq(col, val); return originalEq(col, val) })
      return c
    })

    await request('GET', '/api/items', { token: adminToken })

    expect(eq).toHaveBeenCalledWith('organization_id', ORG)
  })

  it('clamps limit to the maximum', async () => {
    mockFrom.mockImplementation(mockTable({ data: ITEMS, error: null, count: 3 }))

    const res = await request('GET', '/api/items?limit=9999', { token: adminToken })

    expect(res.status).toBe(200)
    expect(res.body.pagination.limit).toBe(100)
  })

  it('returns 500 when supabase errors', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFrom.mockImplementation(mockTable({ data: null, error: { message: 'db down' }, count: null }))

    const res = await request('GET', '/api/items', { token: adminToken })

    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})

describe('GET /api/items/sku/:sku', () => {
  it('returns the item when the SKU matches', async () => {
    mockFrom.mockImplementation(mockTable({ data: ITEMS[0], error: null }))

    const res = await request('GET', '/api/items/sku/SKU-A', { token: adminToken })

    expect(res.status).toBe(200)
    expect(res.body.found).toBe(true)
    expect(res.body.item.name).toBe('A')
    expect(res.body.item.status).toBe('In Stock')
  })

  it('returns 404 with found:false when no item matches', async () => {
    mockFrom.mockImplementation(mockTable({ data: null, error: null }))

    const res = await request('GET', '/api/items/sku/NOPE', { token: adminToken })

    expect(res.status).toBe(404)
    expect(res.body.found).toBe(false)
    expect(res.body.sku).toBe('NOPE')
  })
})

describe('GET /api/items/metrics', () => {
  it('returns correct metric calculations', async () => {
    mockFrom.mockImplementation(mockTable({ data: ITEMS, error: null }))

    const res = await request('GET', '/api/items/metrics', { token: adminToken })

    expect(res.status).toBe(200)
    expect(res.body.total_items).toBe(3)
    expect(res.body.low_stock).toBe(1)
    expect(res.body.out_of_stock).toBe(1)
    // 50*10 + 5*20 + 0*30
    expect(res.body.total_value).toBe('600.00')
  })

  it('returns 500 when supabase errors', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFrom.mockImplementation(mockTable({ data: null, error: { message: 'boom' } }))

    const res = await request('GET', '/api/items/metrics', { token: adminToken })

    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})

describe('POST /api/items', () => {
  it('returns 403 when a non-admin tries to create an item', async () => {
    const res = await request('POST', '/api/items', {
      token: userToken,
      body: { name: 'X', sku: 'X-1', category: 'Misc' },
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'X' },
    })
    expect(res.status).toBe(400)
  })

  it('creates an item, logs the action and records opening stock', async () => {
    const created = { ...ITEMS[0], id: 'new-1', quantity: 25 }
    mockFrom.mockImplementation(mockTable({ data: created, error: null }))

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'A', sku: 'SKU-A', category: 'Electronics', quantity: 25, price: 10 },
    })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('In Stock')
    expect(logAction).toHaveBeenCalledWith(
      'admin-1', 'admin', 'ADD_ITEM', 'new-1', 'A', expect.any(Object), ORG
    )
    expect(recordMovement).toHaveBeenCalledWith(expect.objectContaining({
      movementType: 'received',
      quantityBefore: 0,
      quantityAfter: 25,
    }))
  })

  it('sends a low stock alert and triggers reorder when the new item is low', async () => {
    const created = { ...ITEMS[1], id: 'new-2', quantity: 2, low_stock_threshold: 10 }
    mockFrom.mockImplementation(mockTable({ data: created, error: null }))

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'B', sku: 'SKU-B', category: 'Electronics', quantity: 2 },
    })

    expect(res.status).toBe(201)
    expect(sendLowStockAlert).toHaveBeenCalled()
    expect(triggerReorderIfLow).toHaveBeenCalledWith(ORG, [created])
  })

  it('returns 400 when the SKU already exists', async () => {
    mockFrom.mockImplementation(mockTable({
      data: null, error: { message: 'duplicate key value violates unique constraint' },
    }))

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'A', sku: 'SKU-A', category: 'Electronics' },
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/SKU already exists/)
  })
})

describe('PUT /api/items/:id', () => {
  it('updates an item, logs it and records the quantity change', async () => {
    const updated = { ...ITEMS[0], quantity: 40 }
    mockFrom.mockImplementation(mockTable({ data: updated, error: null }))

    const res = await request('PUT', '/api/items/1', {
      token: adminToken,
      body: { name: 'A', sku: 'SKU-A', category: 'Electronics', quantity: 40, price: 10 },
    })

    expect(res.status).toBe(200)
    expect(logAction).toHaveBeenCalledWith(
      'admin-1', 'admin', 'UPDATE_ITEM', '1', 'A', expect.any(Object), ORG
    )
    expect(recordQuantityChange).toHaveBeenCalled()
  })

  it('returns 404 when the item is not in the caller organization', async () => {
    mockFrom.mockImplementation(mockTable({ data: null, error: { message: 'no rows' } }))

    const res = await request('PUT', '/api/items/other-org-item', {
      token: adminToken,
      body: { name: 'X', quantity: 1 },
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/items/:id', () => {
  it('deletes an item and logs the action', async () => {
    mockFrom.mockImplementation(mockTable({ data: { name: 'A' }, error: null }))

    const res = await request('DELETE', '/api/items/1', { token: adminToken })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(logAction).toHaveBeenCalledWith(
      'admin-1', 'admin', 'DELETE_ITEM', '1', 'A', null, ORG
    )
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request('DELETE', '/api/items/1', { token: userToken })
    expect(res.status).toBe(403)
  })

  it('returns 404 when the item does not exist', async () => {
    mockFrom.mockImplementation(mockTable({ data: null, error: { message: 'no rows' } }))

    const res = await request('DELETE', '/api/items/missing', { token: adminToken })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/items/export', () => {
  it('returns CSV content with the right headers', async () => {
    mockFrom.mockImplementation(mockTable({ data: ITEMS, error: null }))

    const res = await request('GET', '/api/items/export', { token: adminToken })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/techit-inventory\.csv/)
    expect(res.body).toContain('name')
  })

  it('returns 500 when supabase errors', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFrom.mockImplementation(mockTable({ data: null, error: { message: 'boom' } }))

    const res = await request('GET', '/api/items/export', { token: adminToken })

    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})
