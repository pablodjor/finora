import { EXPENSE_TYPES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../lib/constants'

export function labelFromOptions(options, value) {
  return options.find((item) => item.value === value)?.label || value || '—'
}

export function transactionTypeLabel(type) {
  return labelFromOptions(TRANSACTION_TYPES, type)
}

export function expenseTypeLabel(type) {
  return labelFromOptions(EXPENSE_TYPES, type)
}

export function statusLabel(status) {
  return labelFromOptions(TRANSACTION_STATUSES, status)
}

export function statusTone(status) {
  return TRANSACTION_STATUSES.find((item) => item.value === status)?.tone || 'neutral'
}

export function percentage(part, total) {
  if (!total) return 0
  return Math.round((Number(part) / Number(total)) * 100)
}
