import { useMemo, useState } from 'react'
import { FileSpreadsheet, Upload, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Select from '../common/Select'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { parseSantanderMovimientos } from '../../utils/santanderImport'
import {
  createManyTransactions,
  listImportedReferences,
} from '../../services/transactions'
import { formatCurrency } from '../../utils/currency'
import { formatDate } from '../../utils/dates'
import { saveBankBalance } from '../../utils/bankBalance'

export default function ImportSantanderModal({ open, onClose, paymentMethods = [], onImported }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'

  const [fileName, setFileName] = useState('')
  const [meta, setMeta] = useState(null)
  const [movements, setMovements] = useState([])
  const [skipped, setSkipped] = useState(0)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  const bankMethodId = useMemo(() => {
    const preferred =
      paymentMethods.find((m) => m.type === 'bank') ||
      paymentMethods.find((m) => /banco|cuenta/i.test(m.name))
    return preferred?.id || paymentMethods[0]?.id || ''
  }, [paymentMethods])

  function resetState() {
    setFileName('')
    setMeta(null)
    setMovements([])
    setSkipped(0)
    setPaymentMethodId('')
    setLoading(false)
    setImporting(false)
  }

  function handleClose() {
    resetState()
    onClose?.()
  }

  async function handleFile(file) {
    if (!file || !user) return
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseSantanderMovimientos(buffer)
      const refs = await listImportedReferences(
        user.id,
        parsed.movements.map((m) => m.reference),
      )

      const fresh = []
      let skipCount = 0
      parsed.movements.forEach((m) => {
        if (m.reference && refs.has(m.reference)) {
          skipCount += 1
          return
        }
        fresh.push(m)
      })

      setFileName(file.name)
      setMeta(parsed.meta)
      setMovements(fresh)
      setSkipped(skipCount)
      setPaymentMethodId(bankMethodId)
      if (fresh.length === 0) {
        toast.info(
          skipCount
            ? `Los ${skipCount} movimientos ya estaban importados`
            : 'No hay movimientos nuevos para importar',
        )
      }
    } catch (error) {
      toast.error(error.message)
      resetState()
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!user || movements.length === 0) return
    setImporting(true)
    try {
      const payloads = movements.map((m) => ({
        user_id: user.id,
        type: m.type,
        description: m.description.slice(0, 500),
        amount: m.amount,
        date: m.date,
        status: 'paid',
        expense_type: m.type === 'expense' ? 'one_time' : null,
        payment_method_id: paymentMethodId || null,
        notes: m.notes,
        is_recurring: false,
        period_year: Number(m.date.slice(0, 4)),
        period_month: Number(m.date.slice(5, 7)),
        installments_count: 1,
        current_installment: 1,
      }))

      await createManyTransactions(payloads)

      if (meta?.bankBalance != null) {
        saveBankBalance(user.id, {
          amount: meta.bankBalance,
          account: meta.account || 'Cuenta Santander',
          period: meta.period,
          source: 'import',
        })
      }

      toast.success(`Se importaron ${payloads.length} movimiento(s)`)
      onImported?.()
      handleClose()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setImporting(false)
    }
  }

  const incomeCount = movements.filter((m) => m.type === 'income').length
  const expenseCount = movements.filter((m) => m.type === 'expense').length

  function removeMovement(importKey) {
    setMovements((prev) => prev.filter((m) => m.importKey !== importKey))
  }

  function removeAllExpenses() {
    setMovements((prev) => prev.filter((m) => m.type !== 'expense'))
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar Santander"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            loading={importing}
            disabled={movements.length === 0 || loading}
          >
            Importar {movements.length || ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">
          Subí el Excel de <strong>Últimos movimientos</strong> de Santander Select. Los importes
          negativos se cargan como gastos y los positivos como ingresos. Podés sacar filas de la
          lista antes de importar.
        </p>

        <label className="card flex cursor-pointer flex-col items-center gap-2 border-dashed p-6 text-center hover:bg-[var(--bg-muted)]">
          <Upload className="h-6 w-6 text-primary-600" />
          <span className="text-sm font-medium">
            {loading ? 'Leyendo archivo...' : 'Elegir archivo .xlsx'}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {fileName || 'movimientos.xlsx'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={loading || importing}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file)
              event.target.value = ''
            }}
          />
        </label>

        {meta ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              {meta.account ? <Badge tone="info">{meta.account}</Badge> : null}
              {meta.period ? <Badge>{meta.period}</Badge> : null}
              <Badge tone="success">{incomeCount} ingresos</Badge>
              <Badge tone="danger">{expenseCount} gastos</Badge>
              {skipped > 0 ? <Badge tone="warning">{skipped} ya importados</Badge> : null}
            </div>
            {meta.bankBalance != null ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm">
                <p className="text-[var(--text-muted)]">Saldo actual (calculado del extracto)</p>
                <p
                  className={`font-amount text-lg font-semibold ${
                    meta.bankBalance < 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(meta.bankBalance, currency)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {meta.estimatedBalances > 0
                    ? `Se completaron ${meta.estimatedBalances} saldo(s) vacío(s) descontando desde el último Saldo del Excel.`
                    : 'Tomado de la columna Saldo del Excel.'}{' '}
                  El resultado del período en Finora (ingresos − gastos) es aparte.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {movements.length > 0 ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <Select
                  label="Método de pago para los importados"
                  placeholder={null}
                  options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                />
              </div>
              {expenseCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeAllExpenses}
                  disabled={importing}
                >
                  <Trash2 className="h-4 w-4" />
                  Quitar todos los gastos
                </Button>
              ) : null}
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-[var(--border)]">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-[var(--bg-muted)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Descripción</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium text-right">Importe</th>
                    <th className="px-3 py-2 font-medium text-right">Saldo</th>
                    <th className="px-3 py-2 font-medium text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.importKey} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.date)}</td>
                      <td className="px-3 py-2">
                        <p className="line-clamp-2">{m.description}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={m.type === 'income' ? 'success' : 'neutral'}>
                          {m.type === 'income' ? 'Ingreso' : 'Gasto'}
                        </Badge>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-amount font-medium ${
                          m.type === 'income' ? 'text-emerald-600' : ''
                        }`}
                      >
                        {m.type === 'income' ? '+' : '-'}
                        {formatCurrency(m.amount, currency)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-amount whitespace-nowrap ${
                          m.balance != null && m.balance < 0 ? 'text-red-600' : ''
                        }`}
                        title={
                          m.balanceEstimated
                            ? 'Calculado desde el último Saldo del Excel'
                            : 'Del Excel'
                        }
                      >
                        {m.balance != null ? (
                          <>
                            {formatCurrency(m.balance, currency)}
                            {m.balanceEstimated ? (
                              <span className="ml-1 text-[10px] text-[var(--text-muted)]">≈</span>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Quitar de la importación"
                          aria-label="Quitar de la importación"
                          onClick={() => removeMovement(m.importKey)}
                          disabled={importing}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
            <FileSpreadsheet className="h-5 w-5" />
            Todavía no hay movimientos listos para importar.
          </div>
        )}
      </div>
    </Modal>
  )
}
