import { Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-800 dark:border-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-100">
        Estás en el panel de administración de Finora.
      </div>
      <Outlet />
    </div>
  )
}
