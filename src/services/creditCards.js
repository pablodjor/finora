import { getSupabaseErrorMessage, supabase } from '../lib/supabase'
import { addMonths, parseISO } from 'date-fns'
import { toISODate } from '../utils/dates'

const CARD_SELECT = '*'
const PURCHASE_SELECT = `
  *,
  credit_card:credit_cards(id, name, color),
  category:categories(id, name),
  installments:credit_card_installments(*)
`

export async function listCreditCards(userId) {
  const { data, error } = await supabase
    .from('credit_cards')
    .select(CARD_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function createCreditCard(payload) {
  const { data, error } = await supabase
    .from('credit_cards')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function updateCreditCard(id, updates) {
  const { data, error } = await supabase
    .from('credit_cards')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function softDeleteCreditCard(id) {
  const { data, error } = await supabase
    .from('credit_cards')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function listPurchases(userId, creditCardId) {
  let query = supabase
    .from('credit_card_purchases')
    .select(PURCHASE_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('purchase_date', { ascending: false })

  if (creditCardId) query = query.eq('credit_card_id', creditCardId)

  const { data, error } = await query
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function listInstallments(userId, { from, to, creditCardId, status } = {}) {
  let query = supabase
    .from('credit_card_installments')
    .select(`
      *,
      purchase:credit_card_purchases(id, description),
      credit_card:credit_cards(id, name, color)
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  if (from) query = query.gte('due_date', from)
  if (to) query = query.lte('due_date', to)
  if (creditCardId) query = query.eq('credit_card_id', creditCardId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

function buildInstallments({
  userId,
  purchaseId,
  creditCardId,
  totalAmount,
  installmentsCount,
  purchaseDate,
}) {
  const base = Math.floor((totalAmount / installmentsCount) * 100) / 100
  const rows = []
  let assigned = 0
  const start = typeof purchaseDate === 'string' ? parseISO(purchaseDate) : purchaseDate

  for (let i = 1; i <= installmentsCount; i += 1) {
    const amount = i === installmentsCount ? Number((totalAmount - assigned).toFixed(2)) : base
    assigned += amount
    const due = addMonths(start, i - 1)
    rows.push({
      user_id: userId,
      purchase_id: purchaseId,
      credit_card_id: creditCardId,
      installment_number: i,
      amount,
      due_date: toISODate(due),
      status: 'pending',
    })
  }
  return rows
}

export async function createPurchaseWithInstallments({
  userId,
  creditCardId,
  description,
  totalAmount,
  installmentsCount,
  purchaseDate,
  categoryId,
  notes,
}) {
  const { data: purchase, error } = await supabase
    .from('credit_card_purchases')
    .insert({
      user_id: userId,
      credit_card_id: creditCardId,
      description,
      total_amount: totalAmount,
      installments_count: installmentsCount,
      purchase_date: purchaseDate,
      category_id: categoryId || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))

  const installmentRows = buildInstallments({
    userId,
    purchaseId: purchase.id,
    creditCardId,
    totalAmount: Number(totalAmount),
    installmentsCount: Number(installmentsCount),
    purchaseDate,
  })

  const { error: instError } = await supabase
    .from('credit_card_installments')
    .insert(installmentRows)

  if (instError) throw new Error(getSupabaseErrorMessage(instError))

  // Update available limit roughly
  const { data: card } = await supabase
    .from('credit_cards')
    .select('available_limit, total_limit')
    .eq('id', creditCardId)
    .single()

  if (card) {
    const nextAvailable = Math.max(0, Number(card.available_limit) - Number(totalAmount))
    await supabase
      .from('credit_cards')
      .update({ available_limit: nextAvailable })
      .eq('id', creditCardId)
  }

  return purchase
}

export async function getCardSummary(userId, cardId) {
  const [cardRes, installments] = await Promise.all([
    supabase.from('credit_cards').select('*').eq('id', cardId).single(),
    listInstallments(userId, { creditCardId: cardId }),
  ])

  if (cardRes.error) throw new Error(getSupabaseErrorMessage(cardRes.error))
  const card = cardRes.data
  const pending = installments.filter((i) => i.status === 'pending' || i.status === 'scheduled')
  const pendingTotal = pending.reduce((acc, i) => acc + Number(i.amount || 0), 0)
  const used = Number(card.total_limit || 0) - Number(card.available_limit || 0)

  return {
    card,
    pendingCount: pending.length,
    pendingTotal,
    used,
    available: Number(card.available_limit || 0),
    nextDue: pending[0]?.due_date || null,
    installments,
  }
}
