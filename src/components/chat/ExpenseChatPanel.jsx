import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, MessageCircle, Send, Sparkles, X, Check, Pencil } from 'lucide-react'
import Button from '../common/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useTransactionModal } from '../../contexts/TransactionModalContext'
import { ensureDefaultExpenseCategories } from '../../services/categories'
import { listPaymentMethods } from '../../services/paymentMethods'
import { listCreditCards } from '../../services/creditCards'
import { createTransaction } from '../../services/transactions'
import { hasExpenseChatAi, parseExpenseChatMessage } from '../../services/expenseChatAi'
import { uploadReceipt } from '../../services/storage'
import { compressImage } from '../../utils/image'
import { formatCurrency } from '../../utils/currency'
import { createId } from '../../utils/id'
import { applyMovementPaymentEffects, CREDIT_TYPES } from '../../utils/paymentEffects'
import { cn } from '../../utils/cn'

function DraftCard({ draft, currency, onConfirm, onEdit, confirming }) {
  if (!draft) return null
  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        Borrador{draft.fromPhoto ? ' · desde foto' : ''}
      </p>
      {draft.imagePreview ? (
        <img
          src={draft.imagePreview}
          alt="Comprobante"
          className="mt-2 h-20 w-20 rounded-lg object-cover ring-1 ring-[var(--border)]"
        />
      ) : null}
      {draft.whatSpent ? (
        <p className="mt-1 text-sm text-primary-700 dark:text-primary-300">
          En qué gastaste: {draft.whatSpent}
        </p>
      ) : null}
      <p className="mt-1 font-medium">{draft.description}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {draft.category_name || 'Sin categoría'}
        {draft.payment_method_name ? ` · ${draft.payment_method_name}` : ''} · {draft.date}
      </p>
      <p
        className={cn(
          'mt-2 font-amount text-xl font-semibold',
          draft.type === 'income' ? 'text-emerald-600' : '',
        )}
      >
        {draft.amount != null
          ? `${draft.type === 'income' ? '+' : '-'}${formatCurrency(draft.amount, currency)}`
          : 'Importe pendiente'}
      </p>
      {!draft.incomplete && draft.amount != null ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" loading={confirming} onClick={onConfirm}>
            <Check className="h-4 w-4" />
            Confirmar
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit} disabled={confirming}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Faltan datos. Completá en el chat.
        </p>
      )}
    </div>
  )
}

export default function ExpenseChatPanel({ open, onClose }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const { openCreate, notifySaved } = useTransactionModal()
  const currency = profile?.currency || 'ARS'
  const aiOn = hasExpenseChatAi()

  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: aiOn
        ? 'Contame el gasto o subí una foto. Ej: “Gasté 4500 en comida con débito” / “Nafta 38000 con crédito”.'
        : 'Modo simple. Ej: “Gasté 4500 en supermercado con débito”.',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const pendingImageRef = useRef(null)

  useEffect(() => {
    if (!open || !user) return
    Promise.all([
      ensureDefaultExpenseCategories(user.id),
      listPaymentMethods(user.id),
      listCreditCards(user.id),
    ])
      .then(([cats, methods, cards]) => {
        setCategories(cats)
        setPaymentMethods(methods.filter((m) => m.is_active))
        setCreditCards(cards.filter((c) => c.is_active !== false))
      })
      .catch(() => {
        setCategories([])
        setPaymentMethods([])
        setCreditCards([])
      })
    const t = setTimeout(() => inputRef.current?.focus(), 200)
    return () => clearTimeout(t)
  }, [open, user?.id])

  useEffect(() => {
    if (!open) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, draft, open])

  async function runParse({ text = '', imageFile = null, previewUrl = null }) {
    const caption = text.trim()
    if ((!caption && !imageFile) || sending) return

    const userMsg = {
      id: createId(),
      role: 'user',
      content: caption || '📷 Foto del ticket',
      imageUrl: previewUrl || null,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const result = await parseExpenseChatMessage({
        message: caption,
        imageFile,
        categories,
        paymentMethods,
        history,
      })

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content:
            result.reply ||
            '¡Hola! Contame un gasto cuando quieras. Ej: “Gasté 4500 en comida”.',
          draft: result.draft,
        },
      ])
      if (result.draft) {
        setDraft({
          ...result.draft,
          imagePreview: previewUrl || result.draft.imagePreview || null,
          fromPhoto: Boolean(imageFile || result.draft.fromPhoto || previewUrl),
        })
      } else {
        if (!imageFile) pendingImageRef.current = null
        setDraft(null)
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: error.message || 'No pude interpretar el gasto.',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleSend(event) {
    event?.preventDefault?.()
    await runParse({ text: input })
  }

  async function handlePhoto(file) {
    if (!file?.type?.startsWith('image/')) return
    setSending(true)
    try {
      const compressed = await compressImage(file)
      const previewUrl = URL.createObjectURL(compressed)
      pendingImageRef.current = compressed
      setSending(false)
      await runParse({
        text: input,
        imageFile: compressed,
        previewUrl,
      })
    } catch (error) {
      setSending(false)
      toast.error(error.message || 'No se pudo leer la foto')
    }
  }

  async function handleConfirm() {
    if (!user || !draft?.amount) return
    setConfirming(true)
    try {
      const method = paymentMethods.find((m) => m.id === draft.payment_method_id)
      const isCredit = (draft.type || 'expense') === 'expense' && CREDIT_TYPES.has(method?.type)
      const creditCardId = isCredit ? creditCards[0]?.id || null : null

      let receiptUrl = null
      if (pendingImageRef.current) {
        receiptUrl = await uploadReceipt(user.id, pendingImageRef.current)
      }

      const payload = {
        user_id: user.id,
        type: draft.type || 'expense',
        description: draft.description,
        amount: Number(draft.amount),
        date: draft.date,
        category_id: draft.category_id || null,
        payment_method_id: draft.payment_method_id || null,
        credit_card_id: creditCardId,
        expense_type: draft.type === 'expense' ? 'one_time' : null,
        status: 'paid',
        notes: draft.fromPhoto || receiptUrl ? 'Creado desde chat IA (foto)' : 'Creado desde chat IA',
        receipt_url: receiptUrl,
        is_recurring: false,
        installments_count: 1,
        current_installment: 1,
        period_year: Number(draft.date.slice(0, 4)),
        period_month: Number(draft.date.slice(5, 7)),
      }

      await createTransaction(payload)
      const effects = await applyMovementPaymentEffects({
        userId: user.id,
        previous: null,
        next: payload,
        paymentMethods,
        options: { createCardPurchase: isCredit && Boolean(creditCardId) },
      })

      toast.success(
        effects.bankAdjusted
          ? 'Gasto guardado · saldo de cuenta actualizado'
          : effects.cardPurchase
            ? 'Gasto guardado · cargado en la tarjeta'
            : 'Gasto guardado',
      )
      notifySaved()
      pendingImageRef.current = null
      setDraft(null)
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: 'Guardado. ¿Querés cargar otro?',
        },
      ])
    } catch (error) {
      toast.error(error.message)
    } finally {
      setConfirming(false)
    }
  }

  function handleEdit() {
    if (!draft) return
    openCreate({
      type: draft.type || 'expense',
      description: draft.description,
      amount: draft.amount || '',
      date: draft.date,
      category_id: draft.category_id || '',
      payment_method_id: draft.payment_method_id || '',
      receiptFile: pendingImageRef.current || undefined,
    })
    onClose?.()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Cerrar chat"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl sm:w-[24rem]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <MessageCircle className="h-5 w-5 text-primary-600" />
              Chat de gastos
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
              {aiOn ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                  Texto o foto del ticket
                </>
              ) : (
                'Parser local · agregá VITE_GEMINI_API_KEY para IA completa'
              )}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm',
                  m.role === 'user'
                    ? 'rounded-br-md bg-primary-600 text-white'
                    : 'rounded-bl-md bg-[var(--bg-muted)] text-[var(--text)]',
                )}
              >
                {m.imageUrl ? (
                  <img
                    src={m.imageUrl}
                    alt="Ticket"
                    className="mb-2 max-h-40 w-full rounded-lg object-cover"
                  />
                ) : null}
                {m.content}
              </div>
            </div>
          ))}
          {draft ? (
            <DraftCard
              draft={draft}
              currency={currency}
              confirming={confirming}
              onConfirm={handleConfirm}
              onEdit={handleEdit}
            />
          ) : null}
          {sending ? (
            <p className="text-xs text-[var(--text-muted)]">
              {aiOn ? 'La IA está leyendo...' : 'Pensando...'}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={handleSend}
          className="border-t border-[var(--border)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={sending || confirming}
              onClick={() => cameraRef.current?.click()}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--bg-muted)] text-sm font-semibold disabled:opacity-60"
            >
              <Camera className="h-5 w-5" />
              Foto
            </button>
            <button
              type="button"
              disabled={sending || confirming}
              onClick={() => galleryRef.current?.click()}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--bg-muted)] text-sm font-semibold disabled:opacity-60"
            >
              <ImagePlus className="h-5 w-5" />
              Galería
            </button>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              placeholder='Ej: "Gasté 8500 en comida" o subí foto'
              className="min-h-[3.25rem] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 sm:text-sm"
              disabled={sending || confirming}
            />
            <Button
              type="submit"
              size="icon"
              className="h-12 w-12 shrink-0"
              disabled={!input.trim() || sending}
              aria-label="Enviar"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handlePhoto(file)
              e.target.value = ''
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handlePhoto(file)
              e.target.value = ''
            }}
          />
        </form>
      </aside>
    </div>
  )
}

export function ExpenseChatFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-24 right-4 z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 lg:bottom-8 lg:right-8"
      aria-label="Abrir chat de gastos"
      title="Chat de gastos"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  )
}
