import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

export async function getTelegramLink() {
  const { data, error } = await supabase
    .from('telegram_links')
    .select('id, telegram_chat_id, telegram_username, linked_at')
    .maybeSingle()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function createTelegramLinkCode() {
  const { data, error } = await supabase.rpc('create_telegram_link_code')
  if (error) throw new Error(getSupabaseErrorMessage(error))
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.code) throw new Error('No se pudo generar el código')
  return {
    code: row.code,
    expires_at: row.expires_at,
  }
}

export async function unlinkTelegram() {
  const { error } = await supabase.rpc('unlink_telegram')
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return true
}

export function getTelegramBotUsername() {
  return String(import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '')
}

export function buildTelegramStartLink(code) {
  const username = getTelegramBotUsername()
  if (!username || !code) return null
  return `https://t.me/${username}?start=${encodeURIComponent(code)}`
}
