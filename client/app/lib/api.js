import axios from 'axios'
import Cookies from 'js-cookie'

export const API_BASE = 'https://techit-api.onrender.com'

export function getToken() {
  return Cookies.get('token')
}

export function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` }
}

export const apiClient = axios.create({
  baseURL: API_BASE,
})

apiClient.interceptors.request.use(config => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
