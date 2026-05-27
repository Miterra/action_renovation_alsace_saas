/* ============================================================
 *  Gestion des notifications PWA — Web Push natif (sans Firebase)
 *
 *  Flux :
 *    1. requestPermission()            → demande à l'utilisateur
 *    2. subscribePush()                → Service Worker s'abonne (VAPID)
 *    3. registerSubscription()         → POST dans Supabase
 *    4. Edge Function send-reminders   → envoie le push à l'heure dite
 *    5. SW reçoit le push              → affiche la notif (même app fermée)
 *
 *  iOS : depuis iOS 16.4, les Web Push fonctionnent UNIQUEMENT
 *  quand l'app est installée sur l'écran d'accueil (mode standalone).
 * ============================================================ */
import { supabase, isSupabaseConfigured, VAPID_PUBLIC_KEY } from './supabase'

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
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function getPermissionStatus() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

/** Demande la permission au navigateur. À appeler depuis un clic utilisateur. */
export async function requestPermission() {
  if (!notificationsSupported()) {
    throw new Error('Notifications non supportées sur ce navigateur.')
  }
  if (isIos() && !isStandalone()) {
    throw new Error(
      "Sur iPhone, installe d'abord l'app sur ton écran d'accueil (Partager → Sur l'écran d'accueil).",
    )
  }
  return await Notification.requestPermission()
}

/** Convertit une clé VAPID base64-url en Uint8Array (requis par PushManager). */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}

/** Abonne le navigateur au Push (ou retourne l'abo existant). */
export async function subscribePush() {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Clé VAPID publique manquante (VITE_VAPID_PUBLIC_KEY).')
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  return sub
}

/** Enregistre la subscription dans Supabase (idempotent via endpoint unique). */
export async function registerSubscription(sub) {
  if (!isSupabaseConfigured || !supabase) {
    console.info('[Notifications] Supabase non configuré — subscription non enregistrée.')
    return null
  }
  const json = sub.toJSON()
  const row = {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
    device_label: detectDevice(),
  }
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select()
    .single()
  if (error) {
    console.error('[Notifications] enregistrement Supabase échoué :', error)
    return null
  }
  return data
}

function detectDevice() {
  if (isIos()) return 'iPhone'
  const ua = navigator.userAgent
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'PC Windows'
  return 'Navigateur'
}

/** Désabonnement complet (révoque côté navigateur + supprime côté Supabase). */
export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  if (isSupabaseConfigured && supabase) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
}

/** Test : affiche une notif locale via le SW (sans passer par le serveur). */
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
 * Workflow complet "Activer les notifs" → permission + subscribe + register.
 * Retourne { ok, permission, subscription, error }.
 */
export async function enableNotifications() {
  try {
    const permission = await requestPermission()
    if (permission !== 'granted') {
      return { ok: false, permission, error: 'Permission refusée.' }
    }
    const sub = await subscribePush()
    const stored = await registerSubscription(sub)
    return { ok: true, permission, subscription: stored }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
}
