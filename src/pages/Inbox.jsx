import { useEffect, useState } from 'react'
import {
  Mail,
  RefreshCw,
  LogIn,
  LogOut,
  AlertTriangle,
  Inbox as InboxIcon,
} from 'lucide-react'
import {
  isGmailConfigured,
  signInWithGoogle,
  signOutGoogle,
  isSignedIn,
  fetchInbox,
  MOCK_INBOX,
} from '../lib/gmail.js'

export default function Inbox() {
  const [messages, setMessages] = useState(MOCK_INBOX)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
            <MessageRow key={m.id} message={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function MessageRow({ message }) {
  return (
    <article
      className={`flex items-start gap-3 px-5 py-4 transition hover:bg-navy-50/40 cursor-pointer ${
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
    </article>
  )
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
