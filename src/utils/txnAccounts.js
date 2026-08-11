const key = (email) => `fp_txnacc_${email}`

export function setTxnAccount(email, txnId, accountId) {
  const map = JSON.parse(localStorage.getItem(key(email)) || '{}')
  if (accountId) map[txnId] = accountId
  else delete map[txnId]
  localStorage.setItem(key(email), JSON.stringify(map))
}

export function removeTxnAccount(email, txnId) {
  const map = JSON.parse(localStorage.getItem(key(email)) || '{}')
  delete map[txnId]
  localStorage.setItem(key(email), JSON.stringify(map))
}

export function getAllTxnAccounts(email) {
  try { return JSON.parse(localStorage.getItem(key(email)) || '{}') }
  catch { return {} }
}
