import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import { api } from '../utils/api'
import { useNotificationStore } from '../store/notificationStore'
import { useAuthStore } from '../store/authStore'
import { BRAND } from '../config/brand'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d} kun oldin`
  if (h > 0) return `${h} soat oldin`
  if (m > 0) return `${m} daqiqa oldin`
  return 'Hozirgina'
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const { lastChecked, setLastChecked } = useNotificationStore()
  const { accessToken } = useAuthStore()
  const ref = useRef(null)
  const initializedRef = useRef(false)
  const lastSeenTsRef = useRef(0)

  const unreadCount = lastChecked
    ? items.filter((n) => new Date(n.created_at) > new Date(lastChecked)).length
    : Math.min(items.length, 9)

  const load = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await api('/notifications')
      setItems(data)
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [accessToken])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (!Array.isArray(items) || items.length === 0) return

    const tsList = items
      .map((n) => new Date(n.created_at).getTime())
      .filter((v) => Number.isFinite(v) && v > 0)
    if (!tsList.length) return
    const newestTs = Math.max(...tsList)
    if (!initializedRef.current) {
      initializedRef.current = true
      lastSeenTsRef.current = newestTs
      return
    }

    // Faol sessiyada faqat keyin kelgan yangi xabarlarni desktopda ko'rsatamiz.
    if (newestTs <= lastSeenTsRef.current) return

    const newestItem = items
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (document.visibilityState === 'hidden') {
      try {
        new Notification(BRAND.name, {
          body: newestItem?.message || "Yangi bildirishnoma",
        })
      } catch (_) {}
    }
    lastSeenTsRef.current = newestTs
  }, [items])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) {
      setLastChecked()
      if (items.length === 0) load()
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="btn-ghost relative p-2"
        title="Bildirishnomalar"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal((
        <div
          className="fixed right-4 top-4 z-[9999] w-[min(24rem,calc(100vw-2rem))] rounded-2xl overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
            maxHeight: '70vh',
          }}
        >
          <div
            className="flex items-center justify-between p-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-sm font-semibold">Bildirishnomalar</span>
            <button
              type="button"
              className="text-xs text-muted hover:text-body"
              onClick={() => { setLastChecked(); setOpen(false) }}
            >
              O'qildi deb belgilash
            </button>
          </div>

          {loading && items.length === 0 ? (
            <div className="p-6 text-center text-muted text-sm">Yuklanmoqda...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-muted text-sm">Bildirishnomalar yo'q</div>
          ) : (
            <ul className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {items.map((n) => {
                const isUnread = !lastChecked || new Date(n.created_at) > new Date(lastChecked)
                return (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 p-3 text-sm"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isUnread ? 'var(--gold-dim)' : 'transparent',
                    }}
                  >
                    <span className="mt-0.5 text-base shrink-0">{n.icon || '📌'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body leading-snug">{n.message}</p>
                      <p className="text-muted mt-0.5 text-xs">
                        {n.user_name} · {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ), document.body)}
    </div>
  )
}
