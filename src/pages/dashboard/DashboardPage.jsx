import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransactionModal } from '../../contexts/TransactionModalContext'
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  LayoutDashboard,
  Landmark,
  RefreshCw,
} from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Select from '../../components/common/Select'
import Input from '../../components/common/Input'
import FiltersPanel from '../../components/common/FiltersPanel'
import Badge from '../../components/common/Badge'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Button from '../../components/common/Button'
import StatCard from '../../components/dashboard/StatCard'
import ExpenseDistribution from '../../components/dashboard/ExpenseDistribution'
import MonthlyTrend from '../../components/dashboard/MonthlyTrend'
import UpcomingFixed from '../../components/dashboard/UpcomingFixed'
import RecentTransactions from '../../components/dashboard/RecentTransactions'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getDashboardData } from '../../services/dashboard'
import { listUserCategories } from '../../services/categories'
import { listPaymentMethods } from '../../services/paymentMethods'
import { formatCurrency } from '../../utils/currency'
import { currentYearMonth, getMonthRange } from '../../utils/dates'
import { MONTHS, TRANSACTION_TYPES, YEARS } from '../../lib/constants'
import { percentage } from '../../utils/formatters'
import { getBankBalance } from '../../utils/bankBalance'
import BankBalanceModal from '../../components/forms/BankBalanceModal'

const emptyData = {
  income: 0,
  expenses: 0,
  balance: 0,
  available: 0,
  spentPercent: 0,
  previousMonth: { income: 0, expenses: 0 },
  byCategory: [],
  trend: [],
  upcomingFixed: [],
  recent: [],
  budgetAlerts: [],
  hasData: false,
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const { openCreate, version } = useTransactionModal()
  const currency = profile?.currency || 'ARS'
  const { year, month } = currentYearMonth()
  const initialRange = getMonthRange(year, month)
  const [filters, setFilters] = useState({
    year,
    month,
    from: initialRange.from,
    to: initialRange.to,
    categoryId: '',
    paymentMethodId: '',
    type: '',
  })
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [bankBalance, setBankBalance] = useState(null)
  const [bankModalOpen, setBankModalOpen] = useState(false)

  function applyMonthYear(nextYear, nextMonth) {
    const range = getMonthRange(nextYear, nextMonth)
    setFilters((f) => ({
      ...f,
      year: nextYear,
      month: nextMonth,
      from: range.from,
      to: range.to,
    }))
  }

  useEffect(() => {
    async function loadFilters() {
      if (!user) return
      try {
        const [cats, methods] = await Promise.all([
          listUserCategories(user.id),
          listPaymentMethods(user.id),
        ])
        setCategories(cats)
        setPaymentMethods(methods.filter((m) => m.is_active))
      } catch (error) {
        toast.error(error.message)
      }
    }
    loadFilters()
  }, [user?.id, toast])

  async function loadDashboard() {
    if (!user) return
    setLoading(true)
    try {
      const result = await getDashboardData(user.id, filters)
      setData(result)
      setBankBalance(getBankBalance(user.id))
    } catch (error) {
      toast.error(error.message)
      setData(emptyData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filters, toast, version])

  const comparison = useMemo(() => {
    const incomeDiff = percentage(
      data.income - data.previousMonth.income,
      data.previousMonth.income || 1,
    )
    const expenseDiff = percentage(
      data.expenses - data.previousMonth.expenses,
      data.previousMonth.expenses || 1,
    )
    return { incomeDiff, expenseDiff }
  }, [data])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen de tus finanzas con datos reales de tu cuenta."
        actions={
          <>
            <Button variant="outline" title="Recargar" loading={loading} onClick={() => loadDashboard()}>
              <RefreshCw className="h-4 w-4" />
              Recargar
            </Button>
            <Button onClick={() => openCreate({ type: 'expense' })}>Registrar movimiento</Button>
          </>
        }
      />

      <FiltersPanel
        className="mb-5"
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
        <Select
          label="Tipo"
          options={TRANSACTION_TYPES}
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
        />
        <Select
          label="Categoría"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={filters.categoryId}
          onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
        />
        <Select
          label="Método de pago"
          options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
          value={filters.paymentMethodId}
          onChange={(e) => setFilters((f) => ({ ...f, paymentMethodId: e.target.value }))}
        />
      </FiltersPanel>

      {!loading ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.hasData ? (
            <>
              <StatCard
                title="Resultado del período"
                value={formatCurrency(data.balance, currency)}
                icon={Wallet}
                hint="Ingresos − gastos (no es el saldo del banco)"
                tone={data.balance >= 0 ? 'success' : 'danger'}
              />
              <StatCard
                title="Ingresos"
                value={formatCurrency(data.income, currency)}
                icon={TrendingUp}
                tone="success"
                trend={`${comparison.incomeDiff >= 0 ? '+' : ''}${comparison.incomeDiff}% vs mes anterior`}
              />
              <StatCard
                title="Gastos"
                value={formatCurrency(data.expenses, currency)}
                icon={TrendingDown}
                tone="danger"
                trend={`${comparison.expenseDiff >= 0 ? '+' : ''}${comparison.expenseDiff}% vs mes anterior`}
              />
            </>
          ) : null}
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-muted)]">
                  {bankBalance?.account || 'Cuenta sueldo'}
                </p>
                <p
                  className={`mt-2 font-amount text-2xl font-semibold ${
                    bankBalance
                      ? bankBalance.amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                      : 'text-[var(--text)]'
                  }`}
                >
                  {bankBalance ? formatCurrency(bankBalance.amount, currency) : 'Sin cargar'}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Saldo real del banco (no es el resultado del período)
                </p>
                <button
                  type="button"
                  onClick={() => setBankModalOpen(true)}
                  className="mt-2 text-xs font-medium text-primary-600 hover:underline dark:text-primary-300"
                >
                  {bankBalance ? 'Editar saldo' : 'Cargar saldo'}
                </button>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <Loader fullPage />
      ) : !data.hasData ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Todavía no hay movimientos"
          description="Empezá registrando un ingreso o un gasto. El dashboard se completa solo con tus datos."
          actionLabel="Nuevo movimiento"
          onAction={() => openCreate({ type: 'expense' })}
        />
      ) : (
        <>

          {data.budgetAlerts.length > 0 ? (
            <div className="mb-5 space-y-2">
              {data.budgetAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="card flex items-center gap-3 border-l-4 border-l-amber-500 p-4"
                >
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Presupuesto de {alert.category} al {alert.percent}%
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {alert.percent >= 100
                        ? 'Excediste el presupuesto.'
                        : 'Superaste el 80% del presupuesto.'}
                    </p>
                  </div>
                  <Badge tone={alert.tone === 'danger' ? 'danger' : 'warning'}>
                    {alert.percent >= 100 ? 'Excedido' : 'Advertencia'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mb-5 grid gap-4 xl:grid-cols-2">
            {data.trend.some((t) => t.ingresos || t.gastos) ? (
              <MonthlyTrend data={data.trend} currency={currency} />
            ) : (
              <div className="card p-4 text-sm text-[var(--text-muted)]">
                Todavía no hay suficiente historial para el gráfico de evolución.
              </div>
            )}
            {data.byCategory.length > 0 ? (
              <ExpenseDistribution data={data.byCategory} currency={currency} />
            ) : (
              <div className="card p-4 text-sm text-[var(--text-muted)]">
                No hay gastos por categoría en este período.
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {data.upcomingFixed.length > 0 ? (
              <UpcomingFixed items={data.upcomingFixed} currency={currency} />
            ) : (
              <div className="card p-4 text-sm text-[var(--text-muted)]">
                No tenés gastos fijos activos.{' '}
                <Link to="/gastos-fijos" className="text-primary-700 hover:underline">
                  Configurar
                </Link>
              </div>
            )}
            {data.recent.length > 0 ? (
              <RecentTransactions items={data.recent} currency={currency} />
            ) : (
              <div className="card p-4 text-sm text-[var(--text-muted)]">
                Sin movimientos recientes en este filtro.
              </div>
            )}
          </div>
        </>
      )}

      <BankBalanceModal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        userId={user?.id}
        initial={bankBalance}
        onSaved={() => setBankBalance(getBankBalance(user?.id))}
      />
    </div>
  )
}
