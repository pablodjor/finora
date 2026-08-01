import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function updateProfile(userId, updates) {
  const safeUpdates = { ...updates }
  delete safeUpdates.role
  delete safeUpdates.is_active
  delete safeUpdates.id
  delete safeUpdates.email

  const { data, error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function setUserActive(userId, isActive) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}
