import { useState } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { cn } from '../../utils/cn'

/**
 * En móvil: dropdown/acordeón para no tapar la vista.
 * En desktop (md+): siempre abierto.
 */
export default function FiltersPanel({
  title = 'Filtros',
  summary = '',
  children,
  className,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('card relative z-10 mb-4 overflow-visible', className)}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary-600" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            {summary ? (
              <span className="block truncate text-xs text-[var(--text-muted)]">{summary}</span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 transition', open ? 'rotate-180' : '')}
        />
      </button>

      <div
        className={cn(
          'grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
          'md:grid',
          open ? 'grid' : 'hidden',
        )}
      >
        {children}
      </div>
    </div>
  )
}
