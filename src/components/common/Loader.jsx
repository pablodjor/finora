import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

export default function Loader({ label = 'Cargando...', className, fullPage = false }) {
  const content = (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      <p className="text-sm">{label}</p>
    </div>
  )

  if (fullPage) {
    return <div className="flex min-h-[50vh] items-center justify-center">{content}</div>
  }

  return content
}
