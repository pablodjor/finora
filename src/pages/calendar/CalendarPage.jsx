import { useEffect, useMemo, useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loader from '../../components/common/Loader'
import Select from '../../components/common/Select'
import Badge from '../../components/common/Badge'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { COLORS, getCalendarEvents, groupEventsByDate } from '../../services/calendar'
import { formatCurrency } from '../../utils/currency'
import { currentYearMonth, formatDate } from '../../utils/dates'
import { statusLabel, statusTone } from '../../utils/formatters'
import { MONTHS, YEARS } from '../../lib/constants'

const KIND_LABELS = {
  income: 'Ingreso',
  expense: 'Gasto',
  fixed: 'Gasto fijo',
  installment: 'Cuota',
}

const LEGEND = [
  { label: 'Ingreso', color: COLORS.income },
  { label: 'Gasto', color: COLORS.expense },
  { label: 'Gasto fijo', color: COLORS.fixed },
  { label: 'Cuota', color: COLORS.installment },
]

function eventStatusLabel(status) {
  if (!status) return '—'
  const mapped = statusLabel(status)
  if (mapped && mapped !== status) return mapped
  const fallback = {
    paid: 'Pagado',
    pending: 'Pendiente',
    overdue: 'Vencido',
    scheduled: 'Programado',
    cancelled: 'Cancelado',
  }
  return fallback[status] || status
}

export default function CalendarPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'
  const now = currentYearMonth()
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const data = await getCalendarEvents(user.id, year, month)
        setEvents(data)
        setSelectedDate(null)
      } catch (error) {
        toast.error(error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.id, year, month, toast])

  const byDate = useMemo(() => groupEventsByDate(events), [events])
  const monthDate = new Date(year, month - 1, 1)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [year, month])

  const selectedEvents = selectedDate ? byDate.get(selectedDate) || [] : []
  const listEvents = selectedDate ? selectedEvents : events.slice(0, 12)

  return (
    <div>
      <PageHeader
        title="Calendario financiero"
        description="Vencimientos, fijos, ingresos y cuotas del mes."
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

      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        {LEGEND.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {loading ? (
        <Loader fullPage />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="card p-3 sm:p-4">
            <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--text-muted)]">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayEvents = byDate.get(key) || []
                const inMonth = isSameMonth(day, monthDate)
                const selected = selectedDate === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    className={`min-h-20 cursor-pointer rounded-lg border p-1.5 text-left transition ${
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                    } ${inMonth ? '' : 'opacity-40'}`}
                  >
                    <p className="text-xs font-medium">{format(day, 'd')}</p>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className="truncate rounded px-1 text-[10px] font-medium text-white"
                          style={{ background: ev.color }}
                          title={`${KIND_LABELS[ev.kind] || ''}: ${ev.title}`}
                        >
                          {ev.kind === 'income' ? '+' : '-'}
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 ? (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          +{dayEvents.length - 3}
                        </p>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold">
              {selectedDate
                ? formatDate(selectedDate)
                : format(monthDate, 'MMMM yyyy', { locale: es })}
            </h3>
            <div className="mt-3 space-y-2">
              {listEvents.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Sin eventos.</p>
              ) : (
                listEvents.map((ev) => {
                  const isIncome = ev.kind === 'income'
                  return (
                    <div
                      key={ev.id}
                      className="rounded-lg border border-[var(--border)] p-3"
                      style={{ borderLeftWidth: 4, borderLeftColor: ev.color }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{ev.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatDate(ev.date)} · {KIND_LABELS[ev.kind] || ev.kind}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 font-amount text-sm font-semibold ${
                            isIncome ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(ev.amount, currency)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge
                          tone={
                            isIncome
                              ? 'success'
                              : ev.kind === 'fixed'
                                ? 'info'
                                : ev.kind === 'installment'
                                  ? 'neutral'
                                  : 'danger'
                          }
                        >
                          {KIND_LABELS[ev.kind] || ev.kind}
                        </Badge>
                        <Badge tone={statusTone(ev.status) || 'neutral'}>
                          {eventStatusLabel(ev.status)}
                        </Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {selectedDate ? (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setSelectedDate(null)}
              >
                Ver resumen del mes
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
