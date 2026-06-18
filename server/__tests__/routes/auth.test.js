const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'

// Supabase mock setup
const mockSelect = jest.fn()
const mockOr = jest.fn()
const mockLimit = jest.fn()
const mockInsert = jest.fn()
const mockSingle = jest.fn()

jest.mock('../../services/supabase', () => ({
  from: jest.fn(),
}))

const supabase = require('../../services/supabase')

// Build Express app with auth routes
const express = require('express')
const authRoutes = require('../../routes/auth')
const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

// Use Node's built-in test client
const http = require('http')
let server
let baseUrl

beforeAll((done) => {
  server = app.listen(0, () => {
    const { port } = server.address()
    baseUrl = `http://127.0.0.1:${port}`
    done()
  })
})

afterAll((done) => {
  server.close(done)
})

beforeEach(() => {
  jest.clearAllMocks()
})

async function request(method, path, body) {
  const url = `${baseUrl}${path}`
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }

  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(data) })
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

describe('POST /api/auth/login', () => {
  it('returns 400 when username or password is missing', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'admin' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Username and password required')
  })

  it('returns 401 when user is not found', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })

    const res = await request('POST', '/api/auth/login', { username: 'nobody', password: 'pass' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid credentials')
  })

  it('returns 401 when password is wrong', async () => {
    const hashed = await bcrypt.hash('correctpass', 10)
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: '1', username: 'admin', password: hashed, role: 'admin' }],
            error: null,
          }),
        }),
      }),
    })

    const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrongpass' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid credentials')
  })

  it('returns a JWT token on successful login', async () => {
    const hashed = await bcrypt.hash('admin123', 10)
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: '1', username: 'admin', password: hashed, role: 'admin' }],
            error: null,
          }),
        }),
      }),
    })

    const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user).toEqual({ id: '1', username: 'admin', role: 'admin' })

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET)
    expect(decoded.username).toBe('admin')
  })
})

describe('POST /api/auth/register', () => {
  it('returns 400 when fields are missing', async () => {
    const res = await request('POST', '/api/auth/register', { username: 'user1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('All fields required')
  })

  it('returns 400 when password is too short', async () => {
    const res = await request('POST', '/api/auth/register', {
      username: 'user1', email: 'user1@test.com', password: '123',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Password must be at least 6 characters')
  })

  it('returns 400 when username/email already exists', async () => {
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'duplicate key value violates unique constraint' },
          }),
        }),
      }),
    })

    const res = await request('POST', '/api/auth/register', {
      username: 'admin', email: 'admin@techit.com', password: 'password123',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Username or email already exists')
  })

  it('returns 500 when a non-unique DB error occurs on register', async () => {
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'connection refused' },
          }),
        }),
      }),
    })

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const res = await request('POST', '/api/auth/register', {
      username: 'newuser', email: 'new@test.com', password: 'password123',
    })
    expect(res.status).toBe(500)
    consoleSpy.mockRestore()
  })

  it('returns 500 when login encounters an unexpected error', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('unexpected crash')),
        }),
      }),
    })

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const res = await request('POST', '/api/auth/login', {
      username: 'admin', password: 'admin123',
    })
    expect(res.status).toBe(500)
    consoleSpy.mockRestore()
  })

  it('returns 201 on successful registration', async () => {
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: '2', username: 'newuser', email: 'new@test.com', role: 'user' },
            error: null,
          }),
        }),
      }),
    })

    const res = await request('POST', '/api/auth/register', {
      username: 'newuser', email: 'new@test.com', password: 'password123',
    })
    expect(res.status).toBe(201)
    expect(res.body.message).toBe('Account created successfully')
  })
})
