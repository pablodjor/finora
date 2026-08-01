import { suggestFromText } from '../utils/receiptSuggest'
import { geminiGenerateContent, hasGemini } from '../lib/gemini'
import { analyzeReceiptImage } from './receiptAi'
import { matchPaymentMethod } from '../utils/paymentEffects'
import { toISODate, nowInArgentina } from '../utils/dates'

function parseJsonLoose(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('La IA no devolvió texto')
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

function isGreeting(text) {
  const t = normalize(text).trim()
  return /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|hi|hello|que tal|como estas|como andas|todo bien)[\s!?.]*$/i.test(
    t,
  ) || /^(hola|buenas)\b.*(como estas|como andas|que tal|todo bien)?[\s!?.]*$/i.test(t)
}

function resolveCategory(categoryHint, categories) {
  if (!categoryHint) return null
  const expenseCategories = categories.filter((c) => c.type !== 'income')
  const needle = normalize(categoryHint)

  const exact = expenseCategories.find((c) => {
    const name = normalize(c.name)
    return name === needle || name.includes(needle) || needle.includes(name)
  })
  if (exact) return exact

  const fromKeywords = suggestFromText(categoryHint, expenseCategories)
  return expenseCategories.find((c) => c.id === fromKeywords.categoryId) || null
}

function localParse(message, categories) {
  const text = String(message || '').trim()

  if (isGreeting(text)) {
    return {
      reply:
        '¡Hola! Bien, gracias. Contame un gasto cuando quieras. Ej: “Gasté 4500 en comida” o “Sumá 12000 de Uber”.',
      draft: null,
    }
  }

  const amountMatch =
    text.match(/\$\s*([\d.]+,\d{2})/) ||
    text.match(/\$\s*([\d]+(?:[.,]\d{1,2})?)/) ||
    text.match(/([\d.]+,\d{2})\s*(pesos|ars)?/i) ||
    text.match(/(?:gaste|gasté|pague|pagué|sum[aá]|agreg[aá]|por)\s*\$?\s*([\d.]+(?:,\d{2})?)/i) ||
    text.match(/\b([\d]{2,}(?:[.,]\d{1,2})?)\b/)

  let amount = null
  if (amountMatch) {
    const raw = amountMatch[1]
    amount = raw.includes(',')
      ? Number(raw.replace(/\./g, '').replace(',', '.'))
      : Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) amount = null
  }

  const category =
    resolveCategory(text, categories) ||
    (() => {
      const s = suggestFromText(text, categories)
      return categories.find((c) => c.id === s.categoryId) || null
    })()

  const needsAmount = !amount
  const description =
    text
      .replace(/\$?\s*[\d.]+(?:,\d{2})?/g, '')
      .replace(/\b(gaste|gasté|pague|pagué|suma|sumá|agrega|agregá|un gasto de|gasto de|en|de|por)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() ||
    category?.name ||
    'Gasto'

  if (needsAmount && !category) {
    return {
      reply:
        'Decime el gasto con importe y categoría. Ej: “Gasté 4500 en supermercado” o “Sumá 12000 de Uber”.',
      draft: null,
    }
  }

  if (needsAmount) {
    return {
      reply: `¿Cuánto fue el gasto de ${category.name}?`,
      draft: {
        type: 'expense',
        description,
        amount: null,
        category_id: category.id,
        category_name: category.name,
        date: toISODate(nowInArgentina()),
        incomplete: true,
      },
    }
  }

  return {
    reply: category
      ? `Listo: ${description} en ${category.name} por $${amount.toLocaleString('es-AR')}. Confirmá para guardarlo.`
      : `Armé el gasto por $${amount.toLocaleString('es-AR')}. Revisá la categoría y confirmá.`,
    draft: {
      type: 'expense',
      description: description.slice(0, 120),
      amount,
      category_id: category?.id || null,
      category_name: category?.name || null,
      date: toISODate(nowInArgentina()),
      incomplete: false,
    },
  }
}

async function parseWithGemini(message, categories, history = [], paymentMethods = []) {
  const categoryNames = categories
    .filter((c) => c.type === 'expense' || !c.type)
    .map((c) => c.name)
    .slice(0, 40)
  const methodNames = paymentMethods.map((m) => `${m.name} (${m.type})`).slice(0, 20)

  const today = toISODate(nowInArgentina())
  const prompt = `Sos el asistente de Finora, app de finanzas personales en Argentina.
Podés charlar normal (saludos, dudas cortas) y también cargar gastos/ingresos.
Hoy es ${today}.

Categorías disponibles: ${JSON.stringify(categoryNames)}
Métodos de pago: ${JSON.stringify(methodNames)}

Historial reciente:
${history
  .slice(-8)
  .map((m) => `${m.role}: ${m.content}`)
  .join('\n')}

Mensaje nuevo del usuario: ${JSON.stringify(message)}

Respondé SOLO JSON válido:
{
  "reply": "mensaje corto y amable en español",
  "draft": null | {
    "type": "expense" | "income",
    "description": "string corta",
    "amount": number | null,
    "categoryHint": "string|null",
    "paymentMethodHint": "string|null",
    "date": "YYYY-MM-DD",
    "incomplete": boolean
  }
}

Reglas:
- Si te saludan ("hola", "cómo estás"), respondé el saludo y ofrecé ayuda para cargar un gasto. draft=null.
- Si faltan datos (sobre todo amount), draft.incomplete=true y preguntá en reply.
- Si hay suficiente para guardar, incomplete=false.
- amount en número (4500.5), no string.
- categoryHint debe preferir una categoría de la lista.
- paymentMethodHint: efectivo, debito, credito, transferencia, mercado pago, etc.
- Si dice "comida", "super", "carrefour" → categoría de supermercado/comida si existe.
- Si dice "nafta", "combustible", "YPF", "Shell" → categoría Nafta si existe.
- No inventes importes.`

  const { text } = await geminiGenerateContent({
    parts: [{ text: prompt }],
    temperature: 0.4,
    responseMimeType: 'application/json',
  })
  const parsed = parseJsonLoose(text)

  if (!parsed.draft) {
    return {
      reply:
        parsed.reply ||
        '¡Hola! Contame el gasto: importe y en qué fue. Ej: “Gasté 4500 en comida con débito”.',
      draft: null,
    }
  }

  const category = resolveCategory(
    parsed.draft.categoryHint || parsed.draft.description,
    categories,
  )
  const paymentMethod = matchPaymentMethod(
    parsed.draft.paymentMethodHint || message,
    paymentMethods,
  )
  const amount = Number(parsed.draft.amount)
  const incomplete =
    Boolean(parsed.draft.incomplete) || !Number.isFinite(amount) || amount <= 0

  return {
    reply: parsed.reply || 'Revisá el borrador y confirmá.',
    draft: {
      type: parsed.draft.type === 'income' ? 'income' : 'expense',
      description: String(parsed.draft.description || category?.name || 'Gasto').slice(0, 120),
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      category_id: category?.id || null,
      category_name: category?.name || parsed.draft.categoryHint || null,
      payment_method_id: paymentMethod?.id || null,
      payment_method_name: paymentMethod?.name || parsed.draft.paymentMethodHint || null,
      date: parsed.draft.date || today,
      incomplete,
    },
  }
}

async function parseFromImage(imageFile, categories, caption = '', paymentMethods = []) {
  const analysis = await analyzeReceiptImage(imageFile, categories, paymentMethods)
  const today = toISODate(nowInArgentina())
  const amount = analysis.amount
  const description =
    analysis.description ||
    analysis.whatSpent ||
    analysis.categoryName ||
    (caption.trim() || 'Gasto del ticket')
  const incomplete = !amount || amount <= 0

  const replyParts = []
  if (analysis.isReceipt === false) {
    replyParts.push(
      analysis.summary ||
        'No parece un recibo claro. Si igual era un gasto, decime importe y categoría.',
    )
  } else {
    replyParts.push(
      analysis.summary ||
        `Vi un gasto${analysis.whatSpent ? ` en ${analysis.whatSpent}` : ''}${
          analysis.categoryName ? ` → ${analysis.categoryName}` : ''
        }${analysis.paymentMethodName ? ` · ${analysis.paymentMethodName}` : ''}${
          amount ? ` por $${Number(amount).toLocaleString('es-AR')}` : ''
        }.`,
    )
    if (incomplete) replyParts.push('Falta el importe: ¿cuánto fue?')
    else replyParts.push('Confirmá para guardarlo.')
  }

  return {
    reply: replyParts.join(' '),
    draft: {
      type: 'expense',
      description: String(description).slice(0, 120),
      amount: amount || null,
      category_id: analysis.categoryId || null,
      category_name: analysis.categoryName || null,
      payment_method_id: analysis.paymentMethodId || null,
      payment_method_name: analysis.paymentMethodName || null,
      date: today,
      incomplete,
      whatSpent: analysis.whatSpent || null,
      fromPhoto: true,
    },
  }
}

export async function parseExpenseChatMessage({
  message,
  imageFile = null,
  categories,
  paymentMethods = [],
  history = [],
}) {
  if (imageFile) {
    try {
      return await parseFromImage(imageFile, categories, message, paymentMethods)
    } catch (error) {
      console.warn('Chat foto falló:', error)
      if (message?.trim()) {
        const fallback = localParse(message, categories)
        return {
          ...fallback,
          reply: `${fallback.reply}\n\n(No pude leer la foto: ${error.message})`,
        }
      }
      return {
        reply: `No pude leer la foto. ${error.message || ''} Probá otra o escribí el gasto.`,
        draft: null,
      }
    }
  }

  if (hasGemini()) {
    try {
      return await parseWithGemini(message, categories, history, paymentMethods)
    } catch (error) {
      console.warn('Chat Gemini falló, uso parser local:', error)
      const fallback = localParse(message, categories)
      const paymentMethod = matchPaymentMethod(message, paymentMethods)
      const quotaHint = /cuota|429|RESOURCE_EXHAUSTED|agotad/i.test(String(error.message || ''))
      return {
        ...fallback,
        draft: fallback.draft
          ? {
              ...fallback.draft,
              payment_method_id: paymentMethod?.id || null,
              payment_method_name: paymentMethod?.name || null,
            }
          : null,
        reply: quotaHint
          ? `${fallback.reply}\n\n(Gemini sin cuota ahora; usé el asistente local.)`
          : `${fallback.reply}\n\n(${error.message || 'Gemini no disponible; modo local'})`,
      }
    }
  }
  const fallback = localParse(message, categories)
  const paymentMethod = matchPaymentMethod(message, paymentMethods)
  return {
    ...fallback,
    draft: fallback.draft
      ? {
          ...fallback.draft,
          payment_method_id: paymentMethod?.id || null,
          payment_method_name: paymentMethod?.name || null,
        }
      : null,
  }
}

export { hasGemini as hasExpenseChatAi }
