/* ============================================================
 *  Supabase — client unique pour l'app
 *  - Postgres (RDV + tâches + push_subscriptions)
 *  - Realtime (sync multi-device automatique)
 *  - Edge Functions (send-reminders pour les rappels)
 * ============================================================ */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  url && anonKey && !anonKey.startsWith('__REMPLACER'),
)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

if (!isSupabaseConfigured) {
  console.info(
    '[Supabase] Variables manquantes — l\'app tourne en mode local (localStorage). ' +
      'Renseigne VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY dans .env.local.',
  )
}

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
