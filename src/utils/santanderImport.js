import * as XLSX from 'xlsx'

function cleanText(value) {
  return String(value || '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseSantanderDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const text = String(value).trim()
  // DD/MM/YYYY
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Excel serial date
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }

  return null
}

function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  // Santander exporta con punto decimal: -14000.00
  const normalized = String(value)
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(',', '.')

  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function findHeaderRow(rows) {
  return rows.findIndex(
    (row) =>
      Array.isArray(row) &&
      cleanText(row[1]).toLowerCase() === 'fecha' &&
      cleanText(row[3]).toLowerCase().includes('descrip'),
  )
}

/**
 * El extracto viene de más nuevo (arriba) a más viejo (abajo).
 * Si faltan Saldos arriba, se reconstruyen desde el último Saldo conocido:
 * saldo[i] = saldo[i+1] + importe[i]
 */
export function fillRunningBalances(rows) {
  const balances = rows.map((row) =>
    row.reportedBalance != null ? roundMoney(row.reportedBalance) : null,
  )

  // Hacia arriba: desde un saldo conocido hacia movimientos más nuevos
  for (let i = balances.length - 2; i >= 0; i -= 1) {
    if (balances[i] == null && balances[i + 1] != null) {
      balances[i] = roundMoney(balances[i + 1] + rows[i].signedAmount)
    }
  }

  // Hacia abajo: por si hay huecos entre saldos conocidos
  for (let i = 0; i < balances.length - 1; i += 1) {
    if (balances[i + 1] == null && balances[i] != null) {
      balances[i + 1] = roundMoney(balances[i] - rows[i + 1].signedAmount)
    }
  }

  return rows.map((row, i) => ({
    ...row,
    balance: balances[i],
    balanceEstimated:
      balances[i] != null &&
      (row.reportedBalance == null || roundMoney(row.reportedBalance) !== balances[i]),
  }))
}

/**
 * Parsea el Excel de "Últimos movimientos" de Santander Select.
 * @returns {{ movements: Array, meta: object }}
 */
export function parseSantanderMovimientos(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })

  const headerIndex = findHeaderRow(rows)
  if (headerIndex < 0) {
    throw new Error(
      'No se reconoció el formato de Santander. Buscá un Excel con columnas Fecha / Descripción / Caja de Ahorro.',
    )
  }

  const account =
    cleanText(rows.find((r) => cleanText(r?.[1]).toLowerCase() === 'cuenta')?.[2]) || null
  const currency =
    cleanText(rows.find((r) => cleanText(r?.[1]).toLowerCase() === 'moneda')?.[2]) || 'Pesos'
  const period =
    cleanText(rows.find((r) => cleanText(r?.[1]).toLowerCase() === 'fecha')?.[2]) || null

  const rawMovements = []

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row) continue

    const dateRaw = row[1]
    const branch = cleanText(row[2])
    const description = cleanText(row[3])
    const reference = cleanText(row[4])
    const savingsAmount = parseAmount(row[5])
    const checkingAmount = parseAmount(row[6])
    const reportedBalance = parseAmount(row[7])
    const signedAmount = savingsAmount ?? checkingAmount

    if (!description || signedAmount === null || signedAmount === 0) continue

    const date = parseSantanderDate(dateRaw)
    if (!date) continue

    rawMovements.push({
      date,
      description,
      signedAmount,
      reportedBalance,
      reference: reference || null,
      branch: branch || null,
    })
  }

  if (rawMovements.length === 0) {
    throw new Error('No se encontraron movimientos válidos en el archivo.')
  }

  const withBalances = fillRunningBalances(rawMovements)
  const bankBalance = withBalances[0]?.balance ?? null
  const estimatedCount = withBalances.filter((m) => m.balanceEstimated).length

  const movements = withBalances.map((m) => {
    const type = m.signedAmount < 0 ? 'expense' : 'income'
    const absAmount = Math.abs(m.signedAmount)

    return {
      date: m.date,
      description: m.description,
      amount: absAmount,
      signedAmount: m.signedAmount,
      type,
      balance: m.balance,
      balanceEstimated: Boolean(m.balanceEstimated),
      reference: m.reference,
      branch: m.branch,
      notes: [
        m.reference ? `Ref: ${m.reference}` : null,
        m.branch ? `Sucursal: ${m.branch}` : null,
        'Importado desde Santander',
      ]
        .filter(Boolean)
        .join(' · '),
      importKey: `${m.date}|${m.reference || ''}|${m.signedAmount}|${m.description}`,
    }
  })

  return {
    movements,
    meta: {
      sheetName,
      account,
      currency,
      period,
      count: movements.length,
      bankBalance,
      estimatedBalances: estimatedCount,
    },
  }
}
