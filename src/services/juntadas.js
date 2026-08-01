import { getSupabaseErrorMessage, supabase } from '../lib/supabase'
import { computeSplitSummary, equalShares } from '../utils/splitBalances'

export async function listJuntadas(userId) {
  const { data, error } = await supabase
    .from('juntadas')
    .select('*, members:juntada_members(id, name, is_me)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function getJuntada(id) {
  const { data, error } = await supabase
    .from('juntadas')
    .select('*, members:juntada_members(id, name, is_me, created_at)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function createJuntada(userId, { name, notes, currency = 'ARS', members = [] }) {
  const names = [
    ...new Set(
      members
        .map((m) => String(m).trim())
        .filter(Boolean),
    ),
  ]
  if (!names.length) {
    throw new Error('Agregá al menos una persona (incluite si también participás)')
  }

  const { data: juntada, error } = await supabase
    .from('juntadas')
    .insert({
      user_id: userId,
      name,
      notes: notes || null,
      currency,
      status: 'open',
    })
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))

  const memberRows = names.map((memberName) => ({
    juntada_id: juntada.id,
    user_id: userId,
    name: memberName,
    is_me: false,
  }))

  const { error: membersError } = await supabase.from('juntada_members').insert(memberRows)
  if (membersError) throw new Error(getSupabaseErrorMessage(membersError))

  return getJuntada(juntada.id)
}

export async function addMember(userId, juntadaId, name) {
  const { data, error } = await supabase
    .from('juntada_members')
    .insert({
      juntada_id: juntadaId,
      user_id: userId,
      name: String(name).trim(),
      is_me: false,
    })
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

/** Elimina una persona de la juntada si no tiene gastos asociados. */
export async function removeMember(memberId) {
  const { data: paidExpenses, error: paidError } = await supabase
    .from('juntada_expenses')
    .select('id')
    .eq('paid_by_member_id', memberId)
    .is('deleted_at', null)
    .limit(1)

  if (paidError) throw new Error(getSupabaseErrorMessage(paidError))
  if (paidExpenses?.length) {
    throw new Error('No se puede sacar: tiene gastos a su nombre. Borrá esos gastos primero.')
  }

  const { data: shares, error: sharesError } = await supabase
    .from('juntada_expense_shares')
    .select('id, expense_id')
    .eq('member_id', memberId)
    .limit(1)

  if (sharesError) throw new Error(getSupabaseErrorMessage(sharesError))
  if (shares?.length) {
    throw new Error(
      'No se puede sacar: participa en algún gasto. Borrá esos gastos o creá la juntada de nuevo.',
    )
  }

  const { error } = await supabase.from('juntada_members').delete().eq('id', memberId)
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return true
}

export async function softDeleteJuntada(id) {
  const { data, error } = await supabase
    .from('juntadas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function listJuntadaExpenses(juntadaId) {
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
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function createJuntadaExpense(userId, payload) {
  const {
    juntada_id,
    description,
    amount,
    paid_by_member_id,
    expense_date,
    participant_member_ids,
  } = payload

  const participants = [...new Set(participant_member_ids || [])]
  if (!participants.length) throw new Error('Seleccioná al menos una persona que participa')

  const { data: expense, error } = await supabase
    .from('juntada_expenses')
    .insert({
      juntada_id,
      user_id: userId,
      description,
      amount: Number(amount),
      paid_by_member_id,
      expense_date,
    })
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))

  const shares = equalShares(amount, participants).map((s) => ({
    expense_id: expense.id,
    member_id: s.member_id,
    share_amount: s.share_amount,
  }))

  const { error: sharesError } = await supabase.from('juntada_expense_shares').insert(shares)
  if (sharesError) throw new Error(getSupabaseErrorMessage(sharesError))

  return expense
}

export async function softDeleteJuntadaExpense(id) {
  const { data, error } = await supabase
    .from('juntada_expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

/** Crea varios gastos de una misma persona (ej. Emma: hielo 3000, papa 2000). */
export async function createManyJuntadaExpenses(userId, items = []) {
  const created = []
  for (const item of items) {
    created.push(await createJuntadaExpense(userId, item))
  }
  return created
}

export async function getJuntadaSummary(juntadaId) {
  const [juntada, expenses] = await Promise.all([
    getJuntada(juntadaId),
    listJuntadaExpenses(juntadaId),
  ])
  if (!juntada) return null

  const members = (juntada.members || []).sort((a, b) => a.name.localeCompare(b.name))
  const summary = computeSplitSummary(members, expenses)
  return { juntada: { ...juntada, members }, expenses, ...summary }
}
