import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Target, PiggyBank } from 'lucide-react'
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
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import CurrencyInput from '../../components/common/CurrencyInput'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as savingsService from '../../services/savings'
import { formatCurrency } from '../../utils/currency'
import { formatDate, toISODate, nowInArgentina } from '../../utils/dates'
import { CATEGORY_COLORS } from '../../lib/constants'
import { bindSelect } from '../../utils/formSelect'

const goalSchema = z.object({
  name: z.string().min(2),
  target_amount: z.coerce.number().positive(),
  saved_amount: z.coerce.number().min(0).optional(),
  deadline: z.string().optional().nullable(),
  color: z.string().min(1),
  icon: z.string().min(1),
  status: z.string().min(1),
})

const contribSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  notes: z.string().optional(),
})

export default function SavingsGoalsPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [contribOpen, setContribOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  const goalForm = useForm({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      target_amount: '',
      saved_amount: 0,
      deadline: '',
      color: CATEGORY_COLORS[0],
      icon: 'Target',
      status: 'active',
    },
  })

  const contribForm = useForm({
    resolver: zodResolver(contribSchema),
    defaultValues: {
      amount: '',
      date: toISODate(nowInArgentina()),
      notes: '',
    },
  })

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      setGoals(await savingsService.listGoals(user.id))
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

  async function handleGoalSubmit(values) {
    setBusy(true)
    try {
      const payload = {
        name: values.name,
        target_amount: Number(values.target_amount),
        saved_amount: Number(values.saved_amount || 0),
        deadline: values.deadline || null,
        color: values.color,
        icon: values.icon,
        status: values.status,
        suggested_monthly: 0,
      }
      payload.suggested_monthly = savingsService.calcMonthlyNeeded(payload)

      if (editing) {
        await savingsService.updateGoal(editing.id, payload)
        toast.success('Objetivo actualizado')
      } else {
        await savingsService.createGoal({ ...payload, user_id: user.id })
        toast.success('Objetivo creado')
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

  async function handleContribSubmit(values) {
    setBusy(true)
    try {
      await savingsService.addContribution({
        userId: user.id,
        goalId: selectedGoal.id,
        amount: Number(values.amount),
        date: values.date,
        notes: values.notes,
      })
      toast.success('Aporte registrado')
      setContribOpen(false)
      setSelectedGoal(null)
      contribForm.reset({ amount: '', date: toISODate(nowInArgentina()), notes: '' })
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
      await savingsService.softDeleteGoal(deleteId)
      toast.success('Objetivo eliminado')
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
        title="Objetivos de ahorro"
        description="Definí metas y registrá aportes mensuales."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              goalForm.reset({
                name: '',
                target_amount: '',
                saved_amount: 0,
                deadline: '',
                color: CATEGORY_COLORS[0],
                icon: 'Target',
                status: 'active',
              })
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
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sin objetivos"
          description="Creá un objetivo como viaje, auto o fondo de emergencia."
          actionLabel="Nuevo objetivo"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {goals.map((goal) => {
            const progress = savingsService.calcProgress(goal)
            const monthly = savingsService.calcMonthlyNeeded(goal)
            const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.saved_amount))
            return (
              <div key={goal.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{goal.name}</h3>
                    <Badge className="mt-1" tone={goal.status === 'completed' ? 'success' : 'info'}>
                      {goal.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Aportar"
                      onClick={() => {
                        setSelectedGoal(goal)
                        setContribOpen(true)
                      }}
                    >
                      <PiggyBank className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(goal)
                        goalForm.reset({
                          name: goal.name,
                          target_amount: Number(goal.target_amount),
                          saved_amount: Number(goal.saved_amount),
                          deadline: goal.deadline || '',
                          color: goal.color,
                          icon: goal.icon,
                          status: goal.status,
                        })
                        setModalOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(goal.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Ahorrado</span>
                    <span className="font-amount">
                      {formatCurrency(goal.saved_amount, currency)} /{' '}
                      {formatCurrency(goal.target_amount, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Falta</span>
                    <span className="font-amount">{formatCurrency(remaining, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Aporte mensual sugerido</span>
                    <span className="font-amount">{formatCurrency(monthly, currency)}</span>
                  </div>
                  {goal.deadline ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Fecha límite: {formatDate(goal.deadline)}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${progress}%`, background: goal.color }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">{progress}% completado</p>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Editar objetivo' : 'Nuevo objetivo'}
      >
        <form className="space-y-4" onSubmit={goalForm.handleSubmit(handleGoalSubmit)} noValidate>
          <Input label="Nombre" required {...goalForm.register('name')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyInput
              label="Monto objetivo"
              required
              value={goalForm.watch('target_amount')}
              onChange={(v) => goalForm.setValue('target_amount', v, { shouldValidate: true })}
            />
            <CurrencyInput
              label="Ya ahorrado"
              value={goalForm.watch('saved_amount')}
              onChange={(v) => goalForm.setValue('saved_amount', v)}
            />
            <Input label="Fecha límite" type="date" {...goalForm.register('deadline')} />
            <Select
              label="Estado"
              options={[
                { value: 'active', label: 'Activo' },
                { value: 'paused', label: 'Pausado' },
                { value: 'completed', label: 'Completado' },
                { value: 'cancelled', label: 'Cancelado' },
              ]}
              {...bindSelect('status', {
                watch: goalForm.watch,
                setValue: goalForm.setValue,
                register: goalForm.register,
              })}
            />
            <Input label="Color" type="color" {...goalForm.register('color')} />
            <Input label="Icono" {...goalForm.register('icon')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={contribOpen}
        onClose={() => setContribOpen(false)}
        title={`Aportar a ${selectedGoal?.name || ''}`}
      >
        <form
          className="space-y-4"
          onSubmit={contribForm.handleSubmit(handleContribSubmit)}
          noValidate
        >
          <CurrencyInput
            label="Monto"
            required
            value={contribForm.watch('amount')}
            onChange={(v) => contribForm.setValue('amount', v, { shouldValidate: true })}
          />
          <Input label="Fecha" type="date" {...contribForm.register('date')} />
          <Input label="Notas" {...contribForm.register('notes')} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setContribOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Guardar aporte
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar objetivo"
        message="¿Confirmás eliminar este objetivo de ahorro?"
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}
