import { useAuthStore } from '../store/authStore'

function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_URL || '').trim()
  if (!raw) return '/api'
  const cleaned = raw.replace(/\/+$/, '')
  return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`
}

const API_BASE = resolveApiBase()

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
  let res
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch (_) {
    // Tarmoq uzilgan bo'lsa tizimdan chiqarib yubormaymiz — foydalanuvchi
    // aloqa tiklangach ishini davom ettira olsin
    return null
  }
  if (!res.ok) {
    logout()
    return null
  }
  const data = await res.json()
  setAuth(data)
  return data.access_token
}

// Tarmoq uzilganda beriladigan yagona xabar
function networkError() {
  const e = new Error("Serverga ulanib bo'lmadi. Internet aloqangizni tekshiring.")
  e.status = 0
  e.offline = true
  return e
}

// Server JSON emas, HTML yoki bo'sh javob qaytarsa (masalan 502) — holatga qarab xabar
function statusMessage(status) {
  if (status === 401 || status === 403) return "Bu amal uchun ruxsatingiz yo'q."
  if (status === 404) return "So'ralgan ma'lumot topilmadi."
  if (status === 409) return 'Bu yozuv allaqachon mavjud.'
  if (status === 413) return 'Yuborilgan fayl juda katta.'
  if (status === 429) return "Juda ko'p urinish. Bir oz kuting."
  if (status >= 500) return 'Serverda xatolik yuz berdi. Birozdan keyin qayta urining.'
  return 'Xato yuz berdi.'
}

export async function api(path, options = {}) {
  const { accessToken } = useAuthStore.getState()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch (_) {
    // Internet uzilsa yoki server javob bermasa fetch o'zi yiqiladi. Ilgari
    // foydalanuvchi inglizcha "Failed to fetch" degan yozuvni ko'rardi.
    throw networkError()
  }

  if (res.status === 401 && accessToken) {
    const newToken = await refreshTokens()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      try {
        res = await fetch(`${API_BASE}${path}`, { ...options, headers })
      } catch (_) {
        throw networkError()
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const apiError = new Error(err ? extractErrorMessage(err) : statusMessage(res.status))
    apiError.status = res.status
    throw apiError
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
