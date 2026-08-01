import { ImageIcon } from 'lucide-react'

export default function ReceiptThumb({ url, onOpen, className = 'h-10 w-10', showEmpty = false }) {
  if (!url) {
    if (!showEmpty) return <span className="text-[var(--text-muted)]">—</span>
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md bg-[var(--bg-muted)] text-[var(--text-muted)] ${className}`}
        title="Sin foto"
      >
        <ImageIcon className="h-4 w-4 opacity-40" />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.(url)
      }}
      className={`shrink-0 overflow-hidden rounded-md ring-1 ring-[var(--border)] transition hover:ring-primary-500 ${className}`}
      title="Ver comprobante"
    >
      <img src={url} alt="Comprobante" className="h-full w-full object-cover" />
    </button>
  )
}

export function ReceiptLightbox({ url, onClose }) {
  if (!url) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]"
        aria-label="Cerrar foto"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] max-w-[min(96vw,52rem)] overflow-hidden rounded-xl shadow-2xl">
        <img src={url} alt="Comprobante" className="max-h-[90vh] w-auto object-contain" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-lg bg-black/55 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/75"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
