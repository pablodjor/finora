import { listTransactions } from './transactions'
import { listRecurringExpenses } from './recurringExpenses'
import { listInstallments } from './creditCards'
import { getMonthRange, formatDate } from '../utils/dates'

const COLORS = {
  income: '#059669',
  expense: '#dc2626',
  expensePending: '#ea580c',
  expenseOverdue: '#991b1b',
  fixed: '#0284c7',
  installment: '#7c3aed',
  installmentPaid: '#6d28d9',
}

function expenseColor(status) {
  if (status === 'pending' || status === 'scheduled') return COLORS.expensePending
  if (status === 'overdue') return COLORS.expenseOverdue
  return COLORS.expense
}

export async function getCalendarEvents(userId, year, month) {
  const range = getMonthRange(year, month)

  const [transactions, recurring, installments] = await Promise.all([
    listTransactions(userId, { year, month }),
    listRecurringExpenses(userId),
    listInstallments(userId, { from: range.from, to: range.to }),
  ])

  const events = []

  transactions
    .filter((t) => Number(t.amount) > 0)
    .forEach((t) => {
      const isIncome = t.type === 'income'
      events.push({
        id: `tx-${t.id}`,
        date: t.date,
        title: t.description,
        amount: Number(t.amount),
        kind: isIncome ? 'income' : 'expense',
        status: t.status,
        color: isIncome ? COLORS.income : expenseColor(t.status),
      })
    })

  recurring
    .filter((r) => r.is_active === true && Number(r.estimated_amount) > 0)
    .forEach((r) => {
      const day = String(Math.min(r.due_day, 28)).padStart(2, '0')
      const date = `${year}-${String(month).padStart(2, '0')}-${day}`
      const exists = events.some(
        (e) =>
          (e.kind === 'expense' || e.kind === 'fixed') &&
          e.title === r.name &&
          e.date === date,
      )
      if (!exists) {
        events.push({
          id: `rec-${r.id}-${year}-${month}`,
          date,
          title: r.name,
          amount: Number(r.estimated_amount),
          kind: 'fixed',
          status: 'scheduled',
          color: COLORS.fixed,
        })
      }
    })

  installments.forEach((i) => {
    const paid = i.status === 'paid'
    events.push({
      id: `inst-${i.id}`,
      date: i.due_date,
      title: `${i.purchase?.description || 'Cuota'} (${i.installment_number})`,
      amount: Number(i.amount),
      kind: 'installment',
      status: i.status,
      color: paid ? COLORS.installmentPaid : COLORS.installment,
    })
  })

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

export function groupEventsByDate(events) {
  const map = new Map()
  events.forEach((e) => {
    const list = map.get(e.date) || []
    list.push(e)
    map.set(e.date, list)
  })
  return map
}

export { formatDate, COLORS }
