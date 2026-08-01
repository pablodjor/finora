const key = (userId) => `finora-bank-balance-${userId}`

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

export function saveBankBalance(userId, payload) {
  if (!userId || payload?.amount == null || Number.isNaN(Number(payload.amount))) return
  localStorage.setItem(
    key(userId),
    JSON.stringify({
      amount: Number(payload.amount),
      account: payload.account || 'Cuenta sueldo',
      period: payload.period || null,
      source: payload.source || 'manual',
      updatedAt: new Date().toISOString(),
    }),
  )
}

export function getBankBalance(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data?.amount == null || Number.isNaN(Number(data.amount))) return null
    return data
  } catch {
    return null
  }
}

export function clearBankBalance(userId) {
  if (!userId) return
  localStorage.removeItem(key(userId))
}

/** Suma/resta del saldo banco si ya hay uno cargado. */
export function adjustBankBalance(userId, delta, source = 'transaction') {
  if (!userId || !delta) return null
  const current = getBankBalance(userId)
  if (!current) return null
  const nextAmount = roundMoney(Number(current.amount) + Number(delta))
  saveBankBalance(userId, {
    ...current,
    amount: nextAmount,
    source,
  })
  return nextAmount
}

/** Acepta 685634.13 o formato AR 685.634,13 */
export function parseArAmount(value) {
  if (typeof value === 'number') return value
  if (!value) return NaN
  let text = String(value).replace(/\$/g, '').replace(/\s/g, '')
  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/\./g, '').replace(',', '.')
  } else if (text.includes(',')) {
    text = text.replace(',', '.')
  }
  return Number(text)
}
