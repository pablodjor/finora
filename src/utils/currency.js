const CURRENCY_LOCALES = {
  ARS: { locale: 'es-AR', currency: 'ARS' },
  USD: { locale: 'en-US', currency: 'USD' },
  EUR: { locale: 'es-ES', currency: 'EUR' },
}

export function formatCurrency(amount, currencyCode = 'ARS') {
  const value = Number(amount) || 0
  const config = CURRENCY_LOCALES[currencyCode] || CURRENCY_LOCALES.ARS

  if (currencyCode === 'ARS') {
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
    return `$ ${formatted}`
  }

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function parseCurrencyInput(value) {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}
