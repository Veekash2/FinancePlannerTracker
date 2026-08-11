const key = email => `fp_nwhistory_${email}`
const MAX = 24 // keep last 24 monthly snapshots

export function logNetWorth(email, netWorth) {
  const history = getNetWorthHistory(email)
  const month   = new Date().toISOString().slice(0, 7) // YYYY-MM
  const idx     = history.findIndex(e => e.month === month)
  if (idx >= 0) history[idx] = { month, netWorth }
  else          history.push({ month, netWorth })
  const sorted  = history.sort((a, b) => a.month.localeCompare(b.month)).slice(-MAX)
  localStorage.setItem(key(email), JSON.stringify(sorted))
}

export function getNetWorthHistory(email) {
  try { return JSON.parse(localStorage.getItem(key(email)) || '[]') }
  catch { return [] }
}
