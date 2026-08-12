import { GEMINI_API_KEY, GEMINI_MODEL } from '../config'

const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function generate(parts) {
  const res = await fetch(`${BASE}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Gemini API error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

function parseJSON(text) {
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(clean)
}

// ── Receipt / document analysis ──────────────────────────────────────────────
export async function analyzeReceipt(file) {
  const base64 = await fileToBase64(file)
  const today = new Date().toISOString().slice(0, 10)

  const parts = [
    { inline_data: { mime_type: file.type, data: base64 } },
    {
      text: `Analyze this receipt, invoice, bank statement, or financial document. Extract every expense or purchase.

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "merchant": "store or service name",
  "date": "YYYY-MM-DD (use ${today} if unclear)",
  "transactions": [
    {
      "description": "item or service name",
      "amount": 0.00,
      "category": "Food|Transport|Entertainment|Shopping|Bills|Health|Other"
    }
  ]
}

Rules:
- amount is always a positive number, no currency symbols
- If the document shows one total purchase, create one transaction
- If itemized, create one transaction per line item
- Category must be exactly one of the listed options
- description should be concise but clear`,
    },
  ]

  const text = await generate(parts)
  return parseJSON(text)
}

// ── Spending insights ────────────────────────────────────────────────────────
export async function getSpendingInsights({ summary, goals, subscriptions }) {
  const savingsRate = summary.income > 0
    ? Math.round(((summary.income - summary.expenses) / summary.income) * 100)
    : 0

  const catLines = Object.entries(summary.spendingByCategory)
    .map(([c, a]) => `  ${c}: R${a.toFixed(2)}`).join('\n') || '  (no expenses yet)'

  const parts = [{
    text: `You are a personal finance advisor for a South African user. Analyze their financial data and give specific, actionable insights.

This month:
- Income: R${summary.income.toFixed(2)}
- Expenses: R${summary.expenses.toFixed(2)}
- Balance: R${summary.balance.toFixed(2)}
- Savings rate: ${savingsRate}%
- Monthly subscriptions: R${summary.monthlySubsCost.toFixed(2)}

Spending breakdown:
${catLines}

Goals: ${goals.length} total, ${goals.filter(g => g.current_amount >= g.target_amount).length} reached
Subscriptions: ${subscriptions.length} active

Return ONLY a JSON array — no markdown:
[
  {
    "type": "positive|warning|tip",
    "title": "max 5 words",
    "message": "1–2 sentences, reference actual numbers, be specific and direct"
  }
]

Give 4–6 insights. Mix positives, warnings, and actionable tips.`,
  }]

  const text = await generate(parts)
  return parseJSON(text)
}

// ── Budget recommendations ───────────────────────────────────────────────────
export async function getBudgetPlan({ summary, goals }) {
  const catSpend = summary.spendingByCategory

  const parts = [{
    text: `Create a monthly budget plan for a South African user with monthly income of R${summary.income.toFixed(2)}.

Their actual spending this month:
${Object.entries(catSpend).map(([c, a]) => `  ${c}: R${a.toFixed(2)}`).join('\n') || '  (no spending recorded)'}

Goals needing funding: ${goals.filter(g => g.current_amount < g.target_amount).map(g => g.name).join(', ') || 'None'}

Apply a 50/30/20 framework adapted to South African context (housing, transport costs, etc).

Return ONLY a JSON array — no markdown:
[
  {
    "category": "category name",
    "recommended": 0.00,
    "current": 0.00,
    "tip": "one concrete action they can take"
  }
]

Include: Housing/Rent, Food, Transport, Entertainment, Shopping, Bills, Health, Savings, Subscriptions.
Set current to 0 for categories with no recorded spending.`,
  }]

  const text = await generate(parts)
  return parseJSON(text)
}

// ── Smart category suggestion ────────────────────────────────────────────────
export async function suggestCategory(description) {
  const parts = [{
    text: `Transaction: "${description}". Pick the best category: Food, Transport, Entertainment, Shopping, Bills, Health, Salary, Freelance, Other. Reply with ONLY the category name.`,
  }]
  const text = await generate(parts)
  return text.trim().split('\n')[0].trim()
}

// ── Detect subscriptions from transaction history ────────────────────────────
export async function detectSubscriptions(transactions) {
  const today = new Date().toISOString().slice(0, 10)
  const lines = transactions
    .map(t => `${t.date} | ${t.description} | R${parseFloat(t.amount).toFixed(2)}`)
    .join('\n')

  const parts = [{
    text: `Analyze these bank transactions and identify recurring subscription or contract payments.

Look for: streaming (Netflix, Showmax, DSTV Now), music (Spotify, Apple Music), software (Microsoft 365, Adobe, Dropbox),
gaming, gym/fitness, news, cloud storage, insurance premiums, cell phone contracts, internet/fibre, and similar recurring services.

Transactions:
${lines}

Return ONLY a valid JSON array. Empty array [] if nothing found. No markdown, no explanation.
[
  {
    "name": "Netflix",
    "amount": 199.00,
    "billing_cycle": "monthly",
    "category": "Streaming",
    "next_billing_date": "${today}"
  }
]

Rules:
- Only include clear recurring services — exclude groceries, fuel, once-off purchases
- billing_cycle: "monthly", "yearly", or "weekly"
- category: one of: Streaming, Music, Software, Gaming, Fitness, News, Cloud, Other
- amount: the value from the most recent occurrence
- next_billing_date: estimate based on the most recent date seen`,
  }]
  const text = await generate(parts)
  return parseJSON(text)
}

// ── Parse PDF bank statement ─────────────────────────────────────────────────
export async function parseBankStatementPDF(file) {
  const base64 = await fileToBase64(file)
  const today = new Date().toISOString().slice(0, 10)

  const parts = [
    { inline_data: { mime_type: 'application/pdf', data: base64 } },
    {
      text: `You are a bank statement parser. Extract every individual transaction from this bank statement PDF.

Return ONLY valid JSON — no markdown, no explanation:
{
  "bank": "bank name if visible",
  "account": "account number or name if visible",
  "period": "statement period if visible",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "clean description (remove reference numbers, trim spaces)",
      "amount": 0.00,
      "type": "income or expense",
      "category": "one of: Salary|Freelance|Food|Transport|Entertainment|Shopping|Bills|Health|Other"
    }
  ]
}

Rules:
- amount is always a POSITIVE number, no currency symbols
- type is "expense" when money left the account (debits, withdrawals, payments), "income" when money came in (credits, deposits, salary)
- Extract ALL transactions — do not skip any
- If a date is missing use today: ${today}
- description should be human-readable, remove bank codes like POS/NB/ATM prefixes where possible but keep the merchant name
- category: Salary for regular employer payments, Freelance for irregular income, Food for groceries/restaurants, Transport for fuel/Uber/parking, Bills for utilities/insurance/phone, Health for medical/pharmacy, Shopping for retail, Entertainment for leisure, Other for anything else`,
    },
  ]

  const text = await generate(parts)
  return parseJSON(text)
}

// ── Bulk categorize (for CSV import) ─────────────────────────────────────────
export async function bulkCategorize(descriptions) {
  const numbered = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')
  const parts = [{
    text: `Categorize each of these bank transactions. Reply with ONLY a JSON array of strings (same order, same count):
["Category1", "Category2", ...]

Valid categories: Food, Transport, Entertainment, Shopping, Bills, Health, Salary, Freelance, Other

Transactions:
${numbered}`,
  }]
  const text = await generate(parts)
  return parseJSON(text)
}
