import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import logoUrl from '../assets/logoprincipal.png'
import { formatCurrency } from './currency'

const BRAND = {
  primary: [5, 150, 105], // #059669
  dark: [15, 23, 42],
  muted: [100, 116, 139],
  light: [236, 253, 245],
  line: [226, 232, 240],
}

let logoDataUrlPromise = null

export async function getLogoDataUrl() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(logoUrl)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          }),
      )
      .catch(() => null)
  }
  return logoDataUrlPromise
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadWorkbook(workbook, filename) {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  )
}

function drawPdfHeader(doc, { title, subtitle, logo }) {
  doc.setFillColor(...BRAND.primary)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, 'F')

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 14, 5, 18, 18)
    } catch {
      // ignore logo errors
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Finora', logo ? 36 : 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(title, logo ? 36 : 14, 20)

  if (subtitle) {
    doc.setTextColor(...BRAND.muted)
    doc.setFontSize(9)
    doc.text(subtitle, 14, 36)
  }
}

function drawPdfFooter(doc) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...BRAND.line)
    doc.line(14, h - 14, w - 14, h - 14)
    doc.setTextColor(...BRAND.muted)
    doc.setFontSize(8)
    doc.text(`Finora · Página ${i} de ${pageCount}`, 14, h - 8)
    doc.text(new Date().toLocaleString('es-AR'), w - 14, h - 8, { align: 'right' })
  }
}

export async function exportReportPdf({
  from,
  to,
  currency,
  income,
  expenses,
  balance,
  byCategory = [],
  transactions = [],
  profileName,
}) {
  const doc = new jsPDF()
  const logo = await getLogoDataUrl()
  drawPdfHeader(doc, {
    title: 'Reporte financiero',
    subtitle: `Período ${from} → ${to}${profileName ? ` · ${profileName}` : ''}`,
    logo,
  })

  doc.setTextColor(...BRAND.dark)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen', 14, 48)

  autoTable(doc, {
    startY: 52,
    head: [['Concepto', 'Monto']],
    body: [
      ['Ingresos', formatCurrency(income, currency)],
      ['Gastos', formatCurrency(expenses, currency)],
      ['Saldo', formatCurrency(balance, currency)],
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
  })

  let y = doc.lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.text('Gastos por categoría', 14, y)
  autoTable(doc, {
    startY: y + 4,
    head: [['Categoría', 'Total']],
    body: byCategory.slice(0, 12).map((c) => [c.name, formatCurrency(c.value, currency)]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
  })

  y = doc.lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.text('Movimientos', 14, y)
  autoTable(doc, {
    startY: y + 4,
    head: [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Método', 'Importe']],
    body: transactions.map((t) => [
      t.date,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      t.description || '',
      t.category?.name || '—',
      t.payment_method?.name || '—',
      formatCurrency(t.amount, currency),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 5: { halign: 'right' } },
  })

  drawPdfFooter(doc)
  doc.save(`finora-reporte-${from}_${to}.pdf`)
}

export function exportReportExcel({
  from,
  to,
  currency,
  income,
  expenses,
  balance,
  byCategory = [],
  transactions = [],
}) {
  const wb = XLSX.utils.book_new()

  const summary = [
    ['Finora — Reporte financiero'],
    [`Período`, `${from} a ${to}`],
    [],
    ['Concepto', 'Monto'],
    ['Ingresos', Number(income)],
    ['Gastos', Number(expenses)],
    ['Saldo', Number(balance)],
    ['Moneda', currency],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summary)
  wsSummary['!cols'] = [{ wch: 22 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

  const catRows = [
    ['Categoría', 'Total'],
    ...byCategory.map((c) => [c.name, Number(c.value)]),
  ]
  const wsCat = XLSX.utils.aoa_to_sheet(catRows)
  wsCat['!cols'] = [{ wch: 28 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsCat, 'Por categoría')

  const txRows = [
    ['Fecha', 'Tipo', 'Descripción', 'Importe', 'Categoría', 'Método', 'Estado'],
    ...transactions.map((t) => [
      t.date,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      t.description || '',
      Number(t.amount),
      t.category?.name || '',
      t.payment_method?.name || '',
      t.status,
    ]),
  ]
  const wsTx = XLSX.utils.aoa_to_sheet(txRows)
  wsTx['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 36 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsTx, 'Movimientos')

  downloadWorkbook(wb, `finora-reporte-${from}_${to}.xlsx`)
}

function safeJuntadaFilename(name) {
  return String(name || 'juntada')
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ]+/gi, '-')
    .slice(0, 40)
}

function formatShortDate(value) {
  if (!value) return '—'
  try {
    const d = typeof value === 'string' ? new Date(`${value}T12:00:00`) : value
    return d.toLocaleDateString('es-AR')
  } catch {
    return String(value)
  }
}

/** Comprobante A4 de juntada con logo Finora. */
export async function buildJuntadaPdfBlob({ summary, currency }) {
  const { juntada, expenses, balances, transfers, totalSpent } = summary
  const members = juntada.members || []
  const logo = await getLogoDataUrl()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16
  const nowLabel = new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Header brand
  doc.setFillColor(...BRAND.primary)
  doc.rect(0, 0, pageW, 36, 'F')
  doc.setFillColor(4, 120, 87)
  doc.rect(0, 36, pageW, 3, 'F')

  if (logo) {
    try {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 7, 22, 22, 4, 4, 'F')
      doc.addImage(logo, 'PNG', margin + 2.5, 9.5, 17, 17)
    } catch {
      // ignore logo errors
    }
  }

  const textX = logo ? margin + 28 : margin
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Finora', textX, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Comprobante de juntada', textX, 25)
  doc.setFontSize(8)
  doc.text(nowLabel, pageW - margin, 20, { align: 'right' })

  // Title card
  let y = 48
  doc.setFillColor(...BRAND.light)
  doc.roundedRect(margin, y, pageW - margin * 2, juntada.notes ? 28 : 22, 3, 3, 'F')
  doc.setTextColor(...BRAND.dark)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const title = doc.splitTextToSize(juntada.name || 'Juntada', pageW - margin * 2 - 10)
  doc.text(title[0], margin + 5, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.muted)
  doc.text(
    `${members.length} personas · ${expenses.length} gastos · ${currency}`,
    margin + 5,
    y + 17,
  )
  if (juntada.notes) {
    const notes = doc.splitTextToSize(juntada.notes, pageW - margin * 2 - 10)
    doc.text(notes[0], margin + 5, y + 23)
  }
  y += juntada.notes ? 34 : 28

  // KPI strip
  const boxW = (pageW - margin * 2 - 8) / 3
  const kpis = [
    { label: 'Total gastado', value: formatCurrency(totalSpent, currency) },
    { label: 'Personas', value: String(members.length) },
    {
      label: 'Pendiente',
      value: transfers.length
        ? formatCurrency(
            transfers.reduce((acc, t) => acc + Number(t.amount || 0), 0),
            currency,
          )
        : 'A mano',
    },
  ]
  kpis.forEach((kpi, i) => {
    const x = margin + i * (boxW + 4)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(...BRAND.line)
    doc.roundedRect(x, y, boxW, 18, 2.5, 2.5, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND.muted)
    doc.text(kpi.label, x + 4, y + 6.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BRAND.dark)
    doc.text(kpi.value, x + 4, y + 13.5)
  })
  y += 26

  // Settlement highlight
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...BRAND.dark)
  doc.text('Quién le paga a quién', margin, y)
  y += 3

  autoTable(doc, {
    startY: y,
    head: [['De', 'Para', 'Monto']],
    body:
      transfers.length > 0
        ? transfers.map((t) => [
            t.fromName,
            t.toName,
            formatCurrency(t.amount, currency),
          ])
        : [['—', 'Están a mano', '—']],
    theme: 'plain',
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: BRAND.dark,
      cellPadding: 3.5,
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: BRAND.light },
    styles: { lineColor: BRAND.line, lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 60 },
      2: { halign: 'right', fontStyle: 'bold', textColor: BRAND.primary },
    },
    margin: { left: margin, right: margin },
  })

  y = doc.lastAutoTable.finalY + 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...BRAND.dark)
  doc.text('Detalle de gastos', margin, y)

  const sorted = [...expenses].sort((a, b) =>
    String(a.expense_date || '').localeCompare(String(b.expense_date || '')),
  )

  autoTable(doc, {
    startY: y + 3,
    head: [['Fecha', 'Concepto', 'Pagó', 'Importe']],
    body: sorted.map((e) => [
      formatShortDate(e.expense_date),
      e.description || 'Gasto',
      e.paid_by?.name || '—',
      formatCurrency(e.amount, currency),
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: BRAND.dark,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3.2,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: BRAND.dark,
      cellPadding: 3,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 36 },
      3: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    didDrawPage(data) {
      // keep footer space
      if (data.pageNumber > 1 && data.cursor) {
        /* noop */
      }
    },
  })

  y = doc.lastAutoTable.finalY + 8

  // Total bar
  doc.setFillColor(...BRAND.primary)
  doc.roundedRect(margin, y, pageW - margin * 2, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL', margin + 5, y + 8)
  doc.text(formatCurrency(totalSpent, currency), pageW - margin - 5, y + 8, { align: 'right' })
  y += 20

  if (y > 230) {
    doc.addPage()
    y = 20
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...BRAND.dark)
  doc.text('Balance por persona', margin, y)

  autoTable(doc, {
    startY: y + 3,
    head: [['Persona', 'Pagó', 'Le toca', 'Resultado']],
    body: balances.map((b) => [
      b.name,
      formatCurrency(b.paid, currency),
      formatCurrency(b.owed, currency),
      b.net > 0.009
        ? `Le deben ${formatCurrency(b.net, currency)}`
        : b.net < -0.009
          ? `Debe ${formatCurrency(Math.abs(b.net), currency)}`
          : 'A mano',
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3.2,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: BRAND.dark,
      cellPadding: 3,
    },
    alternateRowStyles: { fillColor: BRAND.light },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  })

  // Footer on all pages
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...BRAND.line)
    doc.setLineWidth(0.3)
    doc.line(margin, h - 16, pageW - margin, h - 16)
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', margin, h - 13, 8, 8)
      } catch {
        /* ignore */
      }
    }
    doc.setTextColor(...BRAND.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Finora · División de gastos entre amigos', logo ? margin + 11 : margin, h - 8)
    doc.text(`Pág. ${i}/${pageCount}`, pageW - margin, h - 8, { align: 'right' })
  }

  const filename = `comprobante-finora-${safeJuntadaFilename(juntada.name)}.pdf`
  return { blob: doc.output('blob'), filename }
}

export async function exportJuntadaPdf({ summary, currency }) {
  const { blob, filename } = await buildJuntadaPdfBlob({ summary, currency })
  downloadBlob(blob, filename)
}

/** Comprobante en texto para WhatsApp. */
export function buildJuntadaShareText(summary, currency) {
  const { juntada, expenses, balances, transfers, totalSpent } = summary
  const sep = '────────────────'
  const lines = [
    '🧾 *COMPROBANTE FINORA*',
    `*${juntada.name}*`,
    juntada.notes ? `_${juntada.notes}_` : null,
    sep,
    '*GASTOS*',
  ]

  const sorted = [...expenses].sort((a, b) =>
    String(a.expense_date || '').localeCompare(String(b.expense_date || '')),
  )
  for (const e of sorted) {
    lines.push(`• ${e.description}`)
    lines.push(`  ${formatCurrency(e.amount, currency)} · pagó ${e.paid_by?.name || '—'}`)
  }

  lines.push(sep, `*TOTAL: ${formatCurrency(totalSpent, currency)}*`, sep, '*QUIÉN PAGA A QUIÉN*')

  if (transfers.length) {
    for (const t of transfers) {
      lines.push(`• ${t.fromName} → ${t.toName}: *${formatCurrency(t.amount, currency)}*`)
    }
  } else {
    lines.push(expenses.length ? '• Están a mano 👌' : '• Sin gastos')
  }

  lines.push(sep, '*POR PERSONA*')
  for (const b of balances) {
    const netLabel =
      b.net > 0.009
        ? `le deben ${formatCurrency(b.net, currency)}`
        : b.net < -0.009
          ? `debe ${formatCurrency(Math.abs(b.net), currency)}`
          : 'a mano'
    lines.push(`• *${b.name}* → ${netLabel}`)
    lines.push(
      `  pagó ${formatCurrency(b.paid, currency)} · le toca ${formatCurrency(b.owed, currency)}`,
    )
  }

  lines.push(sep, '_Hecho con Finora_')
  return lines.filter((l) => l !== null).join('\n')
}

function openWhatsAppWithText(text) {
  const encoded = encodeURIComponent(text)
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  const url = isMobile
    ? `https://api.whatsapp.com/send?text=${encoded}`
    : `https://web.whatsapp.com/send?text=${encoded}`

  // <a> click evita bloqueo de popups en el celu
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Comparte el comprobante por WhatsApp.
 * - Con HTTPS/localhost: menú del sistema con PDF adjunto (elegís WhatsApp).
 * - En HTTP (ej. IP de la red): abre WhatsApp con el comprobante en texto.
 */
export async function shareJuntadaWhatsApp({ summary, currency }) {
  const { juntada, expenses } = summary
  if (!expenses?.length) {
    throw new Error('No hay gastos para compartir')
  }

  const text = buildJuntadaShareText(summary, currency)
  const title = `Comprobante · ${juntada.name}`
  const secure = typeof window !== 'undefined' && window.isSecureContext
  const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // 1) Adjuntar PDF solo en contexto seguro (HTTPS o localhost)
  if (secure && hasShare) {
    try {
      const { blob, filename } = await buildJuntadaPdfBlob({ summary, currency })
      const file = new File([blob], filename, { type: 'application/pdf' })
      const withFiles = { title, text, files: [file] }
      if (!navigator.canShare || navigator.canShare(withFiles)) {
        await navigator.share(withFiles)
        return { method: 'share-file' }
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
    }
  }

  // 2) Menú compartir del celu con el texto del comprobante
  if (hasShare) {
    try {
      await navigator.share({ title, text })
      return { method: 'share-text', insecure: !secure }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
    }
  }

  // 3) Abrir WhatsApp directo con el comprobante
  try {
    await navigator.clipboard?.writeText(text)
  } catch {
    /* ignore */
  }
  openWhatsAppWithText(text)
  return { method: 'whatsapp-link', insecure: !secure }
}

export function exportJuntadaExcel({ summary, currency }) {
  const { juntada, expenses, balances, transfers, totalSpent } = summary
  const wb = XLSX.utils.book_new()

  const resumen = [
    ['Finora — Juntada'],
    ['Nombre', juntada.name],
    ['Notas', juntada.notes || ''],
    ['Moneda', currency],
    ['Total gastado', Number(totalSpent)],
    [],
    ['Quién le paga a quién'],
    ['De', 'Para', 'Monto'],
    ...(transfers.length
      ? transfers.map((t) => [t.fromName, t.toName, Number(t.amount)])
      : [['—', 'Sin deudas', 0]]),
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  const bal = [
    ['Persona', 'Pagó', 'Le toca', 'Neto'],
    ...balances.map((b) => [b.name, Number(b.paid), Number(b.owed), Number(b.net)]),
  ]
  const wsBal = XLSX.utils.aoa_to_sheet(bal)
  wsBal['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsBal, 'Balances')

  const gastos = [
    ['Fecha', 'Qué gastó', 'Quién pagó', 'Importe'],
    ...expenses.map((e) => [
      e.expense_date,
      e.description,
      e.paid_by?.name || '',
      Number(e.amount),
    ]),
  ]
  const wsGastos = XLSX.utils.aoa_to_sheet(gastos)
  wsGastos['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 16 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos')

  const safeName = String(juntada.name || 'juntada')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .slice(0, 40)
  downloadWorkbook(wb, `finora-juntada-${safeName}.xlsx`)
}
