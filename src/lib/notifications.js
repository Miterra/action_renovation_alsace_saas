/* ============================================================
 *  Gestion des notifications PWA (iOS + Android + Desktop)
 *
 *  iOS : depuis iOS 16.4, les Web Push fonctionnent UNIQUEMENT
 *  quand l'app est installée sur l'écran d'accueil (PWA).
 *  → on doit donc afficher un message d'aide si !standalone.
 *
 *  Architecture :
 *    1. requestPermission() → demande à l'utilisateur
 *    2. getFcmToken()       → token FCM à envoyer au backend
 *    3. (serveur)           → Cloud Function envoie une notif
 *    4. SW                  → reçoit le push et affiche la notif
 *
 *  En attendant FCM côté backend, scheduleLocalReminder() permet
 *  d'envoyer une notif locale via le Service Worker (utile pour
 *  les rappels de tâches/RDV traités côté client).
 * ============================================================ */
import { getMessagingClient, VAPID_KEY, isFirebaseConfigured } from './firebase'
import { getToken, onMessage } from 'firebase/messaging'

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function isIos() {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/.test(window.navigator.userAgent)
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export function getPermissionStatus() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

/** Demande la permission au navigateur. À appeler depuis un clic utilisateur. */
export async function requestPermission() {
  if (!notificationsSupported()) {
    throw new Error('Notifications non supportées sur ce navigateur.')
  }
  if (isIos() && !isStandalone()) {
    throw new Error(
      'Sur iPhone, installe d\'abord l\'app sur ton écran d\'accueil (Partager → Sur l\'écran d\'accueil).',
    )
  }
  const permission = await Notification.requestPermission()
  return permission
}

/** Récupère un token FCM à stocker côté serveur pour envoyer des push ciblés. */
export async function getFcmToken() {
  if (!isFirebaseConfigured) {
    console.info('[Notifications] Firebase non configuré → token FCM indisponible.')
    return null
  }
  if (!VAPID_KEY) {
    console.warn('[Notifications] VITE_FIREBASE_VAPID_KEY manquante.')
    return null
  }
  const messaging = await getMessagingClient()
  if (!messaging) return null

  try {
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    return token
  } catch (err) {
    console.error('[Notifications] Erreur récupération token FCM :', err)
    return null
  }
}

/** Réception en foreground (app ouverte) — affiche une notif manuelle. */
export async function listenForegroundMessages(handler) {
  if (!isFirebaseConfigured) return () => {}
  const messaging = await getMessagingClient()
  if (!messaging) return () => {}
  return onMessage(messaging, handler)
}

/** Notif locale immédiate via le SW (utile pour rappels traités côté client). */
export async function showLocalNotification({ title, body, tag, url }) {
  if (!notificationsSupported()) return
  if (Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  reg.active?.postMessage({
    type: 'SHOW_NOTIFICATION',
    payload: { title, body, tag, url },
  })
}

/**
 * Planifie un rappel local (timer côté client).
 * NOTE : ceci ne fonctionne que tant que l'onglet ou la PWA tourne.
 * Pour un vrai rappel "app fermée", il faut passer par FCM + backend
 * (Cloud Function planifiée qui envoie un push à l'heure dite).
 */
export function scheduleLocalReminder({ title, body, tag, url, fireAt }) {
  const delay = new Date(fireAt).getTime() - Date.now()
  if (delay <= 0) return null
  const handle = setTimeout(() => {
    showLocalNotification({ title, body, tag, url })
  }, delay)
  return () => clearTimeout(handle)
}
