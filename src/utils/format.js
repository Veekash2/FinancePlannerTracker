export const CATEGORY_COLORS = {
  Food: '#f59e0b',
  Transport: '#3b82f6',
  Entertainment: '#ec4899',
  Shopping: '#8b5cf6',
  Bills: '#ef4444',
  Health: '#22c55e',
  Other: '#6366f1',
  Salary: '#22c55e',
  Freelance: '#06b6d4',
}

export const CATEGORY_ICONS = {
  Food: '🍔', Transport: '🚗', Entertainment: '🎬', Shopping: '🛍️',
  Bills: '📄', Health: '💊', Other: '📦', Salary: '💼', Freelance: '💻',
}

export function fmt(n, decimals = 0) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n ?? 0)
}

export function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}
