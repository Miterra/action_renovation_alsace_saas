import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Calendar, CheckSquare, Inbox, X, HardHat } from 'lucide-react'

const links = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/calendar', label: 'Calendrier & RDV', icon: Calendar },
  { to: '/tasks', label: 'Tâches', icon: CheckSquare },
  { to: '/inbox', label: 'Boîte de réception', icon: Inbox },
]

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:sticky top-0 z-50 md:z-auto h-screen
          w-72 shrink-0 bg-navy-950 text-white
          flex flex-col
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-accent-400" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Action Rénovation</p>
              <p className="text-xs text-navy-300 leading-tight">Alsace · SaaS interne</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/5 text-xs text-navy-300">
          <p className="font-medium text-white/80">action.renovation67@gmail.com</p>
          <p className="mt-1">v0.1.0 · PWA</p>
        </div>
      </aside>
    </>
  )
}
