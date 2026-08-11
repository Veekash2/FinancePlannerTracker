const budgetKey   = email => `fp_budgets_${email}`
const envelopeKey = email => `fp_envelopes_${email}`

// ── Category budgets (monthly spend limit per category) ──────────────────────
export function getBudgets(email) {
  try { return JSON.parse(localStorage.getItem(budgetKey(email)) || '{}') }
  catch { return {} }
}

export function setBudget(email, category, amount) {
  const b = getBudgets(email)
  if (amount > 0) b[category] = amount
  else delete b[category]
  localStorage.setItem(budgetKey(email), JSON.stringify(b))
}

// ── Budget envelopes (salary-allocation buckets) ──────────────────────────────
export function getEnvelopes(email) {
  try { return JSON.parse(localStorage.getItem(envelopeKey(email)) || '[]') }
  catch { return [] }
}

export function saveEnvelopes(email, envelopes) {
  localStorage.setItem(envelopeKey(email), JSON.stringify(envelopes))
}
