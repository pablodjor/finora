import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrency } from '../../utils/currency'

export default function MonthlyTrend({ data = [], currency = 'ARS' }) {
  return (
    <div className="card p-4">
      <h3 className="mb-4 font-semibold">Evolución mensual</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
            <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => formatCurrency(value, currency)} />
            <Legend />
            <Area type="monotone" dataKey="ingresos" stroke="#059669" fill="#05966933" />
            <Area type="monotone" dataKey="gastos" stroke="#dc2626" fill="#dc262633" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
