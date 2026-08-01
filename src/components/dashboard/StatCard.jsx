import { cn } from '../../utils/cn'

export default function StatCard({ title, value, hint, trend, icon: Icon, tone = 'default' }) {
  const tones = {
    default: 'text-[var(--text)]',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{title}</p>
          <p className={cn('mt-2 font-amount text-2xl font-semibold', tones[tone])}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
          {trend ? <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">{trend}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
