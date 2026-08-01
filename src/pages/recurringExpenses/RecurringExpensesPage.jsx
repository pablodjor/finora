import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Repeat, Play } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import RecurringExpenseForm from '../../components/forms/RecurringExpenseForm'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as recurringService from '../../services/recurringExpenses'
import * as categoriesService from '../../services/categories'
import * as paymentMethodsService from '../../services/paymentMethods'
import { formatCurrency } from '../../utils/currency'
import { currentYearMonth } from '../../utils/dates'

export default function RecurringExpensesPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const [recs, cats, methods] = await Promise.all([
        recurringService.listRecurringExpenses(user.id),
        categoriesService.listUserCategories(user.id, { type: 'expense' }),
        paymentMethodsService.listPaymentMethods(user.id),
      ])
      setItems(recs)
      setCategories(cats)
      setPaymentMethods(methods.filter((m) => m.is_active))
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
      const payload = {
        ...values,
        estimated_amount: Number(values.estimated_amount) || 0,
        due_day: Number(values.due_day),
        reminder_days: Number(values.reminder_days),
        category_id: values.category_id || null,
        payment_method_id: values.payment_method_id || null,
        end_date: values.end_date || null,
        is_template: false,
      }

      if (editing) {
        await recurringService.updateRecurringExpense(editing.id, payload)
        toast.success('Gasto fijo actualizado')
      } else {
        await recurringService.createRecurringExpense({
          ...payload,
          user_id: user.id,
        })
        toast.success('Gasto fijo creado')
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

  async function toggleActive(item) {
    try {
      await recurringService.updateRecurringExpense(item.id, {
        is_active: !item.is_active,
      })
      toast.success(item.is_active ? 'Gasto fijo desactivado' : 'Gasto fijo activado')
      load()
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function handleGenerate() {
    const { year, month } = currentYearMonth()
    setBusy(true)
    try {
      const count = await recurringService.generateMonthInstances(user.id, year, month)
      toast.success(
        count > 0
          ? `Se generaron ${count} movimiento(s) del mes`
          : 'No había gastos fijos pendientes de generar',
      )
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await recurringService.softDeleteRecurringExpense(deleteId)
      toast.success('Gasto fijo eliminado')
      setDeleteId(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const currency = profile?.currency || 'ARS'

  return (
    <div>
      <PageHeader
        title="Gastos fijos"
        description="Activá, personalizá y generá tus recurrentes mensuales."
        actions={
          <>
            <Button variant="outline" onClick={handleGenerate} loading={busy}>
              <Play className="h-4 w-4" />
              Generar mes
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </>
        }
      />

      {loading ? (
        <Loader fullPage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Sin gastos fijos"
          description="Al registrarte se crean plantillas sugeridas. También podés crear las tuyas."
          actionLabel="Crear gasto fijo"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <Badge tone={item.is_active ? 'success' : 'neutral'}>
                      {item.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {item.is_template ? <Badge tone="info">Sugerido</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Vence el día {item.due_day} · {item.category?.name || 'Sin categoría'}
                  </p>
                  <p className="mt-2 font-amount text-lg font-semibold">
                    {formatCurrency(item.estimated_amount, currency)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(item)} title="Activar/desactivar">
                    <Play className="h-4 w-4" />
                  </Button>
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
        title={editing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
        size="lg"
      >
        <RecurringExpenseForm
          defaultValues={
            editing
              ? {
                  name: editing.name,
                  estimated_amount: Number(editing.estimated_amount),
                  due_day: editing.due_day,
                  category_id: editing.category_id || '',
                  payment_method_id: editing.payment_method_id || '',
                  frequency: editing.frequency,
                  start_date: editing.start_date,
                  end_date: editing.end_date || '',
                  reminder_days: editing.reminder_days,
                  auto_renew: editing.auto_renew,
                  is_active: editing.is_active,
                  notes: editing.notes || '',
                }
              : undefined
          }
          categories={categories}
          paymentMethods={paymentMethods}
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
        title="Eliminar gasto fijo"
        message="¿Confirmás eliminar este gasto fijo? Los movimientos ya generados no se borran."
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}
