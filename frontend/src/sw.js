import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// ── Statik fayllarni oldindan keshlash (plugin tomonidan inject qilinadi) ──
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── API: Network first ────────────────────────────────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-v2',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  })
)

// ── Assets: StaleWhileRevalidate (har doim yangi kodni oladi va 200 OK keshlaydi) ──
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script',
  new StaleWhileRevalidate({
    cacheName: 'assets-v2',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  })
)

// ── Push bildirishnomasi ──────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data?.json() ?? {}
  } catch {
    data = { title: 'Marjona Med Servis', body: e.data?.text() || '' }
  }

  const title = data.title || 'Marjona Med Servis'
  const options = {
    body: data.body || '',
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  }

  e.waitUntil(
    self.registration.showNotification(title, options).then(() =>
      self.clients
        .matchAll({ type: 'window' })
        .then((clients) =>
          clients.forEach((c) => c.postMessage({ type: 'PUSH_RECEIVED', payload: data }))
        )
    )
  )
})

// ── Bildirishnomaga klik ──────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const targetUrl = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin))
        if (existing) {
          existing.focus()
          existing.navigate(targetUrl)
        } else {
          self.clients.openWindow(targetUrl)
        }
      })
  )
})
