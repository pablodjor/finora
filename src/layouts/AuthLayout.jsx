import { Outlet, Navigate } from 'react-router-dom'
import { APP_NAME } from '../lib/constants'
import { useAuth } from '../contexts/AuthContext'
import Loader from '../components/common/Loader'
import logoPrincipal from '../assets/logoprincipal.png'

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <Loader fullPage label="Preparando sesión..." />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at top left, rgba(16,185,129,0.18), transparent 45%), radial-gradient(ellipse at bottom right, rgba(16,42,67,0.25), transparent 50%), var(--bg)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <img
            src={logoPrincipal}
            alt={APP_NAME}
            className="mx-auto h-20 w-auto rounded-xl object-contain sm:h-24"
          />
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Organizá ingresos, gastos y recurrentes con claridad.
          </p>
        </div>
        <div className="card p-6 sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
