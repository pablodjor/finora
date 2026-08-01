import { computeSplitSummary, equalShares } from './splitBalances.ts'

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function normalize(text: string) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export async function createJuntadaWithMembers(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  memberNames: string[],
) {
  const names = [...new Set(memberNames.map((m) => String(m).trim()).filter(Boolean))]
  if (!names.length) throw new Error('Agregá al menos una persona')

  const { data: juntada, error } = await supabase
    .from('juntadas')
    .insert({
      user_id: userId,
      name: name.trim(),
      notes: 'Creada desde Telegram',
      currency: 'ARS',
      status: 'open',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { error: membersError } = await supabase.from('juntada_members').insert(
    names.map((memberName) => ({
      juntada_id: juntada.id,
      user_id: userId,
      name: memberName,
      is_me: false,
    })),
  )
  if (membersError) throw new Error(membersError.message)

  return getJuntada(supabase, juntada.id)
}

export async function getJuntada(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('juntadas')
    .select('*, members:juntada_members(id, name, is_me, created_at)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listJuntadaExpenses(supabase: SupabaseClient, juntadaId: string) {
  const { data, error } = await supabase
    .from('juntada_expenses')
    .select(
      `
      *,
      paid_by:juntada_members!paid_by_member_id(id, name, is_me),
      shares:juntada_expense_shares(id, member_id, share_amount)
    `,
    )
    .eq('juntada_id', juntadaId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createJuntadaExpenseEqual(
  supabase: SupabaseClient,
  userId: string,
  {
    juntada_id,
    description,
    amount,
    paid_by_member_id,
    participant_member_ids,
    expense_date,
  }: {
    juntada_id: string
    description: string
    amount: number
    paid_by_member_id: string
    participant_member_ids: string[]
    expense_date?: string
  },
) {
  const participants = [...new Set(participant_member_ids)]
  if (!participants.length) throw new Error('Faltan participantes')

  const { data: expense, error } = await supabase
    .from('juntada_expenses')
    .insert({
      juntada_id,
      user_id: userId,
      description,
      amount: Number(amount),
      paid_by_member_id,
      expense_date: expense_date || todayISO(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const shares = equalShares(amount, participants).map((s) => ({
    expense_id: expense.id,
    member_id: s.member_id,
    share_amount: s.share_amount,
  }))

  const { error: sharesError } = await supabase.from('juntada_expense_shares').insert(shares)
  if (sharesError) throw new Error(sharesError.message)
  return expense
}

export async function getJuntadaSummary(supabase: SupabaseClient, juntadaId: string) {
  const [juntada, expenses] = await Promise.all([
    getJuntada(supabase, juntadaId),
    listJuntadaExpenses(supabase, juntadaId),
  ])
  if (!juntada) return null
  const members = (juntada.members || []).sort((a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name),
  )
  const summary = computeSplitSummary(members, expenses)
  return { juntada: { ...juntada, members }, expenses, ...summary }
}

export function findMemberByName(
  members: Array<{ id: string; name: string }>,
  rawName: string,
) {
  const needle = normalize(rawName)
  if (!needle) return { match: null as null | { id: string; name: string }, ambiguous: [] as Array<{ id: string; name: string }> }

  const exact = members.filter((m) => normalize(m.name) === needle)
  if (exact.length === 1) return { match: exact[0], ambiguous: [] }
  if (exact.length > 1) return { match: null, ambiguous: exact }

  const partial = members.filter((m) => {
    const n = normalize(m.name)
    return n.includes(needle) || needle.includes(n)
  })
  if (partial.length === 1) return { match: partial[0], ambiguous: [] }
  if (partial.length > 1) return { match: null, ambiguous: partial }
  return { match: null, ambiguous: [] }
}

/** Parse lines like "Juan: carne 15000" or "Juan - carne $15.000" */
export function parseExpenseLines(text: string) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const items: Array<{ payerName: string; description: string; amount: number }> = []
  const errors: string[] = []

  for (const line of lines) {
    if (line.startsWith('/')) continue
    const m =
      line.match(/^(.+?)\s*[:\-–]\s*(.+?)\s+\$?\s*([\d.]+(?:,\d{2})?|\d+(?:[.,]\d{1,2})?)\s*$/i) ||
      line.match(/^(.+?)\s+(.+?)\s+\$?\s*([\d.]+(?:,\d{2})?|\d+(?:[.,]\d{1,2})?)\s*$/i)

    if (!m) {
      errors.push(`No entendí: ${line}`)
      continue
    }
    const payerName = m[1].trim()
    const description = m[2].trim()
    const raw = m[3]
    const amount = raw.includes(',')
      ? Number(raw.replace(/\./g, '').replace(',', '.'))
      : Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Importe inválido: ${line}`)
      continue
    }
    if (description.length < 1) {
      errors.push(`Falta concepto: ${line}`)
      continue
    }
    items.push({ payerName, description: description.slice(0, 120), amount })
  }

  return { items, errors }
}

export function formatMoney(amount: number) {
  return `$ ${Number(amount).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function buildJuntadaTelegramSummary(summary: {
  juntada: { name: string; members?: Array<{ name: string }> }
  expenses: Array<{ description: string; amount: number; paid_by?: { name?: string } }>
  balances: Array<{ name: string; paid: number; owed: number; net: number }>
  transfers: Array<{ fromName: string; toName: string; amount: number }>
  totalSpent: number
}) {
  const { juntada, expenses, balances, transfers, totalSpent } = summary
  const lines = [
    `🧾 <b>Juntada: ${escapeHtml(juntada.name)}</b>`,
    `Total: <b>${formatMoney(totalSpent)}</b> · ${(juntada.members || []).length} personas · ${expenses.length} gastos`,
    '',
    '<b>Quién le paga a quién</b>',
  ]

  if (transfers.length) {
    for (const t of transfers) {
      lines.push(`• ${escapeHtml(t.fromName)} → ${escapeHtml(t.toName)}: <b>${formatMoney(t.amount)}</b>`)
    }
  } else {
    lines.push(expenses.length ? '• Están a mano 👌' : '• Sin gastos')
  }

  lines.push('', '<b>Gastos</b>')
  for (const e of expenses) {
    lines.push(
      `• ${escapeHtml(e.description)} — ${formatMoney(Number(e.amount))} (pagó ${escapeHtml(e.paid_by?.name || '—')})`,
    )
  }

  lines.push('', '<b>Balance</b>')
  for (const b of balances) {
    const netLabel =
      b.net > 0.009
        ? `le deben ${formatMoney(b.net)}`
        : b.net < -0.009
          ? `debe ${formatMoney(Math.abs(b.net))}`
          : 'a mano'
    lines.push(`• <b>${escapeHtml(b.name)}</b> → ${netLabel}`)
  }

  lines.push('', '<i>Hecho con Finora</i>')
  return lines.join('\n')
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
