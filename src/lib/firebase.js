/* ============================================================
 *  Firebase — initialisation
 *  - Firestore : stockage RDV, tâches, contacts
 *  - Auth (à venir) : login compte interne
 *  - Cloud Messaging : push notifications (iOS PWA 16.4+)
 *
 *  Les clés sont injectées via Vite (.env.local).
 *  Voir .env.example pour la liste des variables.
 * ============================================================ */
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isConfigured = Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('__REMPLACER'))

let app = null
let db = null
let messagingInstance = null

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
  } catch (err) {
    console.warn('[Firebase] Initialisation échouée :', err)
  }
} else {
  console.info(
    '[Firebase] Mode local — variables VITE_FIREBASE_* non configurées. ' +
      'Renseigne .env.local pour activer Firestore + Push.',
  )
}

export async function getMessagingClient() {
  if (!app) return null
  if (messagingInstance) return messagingInstance
  try {
    const supported = await isSupported()
    if (!supported) return null
    messagingInstance = getMessaging(app)
    return messagingInstance
  } catch (err) {
    console.warn('[Firebase Messaging] non supporté ici :', err)
    return null
  }
}

export { app, db, isConfigured as isFirebaseConfigured }
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
