import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Input from '../../components/common/Input'
import ExpenseDistribution from '../../components/dashboard/ExpenseDistribution'
import StatCard from '../../components/dashboard/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getReportsData } from '../../services/reports'
import { formatCurrency } from '../../utils/currency'
import { currentYearMonth, getMonthRange, toISODate, nowInArgentina } from '../../utils/dates'
import { exportReportExcel, exportReportPdf } from '../../utils/exportFinora'

export default function ReportsPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'
  const { year, month } = currentYearMonth()
  const defaultRange = getMonthRange(year, month)
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      setData(await getReportsData(user.id, { from, to }))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, from, to])

  const [exporting, setExporting] = useState(false)

  async function handleExportPdf() {
    if (!data?.transactions?.length) {
      toast.warning('No hay datos para exportar')
      return
    }
    setExporting(true)
    try {
      await exportReportPdf({
        from,
        to,
        currency,
        income: data.income,
        expenses: data.expenses,
        balance: data.balance,
        byCategory: data.byCategory,
        transactions: data.transactions,
        profileName: profile?.full_name,
      })
      toast.success('PDF descargado')
    } catch (error) {
      toast.error(error.message || 'No se pudo generar el PDF')
    } finally {
      setExporting(false)
    }
  }

  function handleExportExcel() {
    if (!data?.transactions?.length) {
      toast.warning('No hay datos para exportar')
      return
    }
    try {
      exportReportExcel({
        from,
        to,
        currency,
        income: data.income,
        expenses: data.expenses,
        balance: data.balance,
        byCategory: data.byCategory,
        transactions: data.transactions,
      })
      toast.success('Excel descargado')
    } catch (error) {
      toast.error(error.message || 'No se pudo generar el Excel')
    }
  }

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Análisis de ingresos, gastos y tendencias con tus datos reales."
        actions={
          <>
            <Button variant="outline" onClick={handleExportPdf} loading={exporting}>
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 sm:max-w-lg">
        <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading ? (
        <Loader fullPage />
      ) : !data || data.transactions.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sin datos en el rango"
          description="Registrá movimientos o ampliá el rango de fechas."
          actionLabel="Ir a hoy"
          onAction={() => {
            const range = getMonthRange(year, month)
            setFrom(range.from)
            setTo(toISODate(nowInArgentina()))
          }}
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Ingresos" value={formatCurrency(data.income, currency)} />
            <StatCard title="Gastos" value={formatCurrency(data.expenses, currency)} />
            <StatCard title="Saldo" value={formatCurrency(data.balance, currency)} />
            <StatCard
              title="Promedio mensual gastos"
              value={formatCurrency(data.avgMonthlyExpense, currency)}
            />
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div className="card p-4 text-sm">
              <p className="text-[var(--text-muted)]">Mes con más gastos</p>
              <p className="mt-1 font-semibold">
                {data.topExpenseMonth
                  ? `${data.topExpenseMonth.month} · ${formatCurrency(data.topExpenseMonth.gastos, currency)}`
                  : '—'}
              </p>
            </div>
            <div className="card p-4 text-sm">
              <p className="text-[var(--text-muted)]">Categoría con mayor consumo</p>
              <p className="mt-1 font-semibold">
                {data.topCategory
                  ? `${data.topCategory.name} · ${formatCurrency(data.topCategory.value, currency)}`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="mb-5 grid gap-4 xl:grid-cols-2">
            <ExpenseDistribution data={data.byCategory} currency={currency} />
            <div className="card p-4">
              <h3 className="mb-4 font-semibold">Fijos vs variables</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.fixedVsVariable}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                    <Bar dataKey="value" fill="#059669" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mb-5 card p-4">
            <h3 className="mb-4 font-semibold">Ingresos vs gastos / evolución del saldo</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                  <Legend />
                  <Line type="monotone" dataKey="ingresos" stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="gastos" stroke="#dc2626" strokeWidth={2} />
                  <Line type="monotone" dataKey="saldo" stroke="#0ea5e9" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-4 font-semibold">Métodos de pago más utilizados</h3>
            <ul className="space-y-2">
              {data.byMethod.map((item) => (
                <li key={item.name} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-amount font-medium">
                    {formatCurrency(item.value, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
