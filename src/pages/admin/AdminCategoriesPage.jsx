import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loader from '../../components/common/Loader'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import CategoryForm from '../../components/forms/CategoryForm'
import { useToast } from '../../contexts/ToastContext'
import * as categoriesService from '../../services/categories'

export default function AdminCategoriesPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setItems(await categoriesService.listSystemCategories())
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

  async function handleSubmit(values) {
    setBusy(true)
    try {
      if (editing) {
        await categoriesService.updateCategory(editing.id, values)
        toast.success('Categoría actualizada')
      } else {
        await categoriesService.createCategory({
          ...values,
          is_system: true,
          user_id: null,
        })
        toast.success('Categoría de sistema creada')
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
        title="Categorías del sistema"
        description="Plantillas predeterminadas disponibles para todos los usuarios."
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="card flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: item.color }} />
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{item.type}</p>
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
        title={editing ? 'Editar categoría' : 'Nueva categoría de sistema'}
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
        message="¿Confirmás eliminar esta categoría del sistema?"
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}
