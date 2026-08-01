import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Banknote } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import PaymentMethodForm from '../../components/forms/PaymentMethodForm'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as paymentMethodsService from '../../services/paymentMethods'

export default function PaymentMethodsPage() {
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
      setItems(await paymentMethodsService.listPaymentMethods(user.id))
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
        await paymentMethodsService.updatePaymentMethod(editing.id, values)
        toast.success('Método actualizado')
      } else {
        await paymentMethodsService.createPaymentMethod({
          ...values,
          user_id: user.id,
        })
        toast.success('Método creado')
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
      await paymentMethodsService.softDeletePaymentMethod(deleteId)
      toast.success('Método eliminado')
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
        title="Métodos de pago"
        description="Administrá cómo pagás y cobrás."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        }
      />

      {loading ? (
        <Loader fullPage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Sin métodos de pago"
          description="Agregá efectivo, transferencias, tarjetas y más."
          actionLabel="Nuevo método"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                  style={{ background: item.color }}
                >
                  <Banknote className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium">{item.name}</p>
                  <Badge tone={item.is_active ? 'success' : 'neutral'} className="mt-1">
                    {item.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
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
        title={editing ? 'Editar método' : 'Nuevo método'}
      >
        <PaymentMethodForm
          defaultValues={
            editing
              ? {
                  name: editing.name,
                  type: editing.type,
                  color: editing.color,
                  icon: editing.icon,
                  is_active: editing.is_active,
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
        title="Eliminar método de pago"
        message="¿Confirmás eliminar este método de pago?"
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}
