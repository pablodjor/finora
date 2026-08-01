import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import CategoryForm from '../../components/forms/CategoryForm'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as categoriesService from '../../services/categories'

export default function CategoriesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const data = await categoriesService.listUserCategories(user.id)
      setItems(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleSubmit(values) {
    setBusy(true)
    try {
      if (editing) {
        await categoriesService.updateCategory(editing.id, values)
        toast.success('Categoría actualizada')
      } else {
        await categoriesService.createCategory({
          ...values,
          user_id: user.id,
          is_system: false,
        })
        toast.success('Categoría creada')
      }
      setModalOpen(false)
      setEditing(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await categoriesService.softDeleteCategory(deleteId)
      toast.success('Categoría eliminada')
      setDeleteId(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Organizá tus ingresos y gastos por categoría."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        }
      />

      {loading ? (
        <Loader fullPage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Sin categorías"
          description="Creá tu primera categoría personal."
          actionLabel="Nueva categoría"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="card flex items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-3.5 w-3.5 rounded-full"
                  style={{ background: item.color }}
                />
                <div>
                  <p className="font-medium">{item.name}</p>
                  <div className="mt-1 flex gap-2">
                    <Badge tone={item.type === 'income' ? 'success' : 'info'}>
                      {item.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </Badge>
                    {!item.is_active ? <Badge>Inactiva</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditing(item)
                    setModalOpen(true)
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
      >
        <CategoryForm
          defaultValues={
            editing
              ? {
                  name: editing.name,
                  type: editing.type,
                  color: editing.color,
                  icon: editing.icon,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          loading={busy}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar categoría"
        message="Solo se puede eliminar si no tiene movimientos asociados."
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}
