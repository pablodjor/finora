import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(getSupabaseErrorMessage(error))
}

export async function resetPassword(email) {
  const redirectTo = `${window.location.origin}/login`
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data.session
}
