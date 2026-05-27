import { useEffect, useState } from 'react'
import {
  Mail,
  RefreshCw,
  LogIn,
  LogOut,
  AlertTriangle,
  Inbox as InboxIcon,
  X,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import {
  isGmailConfigured,
  signInWithGoogle,
  signOutGoogle,
  isSignedIn,
  fetchInbox,
  getMessageFull,
  MOCK_INBOX,
} from '../lib/gmail.js'

export default function Inbox() {
  const [messages, setMessages] = useState(MOCK_INBOX)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    setConnected(isSignedIn())
  }, [])

  async function handleConnect() {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
      setConnected(true)
      const inbox = await fetchInbox(20)
      setMessages(inbox)
    } catch (e) {
      setError(e.message || 'Connexion Google impossible.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    if (!connected) return
    setLoading(true)
    setError(null)
    try {
      const inbox = await fetchInbox(20)
      setMessages(inbox)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDisconnect() {
    signOutGoogle()
    setConnected(false)
    setMessages(MOCK_INBOX)
    setSelectedId(null)
  }

  const unread = messages.filter((m) => m.unread).length

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Boîte de réception</h1>
          <p className="text-sm text-navy-500">
            action.renovation67@gmail.com · {unread} non lu{unread > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {connected ? (
            <>
              <button onClick={handleRefresh} disabled={loading} className="btn-ghost">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
              <button onClick={handleDisconnect} className="btn-ghost">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </>
          ) : (
            <button onClick={handleConnect} disabled={loading} className="btn-accent">
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Connecter Gmail</span>
            </button>
          )}
        </div>
      </div>

      {!isGmailConfigured && (
        <div className="card card-pad flex gap-3 bg-amber-50 border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Mode démo (données simulées)</p>
            <p className="text-amber-800 mt-0.5">
              Pour activer la vraie connexion Gmail, renseigne{' '}
              <code className="bg-white/60 rounded px-1 py-0.5 text-xs">VITE_GOOGLE_CLIENT_ID</code> et{' '}
              <code className="bg-white/60 rounded px-1 py-0.5 text-xs">VITE_GOOGLE_API_KEY</code> dans{' '}
              <code className="bg-white/60 rounded px-1 py-0.5 text-xs">.env.local</code>.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="card card-pad bg-red-50 border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div className="card card-pad text-center py-12">
          <InboxIcon className="w-10 h-10 text-navy-200 mx-auto mb-3" />
          <p className="text-sm text-navy-500">Boîte vide.</p>
        </div>
      ) : (
        <div className="card divide-y divide-navy-100">
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} onOpen={() => setSelectedId(m.id)} />
          ))}
        </div>
      )}

      {selectedId && (
        <MessageDetailModal
          messageId={selectedId}
          fallback={messages.find((m) => m.id === selectedId)}
          connected={connected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function MessageRow({ message, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left flex items-start gap-3 px-5 py-4 transition hover:bg-navy-50/40 ${
        message.unread ? 'bg-accent-50/30' : ''
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-semibold text-xs ${
          message.unread ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-700'
        }`}
      >
        {initials(message.from)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`text-sm truncate ${
              message.unread ? 'font-semibold text-navy-900' : 'font-medium text-navy-700'
            }`}
          >
            {cleanName(message.from)}
          </p>
          <span className="text-[11px] text-navy-400 whitespace-nowrap">{message.date}</span>
        </div>
        <p
          className={`text-sm truncate ${
            message.unread ? 'text-navy-900 font-medium' : 'text-navy-600'
          }`}
        >
          {message.subject || '(sans objet)'}
        </p>
        <p className="text-xs text-navy-500 truncate mt-0.5">{message.snippet}</p>
      </div>
      {message.unread && (
        <span className="w-2 h-2 rounded-full bg-accent-500 shrink-0 mt-2.5" />
      )}
    </button>
  )
}

/* ============================================================
 *  Modal de lecture d'un mail
 * ============================================================ */
function MessageDetailModal({ messageId, fallback, connected, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (connected) {
          // Vraie API Gmail : charger le corps complet
          const full = await getMessageFull(messageId)
          if (!cancelled) setData(full)
        } else {
          // Mode démo : utiliser le fallback déjà chargé
          if (!cancelled) {
            setData({
              ...fallback,
              html: fallback.html || '',
              plain: fallback.plain || fallback.snippet || '',
            })
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Impossible de charger ce mail.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [messageId, connected, fallback])

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-navy-950/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-none sm:rounded-2xl shadow-card flex flex-col h-full sm:h-auto sm:max-h-[92vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 bg-white px-4 sm:px-6 py-4 border-b border-navy-100 flex items-center gap-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <button
            onClick={onClose}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-navy-50"
            aria-label="Fermer"
          >
            <ArrowLeft className="w-5 h-5 text-navy-700 sm:hidden" />
            <X className="w-5 h-5 text-navy-700 hidden sm:block" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-navy-900 truncate">
              {data?.subject || fallback?.subject || '(sans objet)'}
            </p>
            <p className="text-xs text-navy-500 truncate">
              {cleanName(data?.from || fallback?.from)} · {data?.date || fallback?.date}
            </p>
          </div>
          {connected && data?.id && (
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${data.id}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-navy-50 text-navy-500"
              title="Ouvrir dans Gmail"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-sm text-navy-500">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-navy-300" />
              Chargement du mail…
            </div>
          )}
          {error && (
            <div className="m-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
          {!loading && !error && data && <MailBody data={data} />}
        </div>
      </div>
    </div>
  )
}

function MailBody({ data }) {
  // Priorité au HTML (rendu propre dans iframe sandboxée), fallback texte brut
  if (data.html) {
    return (
      <iframe
        srcDoc={wrapHtml(data.html)}
        sandbox="allow-popups allow-same-origin"
        className="w-full min-h-[60vh] border-0"
        title="Corps du mail"
      />
    )
  }
  if (data.plain) {
    return (
      <pre className="whitespace-pre-wrap p-5 sm:p-6 text-sm text-navy-800 font-sans leading-relaxed">
        {data.plain}
      </pre>
    )
  }
  return (
    <p className="p-6 text-sm text-navy-500 italic">
      Ce mail n'a pas de contenu lisible (pièce jointe uniquement ?).
    </p>
  )
}

/** Wrappe le HTML du mail dans un document minimal avec styles propres. */
function wrapHtml(html) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  body {
    margin: 0;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
    font-size: 14px;
    color: #0f2742;
    line-height: 1.6;
    word-wrap: break-word;
  }
  img { max-width: 100%; height: auto; }
  a { color: #f97316; }
  blockquote {
    border-left: 3px solid #dbe5f1;
    padding-left: 12px;
    margin-left: 0;
    color: #5a83b0;
  }
  pre, code {
    background: #f1f3f7;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  table { max-width: 100%; }
</style>
</head>
<body>${html}</body>
</html>`
}

function cleanName(from) {
  if (!from) return 'Inconnu'
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return (match ? match[1] : from).trim()
}

function initials(from) {
  const name = cleanName(from)
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'M'
}
