import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

export async function listPaymentMethods(userId) {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function createPaymentMethod(payload) {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function updatePaymentMethod(id, updates) {
  const { data, error } = await supabase
    .from('payment_methods')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function softDeletePaymentMethod(id) {
  const { data, error } = await supabase
    .from('payment_methods')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}
