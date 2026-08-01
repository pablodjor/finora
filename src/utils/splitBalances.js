function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

/** Reparte un monto en partes iguales, ajustando centavos en el último. */
export function equalShares(amount, memberIds) {
  const ids = [...memberIds]
  if (!ids.length) return []
  const total = roundMoney(amount)
  const base = roundMoney(total / ids.length)
  const shares = ids.map((memberId, index) => ({
    member_id: memberId,
    share_amount: index === ids.length - 1 ? 0 : base,
  }))
  const assigned = roundMoney(base * (ids.length - 1))
  shares[shares.length - 1].share_amount = roundMoney(total - assigned)
  return shares
}

/**
 * Calcula cuánto pagó / debe cada uno y transferencias mínimas.
 * expenses: [{ paid_by_member_id, amount, shares: [{ member_id, share_amount }] }]
 * members: [{ id, name, is_me }]
 */
export function computeSplitSummary(members, expenses) {
  const map = new Map(
    members.map((m) => [
      m.id,
      {
        memberId: m.id,
        name: m.name,
        isMe: Boolean(m.is_me),
        paid: 0,
        owed: 0,
        net: 0,
      },
    ]),
  )

  for (const expense of expenses) {
    const paidBy = map.get(expense.paid_by_member_id)
    if (paidBy) paidBy.paid = roundMoney(paidBy.paid + Number(expense.amount || 0))

    for (const share of expense.shares || []) {
      const row = map.get(share.member_id)
      if (row) row.owed = roundMoney(row.owed + Number(share.share_amount || 0))
    }
  }

  const balances = [...map.values()].map((row) => ({
    ...row,
    net: roundMoney(row.paid - row.owed),
  }))

  const debtors = balances
    .filter((b) => b.net < -0.009)
    .map((b) => ({ ...b, remaining: roundMoney(-b.net) }))
    .sort((a, b) => b.remaining - a.remaining)

  const creditors = balances
    .filter((b) => b.net > 0.009)
    .map((b) => ({ ...b, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining)

  const transfers = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = roundMoney(Math.min(debtors[i].remaining, creditors[j].remaining))
    if (amount > 0) {
      transfers.push({
        fromMemberId: debtors[i].memberId,
        fromName: debtors[i].name,
        toMemberId: creditors[j].memberId,
        toName: creditors[j].name,
        amount,
      })
    }
    debtors[i].remaining = roundMoney(debtors[i].remaining - amount)
    creditors[j].remaining = roundMoney(creditors[j].remaining - amount)
    if (debtors[i].remaining <= 0.009) i += 1
    if (creditors[j].remaining <= 0.009) j += 1
  }

  const totalSpent = roundMoney(
    expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0),
  )

  return { balances, transfers, totalSpent }
}
