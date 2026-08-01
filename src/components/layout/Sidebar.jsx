import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  TrendingUp,
  CreditCard,
  Wallet,
  Target,
  Calendar,
  BarChart3,
  Tags,
  Banknote,
  User,
  Settings,
  Shield,
  Users,
  UsersRound,
  Activity,
  X,
  LogOut,
} from 'lucide-react'
import { ADMIN_NAV_ITEMS, APP_NAME, NAV_ITEMS } from '../../lib/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { cn } from '../../utils/cn'
import Button from '../common/Button'
import logoPrincipal from '../../assets/logoprincipal.png'

const ICONS = {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  TrendingUp,
  CreditCard,
  Wallet,
  Target,
  Calendar,
  BarChart3,
  Tags,
  Banknote,
  User,
  Settings,
  Shield,
  Users,
  UsersRound,
  Activity,
}

function NavItem({ item, onNavigate }) {
  const Icon = ICONS[item.icon] || LayoutDashboard
  // /admin debe ser exacto; si no, queda activo en /admin/usuarios, etc.
  const exact = item.to === '/admin'

  return (
    <NavLink
      to={item.to}
      end={exact}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
          isActive
            ? 'bg-primary-600 text-white'
            : 'text-[var(--sidebar-text)]/80 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin, profile, signOut } = useAuth()
  const toast = useToast()

  async function handleLogout() {
    try {
      await signOut()
      toast.info('Sesión cerrada')
      onClose?.()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/40 lg:hidden',
          open ? 'block' : 'hidden',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col bg-[var(--sidebar)] text-[var(--sidebar-text)] transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logoPrincipal}
              alt={APP_NAME}
              className="h-10 w-10 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-tight text-white">{APP_NAME}</p>
              <p className="text-xs text-primary-300">Finanzas personales</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-white lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onClose} />
          ))}
          {isAdmin ? (
            <div className="pt-4">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                Administración
              </p>
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onClose} />
              ))}
            </div>
          ) : null}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm font-medium text-white">{profile?.full_name}</p>
          <p className="truncate text-xs text-white/50">{profile?.email}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
    </>
  )
}
