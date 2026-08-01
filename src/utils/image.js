/** Comprime una imagen para OCR/upload (máx. ~1600px, JPEG). */
export async function compressImage(file, { maxSize = 1600, quality = 0.82 } = {}) {
  if (!file?.type?.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })

  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg') || 'recibo.jpg', {
    type: 'image/jpeg',
  })
}
