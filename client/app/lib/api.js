import axios from 'axios'
import Cookies from 'js-cookie'

export const API_BASE = 'https://techit-v2.onrender.com'

// The access token is short-lived (15 minutes) and lives in a readable cookie
// so the interceptor can attach it. The refresh token is httpOnly and never
// visible to JavaScript — the browser sends it automatically because
// withCredentials is on.
const TOKEN_COOKIE = 'token'
const USER_COOKIE = 'user'

const cookieOptions = { expires: 30, secure: true, sameSite: 'Strict' }

export function getToken() {
  return Cookies.get(TOKEN_COOKIE)
}

export function setSession(token, user) {
  Cookies.set(TOKEN_COOKIE, token, cookieOptions)
  if (user) Cookies.set(USER_COOKIE, JSON.stringify(user), cookieOptions)
}

export function clearSession() {
  Cookies.remove(TOKEN_COOKIE)
  Cookies.remove(USER_COOKIE)
}

export function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` }
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

apiClient.interceptors.request.use(config => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// A separate client for the refresh call itself. Using apiClient would send
// the expired access token and re-enter this interceptor on failure.
const refreshClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

// When several requests 401 at once they must not each trigger their own
// refresh — the first rotation would invalidate the token the others carry,
// which reads as reuse and revokes the whole session. Instead the first
// failure starts one refresh and the rest await it.
let refreshPromise = null

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/api/auth/refresh')
      .then(res => {
        setSession(res.data.token, res.data.user)
        return res.data.token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/** Called when refreshing fails, so the app can send the user to /login. */
let onAuthFailure = null
export function setAuthFailureHandler(handler) {
  onAuthFailure = handler
}

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config
    const status = error.response?.status

    // Only retry a genuine 401, and only once per request.
    if (status !== 401 || !original || original._retried) {
      return Promise.reject(error)
    }

    // Never try to refresh the auth endpoints themselves.
    if (original.url && original.url.includes('/api/auth/')) {
      return Promise.reject(error)
    }

    original._retried = true

    try {
      const token = await refreshAccessToken()
      original.headers = original.headers || {}
      original.headers.Authorization = `Bearer ${token}`
      return apiClient(original)
    } catch (refreshError) {
      clearSession()
      if (onAuthFailure) onAuthFailure()
      return Promise.reject(refreshError)
    }
  }
)
