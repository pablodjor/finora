import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

const SELECT = `
  *,
  category:categories(id, name, color, icon)
`

export async function listBudgets(userId, { year, month } = {}) {
  let query = supabase
    .from('budgets')
    .select(SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (year) query = query.eq('year', year)
  if (month) query = query.eq('month', month)

  const { data, error } = await query
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function createBudget(payload) {
  const { data, error } = await supabase.from('budgets').insert(payload).select(SELECT).single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function updateBudget(id, updates) {
  const { data, error } = await supabase
    .from('budgets')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function softDeleteBudget(id) {
  const { data, error } = await supabase
    .from('budgets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}
