import { Menu, Bell, BellOff } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  getPermissionStatus,
  requestPermission,
  getFcmToken,
  isIos,
  isStandalone,
} from '../lib/notifications.js'
import { useState, useEffect } from 'react'

export default function TopBar({ onMenuClick }) {
  const { notifEnabled, setNotifEnabled } = useApp()
  const [permission, setPermission] = useState('default')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(null)

  useEffect(() => {
    setPermission(getPermissionStatus())
  }, [])

  async function handleEnable() {
    setBusy(true)
    setHint(null)
    try {
      const perm = await requestPermission()
      setPermission(perm)
      if (perm === 'granted') {
        setNotifEnabled(true)
        const token = await getFcmToken()
        if (token) {
          console.info('[Push] Token FCM :', token)
          // TODO backend : POST /api/push/register { token }
        }
      } else {
        setHint('Permission refusée.')
      }
    } catch (e) {
      setHint(e.message)
    } finally {
      setBusy(false)
    }
  }

  const granted = permission === 'granted' && notifEnabled

  return (
    <header
      className="sticky top-0 z-30 bg-surface/85 backdrop-blur border-b border-navy-100"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-navy-50"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5 text-navy-800" />
          </button>
          <div>
            <p className="font-semibold text-navy-900 text-sm sm:text-base">
              {greeting()}, Halil
            </p>
            <p className="text-[11px] sm:text-xs text-navy-500">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
        </div>

        <button
          onClick={handleEnable}
          disabled={busy || granted}
          title={
            granted
              ? 'Notifications activées'
              : isIos() && !isStandalone()
                ? 'Installe l\'app sur l\'écran d\'accueil pour activer les notifs (iOS)'
                : 'Activer les notifications'
          }
          className={`btn ${granted ? 'btn-ghost text-emerald-600' : 'btn-accent'} px-3 py-2`}
        >
          {granted ? (
            <>
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Activées</span>
            </>
          ) : (
            <>
              <BellOff className="w-4 h-4" />
              <span className="hidden sm:inline">Activer notifs</span>
            </>
          )}
        </button>
      </div>
      {hint && (
        <div className="px-4 sm:px-6 lg:px-8 pb-2 max-w-6xl mx-auto">
          <p className="text-xs text-accent-700 bg-accent-50 border border-accent-100 rounded-lg px-3 py-2">
            {hint}
          </p>
        </div>
      )}
    </header>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}
