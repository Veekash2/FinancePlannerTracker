import { v4 as uuidv4 } from 'uuid';

function get(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

export const api = {
  // ── Transactions ────────────────────────────────────────────────────
  getTransactions() {
    return Promise.resolve(
      get('transactions').sort((a, b) => b.date.localeCompare(a.date))
    );
  },
  addTransaction(body) {
    const txns = get('transactions');
    const item = { ...body, id: uuidv4(), created_at: new Date().toISOString() };
    txns.push(item);
    set('transactions', txns);
    return Promise.resolve(item);
  },
  deleteTransaction(id) {
    set('transactions', get('transactions').filter(t => t.id !== id));
    return Promise.resolve({ ok: true });
  },

  // ── Goals ────────────────────────────────────────────────────────────
  getGoals() {
    return Promise.resolve(
      get('goals').sort((a, b) => b.created_at.localeCompare(a.created_at))
    );
  },
  addGoal(body) {
    const goals = get('goals');
    const item = { current_amount: 0, color: '#6366f1', ...body, id: uuidv4(), created_at: new Date().toISOString() };
    goals.push(item);
    set('goals', goals);
    return Promise.resolve(item);
  },
  updateGoal(id, body) {
    set('goals', get('goals').map(g => g.id === id ? { ...g, ...body } : g));
    return Promise.resolve({ ok: true });
  },
  deleteGoal(id) {
    set('goals', get('goals').filter(g => g.id !== id));
    return Promise.resolve({ ok: true });
  },

  // ── Subscriptions ────────────────────────────────────────────────────
  getSubscriptions() {
    return Promise.resolve(
      get('subscriptions').sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date))
    );
  },
  addSubscription(body) {
    const subs = get('subscriptions');
    const item = { color: '#6366f1', ...body, id: uuidv4(), created_at: new Date().toISOString() };
    subs.push(item);
    set('subscriptions', subs);
    return Promise.resolve(item);
  },
  deleteSubscription(id) {
    set('subscriptions', get('subscriptions').filter(s => s.id !== id));
    return Promise.resolve({ ok: true });
  },

  // ── Summary ──────────────────────────────────────────────────────────
  getSummary() {
    const txns = get('transactions');
    const subs = get('subscriptions');
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const thisMonth = txns.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
    const monthlySubsCost = subs.reduce((s, sub) => {
      if (sub.billing_cycle === 'monthly') return s + parseFloat(sub.amount);
      if (sub.billing_cycle === 'yearly') return s + parseFloat(sub.amount) / 12;
      if (sub.billing_cycle === 'weekly') return s + parseFloat(sub.amount) * 4.33;
      return s;
    }, 0);

    const spendingByCategory = {};
    thisMonth.filter(t => t.type === 'expense').forEach(t => {
      spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + parseFloat(t.amount);
    });

    return Promise.resolve({ income, expenses, balance: income - expenses, monthlySubsCost, spendingByCategory });
  },
};
