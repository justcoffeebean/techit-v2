const { mockTable, mockTables } = require('../helpers/supabaseMock')

process.env.JWT_SECRET = 'test-secret'

jest.mock('../../services/supabase', () => ({ from: jest.fn() }))

const mockSendPasswordResetEmail = jest.fn().mockResolvedValue(undefined)
jest.mock('../../services/email', () => ({
  sendLowStockAlert: jest.fn(),
  sendInvitationEmail: jest.fn(),
  sendPurchaseOrderEmail: jest.fn(),
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
}))

jest.mock('../../services/tokens', () => {
  const actual = jest.requireActual('../../services/tokens')
  return { ...actual, revokeAllForUser: jest.fn().mockResolvedValue(undefined) }
})

const supabase = require('../../services/supabase')
const { revokeAllForUser } = require('../../services/tokens')

const express = require('express')
const http = require('http')
const authRoutes = require('../../routes/auth')

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

let server, baseUrl

beforeAll((done) => {
  server = app.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`
    done()
  })
})
afterAll((done) => { server.close(done) })
beforeEach(() => jest.clearAllMocks())

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        let parsed = data
        try { parsed = JSON.parse(data) } catch { /* non-JSON */ }
        resolve({ status: res.statusCode, body: parsed })
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

const LIVE_TOKEN_ROW = {
  id: 'pr-1', user_id: 'u1', used_at: null,
  expires_at: new Date(Date.now() + 3600000).toISOString(),
}

describe('POST /api/auth/forgot-password', () => {
  it('answers identically for a known and an unknown address', async () => {
    supabase.from.mockImplementation(mockTable({
      data: { id: 'u1', username: 'ada', email: 'ada@example.com' }, error: null,
    }))
    const known = await request('POST', '/api/auth/forgot-password', { email: 'ada@example.com' })

    supabase.from.mockImplementation(mockTable({ data: null, error: null }))
    const unknown = await request('POST', '/api/auth/forgot-password', { email: 'nobody@example.com' })

    // A differing status or body would let an attacker discover which
    // addresses hold accounts.
    expect(known.status).toBe(unknown.status)
    expect(known.body).toEqual(unknown.body)
  })

  it('sends mail only when the account exists', async () => {
    supabase.from.mockImplementation(mockTable({ data: null, error: null }))
    await request('POST', '/api/auth/forgot-password', { email: 'nobody@example.com' })
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()

    supabase.from.mockImplementation(mockTable({
      data: { id: 'u1', username: 'ada', email: 'ada@example.com' }, error: null,
    }))
    await request('POST', '/api/auth/forgot-password', { email: 'ada@example.com' })
    expect(mockSendPasswordResetEmail).toHaveBeenCalled()
  })

  it('gives the same answer for a malformed address', async () => {
    const res = await request('POST', '/api/auth/forgot-password', { email: 'not-an-email' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/if an account exists/i)
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('still answers normally when sending mail fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockSendPasswordResetEmail.mockRejectedValueOnce(new Error('smtp down'))
    supabase.from.mockImplementation(mockTable({
      data: { id: 'u1', username: 'ada', email: 'ada@example.com' }, error: null,
    }))

    const res = await request('POST', '/api/auth/forgot-password', { email: 'ada@example.com' })

    // Surfacing the failure would reveal that the address exists.
    expect(res.status).toBe(200)
    spy.mockRestore()
  })
})

describe('POST /api/auth/reset-password', () => {
  it('rejects a short password before touching the token', async () => {
    const res = await request('POST', '/api/auth/reset-password', { token: 'x', password: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least 6/)
  })

  it('rejects a missing token', async () => {
    const res = await request('POST', '/api/auth/reset-password', { password: 'longenough' })
    expect(res.status).toBe(400)
  })

  it('rejects an unknown token', async () => {
    supabase.from.mockImplementation(mockTable({ data: null, error: null }))
    const res = await request('POST', '/api/auth/reset-password', {
      token: 'bogus', password: 'newpassword',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid or has expired/i)
  })

  it('updates the password and revokes every session', async () => {
    supabase.from.mockImplementation(mockTables({
      techit_password_resets: { data: LIVE_TOKEN_ROW, error: null },
      techit_users: { data: { id: 'u1' }, error: null },
    }))

    const res = await request('POST', '/api/auth/reset-password', {
      token: 'good', password: 'a-new-password',
    })

    expect(res.status).toBe(200)
    // Whoever knew the old password may still hold a refresh token.
    expect(revokeAllForUser).toHaveBeenCalledWith('u1')
  })
})

describe('GET /api/auth/reset-password/:token', () => {
  it('reports a live token as valid', async () => {
    supabase.from.mockImplementation(mockTable({ data: LIVE_TOKEN_ROW, error: null }))
    const res = await request('GET', '/api/auth/reset-password/good')
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
  })

  it('reports an expired token as invalid', async () => {
    supabase.from.mockImplementation(mockTable({
      data: { ...LIVE_TOKEN_ROW, expires_at: new Date(Date.now() - 1000).toISOString() },
      error: null,
    }))
    const res = await request('GET', '/api/auth/reset-password/stale')
    expect(res.status).toBe(404)
    expect(res.body.valid).toBe(false)
  })
})
