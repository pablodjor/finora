import { useEffect, useState } from 'react'
import {
  Camera,
  Copy,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  ArrowLeftRight,
  Upload,
  RefreshCw,
} from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Select from '../../components/common/Select'
import Input from '../../components/common/Input'
import FiltersPanel from '../../components/common/FiltersPanel'
import ReceiptThumb, { ReceiptLightbox } from '../../components/common/ReceiptThumb'
import ImportSantanderModal from '../../components/forms/ImportSantanderModal'
import { applyMovementPaymentEffects } from '../../utils/paymentEffects'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useTransactionModal } from '../../contexts/TransactionModalContext'
import * as transactionsService from '../../services/transactions'
import * as categoriesService from '../../services/categories'
import * as paymentMethodsService from '../../services/paymentMethods'
import { formatCurrency } from '../../utils/currency'
import { formatDate, currentYearMonth, getMonthRange } from '../../utils/dates'
import { statusLabel, statusTone } from '../../utils/formatters'
import { MONTHS, TRANSACTION_TYPES, YEARS } from '../../lib/constants'

export default function TransactionsPage({ typeFilter }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const { openCreate, openEdit, version } = useTransactionModal()
  const { year: currentYear, month: currentMonth } = currentYearMonth()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const initialRange = getMonthRange(currentYear, currentMonth)
  const [filters, setFilters] = useState({
    year: currentYear,
    month: currentMonth,
    from: initialRange.from,
    to: initialRange.to,
    type: typeFilter || '',
    categoryId: '',
    paymentMethodId: '',
  })
  const [deleteId, setDeleteId] = useState(null)
  const [duplicateItem, setDuplicateItem] = useState(null)
  const [busy, setBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState(null)

  function applyMonthYear(year, month) {
    const range = getMonthRange(year, month)
    setFilters((f) => ({
      ...f,
      year,
      month,
      from: range.from,
      to: range.to,
    }))
  }

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const query = {
        type: filters.type || undefined,
        categoryId: filters.categoryId || undefined,
        paymentMethodId: filters.paymentMethodId || undefined,
      }
      if (filters.from && filters.to) {
        query.from = filters.from
        query.to = filters.to
      } else {
        query.year = Number(filters.year)
        query.month = Number(filters.month)
      }

      const [txs, cats, methods] = await Promise.all([
        transactionsService.listTransactions(user.id, query),
        categoriesService.listUserCategories(user.id),
        paymentMethodsService.listPaymentMethods(user.id),
      ])
      setItems(txs)
      setCategories(cats)
      setPaymentMethods(methods)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    filters.year,
    filters.month,
    filters.from,
    filters.to,
    filters.type,
    filters.categoryId,
    filters.paymentMethodId,
    version,
  ])

  async function handleDelete() {
    setBusy(true)
    try {
      const tx = items.find((i) => i.id === deleteId)
      await transactionsService.softDeleteTransaction(deleteId)
      if (tx) {
        await applyMovementPaymentEffects({
          userId: user.id,
          previous: tx,
          next: null,
          paymentMethods,
          options: { createCardPurchase: false },
        })
      }
      toast.success('Movimiento eliminado')
      setDeleteId(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkPaid(id) {
    try {
      await transactionsService.markTransactionPaid(id)
      toast.success('Marcado como pagado')
      load()
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function handleDuplicateConfirm() {
    if (!duplicateItem) return
    setBusy(true)
    try {
      await transactionsService.duplicateTransaction(duplicateItem, user.id)
      toast.success('Movimiento duplicado')
      setDuplicateItem(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const title = typeFilter === 'income' ? 'Ingresos' : 'Movimientos'
  const currency = profile?.currency || 'ARS'

  return (
    <div>
      <PageHeader
        title={title}
        description="Registrá y organizá tus ingresos y gastos."
        actions={
          <>
            <Button
              variant="outline"
              title="Recargar"
              loading={loading}
              onClick={() => load()}
            >
              <RefreshCw className="h-4 w-4" />
              Recargar
            </Button>
            {!typeFilter ? (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="lg"
              className="min-h-12 flex-1 sm:min-h-11 sm:flex-none"
              onClick={() => openCreate({ type: typeFilter || 'expense', openCamera: true })}
            >
              <Camera className="h-5 w-5" />
              Foto
            </Button>
            <Button
              size="lg"
              className="min-h-12 flex-1 sm:min-h-11 sm:flex-none"
              onClick={() => openCreate({ type: typeFilter || 'expense' })}
            >
              <Plus className="h-5 w-5" />
              Nuevo
            </Button>
          </>
        }
      />

      <FiltersPanel
        title="Filtros"
        summary={`${MONTHS.find((m) => m.value === filters.month)?.label || ''} ${filters.year}`}
      >
        <Select
          label="Mes"
          placeholder={null}
          options={MONTHS}
          value={filters.month}
          onChange={(e) => applyMonthYear(filters.year, Number(e.target.value))}
        />
        <Select
          label="Año"
          placeholder={null}
          options={YEARS}
          value={filters.year}
          onChange={(e) => applyMonthYear(Number(e.target.value), filters.month)}
        />
        <Input
          label="Desde"
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
        />
        <Input
          label="Hasta"
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
        />
        {!typeFilter ? (
          <Select
            label="Tipo"
            options={TRANSACTION_TYPES}
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          />
        ) : null}
        <Select
          label="Categoría"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={filters.categoryId}
          onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
        />
        <Select
          label="Método"
          options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
          value={filters.paymentMethodId}
          onChange={(e) => setFilters((f) => ({ ...f, paymentMethodId: e.target.value }))}
        />
      </FiltersPanel>

      {loading ? (
        <Loader fullPage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Sin movimientos"
          description="Todavía no hay registros para este período."
          actionLabel="Registrar movimiento"
          onAction={() => openCreate({ type: typeFilter || 'expense' })}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Foto</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Importe</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <ReceiptThumb
                        url={item.receipt_url}
                        onOpen={setReceiptPreview}
                        className="h-11 w-11"
                      />
                    </td>
                    <td className="px-4 py-3">{formatDate(item.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.type === 'income' ? 'Ingreso' : 'Gasto'}
                        {item.payment_method?.name ? ` · ${item.payment_method.name}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">{item.category?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-amount font-semibold ${
                        item.type === 'income' ? 'text-emerald-600' : 'text-[var(--text)]'
                      }`}
                    >
                      {item.type === 'income' ? '+' : '-'}
                      {formatCurrency(item.amount, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {item.status !== 'paid' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Marcar pagado"
                            onClick={() => handleMarkPaid(item.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Duplicar"
                          onClick={() => setDuplicateItem(item)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => openEdit(item.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[var(--border)] md:hidden">
            {items.map((item) => (
              <div key={item.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {item.receipt_url ? (
                      <ReceiptThumb
                        url={item.receipt_url}
                        onOpen={setReceiptPreview}
                        className="h-12 w-12"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {formatDate(item.date)} · {item.category?.name || 'Sin categoría'}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-amount font-semibold ${
                      item.type === 'income' ? 'text-emerald-600' : ''
                    }`}
                  >
                    {item.type === 'income' ? '+' : '-'}
                    {formatCurrency(item.amount, currency)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" onClick={() => setDuplicateItem(item)}>
                      Duplicar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(item.id)}>
                      Ver
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(item.id)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar movimiento"
        message="¿Confirmás eliminar este movimiento? Esta acción se puede revertir solo desde la base de datos."
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />

      <ConfirmDialog
        open={Boolean(duplicateItem)}
        onClose={() => setDuplicateItem(null)}
        onConfirm={handleDuplicateConfirm}
        title="Duplicar movimiento"
        message={
          duplicateItem
            ? `¿Realmente querés duplicar “${duplicateItem.description}” por ${formatCurrency(duplicateItem.amount, currency)}?`
            : '¿Realmente querés duplicar este movimiento?'
        }
        confirmLabel="Sí, duplicar"
        loading={busy}
      />

      <ImportSantanderModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        paymentMethods={paymentMethods.filter((m) => m.is_active)}
        onImported={load}
      />

      <ReceiptLightbox url={receiptPreview} onClose={() => setReceiptPreview(null)} />
    </div>
  )
}
