const express = require('express')
const http = require('http')
const { notFoundHandler, errorHandler } = require('../../middleware/errorHandler')

let server
let baseUrl

function buildApp() {
  const app = express()
  app.use(express.json())

  app.get('/ok', (req, res) => res.json({ ok: true }))
  app.get('/boom', () => { throw new Error('internal detail that must not leak') })
  app.get('/client-error', (req, res, next) => {
    const err = new Error('You did that wrong')
    err.status = 400
    next(err)
  })
  app.get('/cors', (req, res, next) => next(new Error('Not allowed by CORS')))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

beforeAll((done) => {
  server = buildApp().listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`
    done()
  })
})

afterAll((done) => { server.close(done) })

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        let parsed = data
        try { parsed = JSON.parse(data) } catch { /* non-JSON */ }
        resolve({ status: res.statusCode, body: parsed })
      })
    })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

describe('notFoundHandler', () => {
  it('returns 404 JSON for an unmatched route', async () => {
    const res = await request('GET', '/no-such-route')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('/no-such-route')
  })

  it('leaves matched routes alone', async () => {
    const res = await request('GET', '/ok')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('errorHandler', () => {
  let spy
  beforeEach(() => { spy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => spy.mockRestore())

  it('does not leak the message or stack of a 500', async () => {
    const res = await request('GET', '/boom')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Something went wrong. Please try again.')
    expect(JSON.stringify(res.body)).not.toContain('internal detail')
    expect(res.body.stack).toBeUndefined()
  })

  it('passes through a deliberate client-error message', async () => {
    const res = await request('GET', '/client-error')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('You did that wrong')
  })

  it('maps a CORS rejection to 403', async () => {
    const res = await request('GET', '/cors')
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Origin not allowed')
  })

  it('returns 400 for malformed JSON rather than 500', async () => {
    const res = await request('POST', '/ok', '{not valid json')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Malformed JSON/)
  })

  it('logs the failure server-side', async () => {
    await request('GET', '/boom')
    expect(spy).toHaveBeenCalled()
  })
})
