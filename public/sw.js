/* ============================================================
 *  Action Rénovation Alsace — Service Worker
 *  - Précaching généré par Workbox via vite-plugin-pwa (injectManifest)
 *  - Écoute des événements Web Push (FCM)
 *  - Notifications de rappel iOS (iOS 16.4+ en mode standalone)
 * ============================================================ */

// Injecté à la compilation par vite-plugin-pwa
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// Activation immédiate après installation
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/* ----- Web Push (Firebase Cloud Messaging / VAPID) -----
 *
 *  Côté serveur (Cloud Function ou backend), on enverra un payload type :
 *  {
 *    "notification": {
 *      "title": "Rappel : RDV Dupont",
 *      "body": "14h00 — 12 rue de la Forêt, Strasbourg",
 *      "icon": "/logo.png",
 *      "tag": "rdv-1234"
 *    },
 *    "data": { "url": "/calendar", "id": "1234" }
 *  }
 *
 *  Le SW reçoit ce push même si l'app est fermée (à condition d'être
 *  installée sur l'écran d'accueil pour iOS).
 * ----------------------------------------------------------- */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    payload = {
      notification: {
        title: 'Action Rénovation Alsace',
        body: event.data ? event.data.text() : 'Nouvelle notification',
      },
    }
  }

  const notif = payload.notification || {}
  const title = notif.title || 'Action Rénovation Alsace'
  const options = {
    body: notif.body || '',
    icon: notif.icon || '/logo.png',
    badge: '/logo.png',
    tag: notif.tag || 'ara-default',
    data: payload.data || {},
    vibrate: [80, 40, 80],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Clic sur la notification → ouvrir / focus de l'app sur la bonne route
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsList) => {
        for (const client of clientsList) {
          if ('focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      }),
  )
})

/* ----- Messages depuis l'app (déclenchement manuel d'une notif locale) ----- */
self.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url } = event.data.payload || {}
    self.registration.showNotification(title || 'Action Rénovation Alsace', {
      body: body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: tag || 'ara-local',
      data: { url: url || '/' },
    })
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
