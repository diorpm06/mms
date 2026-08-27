// Vercel'ga yangi deploy tushganda, ochiq tab'dagi eski JS bundle
// endi mavjud bo'lmagan chunk-fayllarni so'rab, "Failed to fetch
// dynamically imported module" kabi xato beradi. Oddiy sahifa
// yangilash (reload) buni har doim ham tuzatavermaydi — Service
// Worker o'sha eski keshni qaytarib berishda davom etishi mumkin,
// natijada xato TAKRORLANADI. Shuning uchun avval SW ro'yxatdan
// chiqariladi va barcha kesh tozalanadi, keyingina qayta yuklanadi.

export function isChunkLoadError(err) {
  const msg = String(err?.message || '').toLowerCase()
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch') ||
    msg.includes('importing a module script failed')
  )
}

const COOLDOWN_MS = 10000
const STORAGE_KEY = 'last_chunk_reload_time'

// `true` qaytarsa — tozalash boshlandi (chaqiruvchi qayta urinishni
// to'xtatishi kerak). `false` — endigina urinilgan edi (10 soniya
// o'tmagan), boshqa yo'l bilan xato ko'rsatilsin. `force: true` —
// foydalanuvchi o'zi "Qayta yuklash" tugmasini bosganda 10 soniyalik
// kutishni chetlab o'tadi (bu — aniq foydalanuvchi harakati).
export function recoverFromChunkError({ force = false } = {}) {
  const lastReload = sessionStorage.getItem(STORAGE_KEY)
  const now = Date.now()
  if (!force && lastReload && now - Number(lastReload) <= COOLDOWN_MS) return false

  sessionStorage.setItem(STORAGE_KEY, String(now))

  const doReload = () => window.location.reload()

  try {
    const cleanups = []
    if ('serviceWorker' in navigator) {
      cleanups.push(
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      )
    }
    if ('caches' in window) {
      cleanups.push(
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      )
    }
    Promise.all(cleanups).catch(() => {}).finally(doReload)
  } catch (_) {
    doReload()
  }

  return true
}
