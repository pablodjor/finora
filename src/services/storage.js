import { getSupabaseErrorMessage, supabase } from '../lib/supabase'
import { createId } from '../utils/id'

const BUCKET = 'receipts'

function extensionFromMime(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic'
  return 'jpg'
}

export async function uploadReceipt(userId, file) {
  if (!userId || !file) throw new Error('Falta el archivo o el usuario')

  const ext = extensionFromMime(file.type)
  const path = `${userId}/${createId()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })

  if (error) throw new Error(getSupabaseErrorMessage(error))

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteReceiptByUrl(url) {
  if (!url) return
  try {
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx < 0) return
    const path = decodeURIComponent(url.slice(idx + marker.length))
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // no bloquear el guardado si falla el borrado
  }
}
