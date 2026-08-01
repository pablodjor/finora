import { adjustBankBalance } from './bankBalance'
import { updateCreditCard } from '../services/creditCards'
import { createPurchaseWithInstallments } from '../services/creditCards'
import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

/** Métodos que mueven plata de la cuenta / banco. */
export const BANK_LINKED_TYPES = new Set(['debit', 'bank', 'transfer', 'mercadopago'])
export const CREDIT_TYPES = new Set(['credit'])

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

export function getMethodType(method) {
  return method?.type || null
}

/** Delta sobre saldo banco: gasto resta, ingreso suma. */
export function bankDeltaForMovement(movement, method) {
  if (!movement || movement.status === 'cancelled') return 0
  if (!BANK_LINKED_TYPES.has(getMethodType(method))) return 0
  const amount = Number(movement.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (movement.type === 'expense') return -amount
  if (movement.type === 'income') return amount
  return 0
}

export async function restoreCardAvailableLimit(creditCardId, amount) {
  if (!creditCardId || !amount) return
  const { data: card, error } = await supabase
    .from('credit_cards')
    .select('available_limit, total_limit')
    .eq('id', creditCardId)
    .maybeSingle()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  if (!card) return
  const next = Math.min(
    Number(card.total_limit || 0),
    roundMoney(Number(card.available_limit || 0) + Number(amount)),
  )
  await updateCreditCard(creditCardId, { available_limit: next })
}

export async function decreaseCardAvailableLimit(creditCardId, amount) {
  if (!creditCardId || !amount) return
  const { data: card, error } = await supabase
    .from('credit_cards')
    .select('available_limit, total_limit')
    .eq('id', creditCardId)
    .maybeSingle()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  if (!card) return
  const next = Math.max(0, roundMoney(Number(card.available_limit || 0) - Number(amount)))
  await updateCreditCard(creditCardId, { available_limit: next })
}

/**
 * Aplica efectos de un movimiento nuevo/editado/eliminado:
 * - débito/transfer/MP/banco → mueve saldo cuenta sueldo
 * - crédito → registra compra en tarjeta (o restaura límite al revertir)
 */
export async function applyMovementPaymentEffects({
  userId,
  previous = null,
  next = null,
  paymentMethods = [],
  options = {},
}) {
  const byId = Object.fromEntries(paymentMethods.map((m) => [m.id, m]))
  const createCardPurchase = options.createCardPurchase !== false

  // 1) Revertir anterior
  if (previous) {
    const prevMethod = byId[previous.payment_method_id]
    const reverseBank = -bankDeltaForMovement(previous, prevMethod)
    if (reverseBank) adjustBankBalance(userId, reverseBank, 'transaction-edit')

    if (
      previous.type === 'expense' &&
      CREDIT_TYPES.has(getMethodType(prevMethod)) &&
      previous.credit_card_id
    ) {
      await restoreCardAvailableLimit(previous.credit_card_id, previous.amount)
    }
  }

  // 2) Aplicar nuevo
  if (!next || next.status === 'cancelled') return { bankAdjusted: false, cardPurchase: null }

  const method = byId[next.payment_method_id]
  const bankDelta = bankDeltaForMovement(next, method)
  let bankAdjusted = false
  if (bankDelta) {
    bankAdjusted = adjustBankBalance(userId, bankDelta, 'transaction') != null
  }

  let cardPurchase = null
  const isCreditExpense =
    next.type === 'expense' &&
    CREDIT_TYPES.has(getMethodType(method)) &&
    next.credit_card_id

  if (isCreditExpense && createCardPurchase) {
    cardPurchase = await createPurchaseWithInstallments({
      userId,
      creditCardId: next.credit_card_id,
      description: next.description,
      totalAmount: Number(next.amount),
      installmentsCount: Number(next.installments_count) || 1,
      purchaseDate: next.date,
      categoryId: next.category_id || null,
      notes: 'Desde movimiento Finora',
    })
  } else if (isCreditExpense) {
    // Edición: solo ajustar límite (ya se revirtió el anterior)
    await decreaseCardAvailableLimit(next.credit_card_id, next.amount)
  }

  return { bankAdjusted, cardPurchase }
}

export function matchPaymentMethod(hint, paymentMethods = []) {
  if (!hint || !paymentMethods.length) return null
  const needle = String(hint)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const typeAliases = [
    { type: 'debit', words: ['debito', 'debit', 'tarjeta de debito', 'cuenta debito'] },
    { type: 'credit', words: ['credito', 'credit', 'visa', 'mastercard', 'amex', 'tarjeta de credito', 'en cuotas'] },
    { type: 'cash', words: ['efectivo', 'cash', 'contado', 'billete'] },
    { type: 'transfer', words: ['transferencia', 'transfer', 'cbu', 'alias', 'cvu'] },
    { type: 'mercadopago', words: ['mercado pago', 'mercadopago', 'qr mp', 'mp '] },
    { type: 'bank', words: ['banco', 'cuenta bancaria', 'cuenta sueldo', 'caja de ahorro'] },
  ]

  for (const alias of typeAliases) {
    if (alias.words.some((w) => needle.includes(w))) {
      const byType = paymentMethods.find((m) => m.type === alias.type && m.is_active !== false)
      if (byType) return byType
    }
  }

  return (
    paymentMethods.find((m) => {
      const name = String(m.name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return name && (needle.includes(name) || name.includes(needle))
    }) || null
  )
}
