const rateLimit = require('express-rate-limit')

/**
 * Rate limits are keyed by client IP and held in memory, which makes them
 * stateful across requests. Under test that state leaks between cases — the
 * fourth registration attempt in a file gets a 429 regardless of what the
 * case is asserting — so limiting is disabled there and exercised by its own
 * dedicated tests instead.
 */
const DISABLED = process.env.NODE_ENV === 'test'

function buildLimiter({ windowMs, max, message }) {
  if (DISABLED) return (req, res, next) => next()

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    // Render terminates TLS at its proxy, so the client address arrives in
    // X-Forwarded-For. app.set('trust proxy', 1) makes req.ip resolve to the
    // real client rather than the proxy, which would otherwise share one
    // bucket across every user.
  })
}

// Credential stuffing is the threat here, so login is the tightest limit.
const loginLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again later.',
})

// Registration is tighter still: it writes rows and sends email.
const registerLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many registration attempts. Please try again later.',
})

/**
 * Baseline limit for authenticated API traffic. Generous enough that ordinary
 * dashboard use never reaches it, low enough to blunt a scripted scrape.
 */
const apiLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many requests. Please slow down and try again shortly.',
})

/**
 * Limit for endpoints that generate a document or send mail. These cost far
 * more per call than a normal read — a PDF render, a CSV of every row, an
 * outbound email — so they get their own much smaller budget.
 */
const expensiveLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'This action is rate limited. Please wait a moment before retrying.',
})

module.exports = { loginLimiter, registerLimiter, apiLimiter, expensiveLimiter }
