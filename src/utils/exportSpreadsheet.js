import * as XLSX from 'xlsx'

function monthlyEquiv(sub) {
  if (sub.billing_cycle === 'yearly') return parseFloat(sub.amount) / 12
  if (sub.billing_cycle === 'weekly') return parseFloat(sub.amount) * 4.33
  return parseFloat(sub.amount)
}

function colWidths(rows) {
  const widths = []
  rows.forEach(row => {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length
      widths[i] = Math.max(widths[i] ?? 10, len + 2)
    })
  })
  return widths.map(w => ({ wch: Math.min(w, 40) }))
}

export function exportFinancialReport({ transactions, goals, subscriptions, summary }) {
  const wb = XLSX.utils.book_new()
  const now = new Date()
  const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // ── Summary ────────────────────────────────────────────────────────────
  const savingsRate = summary.income > 0
    ? `${Math.round(((summary.income - summary.expenses) / summary.income) * 100)}%`
    : 'N/A'

  const summaryRows = [
    ['FINANCIAL REPORT'],
    ['Generated', now.toLocaleDateString('en-ZA')],
    ['Period', period],
    [],
    ['MONTHLY SUMMARY'],
    ['Metric', 'Amount (ZAR)'],
    ['Income', summary.income],
    ['Expenses', summary.expenses],
    ['Net Balance', summary.balance],
    ['Savings Rate', savingsRate],
    ['Monthly Subscriptions', summary.monthlySubsCost],
    [],
    ['SPENDING BY CATEGORY'],
    ['Category', 'Amount (ZAR)'],
    ...Object.entries(summary.spendingByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => [cat, amt]),
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
  summaryWs['!cols'] = colWidths(summaryRows)
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // ── Transactions ───────────────────────────────────────────────────────
  const txnHeaders = ['Date', 'Description', 'Category', 'Type', 'Amount (ZAR)']
  const txnRows = transactions.map(t => [
    t.date,
    t.description,
    t.category,
    t.type.charAt(0).toUpperCase() + t.type.slice(1),
    parseFloat(t.amount),
  ])
  const txnWs = XLSX.utils.aoa_to_sheet([txnHeaders, ...txnRows])
  txnWs['!cols'] = colWidths([txnHeaders, ...txnRows])
  XLSX.utils.book_append_sheet(wb, txnWs, 'Transactions')

  // ── Goals ──────────────────────────────────────────────────────────────
  const goalsHeaders = ['Goal Name', 'Target (ZAR)', 'Saved (ZAR)', 'Remaining (ZAR)', 'Progress %', 'Deadline']
  const goalsRows = goals.map(g => {
    const pct = g.target_amount > 0
      ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100))
      : 0
    return [
      g.name,
      parseFloat(g.target_amount),
      parseFloat(g.current_amount),
      parseFloat(g.target_amount) - parseFloat(g.current_amount),
      `${pct}%`,
      g.deadline || '—',
    ]
  })
  const goalsWs = XLSX.utils.aoa_to_sheet([goalsHeaders, ...goalsRows])
  goalsWs['!cols'] = colWidths([goalsHeaders, ...goalsRows])
  XLSX.utils.book_append_sheet(wb, goalsWs, 'Savings Goals')

  // ── Subscriptions ──────────────────────────────────────────────────────
  const subsHeaders = ['Service', 'Category', 'Amount (ZAR)', 'Billing Cycle', 'Monthly Equiv. (ZAR)', 'Next Billing Date']
  const subsRows = subscriptions.map(s => [
    s.name,
    s.category,
    parseFloat(s.amount),
    s.billing_cycle.charAt(0).toUpperCase() + s.billing_cycle.slice(1),
    Math.round(monthlyEquiv(s) * 100) / 100,
    s.next_billing_date,
  ])
  const subsWs = XLSX.utils.aoa_to_sheet([subsHeaders, ...subsRows])
  subsWs['!cols'] = colWidths([subsHeaders, ...subsRows])
  XLSX.utils.book_append_sheet(wb, subsWs, 'Subscriptions')

  // ── Download ───────────────────────────────────────────────────────────
  const filename = `financial-report-${now.toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}
