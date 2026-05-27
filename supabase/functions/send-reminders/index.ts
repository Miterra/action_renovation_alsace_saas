// ============================================================
//  Edge Function : send-reminders
//
//  Implémentation Web Push native (RFC 8030 + RFC 8291 aes128gcm)
//  basée sur crypto.subtle (pas de dépendance npm:web-push qui crash
//  dans le runtime Deno de Supabase).
//
//  Appelée toutes les minutes par pg_cron.
//  - Cherche RDV (start_at) et tâches (due_at) dans la fenêtre
//    [now - 1 min, now + 15 min] avec reminder_sent = false
//  - Envoie un Web Push (VAPID) à chaque subscription
//  - Marque reminder_sent = true
//  - Nettoie automatiquement les subscriptions invalides (410/404)
//
//  Les clés VAPID sont stockées dans private.app_secrets et exposées
//  via la fonction RPC public.get_vapid_config() (SECURITY DEFINER,
//  exécutable uniquement par service_role).
//
//  Debug : ajouter ?debug=1 pour avoir le détail des push dans la réponse.
// ============================================================
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

/* ---------- helpers base64url ---------- */
function b64uEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64uDecode(s: string): Uint8Array {
  const padding = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrs) { out.set(a, off); off += a.length }
  return out
}

/* ---------- VAPID ---------- */
async function importVapidPrivateKey(privateD: Uint8Array, publicRaw: Uint8Array): Promise<CryptoKey> {
  // publicRaw = 65 bytes uncompressed point : 0x04 || X(32) || Y(32)
  const x = publicRaw.slice(1, 33)
  const y = publicRaw.slice(33, 65)
  return await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: b64uEncode(privateD), x: b64uEncode(x), y: b64uEncode(y), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

async function createVapidJwt(privateKey: CryptoKey, audience: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }
  const headerB64 = b64uEncode(new TextEncoder().encode(JSON.stringify(header)))
  const claimsB64 = b64uEncode(new TextEncoder().encode(JSON.stringify(claims)))
  const signingInput = `${headerB64}.${claimsB64}`
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  )
  // Web Crypto ECDSA → raw r|s (64 bytes pour P-256), exactement le format JWT
  return `${signingInput}.${b64uEncode(sig)}`
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    length * 8,
  )
  return new Uint8Array(bits)
}

/* ---------- Chiffrement aes128gcm (RFC 8291) ---------- */
interface EncryptedPayload { ciphertext: Uint8Array; salt: Uint8Array; serverPublicRaw: Uint8Array }

async function encryptPayload(payload: Uint8Array, p256dh: Uint8Array, auth: Uint8Array): Promise<EncryptedPayload> {
  // 1. Génère une paire ECDH éphémère (côté serveur)
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const serverPubJwk = await crypto.subtle.exportKey('jwk', serverKeyPair.publicKey)
  const sx = b64uDecode(serverPubJwk.x!)
  const sy = b64uDecode(serverPubJwk.y!)
  const serverPublicRaw = concat(new Uint8Array([0x04]), sx, sy)

  // 2. Importe la clé publique du client (p256dh)
  const cx = p256dh.slice(1, 33)
  const cy = p256dh.slice(33, 65)
  const clientPub = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: b64uEncode(cx), y: b64uEncode(cy) },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  // 3. ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPub },
    serverKeyPair.privateKey,
    256,
  )
  const sharedSecret = new Uint8Array(sharedBits)

  // 4. Sel aléatoire
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // 5. PRK_key = HKDF(auth, sharedSecret, "WebPush: info\0" || ua_pub || as_pub, 32)
  const keyInfo = concat(
    new TextEncoder().encode('WebPush: info\0'),
    p256dh,
    serverPublicRaw,
  )
  const prkKey = await hkdf(auth, sharedSecret, keyInfo, 32)

  // 6. CEK = HKDF(salt, prkKey, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, prkKey, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16)
  // 7. NONCE = HKDF(salt, prkKey, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, prkKey, new TextEncoder().encode('Content-Encoding: nonce\0'), 12)

  // 8. plaintext = payload || 0x02 (delimiter, pas de padding)
  const plaintext = concat(payload, new Uint8Array([0x02]))

  // 9. Chiffrement AES-GCM
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, plaintext)
  return { ciphertext: new Uint8Array(ctBuf), salt, serverPublicRaw }
}

function buildBody(enc: EncryptedPayload, recordSize = 4096): Uint8Array {
  // Format aes128gcm : salt(16) || record_size(4 BE) || keyid_len(1) || keyid || ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, recordSize, false)
  const keyIdLen = new Uint8Array([enc.serverPublicRaw.length])
  return concat(enc.salt, rs, keyIdLen, enc.serverPublicRaw, enc.ciphertext)
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivate: CryptoKey,
  vapidPubRaw: Uint8Array,
  vapidSubject: string,
): Promise<{ ok: boolean; status: number; statusText: string; body?: string }> {
  const p256dh = b64uDecode(sub.p256dh)
  const auth = b64uDecode(sub.auth)
  const enc = await encryptPayload(new TextEncoder().encode(payload), p256dh, auth)
  const body = buildBody(enc)
  const url = new URL(sub.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const jwt = await createVapidJwt(vapidPrivate, audience, vapidSubject)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '1800',
      Authorization: `vapid t=${jwt}, k=${b64uEncode(vapidPubRaw)}`,
    },
    body,
  })
  let respBody: string | undefined
  if (!res.ok) {
    try { respBody = await res.text() } catch { /* ignore */ }
  }
  return { ok: res.ok, status: res.status, statusText: res.statusText, body: respBody }
}

/* ============================================================
 *  Edge Function entrypoint
 * ============================================================ */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

let vapidPrivKey: CryptoKey | null = null
let vapidPubRaw: Uint8Array | null = null
let vapidSubject: string | null = null

async function loadVapid(): Promise<void> {
  if (vapidPrivKey && vapidPubRaw && vapidSubject) return
  // RPC SECURITY DEFINER qui lit private.app_secrets (le schéma private
  // n'est pas exposé par PostgREST directement)
  const { data, error } = await supabase.rpc('get_vapid_config')
  if (error) throw new Error(`vapid rpc failed: ${error.message}`)
  const map = Object.fromEntries(((data || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  if (!map.vapid_public || !map.vapid_private || !map.vapid_subject) {
    throw new Error('missing vapid secrets')
  }
  const priv = b64uDecode(map.vapid_private)
  const pub = b64uDecode(map.vapid_public)
  vapidPrivKey = await importVapidPrivateKey(priv, pub)
  vapidPubRaw = pub
  vapidSubject = map.vapid_subject
}

async function pushToAll(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: string,
): Promise<{ sent: number; failed: number; details: unknown[] }> {
  let sent = 0
  let failed = 0
  const details: unknown[] = []
  const toDelete: string[] = []
  for (const s of subs) {
    try {
      const r = await sendWebPush(s, payload, vapidPrivKey!, vapidPubRaw!, vapidSubject!)
      if (r.ok) {
        sent++
        details.push({ id: s.id, ok: true, status: r.status })
      } else {
        failed++
        details.push({ id: s.id, ok: false, status: r.status, body: r.body })
        if (r.status === 404 || r.status === 410) toDelete.push(s.id)
      }
    } catch (e) {
      failed++
      details.push({ id: s.id, error: e instanceof Error ? e.message : String(e) })
    }
  }
  if (toDelete.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', toDelete)
  }
  return { sent, failed, details }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const debugMode = url.searchParams.get('debug') === '1'
  try {
    await loadVapid()

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
    if (subsErr) throw new Error(`subs select: ${subsErr.message}`)
    const activeSubs = subs || []

    const now = new Date()
    // RDV : la notif est envoyée quand reminder_at est passé (fenêtre des 5 dernières minutes)
    const rdvWindowStart = new Date(now.getTime() - 5 * 60_000).toISOString()
    const rdvWindowEnd = now.toISOString()
    // Tâches : T-15 min avant due_at (existant)
    const taskWindowEnd = new Date(now.getTime() + 15 * 60_000).toISOString()
    const taskWindowStart = new Date(now.getTime() - 60_000).toISOString()

    const out: Record<string, unknown> = {
      ok: true,
      now: now.toISOString(),
      subs: activeSubs.length,
      rdv: { matched: 0, sent: 0, failed: 0 } as Record<string, unknown>,
      tasks: { matched: 0, sent: 0, failed: 0 } as Record<string, unknown>,
    }

    if (activeSubs.length === 0) {
      return new Response(JSON.stringify({ ...out, info: 'no subs' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // RDV à rappeler (basé sur reminder_at, pas start_at)
    const { data: rdvs } = await supabase
      .from('appointments')
      .select('id, client_name, address, start_at, reminder_at')
      .eq('reminder_sent', false)
      .not('reminder_at', 'is', null)
      .gte('reminder_at', rdvWindowStart)
      .lte('reminder_at', rdvWindowEnd)

    ;(out.rdv as Record<string, number>).matched = (rdvs || []).length
    for (const r of rdvs || []) {
      const startDate = new Date(r.start_at)
      const day = startDate.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris',
      })
      const time = startDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
      })
      const payload = JSON.stringify({
        notification: {
          title: `RDV demain · ${r.client_name}`,
          body: `${day} à ${time}${r.address ? ' — ' + r.address : ''}`,
          icon: '/logo.png',
          tag: `rdv-${r.id}`,
        },
        data: { url: '/calendar', id: r.id },
      })
      const res = await pushToAll(activeSubs, payload)
      ;(out.rdv as Record<string, number>).sent += res.sent
      ;(out.rdv as Record<string, number>).failed += res.failed
      if (debugMode) (out.rdv as Record<string, unknown>).details = res.details
      await supabase.from('appointments').update({ reminder_sent: true }).eq('id', r.id)
    }

    // Tâches à rappeler (T-15 min)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, description, due_at')
      .eq('done', false)
      .eq('reminder_sent', false)
      .gte('due_at', taskWindowStart)
      .lte('due_at', taskWindowEnd)

    ;(out.tasks as Record<string, number>).matched = (tasks || []).length
    for (const t of tasks || []) {
      const payload = JSON.stringify({
        notification: {
          title: `Rappel : ${t.title}`,
          body: t.description || 'Échéance dans 15 minutes.',
          icon: '/logo.png',
          tag: `task-${t.id}`,
        },
        data: { url: '/tasks', id: t.id },
      })
      const res = await pushToAll(activeSubs, payload)
      ;(out.tasks as Record<string, number>).sent += res.sent
      ;(out.tasks as Record<string, number>).failed += res.failed
      if (debugMode) (out.tasks as Record<string, unknown>).details = res.details
      await supabase.from('tasks').update({ reminder_sent: true }).eq('id', t.id)
    }

    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[send-reminders] FATAL', err)
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
