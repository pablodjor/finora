import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Loader from '../components/common/Loader'

export default function AdminRoute() {
  const { isAdmin, loading, isAuthenticated } = useAuth()

  if (loading) return <Loader fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
