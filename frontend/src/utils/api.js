import { useAuthStore } from '../store/authStore'

// Vercel-da VITE_API_URL muhit o'zgaruvchisi orqali backend URL ko'rsatiladi
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

function extractErrorMessage(err) {
  if (!err) return 'Xato yuz berdi'
  if (typeof err.detail === 'string') return err.detail
  if (Array.isArray(err.detail) && err.detail.length) {
    const first = err.detail[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object') {
      if (first.msg) return String(first.msg)
      return JSON.stringify(first)
    }
  }
  if (typeof err.message === 'string') return err.message
  return JSON.stringify(err)
}

async function refreshTokens() {
  const { refreshToken, setAuth, logout } = useAuthStore.getState()
  if (!refreshToken) {
    logout()
    return null
  }
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) {
    logout()
    return null
  }
  const data = await res.json()
  setAuth(data)
  return data.access_token
}

export async function api(path, options = {}) {
  const { accessToken } = useAuthStore.getState()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401 && accessToken) {
    const newToken = await refreshTokens()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Xato yuz berdi' }))
    throw new Error(extractErrorMessage(err))
  }

  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.blob()
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
