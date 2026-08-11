// Flexible bank CSV parser — handles FNB and most common bank export formats.
// FNB exports: Date | Amount | Balance | Description | Ref No
// Negative amount = expense, positive = income

const DATE_COLS    = ['date', 'transaction date', 'txn date', 'value date', 'posting date']
const AMOUNT_COLS  = ['amount', 'debit', 'credit', 'transaction amount', 'txn amount']
const DESC_COLS    = ['description', 'narrative', 'details', 'transaction details', 'particulars', 'memo', 'ref']

function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function normaliseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10)
  // Try various formats: YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, "01 Jul 2026"
  const clean = raw.replace(/['"]/g, '').trim()

  // YYYY/MM/DD or YYYY-MM-DD
  if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(clean)) {
    return clean.replace(/\//g, '-')
  }
  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split(/[/-]/)
    return `${y}-${m}-${d}`
  }
  // "01 Jul 2026" or "01-Jul-2026"
  const monthMap = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }
  const m = clean.match(/(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{4})/)
  if (m) {
    const mo = String(monthMap[m[2].toLowerCase()] ?? 1).padStart(2, '0')
    return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`
  }
  // Fallback: try native Date parse
  const d = new Date(clean)
  if (!isNaN(d)) return d.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

function normaliseAmount(raw) {
  if (!raw) return 0
  const clean = raw.replace(/['"R$,\s]/g, '').replace(/\((.+)\)/, '-$1')
  return parseFloat(clean) || 0
}

function findColIndex(headers, candidates) {
  const lower = headers.map(h => h.toLowerCase().replace(/['"]/g, '').trim())
  for (const c of candidates) {
    const i = lower.findIndex(h => h === c || h.includes(c))
    if (i !== -1) return i
  }
  return -1
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())

  // Find the header row — look for a line that contains date-like and amount-like column names
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cols = parseCSVLine(lines[i]).map(c => c.toLowerCase().replace(/['"]/g, '').trim())
    const hasDate   = DATE_COLS.some(d => cols.some(c => c.includes(d.split(' ')[0])))
    const hasAmount = AMOUNT_COLS.some(a => cols.some(c => c.includes(a.split(' ')[0])))
    if (hasDate && hasAmount) { headerIdx = i; break }
  }

  if (headerIdx === -1) throw new Error('Could not find transaction columns. Make sure you exported a CSV with Date and Amount columns.')

  const headers = parseCSVLine(lines[headerIdx])
  const dateIdx   = findColIndex(headers, DATE_COLS)
  const amtIdx    = findColIndex(headers, AMOUNT_COLS)
  const descIdx   = findColIndex(headers, DESC_COLS)

  if (dateIdx === -1 || amtIdx === -1) throw new Error('Could not find Date or Amount columns in the file.')

  const transactions = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 2) continue

    const rawAmt  = cols[amtIdx] ?? ''
    const amount  = normaliseAmount(rawAmt)
    if (amount === 0) continue  // skip zero / balance rows

    const desc = descIdx !== -1 ? cols[descIdx]?.replace(/['"]/g, '').trim() : `Transaction ${i}`
    const date = normaliseDate(cols[dateIdx])

    transactions.push({
      description: desc || 'Transaction',
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      date,
      category: 'Other',
      include: true,
    })
  }

  if (transactions.length === 0) throw new Error('No transactions found in the file.')
  return transactions
}
