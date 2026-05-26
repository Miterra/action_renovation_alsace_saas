import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import MobileTabBar from './MobileTabBar.jsx'
import TopBar from './TopBar.jsx'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar desktop (toujours visible ≥ md) */}
      <Sidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main
          className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-8 max-w-6xl w-full mx-auto"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
          <Outlet />
        </main>

        {/* Tab bar style iOS, visible uniquement sur mobile */}
        <MobileTabBar />
      </div>
    </div>
  )
}
