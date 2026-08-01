import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  buildJuntadaTelegramSummary,
  createJuntadaExpenseEqual,
  createJuntadaWithMembers,
  findMemberByName,
  getJuntada,
  getJuntadaSummary,
  parseExpenseLines,
} from '../_shared/juntadas.ts'
import { buildJuntadaPdfBytes } from '../_shared/juntadaPdf.ts'

const TELEGRAM_API = 'https://api.telegram.org'

type JuntadaFlow = {
  kind: 'juntada'
  step: 'name' | 'members' | 'expenses'
  juntada_id?: string
  name?: string
}

type Draft = {
  type: 'expense' | 'income'
  description: string
  amount: number | null
  category_id: string | null
  category_name: string | null
  payment_method_id: string | null
  payment_method_name: string | null
  date: string
  incomplete: boolean
  receipt_url?: string | null
}

type Category = { id: string; name: string; type: string | null }
type PaymentMethod = { id: string; name: string; type: string | null }

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
  }
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function normalize(text: string) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseJsonLoose(text: string) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('Respuesta de IA inválida')
  return JSON.parse(candidate.slice(start, end + 1))
}

function formatMoney(amount: number) {
  return `$ ${Number(amount).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function resolveCategory(hint: string | null | undefined, categories: Category[]) {
  if (!hint) return null
  const needle = normalize(hint)
  const pool = categories.filter((c) => c.type !== 'income')
  return (
    pool.find((c) => {
      const name = normalize(c.name)
      return name === needle || name.includes(needle) || needle.includes(name)
    }) || null
  )
}

function matchPaymentMethod(hint: string | null | undefined, methods: PaymentMethod[]) {
  if (!hint || !methods.length) return null
  const n = normalize(hint)
  const rules: Array<[RegExp, string[]]> = [
    [/mercado\s*pago|\bmp\b/, ['mercadopago']],
    [/debito|d[eé]bito/, ['debit']],
    [/credito|cr[eé]dito|tarjeta/, ['credit']],
    [/transfer|alias|cbu/, ['transfer', 'bank']],
    [/efectivo|cash/, ['cash']],
  ]
  for (const [re, types] of rules) {
    if (re.test(n)) {
      const found = methods.find((m) => types.includes(m.type || ''))
      if (found) return found
    }
  }
  return (
    methods.find((m) => {
      const name = normalize(m.name)
      return name === n || name.includes(n) || n.includes(name)
    }) || null
  )
}

function localParse(message: string, categories: Category[], paymentMethods: PaymentMethod[]) {
  const text = String(message || '').trim()
  const n = normalize(text)

  if (/^(hola|buenas|hey|hi|hello)[\s!?.]*$/i.test(n)) {
    return {
      reply:
        '¡Hola! Mandame un gasto o ingreso. Ej: “Gasté 4500 en nafta” o “Cobré 80000 sueldo”. También podés mandar foto del ticket.',
      draft: null as Draft | null,
    }
  }

  const isIncome = /\b(cobr[eé]|ingreso|sueldo|me pagaron|recib[ií])\b/i.test(text)
  const amountMatch =
    text.match(/\$\s*([\d.]+,\d{2})/) ||
    text.match(/\$\s*([\d]+(?:[.,]\d{1,2})?)/) ||
    text.match(/(?:gaste|gasté|pague|pagué|cobr[eé]|sum[aá]|agreg[aá]|por)\s*\$?\s*([\d.]+(?:,\d{2})?)/i) ||
    text.match(/\b([\d]{2,}(?:[.,]\d{1,2})?)\b/)

  let amount: number | null = null
  if (amountMatch) {
    const raw = amountMatch[1]
    amount = raw.includes(',')
      ? Number(raw.replace(/\./g, '').replace(',', '.'))
      : Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) amount = null
  }

  const category = resolveCategory(text, categories)
  const paymentMethod = matchPaymentMethod(text, paymentMethods)
  const description =
    text
      .replace(/\$?\s*[\d.]+(?:,\d{2})?/g, '')
      .replace(
        /\b(gaste|gasté|pague|pagué|cobr[eé]|suma|sumá|agrega|agregá|un gasto de|gasto de|ingreso|sueldo|en|de|por|con)\b/gi,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim() ||
    category?.name ||
    (isIncome ? 'Ingreso' : 'Gasto')

  const incomplete = !amount
  const draft: Draft = {
    type: isIncome ? 'income' : 'expense',
    description: description.slice(0, 120),
    amount,
    category_id: category?.id || null,
    category_name: category?.name || null,
    payment_method_id: paymentMethod?.id || null,
    payment_method_name: paymentMethod?.name || null,
    date: todayISO(),
    incomplete,
  }

  if (incomplete) {
    return {
      reply: `¿Cuánto fue${category ? ` (${category.name})` : ''}? Mandame solo el importe, ej: 4500`,
      draft,
    }
  }

  return {
    reply: `Listo: ${draft.type === 'income' ? 'ingreso' : 'gasto'} ${formatMoney(amount!)} · ${draft.description}`,
    draft,
  }
}

async function geminiParse(
  message: string,
  categories: Category[],
  paymentMethods: PaymentMethod[],
  apiKey: string,
  model: string,
) {
  const categoryNames = categories
    .filter((c) => c.type === 'expense' || !c.type)
    .map((c) => c.name)
    .slice(0, 40)
  const methodNames = paymentMethods.map((m) => `${m.name} (${m.type})`).slice(0, 20)
  const today = todayISO()

  const prompt = `Sos el asistente de Finora por Telegram (finanzas personales Argentina).
Hoy es ${today}.
Categorías: ${JSON.stringify(categoryNames)}
Métodos de pago: ${JSON.stringify(methodNames)}
Mensaje: ${JSON.stringify(message)}

Respondé SOLO JSON:
{
  "reply": "mensaje corto en español",
  "draft": null | {
    "type": "expense" | "income",
    "description": "string",
    "amount": number | null,
    "categoryHint": "string|null",
    "paymentMethodHint": "string|null",
    "date": "YYYY-MM-DD",
    "incomplete": boolean
  }
}
Reglas: si saludo, draft=null. Si falta amount, incomplete=true. amount numérico. No inventes importes.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    }),
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${raw.slice(0, 180)}`)
  const data = JSON.parse(raw)
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('') ||
    ''
  const parsed = parseJsonLoose(text)

  if (!parsed.draft) {
    return {
      reply:
        parsed.reply ||
        'Contame el gasto o ingreso con importe. Ej: “Gasté 4500 en nafta”.',
      draft: null as Draft | null,
    }
  }

  const category = resolveCategory(parsed.draft.categoryHint || parsed.draft.description, categories)
  const paymentMethod = matchPaymentMethod(parsed.draft.paymentMethodHint || message, paymentMethods)
  const amount = Number(parsed.draft.amount)
  const incomplete = Boolean(parsed.draft.incomplete) || !Number.isFinite(amount) || amount <= 0

  return {
    reply: parsed.reply || 'Revisá el movimiento.',
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
    } as Draft,
  }
}

async function telegramCall(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error('Telegram error', method, data)
  }
  return data
}

async function sendMessage(token: string, chatId: number, text: string) {
  return telegramCall(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  })
}

async function sendDocument(
  token: string,
  chatId: number,
  bytes: Uint8Array,
  filename: string,
  caption = '',
) {
  const form = new FormData()
  form.append('chat_id', String(chatId))
  if (caption) form.append('caption', caption.slice(0, 1000))
  form.append(
    'document',
    new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    filename,
  )
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (!data.ok) console.error('Telegram sendDocument error', data)
  return data
}

// deno-lint-ignore no-explicit-any
async function setFlow(supabase: any, linkId: string, flow: JuntadaFlow | null) {
  await supabase.from('telegram_links').update({ pending_flow: flow }).eq('id', linkId)
}

async function finishJuntadaAndReply(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  botToken: string,
  chatId: number,
  linkId: string,
  juntadaId: string,
) {
  const summary = await getJuntadaSummary(supabase, juntadaId)
  if (!summary) {
    await sendMessage(botToken, chatId, 'No encontré la juntada.')
    return
  }
  if (!summary.expenses.length) {
    await sendMessage(botToken, chatId, 'No hay gastos cargados. Mandá al menos uno o /cancelar.')
    return
  }

  await setFlow(supabase, linkId, null)
  const text = buildJuntadaTelegramSummary(summary)
  await sendMessage(botToken, chatId, text)

  try {
    const { bytes, filename } = await buildJuntadaPdfBytes(summary)
    await sendDocument(botToken, chatId, bytes, filename, `Comprobante · ${summary.juntada.name}`)
  } catch (error) {
    console.error('PDF juntada', error)
    await sendMessage(
      botToken,
      chatId,
      'El resumen ya está arriba. No pude adjuntar el PDF; igual lo ves en Finora → Juntadas.',
    )
  }
}

async function handleJuntadaFlow(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  botToken: string,
  chatId: number,
  link: { id: string; user_id: string },
  flow: JuntadaFlow,
  text: string,
): Promise<boolean> {
  if (/^\/cancelar/i.test(text)) {
    await setFlow(supabase, link.id, null)
    await sendMessage(botToken, chatId, 'Juntada cancelada. Podés seguir cargando gastos personales.')
    return true
  }

  if (flow.step === 'name') {
    const name = text.replace(/^\/juntada(@\w+)?\s*/i, '').trim() || text.trim()
    if (name.length < 2 || name.startsWith('/')) {
      await sendMessage(botToken, chatId, '¿Nombre de la juntada? Ej: Asado del sábado')
      return true
    }
    await setFlow(supabase, link.id, { kind: 'juntada', step: 'members', name })
    await sendMessage(
      botToken,
      chatId,
      `Juntada <b>${name}</b>.\n¿Quiénes participan? Separá por coma.\nEj: Pablo, Juan, Sofi`,
    )
    return true
  }

  if (flow.step === 'members') {
    const names = text
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length < 1) {
      await sendMessage(botToken, chatId, 'Mandá al menos un nombre, separados por coma.')
      return true
    }
    try {
      const juntada = await createJuntadaWithMembers(
        supabase,
        link.user_id,
        flow.name || 'Juntada',
        names,
      )
      const memberList = (juntada.members || []).map((m: { name: string }) => `• ${m.name}`).join('\n')
      await setFlow(supabase, link.id, {
        kind: 'juntada',
        step: 'expenses',
        juntada_id: juntada.id,
        name: juntada.name,
      })
      await sendMessage(
        botToken,
        chatId,
        [
          `✅ Juntada creada con:`,
          memberList,
          '',
          'Mandá gastos así (una o varias líneas):',
          '<code>Juan: carne 15000</code>',
          '<code>Sofi: bebida 8000</code>',
          '',
          'Cuando termines: /listo',
          'Para abortar: /cancelar',
        ].join('\n'),
      )
    } catch (error) {
      await sendMessage(botToken, chatId, `No pude crear la juntada: ${(error as Error).message}`)
    }
    return true
  }

  if (flow.step === 'expenses') {
    if (/^\/listo/i.test(text)) {
      if (!flow.juntada_id) {
        await sendMessage(botToken, chatId, 'No hay juntada activa. Empezá con /juntada')
        return true
      }
      await finishJuntadaAndReply(supabase, botToken, chatId, link.id, flow.juntada_id)
      return true
    }

    if (!flow.juntada_id) {
      await setFlow(supabase, link.id, null)
      await sendMessage(botToken, chatId, 'Se perdió el estado. Empezá de nuevo con /juntada')
      return true
    }

    const juntada = await getJuntada(supabase, flow.juntada_id)
    const members = juntada?.members || []
    if (!members.length) {
      await sendMessage(botToken, chatId, 'La juntada no tiene miembros.')
      return true
    }

    const { items, errors } = parseExpenseLines(text)
    if (!items.length) {
      await sendMessage(
        botToken,
        chatId,
        [
          errors[0] || 'No entendí el gasto.',
          'Formato: <code>Nombre: concepto monto</code>',
          'Ej: <code>Juan: carne 15000</code>',
          'Cuando termines: /listo',
        ].join('\n'),
      )
      return true
    }

    const participantIds = members.map((m: { id: string }) => m.id)
    let created = 0
    const lineErrors = [...errors]

    for (const item of items) {
      const { match, ambiguous } = findMemberByName(members, item.payerName)
      if (ambiguous.length) {
        lineErrors.push(
          `¿Quién pagó "${item.payerName}"? ${ambiguous.map((a) => a.name).join(' / ')}`,
        )
        continue
      }
      if (!match) {
        lineErrors.push(
          `No encontré a "${item.payerName}". Personas: ${members.map((m: { name: string }) => m.name).join(', ')}`,
        )
        continue
      }
      try {
        await createJuntadaExpenseEqual(supabase, link.user_id, {
          juntada_id: flow.juntada_id,
          description: item.description,
          amount: item.amount,
          paid_by_member_id: match.id,
          participant_member_ids: participantIds,
        })
        created += 1
      } catch (error) {
        lineErrors.push(`${item.description}: ${(error as Error).message}`)
      }
    }

    const parts = []
    if (created) parts.push(`✅ Cargué ${created} gasto(s).`)
    if (lineErrors.length) parts.push(lineErrors.slice(0, 5).join('\n'))
    parts.push('Seguí mandando gastos o /listo para cerrar la cuenta.')
    await sendMessage(botToken, chatId, parts.join('\n\n'))
    return true
  }

  return false
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function loadUserContext(supabase: ReturnType<typeof adminClient>, userId: string) {
  const [{ data: categories }, { data: paymentMethods }, { data: cards }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, type')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .is('deleted_at', null),
    supabase
      .from('payment_methods')
      .select('id, name, type')
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase
      .from('credit_cards')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1),
  ])
  return {
    categories: (categories || []) as Category[],
    paymentMethods: (paymentMethods || []) as PaymentMethod[],
    creditCardId: cards?.[0]?.id || null,
  }
}

async function saveTransaction(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  draft: Draft,
  creditCardId: string | null,
  paymentMethods: PaymentMethod[],
) {
  const method = paymentMethods.find((m) => m.id === draft.payment_method_id)
  const isCredit = draft.type === 'expense' && method?.type === 'credit'
  const date = draft.date || todayISO()

  const payload = {
    user_id: userId,
    type: draft.type,
    description: draft.description,
    amount: Number(draft.amount),
    date,
    category_id: draft.category_id,
    payment_method_id: draft.payment_method_id,
    credit_card_id: isCredit ? creditCardId : null,
    expense_type: draft.type === 'expense' ? 'one_time' : null,
    status: 'paid',
    notes: draft.receipt_url ? 'Creado desde Telegram (foto)' : 'Creado desde Telegram',
    receipt_url: draft.receipt_url || null,
    is_recurring: false,
    installments_count: 1,
    current_installment: 1,
    period_year: Number(date.slice(0, 4)),
    period_month: Number(date.slice(5, 7)),
  }

  const { data, error } = await supabase.from('transactions').insert(payload).select('id, amount, description, type').single()
  if (error) throw new Error(error.message)
  return data
}

function mergePending(pending: Draft | null, message: string, categories: Category[], methods: PaymentMethod[]) {
  if (!pending?.incomplete) return null
  const onlyAmount = message.trim().match(/^\$?\s*([\d.]+(?:,\d{2})?|\d+(?:[.,]\d{1,2})?)\s*$/)
  if (onlyAmount) {
    const raw = onlyAmount[1]
    const amount = raw.includes(',')
      ? Number(raw.replace(/\./g, '').replace(',', '.'))
      : Number(raw.replace(',', '.'))
    if (Number.isFinite(amount) && amount > 0) {
      return {
        reply: `Perfecto: ${pending.type === 'income' ? 'ingreso' : 'gasto'} ${formatMoney(amount)} · ${pending.description}`,
        draft: { ...pending, amount, incomplete: false, receipt_url: pending.receipt_url } as Draft,
      }
    }
  }
  // full re-parse but keep pending category if useful
  const parsed = localParse(message, categories, methods)
  if (parsed.draft && !parsed.draft.category_id && pending.category_id) {
    parsed.draft.category_id = pending.category_id
    parsed.draft.category_name = pending.category_name
  }
  if (parsed.draft && !parsed.draft.description && pending.description) {
    parsed.draft.description = pending.description
  }
  if (parsed.draft && !parsed.draft.receipt_url && pending.receipt_url) {
    parsed.draft.receipt_url = pending.receipt_url
  }
  return parsed
}

async function linkWithCode(
  supabase: ReturnType<typeof adminClient>,
  codeRaw: string,
  chatId: number,
  from: { id?: number; username?: string },
) {
  const code = String(codeRaw || '')
    .trim()
    .toUpperCase()
    .replace(/^\/START\s+/i, '')

  if (!code) {
    return 'Para vincular, en Finora generá un código y mandá: /start FINORA-XXXXXXXX'
  }

  const { data: row, error } = await supabase
    .from('telegram_link_codes')
    .select('id, user_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle()

  if (error || !row) return 'Código inválido. Generá uno nuevo desde Finora → Perfil.'
  if (row.used_at) return 'Ese código ya se usó. Pedí uno nuevo en Finora.'
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return 'El código expiró. Generá uno nuevo en Finora → Perfil (valen 15 min).'
  }

  // Liberar chat/user previos
  await supabase.from('telegram_links').delete().eq('telegram_chat_id', chatId)
  await supabase.from('telegram_links').delete().eq('user_id', row.user_id)

  const { error: linkError } = await supabase.from('telegram_links').insert({
    user_id: row.user_id,
    telegram_chat_id: chatId,
    telegram_user_id: from.id || null,
    telegram_username: from.username || null,
    pending_draft: null,
  })
  if (linkError) return `No pude vincular: ${linkError.message}`

  await supabase
    .from('telegram_link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)

  return '✅ Cuenta vinculada.\n\n• Gasto: “Gasté 4500 en nafta”\n• Juntada: /juntada\n• Ayuda: /ayuda'
}

async function downloadTelegramPhoto(token: string, fileId: string) {
  const fileRes = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${fileId}`)
  const fileData = await fileRes.json()
  const path = fileData?.result?.file_path
  if (!path) throw new Error('No pude obtener la foto')
  const imgRes = await fetch(`${TELEGRAM_API}/file/bot${token}/${path}`)
  if (!imgRes.ok) throw new Error('No pude descargar la foto')
  const bytes = new Uint8Array(await imgRes.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  const mime = path.endsWith('.png') ? 'image/png' : 'image/jpeg'
  return { base64, mime, bytes }
}

async function uploadReceipt(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  bytes: Uint8Array,
  mime: string,
) {
  const ext = mime === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  return data.publicUrl as string
}

async function geminiParseImage(
  base64: string,
  mime: string,
  caption: string,
  categories: Category[],
  paymentMethods: PaymentMethod[],
  apiKey: string,
  model: string,
) {
  const categoryNames = categories
    .filter((c) => c.type === 'expense' || !c.type)
    .map((c) => c.name)
    .slice(0, 40)
  const today = todayISO()
  const prompt = `Leé este ticket/recibo para Finora (Argentina). Hoy ${today}.
Categorías: ${JSON.stringify(categoryNames)}
Caption del usuario: ${JSON.stringify(caption || '')}
Respondé SOLO JSON:
{"reply":"string","draft":{"type":"expense","description":"string","amount":number|null,"categoryHint":"string|null","paymentMethodHint":"string|null","date":"YYYY-MM-DD","incomplete":boolean}}
Si no hay importe claro, incomplete=true.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mime, data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`Gemini foto ${response.status}`)
  const data = JSON.parse(raw)
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('') ||
    ''
  const parsed = parseJsonLoose(text)
  const category = resolveCategory(parsed.draft?.categoryHint || parsed.draft?.description, categories)
  const paymentMethod = matchPaymentMethod(parsed.draft?.paymentMethodHint || caption, paymentMethods)
  const amount = Number(parsed.draft?.amount)
  const incomplete = Boolean(parsed.draft?.incomplete) || !Number.isFinite(amount) || amount <= 0
  return {
    reply: parsed.reply || 'Leí el ticket.',
    draft: {
      type: 'expense' as const,
      description: String(parsed.draft?.description || category?.name || 'Gasto del ticket').slice(0, 120),
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      category_id: category?.id || null,
      category_name: category?.name || parsed.draft?.categoryHint || null,
      payment_method_id: paymentMethod?.id || null,
      payment_method_name: paymentMethod?.name || null,
      date: parsed.draft?.date || today,
      incomplete,
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
  const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'

  if (!botToken) {
    return new Response(JSON.stringify({ error: 'Missing TELEGRAM_BOT_TOKEN' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  if (webhookSecret) {
    const header = req.headers.get('x-telegram-bot-api-secret-token')
    if (header !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const update = await req.json()
    const message = update?.message || update?.edited_message
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const chatId = message.chat?.id
    const text = String(message.text || message.caption || '').trim()
    const from = message.from || {}
    if (!chatId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const supabase = adminClient()

    // Commands
    if (text.startsWith('/start')) {
      const payload = text.replace(/^\/start(@\w+)?\s*/i, '').trim()
      if (payload) {
        const reply = await linkWithCode(supabase, payload, chatId, from)
        await sendMessage(botToken, chatId, reply)
      } else {
        const { data: link } = await supabase
          .from('telegram_links')
          .select('user_id')
          .eq('telegram_chat_id', chatId)
          .maybeSingle()
        await sendMessage(
          botToken,
          chatId,
          link
            ? 'Ya estás vinculado. Mandá un gasto/ingreso o /ayuda.'
            : 'Para vincular: en Finora → Perfil generá un código y mandá /start FINORA-XXXXXXXX',
        )
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    if (/^\/ayuda|^\/help/i.test(text)) {
      await sendMessage(
        botToken,
        chatId,
        [
          '<b>Finora Bot</b>',
          '',
          '• Gasté 4500 en nafta',
          '• Cobré 80000 sueldo',
          '• Foto del ticket',
          '',
          '<b>Juntadas</b>',
          '/juntada — crear juntada, cargar gastos y recibir PDF',
          '/listo — cerrar cuenta de la juntada',
          '/cancelar — abortar juntada en curso',
          '',
          '/ultimo — último movimiento personal',
          '/desvincular — desconectar Telegram',
          '/ayuda — este mensaje',
        ].join('\n'),
      )
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const { data: link } = await supabase
      .from('telegram_links')
      .select('id, user_id, pending_draft, pending_flow')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (!link) {
      await sendMessage(
        botToken,
        chatId,
        'Primero vinculá tu cuenta. En Finora → Perfil tocá “Vincular Telegram” y mandá el /start con el código.',
      )
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    if (/^\/desvincular/i.test(text)) {
      await supabase.from('telegram_links').delete().eq('id', link.id)
      await sendMessage(botToken, chatId, 'Listo, desvinculé Telegram de Finora.')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    if (/^\/ultimo/i.test(text)) {
      const { data: last } = await supabase
        .from('transactions')
        .select('type, description, amount, date')
        .eq('user_id', link.user_id)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      await sendMessage(
        botToken,
        chatId,
        last
          ? `Último: <b>${last.type === 'income' ? 'Ingreso' : 'Gasto'}</b> ${formatMoney(Number(last.amount))} · ${last.description} (${last.date})`
          : 'Todavía no hay movimientos.',
      )
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    // --- Juntadas wizard ---
    if (/^\/juntada(@\w+)?(\s|$)/i.test(text)) {
      const inlineName = text.replace(/^\/juntada(@\w+)?\s*/i, '').trim()
      const flow: JuntadaFlow = inlineName
        ? { kind: 'juntada', step: 'members', name: inlineName }
        : { kind: 'juntada', step: 'name' }
      await setFlow(supabase, link.id, flow)
      await supabase.from('telegram_links').update({ pending_draft: null }).eq('id', link.id)
      if (inlineName) {
        await sendMessage(
          botToken,
          chatId,
          `Juntada <b>${inlineName}</b>.\n¿Quiénes participan? Separá por coma.\nEj: Pablo, Juan, Sofi`,
        )
      } else {
        await sendMessage(botToken, chatId, '¿Nombre de la juntada? Ej: Asado del sábado')
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const activeFlow = link.pending_flow as JuntadaFlow | null
    if (activeFlow?.kind === 'juntada') {
      await handleJuntadaFlow(supabase, botToken, chatId, link, activeFlow, text)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    if (/^\/listo|^\/cancelar/i.test(text)) {
      await sendMessage(
        botToken,
        chatId,
        'No hay una juntada en curso. Empezá con /juntada',
      )
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const ctx = await loadUserContext(supabase, link.user_id)
    let parsed: { reply: string; draft: Draft | null }

    const photos = message.photo as Array<{ file_id: string }> | undefined
    let photoUploadError: string | null = null
    if (photos?.length && geminiKey) {
      try {
        const best = photos[photos.length - 1]
        const { base64, mime, bytes } = await downloadTelegramPhoto(botToken, best.file_id)
        let receiptUrl: string | null = null
        try {
          receiptUrl = await uploadReceipt(supabase, link.user_id, bytes, mime)
        } catch (uploadError) {
          photoUploadError = (uploadError as Error).message || 'error al subir'
          console.error('upload receipt', uploadError)
        }
        parsed = await geminiParseImage(
          base64,
          mime,
          text,
          ctx.categories,
          ctx.paymentMethods,
          geminiKey,
          geminiModel,
        )
        if (parsed.draft && receiptUrl) parsed.draft.receipt_url = receiptUrl
      } catch (error) {
        parsed = {
          reply: `No pude leer la foto (${(error as Error).message}). Escribí el gasto, ej: Gasté 4500 en super.`,
          draft: null,
        }
      }
    } else if (photos?.length && !geminiKey) {
      parsed = {
        reply: 'Para leer fotos configurá GEMINI_API_KEY en la Edge Function. Mientras, escribí el gasto.',
        draft: null,
      }
    } else if (link.pending_draft) {
      const pending = link.pending_draft as Draft
      const merged = mergePending(pending, text, ctx.categories, ctx.paymentMethods)
      parsed = merged || localParse(text, ctx.categories, ctx.paymentMethods)
      if (geminiKey && !merged?.draft?.amount) {
        try {
          parsed = await geminiParse(text, ctx.categories, ctx.paymentMethods, geminiKey, geminiModel)
        } catch {
          /* keep local */
        }
      }
      if (parsed.draft && !parsed.draft.receipt_url && pending.receipt_url) {
        parsed.draft.receipt_url = pending.receipt_url
      }
    } else if (geminiKey && text) {
      try {
        parsed = await geminiParse(text, ctx.categories, ctx.paymentMethods, geminiKey, geminiModel)
      } catch {
        parsed = localParse(text, ctx.categories, ctx.paymentMethods)
      }
    } else {
      parsed = localParse(text || 'hola', ctx.categories, ctx.paymentMethods)
    }

    if (!parsed.draft || parsed.draft.incomplete || !parsed.draft.amount) {
      await supabase
        .from('telegram_links')
        .update({ pending_draft: parsed.draft })
        .eq('id', link.id)
      await sendMessage(botToken, chatId, parsed.reply)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const saved = await saveTransaction(
      supabase,
      link.user_id,
      parsed.draft,
      ctx.creditCardId,
      ctx.paymentMethods,
    )
    await supabase.from('telegram_links').update({ pending_draft: null }).eq('id', link.id)

    const label = saved.type === 'income' ? 'Ingreso' : 'Gasto'
    const hasPhoto = Boolean(parsed.draft?.receipt_url)
    const photoLine = photos?.length
      ? hasPhoto
        ? '\n🖼 Foto guardada · tocá la miniatura en Movimientos'
        : `\n⚠️ El gasto se guardó pero la foto no (¿corriste storage.sql?). ${photoUploadError || ''}`
      : ''
    await sendMessage(
      botToken,
      chatId,
      `✅ <b>${label} guardado</b>\n${formatMoney(Number(saved.amount))} · ${saved.description}${photoLine}\n\nMandá otro cuando quieras.`,
    )

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: String((error as Error).message || error) }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }
})
