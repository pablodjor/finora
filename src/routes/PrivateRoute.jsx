import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Loader from '../components/common/Loader'

export default function PrivateRoute() {
  const { isAuthenticated, loading, isActive } = useAuth()
  const location = useLocation()

  if (loading) return <Loader fullPage />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">Cuenta desactivada</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Tu usuario fue desactivado. Contactá a un administrador.
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
