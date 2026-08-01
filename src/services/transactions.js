import { getSupabaseErrorMessage, supabase } from '../lib/supabase'
import { getMonthRange } from '../utils/dates'

const SELECT = `
  *,
  category:categories(id, name, color, icon, type),
  payment_method:payment_methods(id, name, type, color)
`

export async function listTransactions(userId, filters = {}) {
  let query = supabase
    .from('transactions')
    .select(SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.paymentMethodId) query = query.eq('payment_method_id', filters.paymentMethodId)
  if (filters.from) query = query.gte('date', filters.from)
  if (filters.to) query = query.lte('date', filters.to)
  if (filters.year && filters.month) {
    const range = getMonthRange(filters.year, filters.month)
    query = query.gte('date', range.from).lte('date', range.to)
  }
  if (filters.search) {
    query = query.ilike('description', `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function getTransaction(id) {
  const { data, error } = await supabase
    .from('transactions')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function createTransaction(payload) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select(SELECT)
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function createManyTransactions(payloads) {
  if (!payloads?.length) return []
  const { data, error } = await supabase.from('transactions').insert(payloads).select(SELECT)
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

/** Busca movimientos ya importados (por Ref en notes) para evitar duplicados. */
export async function listImportedReferences(userId, references = []) {
  const refs = [...new Set(references.filter(Boolean))]
  if (!refs.length) return new Set()

  const { data, error } = await supabase
    .from('transactions')
    .select('notes')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .ilike('notes', '%Importado desde Santander%')

  if (error) throw new Error(getSupabaseErrorMessage(error))

  const existing = new Set()
  ;(data || []).forEach((row) => {
    const match = String(row.notes || '').match(/Ref:\s*([^\s·]+)/i)
    if (match?.[1]) existing.add(match[1])
  })
  return existing
}

export async function updateTransaction(id, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function softDeleteTransaction(id) {
  const { data, error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function markTransactionPaid(id) {
  return updateTransaction(id, { status: 'paid' })
}

export async function duplicateTransaction(transaction, userId) {
  const payload = {
    user_id: userId,
    type: transaction.type,
    description: `${transaction.description} (copia)`,
    amount: transaction.amount,
    date: transaction.date,
    category_id: transaction.category_id,
    subcategory_id: transaction.subcategory_id,
    payment_method_id: transaction.payment_method_id,
    expense_type: transaction.expense_type,
    status: transaction.status,
    notes: transaction.notes,
    installments_count: transaction.installments_count,
    current_installment: transaction.current_installment,
    is_recurring: false,
  }
  return createTransaction(payload)
}
