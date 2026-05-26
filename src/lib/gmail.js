/* ============================================================
 *  Gmail API — connexion OAuth 2.0 + lecture des mails
 *
 *  Objectif : afficher dans l'onglet "Boîte de réception" les mails
 *  reçus sur action.renovation67@gmail.com.
 *
 *  Flux :
 *    1. Charger les scripts Google (GIS + gapi)
 *    2. signInWithGoogle() → demande consentement scope gmail.readonly
 *    3. listMessages() → liste les 20 derniers mails
 *    4. getMessage(id) → détail d'un mail (sujet, expéditeur, snippet)
 *
 *  Côté Google Cloud :
 *    - Activer "Gmail API"
 *    - Créer un OAuth Client ID (type Web)
 *    - Ajouter http://localhost:5173 + URL prod aux origines autorisées
 *    - Renseigner VITE_GOOGLE_CLIENT_ID + VITE_GOOGLE_API_KEY dans .env.local
 * ============================================================ */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'

let tokenClient = null
let gapiInited = false
let gisInited = false
let accessToken = null

export const isGmailConfigured = Boolean(
  CLIENT_ID && API_KEY && !CLIENT_ID.startsWith('__REMPLACER') && !API_KEY.startsWith('__REMPLACER'),
)

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function initGapi() {
  if (gapiInited) return
  await loadScript('https://apis.google.com/js/api.js')
  await new Promise((resolve) => window.gapi.load('client', resolve))
  await window.gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  })
  gapiInited = true
}

async function initGis() {
  if (gisInited) return
  await loadScript('https://accounts.google.com/gsi/client')
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // défini à chaque signIn
  })
  gisInited = true
}

export async function ensureGoogleClients() {
  if (!isGmailConfigured) {
    throw new Error('Gmail non configuré : renseigne VITE_GOOGLE_CLIENT_ID et VITE_GOOGLE_API_KEY.')
  }
  await Promise.all([initGapi(), initGis()])
}

export async function signInWithGoogle() {
  await ensureGoogleClients()
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp)
      accessToken = resp.access_token
      resolve(resp)
    }
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
  })
}

export function signOutGoogle() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {})
  }
  accessToken = null
  if (window.gapi?.client) {
    window.gapi.client.setToken(null)
  }
}

export function isSignedIn() {
  return Boolean(accessToken)
}

/** Liste les N derniers mails de la boîte. */
export async function listMessages({ maxResults = 20, q = 'in:inbox' } = {}) {
  if (!isSignedIn()) throw new Error('Non connecté à Gmail.')
  const res = await window.gapi.client.gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q,
  })
  return res.result.messages || []
}

/** Récupère le détail d'un mail (headers + snippet). */
export async function getMessage(id) {
  if (!isSignedIn()) throw new Error('Non connecté à Gmail.')
  const res = await window.gapi.client.gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Date'],
  })
  const headers = res.result.payload?.headers || []
  const get = (name) => headers.find((h) => h.name === name)?.value || ''
  return {
    id: res.result.id,
    threadId: res.result.threadId,
    snippet: res.result.snippet,
    from: get('From'),
    subject: get('Subject'),
    date: get('Date'),
    unread: (res.result.labelIds || []).includes('UNREAD'),
  }
}

/** Récupère le contenu de la boîte (liste + détail des N derniers). */
export async function fetchInbox(limit = 15) {
  const list = await listMessages({ maxResults: limit })
  const details = await Promise.all(list.map((m) => getMessage(m.id)))
  return details
}

/* -----------------------------------------------------------------
 *  MOCK — utilisé tant que les clés OAuth ne sont pas renseignées.
 *  Permet de visualiser l'UI sans configuration Google Cloud.
 * ----------------------------------------------------------------- */
export const MOCK_INBOX = [
  {
    id: 'm1',
    from: 'Marie Dupont <marie.dupont@gmail.com>',
    subject: 'Demande de devis — rénovation cuisine',
    snippet:
      'Bonjour, je souhaiterais obtenir un devis pour la rénovation complète de ma cuisine. Surface env. 18m². Disponible la semaine prochaine pour la visite…',
    date: 'Lun. 25 mai 2026 · 14:32',
    unread: true,
  },
  {
    id: 'm2',
    from: 'Jean Müller <j.muller@orange.fr>',
    subject: 'Re: Confirmation RDV jeudi 28/05',
    snippet:
      'Parfait, je confirme le RDV de jeudi à 10h. L\'adresse est 12 rue de la Forêt à Strasbourg. À jeudi !',
    date: 'Lun. 25 mai 2026 · 11:08',
    unread: true,
  },
  {
    id: 'm3',
    from: 'Castorama Pro <noreply@castorama.fr>',
    subject: 'Votre commande #4582 est prête en magasin',
    snippet:
      'Votre commande professionnelle est disponible au comptoir Pro de Strasbourg. Pensez à présenter votre carte…',
    date: 'Dim. 24 mai 2026 · 18:45',
    unread: false,
  },
  {
    id: 'm4',
    from: 'Sophie Klein <sophie.klein@yahoo.fr>',
    subject: 'Photos avant travaux — salle de bain',
    snippet:
      'Bonsoir, comme convenu vous trouverez en pièce jointe les photos avant travaux de la salle de bain ainsi que le plan…',
    date: 'Sam. 23 mai 2026 · 20:12',
    unread: false,
  },
  {
    id: 'm5',
    from: 'URSSAF Alsace <noreply@urssaf.fr>',
    subject: 'Échéance trimestrielle — rappel',
    snippet:
      'Votre prochaine échéance arrive à expiration le 31 mai. Pensez à régulariser votre situation depuis votre espace…',
    date: 'Ven. 22 mai 2026 · 09:00',
    unread: false,
  },
]
