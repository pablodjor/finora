import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import MobileNav from '../components/layout/MobileNav'
import Header from '../components/layout/Header'
import TransactionModal from '../components/forms/TransactionModal'
import ExpenseChatPanel, { ExpenseChatFab } from '../components/chat/ExpenseChatPanel'
import { TransactionModalProvider } from '../contexts/TransactionModalContext'
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from '../lib/constants'

function resolveTitle(pathname) {
  const all = [...NAV_ITEMS, ...ADMIN_NAV_ITEMS]
  const exact = all.find((item) => item.to === pathname)
  if (exact) return exact.label

  // Preferir la ruta más larga (evita que /admin tape /admin/usuarios)
  const partial = all
    .filter((item) => pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]

  return partial?.label || 'Finora'
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const location = useLocation()

  return (
    <TransactionModalProvider>
      <div className="flex min-h-screen bg-[var(--bg)]">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header title={resolveTitle(location.pathname)} onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 px-4 py-5 pb-24 md:px-6 lg:pb-8">
            <Outlet />
          </main>
        </div>
        <MobileNav />
        <TransactionModal />
        {!chatOpen ? <ExpenseChatFab onClick={() => setChatOpen(true)} /> : null}
        <ExpenseChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </TransactionModalProvider>
  )
}
