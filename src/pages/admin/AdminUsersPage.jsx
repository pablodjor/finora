import { useEffect, useState } from 'react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Select from '../../components/common/Select'
import Loader from '../../components/common/Loader'
import { useToast } from '../../contexts/ToastContext'
import * as profilesService from '../../services/profiles'
import { ROLE_LABELS, ROLE_OPTIONS } from '../../lib/constants'
import { formatDate } from '../../utils/dates'

function roleTone(role) {
  if (role === 'admin') return 'warning'
  if (role === 'emmita') return 'danger'
  return 'info'
}

export default function AdminUsersPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [savingRoleId, setSavingRoleId] = useState(null)

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

  async function changeRole(user, role) {
    if (role === user.role) return
    setSavingRoleId(user.id)
    try {
      await profilesService.setUserRole(user.id, role)
      toast.success(`Rol actualizado a ${ROLE_LABELS[role] || role}`)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingRoleId(null)
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
                      <div className="flex min-w-[11rem] flex-col gap-2">
                        <Badge tone={roleTone(user.role)}>{ROLE_LABELS[user.role] || user.role}</Badge>
                        <Select
                          searchable={false}
                          options={ROLE_OPTIONS}
                          value={user.role}
                          disabled={savingRoleId === user.id}
                          onChange={(e) => changeRole(user, e.target.value)}
                        />
                      </div>
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
