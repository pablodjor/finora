import { getSupabaseErrorMessage, supabase } from '../lib/supabase'
import { differenceInCalendarMonths, parseISO, isValid } from 'date-fns'

const GOAL_SELECT = `
  *,
  contributions:savings_contributions(*)
`

export async function listGoals(userId) {
  const { data, error } = await supabase
    .from('savings_goals')
    .select(GOAL_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function createGoal(payload) {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function updateGoal(id, updates) {
  const { data, error } = await supabase
    .from('savings_goals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function softDeleteGoal(id) {
  const { data, error } = await supabase
    .from('savings_goals')
    .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function addContribution({ userId, goalId, amount, date, notes }) {
  const { data: contribution, error } = await supabase
    .from('savings_contributions')
    .insert({
      user_id: userId,
      goal_id: goalId,
      amount,
      date,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))

  const { data: goal } = await supabase
    .from('savings_goals')
    .select('saved_amount, target_amount')
    .eq('id', goalId)
    .single()

  if (goal) {
    const saved = Number(goal.saved_amount || 0) + Number(amount)
    const status = saved >= Number(goal.target_amount) ? 'completed' : 'active'
    await supabase
      .from('savings_goals')
      .update({ saved_amount: saved, status })
      .eq('id', goalId)
  }

  return contribution
}

export function calcMonthlyNeeded(goal) {
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.saved_amount || 0))
  if (!goal.deadline) return goal.suggested_monthly || remaining
  const deadline = parseISO(goal.deadline)
  if (!isValid(deadline)) return remaining
  const months = Math.max(1, differenceInCalendarMonths(deadline, new Date()))
  return Math.ceil(remaining / months)
}

export function calcProgress(goal) {
  const target = Number(goal.target_amount) || 1
  const saved = Number(goal.saved_amount) || 0
  return Math.min(100, Math.round((saved / target) * 100))
}
