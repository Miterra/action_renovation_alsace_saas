import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Calendar, CheckSquare, Inbox } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Accueil', icon: LayoutDashboard, end: true },
  { to: '/calendar', label: 'RDV', icon: Calendar },
  { to: '/tasks', label: 'Tâches', icon: CheckSquare },
  { to: '/inbox', label: 'Mails', icon: Inbox },
]

export default function MobileTabBar() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-navy-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="flex items-stretch justify-around max-w-md mx-auto">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition
                ${isActive ? 'text-accent-600' : 'text-navy-400 hover:text-navy-700'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : ''}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
