import { listTransactions } from './transactions'
import { listRecurringExpenses } from './recurringExpenses'
import { listBudgets } from './budgets'
import { getPreviousMonth } from '../utils/dates'
import { percentage } from '../utils/formatters'
import { CATEGORY_COLORS } from '../lib/constants'

function sumByType(transactions, type) {
  return transactions
    .filter((t) => t.type === type && t.status !== 'cancelled')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)
}

function activeOnly(transactions) {
  return transactions.filter((t) => t.status !== 'cancelled')
}

function shiftMonth(year, month, delta) {
  let y = year
  let m = month + delta
  while (m <= 0) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  return { year: y, month: m }
}

export async function getDashboardData(userId, filters = {}) {
  const year = Number(filters.year)
  const month = Number(filters.month)
  const prev = getPreviousMonth(year, month)
  const useRange = Boolean(filters.from && filters.to)

  const trendMonths = []
  for (let i = 5; i >= 0; i -= 1) {
    trendMonths.push(shiftMonth(year, month, -i))
  }

  const currentQuery = useRange
    ? {
        from: filters.from,
        to: filters.to,
        type: filters.type || undefined,
        categoryId: filters.categoryId || undefined,
        paymentMethodId: filters.paymentMethodId || undefined,
      }
    : {
        year,
        month,
        type: filters.type || undefined,
        categoryId: filters.categoryId || undefined,
        paymentMethodId: filters.paymentMethodId || undefined,
      }

  const [currentTx, previousTx, recurring, budgets, ...trendTx] = await Promise.all([
    listTransactions(userId, currentQuery),
    listTransactions(userId, { year: prev.year, month: prev.month }),
    listRecurringExpenses(userId),
    listBudgets(userId, { year, month }),
    ...trendMonths.map(({ year: y, month: m }) => listTransactions(userId, { year: y, month: m })),
  ])

  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const trend = trendMonths.map((item, index) => {
    const txs = activeOnly(trendTx[index] || [])
    return {
      month: monthLabels[item.month - 1],
      ingresos: sumByType(txs, 'income'),
      gastos: sumByType(txs, 'expense'),
    }
  })

  const activeCurrent = activeOnly(currentTx)
  const income = sumByType(activeCurrent, 'income')
  const expenses = sumByType(activeCurrent, 'expense')
  const balance = income - expenses
  const spentPercent = percentage(expenses, income)

  const byCategoryMap = new Map()
  activeCurrent
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const key = t.category?.id || 'none'
      const name = t.category?.name || 'Sin categoría'
      const color = t.category?.color || CATEGORY_COLORS[byCategoryMap.size % CATEGORY_COLORS.length]
      const current = byCategoryMap.get(key) || { name, value: 0, color, id: key }
      current.value += Number(t.amount || 0)
      byCategoryMap.set(key, current)
    })

  const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.value - a.value)

  const upcomingFixed = (recurring || [])
    .filter((r) => r.is_active === true && Number(r.estimated_amount) > 0)
    .sort((a, b) => a.due_day - b.due_day)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      name: r.name,
      amount: Number(r.estimated_amount || 0),
      dueDay: String(r.due_day).padStart(2, '0'),
    }))

  const recent = activeCurrent.slice(0, 8).map((t) => ({
    id: t.id,
    description: t.description,
    amount: Number(t.amount || 0),
    date: t.date,
    category: t.category?.name || 'Sin categoría',
    type: t.type,
    status: t.status,
  }))

  const expenseByCategoryId = new Map()
  activeCurrent
    .filter((t) => t.type === 'expense' && t.category_id)
    .forEach((t) => {
      expenseByCategoryId.set(
        t.category_id,
        (expenseByCategoryId.get(t.category_id) || 0) + Number(t.amount || 0),
      )
    })

  const budgetAlerts = (budgets || [])
    .map((b) => {
      const spent = expenseByCategoryId.get(b.category_id) || 0
      const amount = Number(b.amount || 0)
      const percent = percentage(spent, amount)
      if (percent < 80) return null
      return {
        id: b.id,
        category: b.category?.name || 'Categoría',
        percent,
        tone: percent >= 100 ? 'danger' : 'warning',
      }
    })
    .filter(Boolean)

  return {
    income,
    expenses,
    balance,
    available: balance,
    spentPercent,
    previousMonth: {
      income: sumByType(activeOnly(previousTx), 'income'),
      expenses: sumByType(activeOnly(previousTx), 'expense'),
    },
    byCategory,
    trend,
    upcomingFixed,
    recent,
    budgetAlerts,
    hasData: activeCurrent.length > 0 || upcomingFixed.length > 0,
  }
}
