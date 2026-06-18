const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'

// Mock supabase
const mockFrom = jest.fn()
jest.mock('../../services/supabase', () => ({
  from: (...args) => mockFrom(...args),
}))

// Mock audit service
jest.mock('../../services/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

// Mock email service
jest.mock('../../services/email', () => ({
  sendLowStockAlert: jest.fn().mockResolvedValue(undefined),
}))

const { logAction } = require('../../services/audit')
const { sendLowStockAlert } = require('../../services/email')

const express = require('express')
const itemRoutes = require('../../routes/items')
const app = express()
app.use(express.json())
app.use('/api/items', itemRoutes)

const http = require('http')
let server
let baseUrl

const adminPayload = { id: 'admin-1', username: 'admin', role: 'admin' }
const userPayload = { id: 'user-1', username: 'viewer', role: 'user' }
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
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        const ct = res.headers['content-type'] || ''
        const parsed = ct.includes('json') ? JSON.parse(data) : data
        resolve({ status: res.statusCode, body: parsed, headers: res.headers })
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// --- computeStatus (tested indirectly through GET responses) ---

describe('GET /api/items', () => {
  it('returns 401 without a token', async () => {
    const res = await request('GET', '/api/items')
    expect(res.status).toBe(401)
  })

  it('returns items with computed status', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              { id: '1', name: 'A', quantity: 50, low_stock_threshold: 10, category: 'Electronics' },
              { id: '2', name: 'B', quantity: 5, low_stock_threshold: 10, category: 'Electronics' },
              { id: '3', name: 'C', quantity: 0, low_stock_threshold: 10, category: 'Office' },
            ],
            error: null,
          }),
        }),
        order: jest.fn().mockResolvedValue({
          data: [
            { id: '1', name: 'A', quantity: 50, low_stock_threshold: 10, category: 'Electronics' },
            { id: '2', name: 'B', quantity: 5, low_stock_threshold: 10, category: 'Electronics' },
            { id: '3', name: 'C', quantity: 0, low_stock_threshold: 10, category: 'Office' },
          ],
          error: null,
        }),
      }),
    })

    const res = await request('GET', '/api/items', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body[0].status).toBe('In Stock')
    expect(res.body[1].status).toBe('Low Stock')
    expect(res.body[2].status).toBe('Out of Stock')
  })

  it('filters items by status query param', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            { id: '1', name: 'A', quantity: 50, low_stock_threshold: 10, category: 'Electronics' },
            { id: '2', name: 'B', quantity: 0, low_stock_threshold: 10, category: 'Office' },
          ],
          error: null,
        }),
      }),
    })

    const res = await request('GET', '/api/items?status=Out%20of%20Stock', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('B')
  })
})

describe('GET /api/items/metrics', () => {
  it('returns correct metric calculations', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: [
          { id: '1', name: 'A', quantity: 50, low_stock_threshold: 10, price: 10.00, category: 'Electronics' },
          { id: '2', name: 'B', quantity: 5, low_stock_threshold: 10, price: 20.00, category: 'Electronics' },
          { id: '3', name: 'C', quantity: 0, low_stock_threshold: 10, price: 30.00, category: 'Office' },
        ],
        error: null,
      }),
    })

    const res = await request('GET', '/api/items/metrics', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.body.total_items).toBe(3)
    expect(res.body.low_stock).toBe(1)
    expect(res.body.out_of_stock).toBe(1)
    // total_value = 50*10 + 5*20 + 0*30 = 600
    expect(res.body.total_value).toBe('600.00')
    expect(res.body.by_status).toEqual({
      'In Stock': 1,
      'Low Stock': 1,
      'Out of Stock': 1,
    })
    expect(res.body.by_category.Electronics.count).toBe(2)
    expect(res.body.by_category.Office.count).toBe(1)
  })
})

describe('POST /api/items', () => {
  it('returns 403 when a non-admin user tries to create an item', async () => {
    const res = await request('POST', '/api/items', {
      token: userToken,
      body: { name: 'X', sku: 'X-001', category: 'Test' },
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'X' },
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Name, SKU and category are required')
  })

  it('creates an item and logs the action', async () => {
    const newItem = {
      id: 'item-1', name: 'Widget', sku: 'W-001', category: 'Parts',
      quantity: 50, price: 9.99, low_stock_threshold: 10,
    }
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: newItem, error: null }),
        }),
      }),
    })

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'Widget', sku: 'W-001', category: 'Parts', quantity: 50, price: 9.99 },
    })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Widget')
    expect(res.body.status).toBe('In Stock')
    expect(logAction).toHaveBeenCalledWith('admin-1', 'admin', 'ADD_ITEM', 'item-1', 'Widget', expect.any(Object))
  })

  it('sends low stock alert when new item is low stock', async () => {
    const newItem = {
      id: 'item-2', name: 'Gadget', sku: 'G-001', category: 'Parts',
      quantity: 3, price: 5.00, low_stock_threshold: 10,
    }
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: newItem, error: null }),
        }),
      }),
    })

    await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'Gadget', sku: 'G-001', category: 'Parts', quantity: 3, price: 5 },
    })

    expect(sendLowStockAlert).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when SKU already exists', async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'duplicate key value violates unique constraint' },
          }),
        }),
      }),
    })

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'Dup', sku: 'EXISTING', category: 'Parts' },
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SKU already exists')
  })
})

describe('PUT /api/items/:id', () => {
  it('updates an item and logs the action', async () => {
    const prevItem = { id: 'item-1', name: 'Widget', quantity: 50, price: 9.99, low_stock_threshold: 10 }
    const updatedItem = { ...prevItem, quantity: 3, price: 9.99, low_stock_threshold: 10 }

    // First call: from('techit_items').select('*').eq('id',...).single() -> prev
    // Second call: from('techit_items').update(...).eq('id',...).select().single() -> updated
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: prevItem }),
            }),
          }),
        }
      }
      return {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: updatedItem, error: null }),
            }),
          }),
        }),
      }
    })

    const res = await request('PUT', '/api/items/item-1', {
      token: adminToken,
      body: { name: 'Widget', sku: 'W-001', category: 'Parts', quantity: 3, price: 9.99 },
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Low Stock')
    expect(logAction).toHaveBeenCalledWith(
      'admin-1', 'admin', 'UPDATE_ITEM', 'item-1', 'Widget',
      expect.objectContaining({ before: expect.any(Object), after: expect.any(Object) })
    )
  })

  it('sends low stock alert when status changes from In Stock to Low Stock', async () => {
    const prevItem = { id: 'item-1', name: 'Widget', quantity: 50, low_stock_threshold: 10 }
    const updatedItem = { ...prevItem, quantity: 2, low_stock_threshold: 10, price: 5 }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: prevItem }),
            }),
          }),
        }
      }
      return {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: updatedItem, error: null }),
            }),
          }),
        }),
      }
    })

    await request('PUT', '/api/items/item-1', {
      token: adminToken,
      body: { name: 'Widget', sku: 'W-001', category: 'Parts', quantity: 2, price: 5 },
    })

    expect(sendLowStockAlert).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /api/items/:id', () => {
  it('deletes an item and logs the action', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { name: 'Widget' } }),
            }),
          }),
        }
      }
      return {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }
    })

    const res = await request('DELETE', '/api/items/item-1', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(logAction).toHaveBeenCalledWith('admin-1', 'admin', 'DELETE_ITEM', 'item-1', 'Widget', null)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request('DELETE', '/api/items/item-1', { token: userToken })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/items/export', () => {
  it('returns CSV content with correct headers', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            { name: 'Widget', sku: 'W-001', category: 'Parts', quantity: 50, price: 9.99, location: 'A1', supplier: 'Acme', low_stock_threshold: 10, created_at: '2024-01-01' },
          ],
          error: null,
        }),
      }),
    })

    const res = await request('GET', '/api/items/export', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('techit-inventory.csv')
    expect(res.body).toContain('Widget')
    expect(res.body).toContain('W-001')
  })

  it('returns 500 when supabase returns an error', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB connection lost' },
        }),
      }),
    })

    const res = await request('GET', '/api/items/export', { token: adminToken })
    expect(res.status).toBe(500)
  })
})

describe('GET /api/items - error paths', () => {
  it('returns 500 when supabase returns an error on list', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      }),
    })

    const res = await request('GET', '/api/items', { token: adminToken })
    expect(res.status).toBe(500)
  })

  it('returns 500 when supabase returns an error on metrics', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      }),
    })

    const res = await request('GET', '/api/items/metrics', { token: adminToken })
    expect(res.status).toBe(500)
  })
})

describe('GET /api/items - category filter', () => {
  it('filters items by category', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              { id: '1', name: 'A', quantity: 50, low_stock_threshold: 10, category: 'Electronics' },
            ],
            error: null,
          }),
        }),
      }),
    })

    const res = await request('GET', '/api/items?category=Electronics', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].category).toBe('Electronics')
  })
})

describe('DELETE /api/items/:id - error path', () => {
  it('returns 500 when delete fails', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { name: 'Widget' } }),
            }),
          }),
        }
      }
      return {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
        }),
      }
    })

    const res = await request('DELETE', '/api/items/item-1', { token: adminToken })
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/items/:id - error path', () => {
  it('returns 500 when update fails', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'item-1', quantity: 10, low_stock_threshold: 10 } }),
            }),
          }),
        }
      }
      return {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
            }),
          }),
        }),
      }
    })

    const res = await request('PUT', '/api/items/item-1', {
      token: adminToken,
      body: { name: 'Widget', sku: 'W-001', category: 'Parts', quantity: 3, price: 9.99 },
    })
    expect(res.status).toBe(500)
  })
})

describe('computeStatus (integration via endpoints)', () => {
  it('marks quantity=0 as Out of Stock', async () => {
    const item = { id: '1', name: 'A', quantity: 0, low_stock_threshold: 10, price: 5, category: 'X' }
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: item, error: null }),
        }),
      }),
    })

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'A', sku: 'A-1', category: 'X', quantity: 0 },
    })
    expect(res.body.status).toBe('Out of Stock')
  })

  it('marks quantity <= threshold as Low Stock', async () => {
    const item = { id: '2', name: 'B', quantity: 10, low_stock_threshold: 10, price: 5, category: 'X' }
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: item, error: null }),
        }),
      }),
    })

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'B', sku: 'B-1', category: 'X', quantity: 10 },
    })
    expect(res.body.status).toBe('Low Stock')
  })

  it('marks quantity > threshold as In Stock', async () => {
    const item = { id: '3', name: 'C', quantity: 11, low_stock_threshold: 10, price: 5, category: 'X' }
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: item, error: null }),
        }),
      }),
    })

    const res = await request('POST', '/api/items', {
      token: adminToken,
      body: { name: 'C', sku: 'C-1', category: 'X', quantity: 11 },
    })
    expect(res.body.status).toBe('In Stock')
  })
})
