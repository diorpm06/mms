const CACHE_NAME = 'marjona-med-v3'
const STATIC_ASSETS = ['/', '/index.html', '/assets/logo.png', '/manifest.json']

/* ── O'rnatish ── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

/* ── Faollashtirish: eski cache larni o'chirish ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

/* ── Fetch ── */
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') return
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok && request.method === 'GET') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, clone))
        }
        return res
      })
    }).catch(() => caches.match('/index.html'))
  )
})

/* ── Push notification ── */
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data?.json() ?? {} } catch { data = { title: 'Marjona Med Servis', body: e.data?.text() || '' } }

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
    self.registration.showNotification(title, options).then(() => {
      // Notify all open clients so they can refresh the notification bell
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'PUSH_RECEIVED', payload: data }))
      })
    })
  )
})

/* ── Notification click ── */
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const targetUrl = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
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
