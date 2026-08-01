import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { updateProfile } = useAuth()
  const toast = useToast()

  async function saveTheme(next) {
    setTheme(next)
    try {
      await updateProfile({ theme: next })
      toast.success('Tema actualizado')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Preferencias generales de la aplicación."
      />
      <div className="card max-w-2xl space-y-4 p-5">
        <div>
          <h3 className="font-semibold">Apariencia</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Tema actual: {theme} (resuelto: {resolvedTheme})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={theme === 'light' ? 'primary' : 'outline'} onClick={() => saveTheme('light')}>
              Claro
            </Button>
            <Button variant={theme === 'dark' ? 'primary' : 'outline'} onClick={() => saveTheme('dark')}>
              Oscuro
            </Button>
            <Button
              variant={theme === 'system' ? 'primary' : 'outline'}
              onClick={() => saveTheme('system')}
            >
              Sistema
            </Button>
          </div>
        </div>
        <div className="border-t border-[var(--border)] pt-4">
          <h3 className="font-semibold">Moneda y región</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Por defecto se usa ARS con formato argentino y zona horaria America/Argentina/Buenos_Aires.
            Podés cambiar la moneda desde tu perfil.
          </p>
        </div>
      </div>
    </div>
  )
}
