import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, CreditCard, ShoppingBag } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import CreditCardForm from '../../components/forms/CreditCardForm'
import PurchaseForm from '../../components/forms/PurchaseForm'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as cardsService from '../../services/creditCards'
import { listUserCategories } from '../../services/categories'
import { formatCurrency } from '../../utils/currency'
import { formatDate } from '../../utils/dates'

export default function CreditCardsPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [cardModal, setCardModal] = useState(false)
  const [purchaseModal, setPurchaseModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const [list, cats] = await Promise.all([
        cardsService.listCreditCards(user.id),
        listUserCategories(user.id, { type: 'expense' }),
      ])
      setCards(list)
      setCategories(cats)
      const nextSelected = selectedId && list.some((c) => c.id === selectedId) ? selectedId : list[0]?.id
      setSelectedId(nextSelected || null)
      if (nextSelected) {
        setSummary(await cardsService.getCardSummary(user.id, nextSelected))
      } else {
        setSummary(null)
      }
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

  async function selectCard(id) {
    setSelectedId(id)
    try {
      setSummary(await cardsService.getCardSummary(user.id, id))
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function handleCardSubmit(values) {
    setBusy(true)
    try {
      const payload = {
        ...values,
        bank: values.bank || null,
        last_four: values.last_four || null,
        total_limit: Number(values.total_limit),
        available_limit: Number(values.available_limit),
        closing_day: Number(values.closing_day),
        due_day: Number(values.due_day),
      }
      if (editing) {
        await cardsService.updateCreditCard(editing.id, payload)
        toast.success('Tarjeta actualizada')
      } else {
        await cardsService.createCreditCard({ ...payload, user_id: user.id })
        toast.success('Tarjeta creada')
      }
      setCardModal(false)
      setEditing(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePurchaseSubmit(values) {
    setBusy(true)
    try {
      await cardsService.createPurchaseWithInstallments({
        userId: user.id,
        creditCardId: values.credit_card_id,
        description: values.description,
        totalAmount: Number(values.total_amount),
        installmentsCount: Number(values.installments_count),
        purchaseDate: values.purchase_date,
        categoryId: values.category_id || null,
        notes: values.notes,
      })
      toast.success('Compra registrada y cuotas generadas')
      setPurchaseModal(false)
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
      await cardsService.softDeleteCreditCard(deleteId)
      toast.success('Tarjeta eliminada')
      setDeleteId(null)
      setSelectedId(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader fullPage />

  return (
    <div>
      <PageHeader
        title="Tarjetas"
        description="Administrá límites, cierres y compras en cuotas."
        actions={
          <>
            <Button variant="outline" onClick={() => setPurchaseModal(true)} disabled={!cards.length}>
              <ShoppingBag className="h-4 w-4" />
              Nueva compra
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setCardModal(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nueva tarjeta
            </Button>
          </>
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin tarjetas"
          description="Agregá tu primera tarjeta para cargar consumos y cuotas."
          actionLabel="Nueva tarjeta"
          onAction={() => setCardModal(true)}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => selectCard(card.id)}
                className={`card w-full p-4 text-left transition ${
                  selectedId === card.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{card.name}</p>
                  <span className="h-3 w-3 rounded-full" style={{ background: card.color }} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {card.bank || 'Sin banco'}
                  {card.last_four ? ` · **** ${card.last_four}` : ''}
                </p>
                <p className="mt-2 font-amount text-sm">
                  Disp. {formatCurrency(card.available_limit, currency)}
                </p>
              </button>
            ))}
          </div>

          {summary ? (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{summary.card.name}</h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      Cierre día {summary.card.closing_day} · Vence día {summary.card.due_day}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(summary.card)
                        setCardModal(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(summary.card.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Límite utilizado</p>
                    <p className="font-amount font-semibold">{formatCurrency(summary.used, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Disponible</p>
                    <p className="font-amount font-semibold">
                      {formatCurrency(summary.available, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Cuotas pendientes</p>
                    <p className="font-amount font-semibold">
                      {summary.pendingCount} · {formatCurrency(summary.pendingTotal, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Próximo vencimiento</p>
                    <p className="font-semibold">
                      {summary.nextDue ? formatDate(summary.nextDue) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
                  Cuotas
                </div>
                {summary.installments.length === 0 ? (
                  <p className="p-4 text-sm text-[var(--text-muted)]">Sin cuotas cargadas.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {summary.installments.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {item.purchase?.description || 'Cuota'} · #{item.installment_number}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{formatDate(item.due_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-amount font-semibold">
                            {formatCurrency(item.amount, currency)}
                          </p>
                          <Badge tone={item.status === 'paid' ? 'success' : 'warning'} className="mt-1">
                            {item.status}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        open={cardModal}
        onClose={() => {
          setCardModal(false)
          setEditing(null)
        }}
        title={editing ? 'Editar tarjeta' : 'Nueva tarjeta'}
        size="lg"
      >
        <CreditCardForm
          defaultValues={
            editing
              ? {
                  name: editing.name,
                  bank: editing.bank || '',
                  card_type: editing.card_type,
                  last_four: editing.last_four || '',
                  closing_day: editing.closing_day,
                  due_day: editing.due_day,
                  total_limit: Number(editing.total_limit),
                  available_limit: Number(editing.available_limit),
                  color: editing.color,
                  is_active: editing.is_active,
                }
              : undefined
          }
          onSubmit={handleCardSubmit}
          onCancel={() => {
            setCardModal(false)
            setEditing(null)
          }}
          loading={busy}
        />
      </Modal>

      <Modal
        open={purchaseModal}
        onClose={() => setPurchaseModal(false)}
        title="Nueva compra en cuotas"
        size="lg"
      >
        <PurchaseForm
          cards={cards.filter((c) => c.is_active)}
          categories={categories}
          defaultCardId={selectedId}
          onSubmit={handlePurchaseSubmit}
          onCancel={() => setPurchaseModal(false)}
          loading={busy}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar tarjeta"
        message="¿Confirmás eliminar esta tarjeta?"
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}
