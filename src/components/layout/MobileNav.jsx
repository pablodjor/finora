import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Repeat, PlusCircle, User } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useTransactionModal } from '../../contexts/TransactionModalContext'

const items = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { action: 'create', label: 'Nuevo', icon: PlusCircle, accent: true },
  { to: '/gastos-fijos', label: 'Fijos', icon: Repeat },
  { to: '/perfil', label: 'Perfil', icon: User },
]

export default function MobileNav() {
  const { openCreate } = useTransactionModal()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-5 gap-1 py-2">
        {items.map((item) => {
          const Icon = item.icon
          if (item.action === 'create') {
            return (
              <li key="create">
                <button
                  type="button"
                  onClick={() => openCreate({ type: 'expense' })}
                  className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium text-primary-600"
                >
                  <Icon className="h-6 w-6" />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          }
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium',
                    isActive ? 'text-primary-600' : 'text-[var(--text-muted)]',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
