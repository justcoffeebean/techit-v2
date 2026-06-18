const jwt = require('jsonwebtoken')
const { authMiddleware, adminMiddleware } = require('../../middleware/auth')

// Set a test JWT secret
process.env.JWT_SECRET = 'test-secret'

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('authMiddleware', () => {
  it('returns 401 when no authorization header is present', () => {
    const req = { headers: {} }
    const res = mockRes()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when authorization header has no token after Bearer', () => {
    const req = { headers: { authorization: 'Bearer ' } }
    const res = mockRes()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } }
    const res = mockRes()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' })
    expect(next).not.toHaveBeenCalled()
  })

  it('sets req.user and calls next for a valid token', () => {
    const payload = { id: 'user-1', username: 'admin', role: 'admin' }
    const token = jwt.sign(payload, process.env.JWT_SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(req.user).toMatchObject(payload)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ id: '1' }, process.env.JWT_SECRET, { expiresIn: '-1s' })
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('adminMiddleware', () => {
  it('calls next when user is admin', () => {
    const req = { user: { role: 'admin' } }
    const res = mockRes()
    const next = jest.fn()

    adminMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when user is not admin', () => {
    const req = { user: { role: 'user' } }
    const res = mockRes()
    const next = jest.fn()

    adminMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' })
    expect(next).not.toHaveBeenCalled()
  })
})
