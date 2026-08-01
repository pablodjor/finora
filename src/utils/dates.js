import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  getYear,
  getMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
export const TIMEZONE = 'America/Argentina/Buenos_Aires'

export function nowInArgentina() {
  // Preferimos la fecha local del navegador; el perfil guarda America/Argentina/Buenos_Aires.
  return new Date()
}

export function formatDate(date, pattern = 'dd/MM/yyyy') {
  if (!date) return '—'
  const value = typeof date === 'string' ? parseISO(date) : date
  return format(value, pattern, { locale: es })
}

export function formatMonthLabel(date) {
  const value = typeof date === 'string' ? parseISO(date) : date
  return format(value, 'MMMM yyyy', { locale: es })
}

export function toISODate(date) {
  const value = typeof date === 'string' ? parseISO(date) : date
  return format(value, 'yyyy-MM-dd')
}

export function getMonthRange(year, month) {
  const base = new Date(year, month - 1, 1)
  return {
    from: toISODate(startOfMonth(base)),
    to: toISODate(endOfMonth(base)),
  }
}

export function getPreviousMonth(year, month) {
  const base = subMonths(new Date(year, month - 1, 1), 1)
  return {
    year: getYear(base),
    month: getMonth(base) + 1,
  }
}

export function currentYearMonth() {
  const now = nowInArgentina()
  return {
    year: getYear(now),
    month: getMonth(now) + 1,
  }
}
