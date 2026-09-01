/**
 * Terminal error handling.
 *
 * Without these, an unhandled throw falls through to Express's default
 * handler, which serialises the stack trace into the response body. That
 * leaks file paths, dependency versions and query shapes to anyone able to
 * trigger an error.
 */

/** Unmatched route. Registered after every router. */
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` })
}

/**
 * Express identifies an error handler by its four-argument signature, so
 * `next` must stay even though it is unused.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500

  // Log the full error server-side; the client gets only what it needs.
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${status}:`, err.message)
  if (status >= 500 && err.stack) {
    console.error(err.stack)
  }

  // A body that failed to parse is the client's fault, not a server fault.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' })
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

  // Below 500 the message is something we raised deliberately and is safe to
  // return. At 500 and above it may contain internal detail, so it is replaced.
  const message = status < 500
    ? err.message
    : 'Something went wrong. Please try again.'

  const body = { error: message }

  // The stack is a debugging aid for local work only, never for production.
  if (process.env.NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack
  }

  res.status(status).json(body)
}

module.exports = { notFoundHandler, errorHandler }
