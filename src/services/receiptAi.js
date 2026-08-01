import { suggestFromText } from '../utils/receiptSuggest'
import { geminiGenerateContent, hasGemini } from '../lib/gemini'
import { matchPaymentMethod } from '../utils/paymentEffects'

export function hasReceiptAi() {
  return hasGemini()
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

function parseJsonLoose(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('Respuesta de IA inválida')
  return JSON.parse(candidate.slice(start, end + 1))
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function resolveCategory(categoryHint, categories, searchText = '') {
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  if (categoryHint) {
    const needle = normalize(categoryHint)
    const exact = expenseCategories.find((c) => {
      const name = normalize(c.name)
      return name === needle || name.includes(needle) || needle.includes(name)
    })
    if (exact) return exact
  }

  const fromKeywords = suggestFromText(searchText || categoryHint || '', expenseCategories)
  if (fromKeywords.categoryId) {
    return expenseCategories.find((c) => c.id === fromKeywords.categoryId) || null
  }
  return null
}

async function analyzeWithGemini(file, categories = [], paymentMethods = []) {
  const base64 = await fileToBase64(file)
  const categoryNames = categories
    .filter((c) => c.type === 'expense')
    .map((c) => c.name)
    .slice(0, 40)
  const methodNames = paymentMethods.map((m) => `${m.name} (${m.type})`).slice(0, 20)

  const prompt = `Sos un asistente de finanzas personales en Argentina.
Analizá la imagen y respondé SOLO un JSON válido (sin markdown) con esta forma:
{
  "isReceipt": boolean,
  "confidence": number,
  "merchant": string|null,
  "description": string|null,
  "amount": number|null,
  "currency": "ARS"|string|null,
  "categoryHint": string|null,
  "paymentMethodHint": string|null,
  "summary": string,
  "whatSpent": string
}

Reglas:
- isReceipt=true solo si parece un ticket, factura, comprobante de pago, transferencia bancaria, carga de nafta o resumen.
- Si es una selfie, meme, captura irrelevante, etc.: isReceipt=false.
- amount debe ser el total a pagar en número (ej 1250.5), no texto.
- categoryHint debe ser UNA de estas categorías del usuario si encaja: ${JSON.stringify(categoryNames)}
- paymentMethodHint: cómo pagó. Preferí uno de: ${JSON.stringify(methodNames)}.
  Si no está claro, usá: "efectivo", "debito", "credito", "transferencia" o "mercado pago".
  Pistas: Visa/Master/Amex/cuotas → credito; Débito → debito; QR Mercado Pago → mercado pago; Transferencia/CBU → transferencia; Contado/efectivo → efectivo.
- Si es nafta/combustible/YPF/Shell/Axion → preferí "Nafta" si está en la lista.
- description: comercio o concepto corto en español (ej "Nafta YPF", "Carrefour", "Uber").
- whatSpent: frase clara de en qué gastó (ej "Nafta en YPF", "Supermercado en Coto").
- summary: una frase tipo "Gastaste $45.000 en nafta en YPF con débito".`

  const { text } = await geminiGenerateContent({
    parts: [
      { text: prompt },
      {
        inline_data: {
          mime_type: file.type || 'image/jpeg',
          data: base64,
        },
      },
    ],
    temperature: 0.2,
    responseMimeType: 'application/json',
  })
  const parsed = parseJsonLoose(text)
  const searchText = [parsed.merchant, parsed.description, parsed.categoryHint, parsed.summary]
    .filter(Boolean)
    .join(' ')
  const category = resolveCategory(parsed.categoryHint, categories, searchText)
  const amount = Number(parsed.amount)

  const description = parsed.description || parsed.merchant || parsed.whatSpent || null
  const whatSpent = parsed.whatSpent || description
  const amountValue = Number.isFinite(amount) && amount > 0 ? amount : null
  const categoryName = category?.name || parsed.categoryHint || null
  const paymentMethod = matchPaymentMethod(
    parsed.paymentMethodHint || text,
    paymentMethods,
  )
  const summary =
    parsed.summary ||
    (whatSpent
      ? `Gastaste${amountValue ? ` $${amountValue.toLocaleString('es-AR')}` : ''} en ${whatSpent}${
          categoryName ? ` (${categoryName})` : ''
        }${paymentMethod ? ` · ${paymentMethod.name}` : ''}.`
      : null)

  return {
    source: 'gemini',
    isReceipt: Boolean(parsed.isReceipt),
    confidence: Number(parsed.confidence) || null,
    amount: amountValue,
    description,
    whatSpent,
    categoryId: category?.id || null,
    categoryName,
    paymentMethodId: paymentMethod?.id || null,
    paymentMethodName: paymentMethod?.name || parsed.paymentMethodHint || null,
    paymentMethodType: paymentMethod?.type || null,
    summary,
    rawText: text,
  }
}

async function analyzeWithOcr(file, categories = [], paymentMethods = []) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa')
  try {
    const {
      data: { text },
    } = await worker.recognize(file)
    const suggestion = suggestFromText(text || '', categories)
    const paymentMethod = matchPaymentMethod(text || '', paymentMethods)
    const looksLikeReceipt =
      Boolean(suggestion.amount) ||
      /total|ticket|factura|cuit|iva|importe|recibo|transferencia/i.test(text || '')

    return {
      source: 'ocr',
      isReceipt: looksLikeReceipt,
      confidence: looksLikeReceipt ? 0.55 : 0.2,
      amount: suggestion.amount,
      description: suggestion.description,
      categoryId: suggestion.categoryId,
      categoryName: suggestion.categoryName,
      paymentMethodId: paymentMethod?.id || null,
      paymentMethodName: paymentMethod?.name || null,
      paymentMethodType: paymentMethod?.type || null,
      summary: looksLikeReceipt
        ? `Leímos el ticket con OCR local${paymentMethod ? ` · ${paymentMethod.name}` : ''}`
        : 'La imagen no parece un recibo claro',
      rawText: text,
    }
  } finally {
    await worker.terminate()
  }
}

/** Analiza la foto con Gemini (si hay API key) o OCR local. */
export async function analyzeReceiptImage(file, categories = [], paymentMethods = []) {
  if (hasReceiptAi()) {
    try {
      return await analyzeWithGemini(file, categories, paymentMethods)
    } catch (error) {
      console.warn('Gemini falló, uso OCR:', error)
      const fallback = await analyzeWithOcr(file, categories, paymentMethods)
      return { ...fallback, aiError: error.message }
    }
  }
  return analyzeWithOcr(file, categories, paymentMethods)
}
