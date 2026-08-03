const BASE = '/api';

async function json(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

export const api = {
  getTransactions: () => json('/transactions'),
  addTransaction: (body) => json('/transactions', { method: 'POST', body: JSON.stringify(body) }),
  deleteTransaction: (id) => json(`/transactions/${id}`, { method: 'DELETE' }),

  getGoals: () => json('/goals'),
  addGoal: (body) => json('/goals', { method: 'POST', body: JSON.stringify(body) }),
  updateGoal: (id, body) => json(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteGoal: (id) => json(`/goals/${id}`, { method: 'DELETE' }),

  getSubscriptions: () => json('/subscriptions'),
  addSubscription: (body) => json('/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
  deleteSubscription: (id) => json(`/subscriptions/${id}`, { method: 'DELETE' }),

  getSummary: () => json('/summary'),
};
