/**
 * Sugiere categoría / importe / descripción a partir del texto de un ticket.
 * Keywords en español orientadas a comercios y servicios de Argentina.
 */

const RULES = [
  {
    categoryHints: ['supermercado', 'comida'],
    keywords: [
      'supermercado',
      'carrefour',
      'coto',
      'jumbo',
      'disco',
      'vea',
      'changomas',
      'walmart',
      'almacen',
      'verduler',
      'carnicer',
      'panader',
      'mcdonald',
      'burger',
      'starbucks',
      'cafe',
      'restaurant',
      'resto',
      'pedidosya',
      'rappi',
      'mostaza',
      'grido',
      'helader',
      'comida',
    ],
  },
  {
    categoryHints: ['salidas'],
    keywords: ['cinema', 'cine', 'teatro', 'bar ', 'boliche', 'entrada', 'show'],
  },
  {
    categoryHints: ['nafta'],
    keywords: [
      'nafta',
      'combustible',
      'gasoil',
      'diesel',
      'ypf',
      'shell',
      'axion',
      'puma energy',
      'estacion de servicio',
      'surtidor',
      'litros',
      'infinia',
      'v-power',
      'gnc',
    ],
  },
  {
    categoryHints: ['transporte', 'cochera'],
    keywords: [
      'uber',
      'cabify',
      'didi',
      'sube',
      'peaje',
      'estacionamiento',
      'cochera',
      'remis',
      'taxi',
      'colectivo',
      'tren',
      'subte',
    ],
  },
  {
    categoryHints: ['streaming', 'suscripciones'],
    keywords: [
      'netflix',
      'spotify',
      'disney',
      'youtube',
      'prime video',
      'hbo',
      'paramount',
      'apple music',
      'flow',
    ],
  },
  {
    categoryHints: ['chatgpt', 'suscripciones'],
    keywords: ['openai', 'chatgpt', 'claude', 'cursor'],
  },
  {
    categoryHints: ['luz'],
    keywords: ['edenor', 'edesur', 'edelap', 'electricidad', 'energia'],
  },
  {
    categoryHints: ['gas'],
    keywords: ['metrogas', 'naturgy', 'camuzzi', 'gas natural'],
  },
  {
    categoryHints: ['agua'],
    keywords: ['aysa', 'agua y saneamientos', 'aguas'],
  },
  {
    categoryHints: ['internet', 'teléfono', 'telefono'],
    keywords: [
      'telecom',
      'fibertel',
      'personal',
      'claro',
      'movistar',
      'telefonica',
      'internet',
      'wifi',
      'celular',
    ],
  },
  {
    categoryHints: ['salud'],
    keywords: [
      'farmacia',
      'farmacity',
      'osde',
      'swiss medical',
      'galeno',
      'medicus',
      'hospital',
      'clinica',
      'laboratorio',
    ],
  },
  {
    categoryHints: ['mascotas'],
    keywords: ['veterinar', 'petshop', 'pet shop', 'puppis', 'mascota'],
  },
  {
    categoryHints: ['mercado pago'],
    keywords: ['mercado pago', 'mercadopago'],
  },
  {
    categoryHints: ['impuestos', 'abl'],
    keywords: ['afip', 'arca', 'abl', 'rentas', 'iibb', 'monotributo', 'impuesto'],
  },
  {
    categoryHints: ['expensas'],
    keywords: ['expensas', 'consorcio', 'administracion'],
  },
  {
    categoryHints: ['seguro'],
    keywords: ['seguro', 'la caja', 'sancor', 'federacion patronal', 'zurich'],
  },
  {
    categoryHints: ['tarjeta'],
    keywords: ['visa', 'mastercard', 'american express', 'amex', 'resumen de cuenta'],
  },
  {
    categoryHints: ['otros'],
    keywords: [
      'santander',
      'transferencia',
      'cbu',
      'alias',
      'banco',
      'caja de ahorro',
      'cuenta sueldo',
      'debito automatico',
    ],
  },
]

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function matchCategory(text, categories) {
  const hay = normalize(text)
  let best = null
  let bestScore = 0

  for (const rule of RULES) {
    let score = 0
    for (const kw of rule.keywords) {
      const needle = normalize(kw)
      if (hay.includes(needle)) score += needle.length > 4 ? 3 : 2
    }
    if (score === 0) continue

    const category = categories.find((c) => {
      const name = normalize(c.name)
      return rule.categoryHints.some((hint) => name.includes(normalize(hint)))
    })
    if (category && score > bestScore) {
      best = category
      bestScore = score
    }
  }

  if (!best) {
    for (const c of categories) {
      const name = normalize(c.name)
      if (name.length >= 4 && hay.includes(name)) {
        best = c
        break
      }
    }
  }

  return best
}

function extractAmount(text) {
  const lines = String(text).split(/\r?\n/)
  const patterns = [
    /total\s*:?\s*\$?\s*([\d.]+,\d{2})/i,
    /importe\s*:?\s*\$?\s*([\d.]+,\d{2})/i,
    /monto\s*:?\s*\$?\s*([\d.]+,\d{2})/i,
    /\$\s*([\d.]+,\d{2})/,
    /([\d.]+,\d{2})\s*$/m,
  ]

  for (const line of lines) {
    for (const re of patterns) {
      const match = line.match(re)
      if (!match) continue
      const raw = match[1]
      const amount = Number(raw.replace(/\./g, '').replace(',', '.'))
      if (Number.isFinite(amount) && amount > 0 && amount < 100_000_000) return amount
    }
  }

  const en = text.match(/(?:total|importe|monto)\s*:?\s*\$?\s*([\d,]+\.\d{2})/i)
  if (en) {
    const amount = Number(en[1].replace(/,/g, ''))
    if (Number.isFinite(amount) && amount > 0) return amount
  }

  return null
}

function extractDescription(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 60)
    .filter((l) => !/^\d+$/.test(l))
    .filter((l) => !/total|cuit|iva|fecha|hora|ticket|factura/i.test(l))

  return lines[0] || null
}

export function suggestFromText(ocrText, categories = []) {
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const category = matchCategory(ocrText, expenseCategories)
  const amount = extractAmount(ocrText)
  const description = extractDescription(ocrText)

  return {
    categoryId: category?.id || null,
    categoryName: category?.name || null,
    amount,
    description,
    rawText: ocrText,
  }
}

/** @deprecated usar analyzeReceiptImage de services/receiptAi */
export async function suggestFromReceiptImage(file, categories = []) {
  const { analyzeReceiptImage } = await import('../services/receiptAi')
  return analyzeReceiptImage(file, categories)
}
