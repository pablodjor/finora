import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Select from '../../components/common/Select'
import CurrencyInput from '../../components/common/CurrencyInput'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as budgetsService from '../../services/budgets'
import { listUserCategories } from '../../services/categories'
import { listTransactions } from '../../services/transactions'
import { formatCurrency } from '../../utils/currency'
import { currentYearMonth } from '../../utils/dates'
import { MONTHS, YEARS } from '../../lib/constants'
import { percentage } from '../../utils/formatters'
import { bindSelect } from '../../utils/formSelect'

const schema = z.object({
  category_id: z.string().min(1, 'Seleccioná una categoría'),
  amount: z.coerce.number().positive('Ingresá un monto'),
})

function BudgetForm({ categories, defaultValues, onSubmit, onCancel, loading }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { category_id: '', amount: '', ...defaultValues },
  })
  const amount = watch('amount')

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Select
        label="Categoría"
        required
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        error={errors.category_id?.message}
        {...bindSelect('category_id', { watch, setValue, register })}
      />
      <CurrencyInput
        label="Monto presupuestado"
        required
        value={amount}
        onChange={(v) => setValue('amount', v, { shouldValidate: true })}
        error={errors.amount?.message}
      />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" loading={loading}>
          Guardar
        </Button>
      </div>
    </form>
  )
}

export default function BudgetsPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'
  const now = currentYearMonth()
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState([])
  const [spentMap, setSpentMap] = useState({})
  const [categories, setCategories] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const [list, cats, txs] = await Promise.all([
        budgetsService.listBudgets(user.id, { year, month }),
        listUserCategories(user.id, { type: 'expense' }),
        listTransactions(user.id, { year, month, type: 'expense' }),
      ])
      setBudgets(list)
      setCategories(cats)
      const map = {}
      txs
        .filter((t) => t.status !== 'cancelled' && t.category_id)
        .forEach((t) => {
          map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount)
        })
      setSpentMap(map)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, year, month])

  const rows = useMemo(
    () =>
      budgets.map((b) => {
        const spent = spentMap[b.category_id] || 0
        const amount = Number(b.amount)
        const pct = percentage(spent, amount)
        const remaining = amount - spent
        let tone = 'success'
        if (pct >= 100) tone = 'danger'
        else if (pct >= 80) tone = 'warning'
        return { ...b, spent, amount, pct, remaining, tone }
      }),
    [budgets, spentMap],
  )

  async function handleSubmit(values) {
    setBusy(true)
    try {
      const payload = {
        category_id: values.category_id,
        amount: Number(values.amount),
        year,
        month,
        user_id: user.id,
      }
      if (editing) {
        await budgetsService.updateBudget(editing.id, {
          category_id: payload.category_id,
          amount: payload.amount,
        })
        toast.success('Presupuesto actualizado')
      } else {
        await budgetsService.createBudget(payload)
        toast.success('Presupuesto creado')
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
      await budgetsService.softDeleteBudget(deleteId)
      toast.success('Presupuesto eliminado')
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
        title="Presupuestos"
        description="Definí límites mensuales por categoría y seguí el avance."
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

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 sm:max-w-md">
        <Select
          label="Mes"
          placeholder={null}
          options={MONTHS}
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Select
          label="Año"
          placeholder={null}
          options={YEARS}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      {loading ? (
        <Loader fullPage />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin presupuestos"
          description="Creá un presupuesto para controlar gastos por categoría."
          actionLabel="Nuevo presupuesto"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{item.category?.name || 'Categoría'}</h3>
                  <Badge tone={item.tone} className="mt-1">
                    {item.pct >= 100 ? 'Excedido' : item.pct >= 80 ? 'Advertencia' : 'Normal'}
                  </Badge>
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
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Presupuestado</span>
                  <span className="font-amount">{formatCurrency(item.amount, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Gastado</span>
                  <span className="font-amount">{formatCurrency(item.spent, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Restante</span>
                  <span className="font-amount">{formatCurrency(item.remaining, currency)}</span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className={`h-full rounded-full ${
                    item.tone === 'danger'
                      ? 'bg-red-500'
                      : item.tone === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-primary-500'
                  }`}
                  style={{ width: `${Math.min(100, item.pct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{item.pct}% utilizado</p>
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
        title={editing ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      >
        <BudgetForm
          categories={categories}
          defaultValues={
            editing
              ? { category_id: editing.category_id, amount: Number(editing.amount) }
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
        title="Eliminar presupuesto"
        message="¿Confirmás eliminar este presupuesto?"
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}
