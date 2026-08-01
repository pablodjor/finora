import { Menu, Moon, Sun, Plus, LogOut } from 'lucide-react'
import Button from '../common/Button'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useTransactionModal } from '../../contexts/TransactionModalContext'

export default function Header({ title, onMenuClick }) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const { signOut } = useAuth()
  const toast = useToast()
  const { openCreate } = useTransactionModal()

  async function handleLogout() {
    try {
      await signOut()
      toast.info('Sesión cerrada')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Finora</p>
          <h1 className="text-lg font-semibold leading-tight">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={() => openCreate({ type: 'expense' })}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Gasto rápido</span>
        </Button>
      </div>
    </header>
  )
}
