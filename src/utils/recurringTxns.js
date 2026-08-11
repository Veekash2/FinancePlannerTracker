const key = email => `fp_recurring_${email}`

export function getRecurringTxns(email) {
  try { return JSON.parse(localStorage.getItem(key(email)) || '[]') }
  catch { return [] }
}

export function saveRecurringTxn(email, txn) {
  const list = getRecurringTxns(email)
  const entry = {
    id: String(Date.now()),
    description: txn.description,
    amount: txn.amount,
    type: txn.type,
    category: txn.category,
    accountId: txn.accountId ?? '',
    savedAt: new Date().toISOString().slice(0, 10),
  }
  localStorage.setItem(key(email), JSON.stringify([...list, entry]))
  return entry
}

export function removeRecurringTxn(email, id) {
  localStorage.setItem(key(email), JSON.stringify(getRecurringTxns(email).filter(t => t.id !== id)))
}
