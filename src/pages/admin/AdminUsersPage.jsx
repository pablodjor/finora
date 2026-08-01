import { useEffect, useState } from 'react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import { useToast } from '../../contexts/ToastContext'
import * as profilesService from '../../services/profiles'
import { formatDate } from '../../utils/dates'

export default function AdminUsersPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  async function load() {
    setLoading(true)
    try {
      setUsers(await profilesService.listProfiles())
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleActive(user) {
    try {
      await profilesService.setUserActive(user.id, !user.is_active)
      toast.success(user.is_active ? 'Usuario desactivado' : 'Usuario activado')
      load()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div>
      <PageHeader title="Usuarios" description="Administrá el acceso a la plataforma." />
      {loading ? (
        <Loader fullPage />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.role === 'admin' ? 'warning' : 'info'}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={user.is_active ? 'outline' : 'primary'}
                        onClick={() => toggleActive(user)}
                      >
                        {user.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
