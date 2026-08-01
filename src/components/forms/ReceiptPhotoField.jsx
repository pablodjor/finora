import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import Button from '../common/Button'
import { compressImage } from '../../utils/image'
import { analyzeReceiptImage, hasReceiptAi } from '../../services/receiptAi'

export default function ReceiptPhotoField({
  receiptUrl,
  categories = [],
  paymentMethods = [],
  autoOpenCamera = false,
  onFileChange,
  onSuggestion,
  disabled = false,
}) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [preview, setPreview] = useState(receiptUrl || null)
  const [analyzing, setAnalyzing] = useState(false)
  const [hint, setHint] = useState('')
  const [warning, setWarning] = useState('')
  const openedRef = useRef(false)
  const aiEnabled = hasReceiptAi()

  useEffect(() => {
    setPreview(receiptUrl || null)
  }, [receiptUrl])

  useEffect(() => {
    if (!autoOpenCamera || openedRef.current || disabled) return
    openedRef.current = true
    const t = setTimeout(() => cameraRef.current?.click(), 250)
    return () => clearTimeout(t)
  }, [autoOpenCamera, disabled])

  useEffect(() => {
    return () => {
      if (preview?.startsWith?.('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function handlePick(file) {
    if (!file || !file.type.startsWith('image/')) return

    setAnalyzing(true)
    setWarning('')
    setHint(aiEnabled ? 'La IA está leyendo el recibo...' : 'Analizando ticket...')
    try {
      const compressed = await compressImage(file)
      const localUrl = URL.createObjectURL(compressed)
      setPreview((prev) => {
        if (prev?.startsWith?.('blob:')) URL.revokeObjectURL(prev)
        return localUrl
      })
      onFileChange?.(compressed)

      const suggestion = await analyzeReceiptImage(compressed, categories, paymentMethods)
      onSuggestion?.(suggestion)

      if (suggestion.isReceipt === false) {
        setWarning(
          suggestion.summary ||
            'Esto no parece un recibo o comprobante. Revisá la foto o elegí otra.',
        )
      }

      if (suggestion.summary) {
        setHint(suggestion.summary)
      } else if (suggestion.whatSpent || suggestion.categoryName) {
        setHint(
          `Gastaste en ${suggestion.whatSpent || suggestion.categoryName}${
            suggestion.categoryName && suggestion.whatSpent
              ? ` (${suggestion.categoryName})`
              : ''
          }${
            suggestion.amount
              ? ` · $${Number(suggestion.amount).toLocaleString('es-AR')}`
              : ''
          }. Podés corregirlo abajo.`,
        )
      } else if (suggestion.amount) {
        setHint('Detectamos el importe. Revisá categoría y descripción.')
      } else {
        setHint('No pudimos identificar el gasto. Elegí la categoría manualmente.')
      }
    } catch {
      setHint('No se pudo leer el ticket. Elegí la categoría manualmente.')
    } finally {
      setAnalyzing(false)
    }
  }

  function clearPhoto() {
    if (preview?.startsWith?.('blob:')) URL.revokeObjectURL(preview)
    setPreview(null)
    setHint('')
    setWarning('')
    onFileChange?.(null)
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-medium sm:text-sm">Comprobante / foto</p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)] sm:text-xs">
            {aiEnabled
              ? 'La IA revisa si es un recibo y sugiere categoría e importe'
              : 'Sacá una foto del ticket y te sugerimos la categoría'}
          </p>
          {aiEnabled ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-300">
              <Sparkles className="h-3.5 w-3.5" />
              Análisis con IA activo
            </p>
          ) : null}
        </div>
        {preview ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={clearPhoto}
            disabled={disabled}
            aria-label="Quitar foto"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]">
          <img
            src={preview}
            alt="Comprobante del gasto"
            className="mx-auto max-h-72 w-full object-contain sm:max-h-64"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled || analyzing}
          onClick={() => cameraRef.current?.click()}
          className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--bg-muted)] px-4 py-4 text-base font-semibold transition hover:border-primary-500 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-primary-900/20 sm:min-h-12 sm:py-3 sm:text-sm"
        >
          <Camera className="h-6 w-6 shrink-0 sm:h-5 sm:w-5" />
          {preview ? 'Otra foto' : 'Tomar foto'}
        </button>
        <button
          type="button"
          disabled={disabled || analyzing}
          onClick={() => galleryRef.current?.click()}
          className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--bg-muted)] px-4 py-4 text-base font-semibold transition hover:border-primary-500 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-primary-900/20 sm:min-h-12 sm:py-3 sm:text-sm"
        >
          <ImagePlus className="h-6 w-6 shrink-0 sm:h-5 sm:w-5" />
          Galería
        </button>
      </div>

      {analyzing ? (
        <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {hint || 'Analizando...'}
        </p>
      ) : (
        <>
          {warning ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {warning}
            </p>
          ) : null}
          {hint ? <p className="text-sm text-[var(--text-muted)] sm:text-xs">{hint}</p> : null}
        </>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handlePick(file)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handlePick(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
