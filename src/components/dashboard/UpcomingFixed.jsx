import { formatCurrency } from '../../utils/currency'
import Badge from '../common/Badge'

export default function UpcomingFixed({ items = [], currency = 'ARS' }) {
  return (
    <div className="card p-4">
      <h3 className="mb-4 font-semibold">Próximos gastos fijos</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-[var(--text-muted)]">Vence el día {item.dueDay}</p>
            </div>
            <div className="text-right">
              <p className="font-amount text-sm font-semibold">
                {formatCurrency(item.amount, currency)}
              </p>
              <Badge tone="warning" className="mt-1">
                Pendiente
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
