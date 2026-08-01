import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

const SELECT = `
  *,
  category:categories(id, name, color, icon),
  payment_method:payment_methods(id, name)
`

export async function listRecurringExpenses(userId) {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select(SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function createRecurringExpense(payload) {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert(payload)
    .select(SELECT)
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function updateRecurringExpense(id, updates) {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function softDeleteRecurringExpense(id) {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function generateMonthInstances(userId, year, month) {
  const { data, error } = await supabase.rpc('generate_recurring_expense_instances', {
    p_user_id: userId,
    p_year: year,
    p_month: month,
  })

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}
