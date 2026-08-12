const rateLimit = require('express-rate-limit')

// Rate limiter for login endpoint: 5 requests per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests towards the limit
})

// Rate limiter for register endpoint: 3 requests per minute per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per window
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests towards the limit
})

module.exports = { loginLimiter, registerLimiter }
