import { getSupabaseErrorMessage, supabase } from '../lib/supabase'

const SELECT = '*'

export async function listCategories(userId, { type } = {}) {
  let query = supabase
    .from('categories')
    .select(SELECT)
    .is('deleted_at', null)
    .or(`user_id.eq.${userId},is_system.eq.true`)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function listUserCategories(userId, { type } = {}) {
  let query = supabase
    .from('categories')
    .select(SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}

export async function createCategory(payload) {
  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

/** Asegura categorías faltantes (ej. Nafta) y devuelve todas las del usuario. */
export async function ensureDefaultExpenseCategories(userId) {
  const expenseCats = await listUserCategories(userId, { type: 'expense' })
  const names = new Set(expenseCats.map((c) => c.name.toLowerCase()))
  const missing = [
    { name: 'Nafta', color: '#c2410c', icon: 'Fuel' },
  ].filter((c) => !names.has(c.name.toLowerCase()))

  for (const cat of missing) {
    await createCategory({
      user_id: userId,
      name: cat.name,
      type: 'expense',
      color: cat.color,
      icon: cat.icon,
      is_system: false,
      is_active: true,
    })
  }

  return listUserCategories(userId)
}

export async function updateCategory(id, updates) {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function softDeleteCategory(id) {
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .is('deleted_at', null)

  if (countError) throw new Error(getSupabaseErrorMessage(countError))
  if (count > 0) {
    throw new Error(
      'No se puede eliminar: hay movimientos asociados. Reasignalos primero.',
    )
  }

  const { data, error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data
}

export async function listSystemCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select(SELECT)
    .eq('is_system', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(getSupabaseErrorMessage(error))
  return data || []
}
