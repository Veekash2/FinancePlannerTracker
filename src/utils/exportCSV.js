export function exportTransactionsCSV(transactions, filename = 'spendwise-transactions.csv') {
  const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [
    ['Date', 'Type', 'Category', 'Description', 'Amount (R)'].join(','),
    ...transactions.map(t => [
      t.date,
      t.type,
      t.category,
      esc(t.description),
      (t.type === 'expense' ? -1 : 1) * parseFloat(t.amount),
    ].join(',')),
  ]
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
