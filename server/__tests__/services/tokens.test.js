jest.mock('../../services/supabase', () => ({ from: jest.fn() }))

process.env.JWT_SECRET = 'test-secret'

const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { mockTable } = require('../helpers/supabaseMock')
const supabase = require('../../services/supabase')
const tokens = require('../../services/tokens')

const USER = { id: 'u1', username: 'ada', role: 'admin', organization_id: 'org-1' }

beforeEach(() => {
  jest.clearAllMocks()
  supabase.from.mockImplementation(mockTable({ data: { id: 'rt-1' }, error: null }))
})

describe('signAccessToken', () => {
  it('carries the identity every request is authorised against', () => {
    const decoded = jwt.verify(tokens.signAccessToken(USER), process.env.JWT_SECRET)
    expect(decoded.id).toBe('u1')
    expect(decoded.role).toBe('admin')
    expect(decoded.organization_id).toBe('org-1')
  })

  it('expires in 15 minutes', () => {
    const decoded = jwt.verify(tokens.signAccessToken(USER), process.env.JWT_SECRET)
    expect(decoded.exp - decoded.iat).toBe(900)
  })

  it('never carries the password', () => {
    const decoded = jwt.verify(
      tokens.signAccessToken({ ...USER, password: 'hashed-secret' }),
      process.env.JWT_SECRET
    )
    expect(decoded.password).toBeUndefined()
  })
})

describe('issueRefreshToken', () => {
  it('stores only the hash, never the raw token', async () => {
    let inserted = null
    supabase.from.mockImplementation(() => {
      const chain = mockTable({ data: { id: 'rt-1' }, error: null })()
      const original = chain.insert
      chain.insert = jest.fn((payload) => { inserted = payload; return original(payload) })
      return chain
    })

    const { token } = await tokens.issueRefreshToken('u1')

    expect(inserted.token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'))
    expect(inserted.token_hash).not.toBe(token)
    expect(JSON.stringify(inserted)).not.toContain(token)
  })

  it('expires 30 days out', async () => {
    const { expiresAt } = await tokens.issueRefreshToken('u1')
    const days = Math.round((expiresAt - Date.now()) / 86400000)
    expect(days).toBe(30)
  })

  it('records the token it replaced, so a family can be traced', async () => {
    let inserted = null
    supabase.from.mockImplementation(() => {
      const chain = mockTable({ data: { id: 'rt-2' }, error: null })()
      const original = chain.insert
      chain.insert = jest.fn((payload) => { inserted = payload; return original(payload) })
      return chain
    })

    await tokens.issueRefreshToken('u1', { replacesId: 'rt-1' })
    expect(inserted.replaces_id).toBe('rt-1')
  })
})

describe('findRefreshToken', () => {
  it('returns null for an absent token', async () => {
    supabase.from.mockImplementation(mockTable({ data: null, error: null }))
    expect(await tokens.findRefreshToken('nope')).toBeNull()
  })

  it('returns null for an empty token without querying', async () => {
    expect(await tokens.findRefreshToken('')).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('refreshCookieOptions', () => {
  const original = process.env.NODE_ENV
  afterEach(() => { process.env.NODE_ENV = original })

  it('is httpOnly in every environment, so script cannot read it', () => {
    process.env.NODE_ENV = 'development'
    expect(tokens.refreshCookieOptions().httpOnly).toBe(true)
    process.env.NODE_ENV = 'production'
    expect(tokens.refreshCookieOptions().httpOnly).toBe(true)
  })

  it('is Secure and SameSite=None in production, which the cross-site cookie needs', () => {
    process.env.NODE_ENV = 'production'
    const opts = tokens.refreshCookieOptions()
    expect(opts.secure).toBe(true)
    expect(opts.sameSite).toBe('none')
  })

  it('relaxes Secure outside production so local http still works', () => {
    process.env.NODE_ENV = 'development'
    expect(tokens.refreshCookieOptions().secure).toBe(false)
  })

  it('is scoped to the auth path', () => {
    expect(tokens.refreshCookieOptions().path).toBe('/api/auth')
  })
})
