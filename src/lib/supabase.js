import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copiá .env.example a .env y completá las claves.',
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export function getSupabaseErrorMessage(error) {
  if (!error) return 'Ocurrió un error inesperado'
  const message = error.message || String(error)

  if (message.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos'
  }
  if (message.includes('User already registered')) {
    return 'Ya existe una cuenta con este email'
  }
  if (message.includes('Email not confirmed')) {
    return 'Debés confirmar tu email antes de iniciar sesión'
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'No se pudo conectar con Supabase. Verificá tu conexión y las variables de entorno.'
  }

  return message
}
