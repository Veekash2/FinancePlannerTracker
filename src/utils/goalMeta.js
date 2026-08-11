const key = (email) => `fp_goalmeta_${email}`

export function setGoalPriority(email, goalId, priority) {
  const map = JSON.parse(localStorage.getItem(key(email)) || '{}')
  if (priority && priority !== 'none') map[goalId] = priority
  else delete map[goalId]
  localStorage.setItem(key(email), JSON.stringify(map))
}

export function getAllGoalPriorities(email) {
  try { return JSON.parse(localStorage.getItem(key(email)) || '{}') }
  catch { return {} }
}
