jest.mock('../../services/supabase', () => ({ from: jest.fn() }))

const crypto = require('crypto')
const { mockTable } = require('../helpers/supabaseMock')
const supabase = require('../../services/supabase')
const resets = require('../../services/passwordResets')

beforeEach(() => {
  jest.clearAllMocks()
  supabase.from.mockImplementation(mockTable({ data: { id: 'pr-1' }, error: null }))
})

describe('createResetToken', () => {
  it('stores only the hash, never the raw token', async () => {
    let inserted = null
    supabase.from.mockImplementation(() => {
      const chain = mockTable({ data: { id: 'pr-1' }, error: null })()
      const original = chain.insert
      chain.insert = jest.fn(payload => { inserted = payload; return original(payload) })
      return chain
    })

    const { token } = await resets.createResetToken('u1')

    expect(inserted.token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'))
    expect(JSON.stringify(inserted)).not.toContain(token)
  })

  it('expires within the hour', async () => {
    const { expiresAt } = await resets.createResetToken('u1')
    const minutes = Math.round((expiresAt - Date.now()) / 60000)
    expect(minutes).toBe(resets.RESET_TTL_MINUTES)
    expect(resets.RESET_TTL_MINUTES).toBeLessThanOrEqual(60)
  })

  it('issues a token with enough entropy to resist guessing', async () => {
    const { token } = await resets.createResetToken('u1')
    expect(token.length).toBeGreaterThanOrEqual(40)
  })

  it('produces a different token each time', async () => {
    const a = await resets.createResetToken('u1')
    const b = await resets.createResetToken('u1')
    expect(a.token).not.toBe(b.token)
  })
})

describe('findValidResetToken', () => {
  it('returns null for an empty token without querying', async () => {
    expect(await resets.findValidResetToken('')).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns null for an unknown token', async () => {
    supabase.from.mockImplementation(mockTable({ data: null, error: null }))
    expect(await resets.findValidResetToken('nope')).toBeNull()
  })

  it('refuses a token that was already used', async () => {
    supabase.from.mockImplementation(mockTable({
      data: {
        id: 'pr-1', user_id: 'u1',
        used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60000).toISOString(),
      },
      error: null,
    }))
    expect(await resets.findValidResetToken('used')).toBeNull()
  })

  it('refuses an expired token', async () => {
    supabase.from.mockImplementation(mockTable({
      data: {
        id: 'pr-1', user_id: 'u1', used_at: null,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
      error: null,
    }))
    expect(await resets.findValidResetToken('stale')).toBeNull()
  })

  it('accepts a live, unused token', async () => {
    supabase.from.mockImplementation(mockTable({
      data: {
        id: 'pr-1', user_id: 'u1', used_at: null,
        expires_at: new Date(Date.now() + 60000).toISOString(),
      },
      error: null,
    }))
    const found = await resets.findValidResetToken('good')
    expect(found).not.toBeNull()
    expect(found.user_id).toBe('u1')
  })
})

describe('hashToken', () => {
  it('is deterministic, so a token can be looked up by hash', () => {
    expect(resets.hashToken('abc')).toBe(resets.hashToken('abc'))
  })

  it('differs for different tokens', () => {
    expect(resets.hashToken('abc')).not.toBe(resets.hashToken('abd'))
  })
})
