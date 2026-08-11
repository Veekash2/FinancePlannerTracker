import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const ACCENT       = [99, 102, 241]
const ACCENT_LIGHT = [237, 237, 253]
const MUTED        = [130, 130, 160]

function fmtR(n) {
  const num = Number(n) || 0
  return `R ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export function exportFinancialPDF({ transactions, goals, subscriptions, summary }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const now   = new Date()
  const W     = doc.internal.pageSize.getWidth()
  const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, W, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Spendwise', 14, 16)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Personal Financial Report', 14, 24)
  doc.text(`${period}  ·  Generated ${now.toLocaleDateString('en-ZA')}`, 14, 30)

  doc.setTextColor(0, 0, 0)

  // ── Monthly Summary ─────────────────────────────────────────────────────
  let y = 46
  const savingsRate = summary.income > 0
    ? `${Math.round(((summary.income - summary.expenses) / summary.income) * 100)}%`
    : 'N/A'

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Monthly Summary', 14, y)

  autoTable(doc, {
    startY: y + 4,
    body: [
      ['Income',       fmtR(summary.income),         'Expenses',      fmtR(summary.expenses)],
      ['Net Balance',  fmtR(summary.balance),         'Savings Rate',  savingsRate],
      ['Subscriptions/mo', fmtR(summary.monthlySubsCost), 'Transactions', String(transactions.length)],
    ],
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 45 },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 45 },
      3: { cellWidth: 50 },
    },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Spending by Category ────────────────────────────────────────────────
  const cats = Object.entries(summary.spendingByCategory).sort((a, b) => b[1] - a[1])
  if (cats.length > 0) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Spending by Category', 14, y)

    autoTable(doc, {
      startY: y + 4,
      head: [['Category', 'Amount']],
      body: cats.map(([cat, amt]) => [cat, fmtR(amt)]),
      theme: 'striped',
      headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: ACCENT_LIGHT },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right' } },
    })

    y = doc.lastAutoTable.finalY + 10
  }

  // ── Transactions ────────────────────────────────────────────────────────
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Transactions (${transactions.length})`, 14, y)

  autoTable(doc, {
    startY: y + 4,
    head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
    body: transactions.map(t => [
      t.date,
      t.description,
      t.category,
      t.type.charAt(0).toUpperCase() + t.type.slice(1),
      fmtR(t.amount),
    ]),
    theme: 'striped',
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 10 },
    alternateRowStyles: { fillColor: ACCENT_LIGHT },
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'ellipsize' },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 68 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 30, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const type = transactions[data.row.index]?.type
        data.cell.styles.textColor = type === 'income' ? [34, 197, 94] : [239, 68, 68]
      }
    },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Savings Goals ───────────────────────────────────────────────────────
  if (goals.length > 0) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`Savings Goals (${goals.length})`, 14, y)

    autoTable(doc, {
      startY: y + 4,
      head: [['Goal', 'Target', 'Saved', 'Remaining', 'Progress', 'Deadline']],
      body: goals.map(g => {
        const pct = g.target_amount > 0
          ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100))
          : 0
        return [
          g.name,
          fmtR(g.target_amount),
          fmtR(g.current_amount),
          fmtR(g.target_amount - g.current_amount),
          `${pct}%`,
          g.deadline || '—',
        ]
      }),
      theme: 'striped',
      headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: ACCENT_LIGHT },
      styles: { fontSize: 9, cellPadding: 2.5 },
    })

    y = doc.lastAutoTable.finalY + 10
  }

  // ── Subscriptions ───────────────────────────────────────────────────────
  if (subscriptions.length > 0) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`Subscriptions (${subscriptions.length})`, 14, y)

    autoTable(doc, {
      startY: y + 4,
      head: [['Service', 'Category', 'Amount', 'Cycle', 'Monthly Equiv.', 'Next Billing']],
      body: subscriptions.map(s => {
        const monthly = s.billing_cycle === 'yearly' ? s.amount / 12
          : s.billing_cycle === 'weekly' ? s.amount * 4.33
          : parseFloat(s.amount)
        return [
          s.name,
          s.category,
          fmtR(s.amount),
          s.billing_cycle.charAt(0).toUpperCase() + s.billing_cycle.slice(1),
          fmtR(monthly),
          s.next_billing_date,
        ]
      }),
      theme: 'striped',
      headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: ACCENT_LIGHT },
      styles: { fontSize: 9, cellPadding: 2.5 },
    })
  }

  // ── Page footers ────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Spendwise Financial Report  ·  Page ${i} of ${pages}`, 14, 290)
    doc.text(now.toLocaleDateString('en-ZA'), W - 14, 290, { align: 'right' })
  }

  doc.save(`financial-report-${now.toISOString().slice(0, 10)}.pdf`)
}
