import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/currency'
import { formatDate } from '../../utils/dates'
import Badge from '../common/Badge'
import { statusLabel, statusTone } from '../../utils/formatters'

export default function RecentTransactions({ items = [], currency = 'ARS' }) {
  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Últimos movimientos</h3>
        <Link to="/movimientos" className="text-sm text-primary-700 hover:underline dark:text-primary-300">
          Ver todos
        </Link>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{item.description}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {formatDate(item.date)} · {item.category}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`font-amount text-sm font-semibold ${
                  item.type === 'income' ? 'text-emerald-600' : ''
                }`}
              >
                {item.type === 'income' ? '+' : '-'}
                {formatCurrency(item.amount, currency)}
              </p>
              <Badge tone={statusTone(item.status)} className="mt-1">
                {statusLabel(item.status)}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
