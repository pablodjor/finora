import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { formatMoney } from './juntadas.ts'

type Summary = {
  juntada: { name: string; notes?: string | null; members?: Array<{ name: string }> }
  expenses: Array<{
    description: string
    amount: number
    expense_date?: string
    paid_by?: { name?: string }
  }>
  balances: Array<{ name: string; paid: number; owed: number; net: number }>
  transfers: Array<{ fromName: string; toName: string; amount: number }>
  totalSpent: number
}

function safeFilename(name: string) {
  return String(name || 'juntada')
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ]+/gi, '-')
    .slice(0, 40)
}

export async function buildJuntadaPdfBytes(summary: Summary): Promise<{ bytes: Uint8Array; filename: string }> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595
  const pageHeight = 842
  let page = doc.addPage([pageWidth, pageHeight])
  const margin = 48
  let y = pageHeight - 50
  const green = rgb(0.02, 0.59, 0.41)
  const dark = rgb(0.06, 0.09, 0.16)
  const muted = rgb(0.4, 0.45, 0.55)

  const ensureSpace = (need: number) => {
    if (y < need) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - 50
    }
  }

  const draw = (text: string, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const size = opts.size || 11
    const f = opts.bold ? fontBold : font
    page.drawText(String(text || ''), {
      x: opts.x ?? margin,
      y,
      size,
      font: f,
      color: opts.color || dark,
      maxWidth: pageWidth - margin * 2,
    })
    y -= size + 6
  }

  // Header bar
  page.drawRectangle({
    x: 0,
    y: pageHeight - 56,
    width: pageWidth,
    height: 56,
    color: green,
  })
  page.drawText('Finora', {
    x: margin,
    y: pageHeight - 28,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  })
  page.drawText('Comprobante de juntada', {
    x: margin,
    y: pageHeight - 44,
    size: 10,
    font,
    color: rgb(0.9, 0.98, 0.95),
  })
  y = pageHeight - 80

  draw(summary.juntada.name || 'Juntada', { bold: true, size: 16 })
  draw(
    `${(summary.juntada.members || []).length} personas · ${summary.expenses.length} gastos · Total ${formatMoney(summary.totalSpent)}`,
    { size: 10, color: muted },
  )
  y -= 6

  draw('Quién le paga a quién', { bold: true, size: 12, color: green })
  if (summary.transfers.length) {
    for (const t of summary.transfers) {
      ensureSpace(40)
      draw(`${t.fromName} → ${t.toName}: ${formatMoney(t.amount)}`, { size: 11 })
    }
  } else {
    draw(summary.expenses.length ? 'Están a mano' : 'Sin gastos', { size: 11, color: muted })
  }
  y -= 4

  draw('Detalle de gastos', { bold: true, size: 12, color: green })
  for (const e of summary.expenses) {
    ensureSpace(40)
    draw(`${e.description} — ${formatMoney(Number(e.amount))}`, { size: 11 })
    draw(`  pagó ${e.paid_by?.name || '—'}`, { size: 9, color: muted })
  }
  y -= 4

  ensureSpace(80)
  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: pageWidth - margin * 2,
    height: 28,
    color: green,
  })
  page.drawText('TOTAL', {
    x: margin + 10,
    y: y + 2,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  })
  const totalLabel = formatMoney(summary.totalSpent)
  const totalWidth = fontBold.widthOfTextAtSize(totalLabel, 12)
  page.drawText(totalLabel, {
    x: pageWidth - margin - 10 - totalWidth,
    y: y + 2,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  })
  y -= 40

  draw('Balance por persona', { bold: true, size: 12, color: green })
  for (const b of summary.balances) {
    ensureSpace(40)
    const netLabel =
      b.net > 0.009
        ? `le deben ${formatMoney(b.net)}`
        : b.net < -0.009
          ? `debe ${formatMoney(Math.abs(b.net))}`
          : 'a mano'
    draw(`${b.name}: ${netLabel}`, { bold: true, size: 11 })
    draw(`  pagó ${formatMoney(b.paid)} · le toca ${formatMoney(b.owed)}`, { size: 9, color: muted })
  }

  ensureSpace(30)
  y -= 8
  draw('Hecho con Finora', { size: 9, color: muted })

  const bytes = await doc.save()
  return {
    bytes,
    filename: `comprobante-finora-${safeFilename(summary.juntada.name)}.pdf`,
  }
}
