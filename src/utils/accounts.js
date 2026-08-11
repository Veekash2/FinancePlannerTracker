// Per-user accounts stored in localStorage (no extra Supabase table needed)
const key = email => `fp_accounts_${email}`

export function getAccounts(email) {
  try { return JSON.parse(localStorage.getItem(key(email)) || '[]') }
  catch { return [] }
}

function save(email, accounts) {
  localStorage.setItem(key(email), JSON.stringify(accounts))
}

export function addAccount(email, account) {
  const accounts = getAccounts(email)
  const newAcc = { ...account, id: String(Date.now()), updated: new Date().toISOString().slice(0, 10) }
  save(email, [...accounts, newAcc])
  return newAcc
}

export function updateAccount(email, id, updates) {
  const accounts = getAccounts(email)
  const updated = accounts.map(a => a.id === id ? { ...a, ...updates, updated: new Date().toISOString().slice(0, 10) } : a)
  save(email, updated)
}

export function deleteAccount(email, id) {
  save(email, getAccounts(email).filter(a => a.id !== id))
}

export const ACCOUNT_TYPES = {
  cheque:     { label: 'Cheque',      icon: '🏦', color: '#6366f1' },
  savings:    { label: 'Savings',     icon: '💰', color: '#10b981' },
  credit:     { label: 'Credit Card', icon: '💳', color: '#f59e0b' },
  investment: { label: 'Investment',  icon: '📈', color: '#3b82f6' },
  other:      { label: 'Other',       icon: '📁', color: '#8b5cf6' },
}
