import { listTransactions } from './transactions'
import { percentage } from '../utils/formatters'

function active(txs) {
  return txs.filter((t) => t.status !== 'cancelled')
}

export async function getReportsData(userId, { from, to }) {
  const txs = active(await listTransactions(userId, { from, to }))

  const income = txs.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
  const expenses = txs.filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)

  const byCategoryMap = new Map()
  txs
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const name = t.category?.name || 'Sin categoría'
      const color = t.category?.color || '#94a3b8'
      const cur = byCategoryMap.get(name) || { name, value: 0, color }
      cur.value += Number(t.amount)
      byCategoryMap.set(name, cur)
    })
  const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.value - a.value)

  const byMethodMap = new Map()
  txs.forEach((t) => {
    const name = t.payment_method?.name || 'Sin método'
    byMethodMap.set(name, (byMethodMap.get(name) || 0) + Number(t.amount))
  })
  const byMethod = Array.from(byMethodMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  let fixed = 0
  let variable = 0
  txs
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      if (t.expense_type === 'fixed' || t.is_recurring) fixed += Number(t.amount)
      else variable += Number(t.amount)
    })

  // Monthly aggregation
  const monthlyMap = new Map()
  txs.forEach((t) => {
    const key = t.date.slice(0, 7)
    const cur = monthlyMap.get(key) || { month: key, ingresos: 0, gastos: 0, saldo: 0 }
    if (t.type === 'income') cur.ingresos += Number(t.amount)
    else cur.gastos += Number(t.amount)
    cur.saldo = cur.ingresos - cur.gastos
    monthlyMap.set(key, cur)
  })
  const monthly = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))

  const monthCount = Math.max(1, monthly.length)
  const avgMonthlyExpense = expenses / monthCount
  const topExpenseMonth = [...monthly].sort((a, b) => b.gastos - a.gastos)[0] || null
  const topCategory = byCategory[0] || null

  return {
    income,
    expenses,
    balance: income - expenses,
    byCategory,
    byMethod,
    fixedVsVariable: [
      { name: 'Fijos', value: fixed, color: '#334e68' },
      { name: 'Variables', value: variable, color: '#059669' },
    ],
    monthly,
    avgMonthlyExpense,
    topExpenseMonth,
    topCategory,
    spentPercent: percentage(expenses, income),
    transactions: txs,
  }
}

export function exportTransactionsCsv(transactions) {
  const header = ['fecha', 'tipo', 'descripcion', 'importe', 'categoria', 'metodo', 'estado']
  const rows = transactions.map((t) => [
    t.date,
    t.type,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.amount,
    t.category?.name || '',
    t.payment_method?.name || '',
    t.status,
  ])
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
