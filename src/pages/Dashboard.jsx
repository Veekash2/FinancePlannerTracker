import { useEffect, useState } from 'react';
import { api } from '../storage';

const CATEGORY_COLORS = {
  Food: '#f59e0b',
  Transport: '#3b82f6',
  Entertainment: '#ec4899',
  Shopping: '#8b5cf6',
  Bills: '#ef4444',
  Health: '#22c55e',
  Other: '#6366f1',
  Salary: '#22c55e',
  Freelance: '#06b6d4',
};

const CATEGORY_ICONS = {
  Food: '🍔', Transport: '🚗', Entertainment: '🎬', Shopping: '🛍️',
  Bills: '📄', Health: '💊', Other: '📦', Salary: '💼', Freelance: '💻',
};

function fmt(n) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    api.getSummary().then(setSummary);
    api.getTransactions().then(d => setTransactions(d.slice(0, 8)));
  }, []);

  const cats = summary?.spendingByCategory ?? {};
  const maxCat = Math.max(...Object.values(cats), 1);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Balance</div>
          <div className={`stat-value ${summary?.balance >= 0 ? 'green' : 'red'}`}>
            {summary ? fmt(summary.balance) : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Income</div>
          <div className="stat-value green">{summary ? fmt(summary.income) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Spent</div>
          <div className="stat-value red">{summary ? fmt(summary.expenses) : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Subscriptions / mo</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--yellow)' }}>
            {summary ? fmt(summary.monthlySubsCost) : '—'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Savings rate</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>
            {summary && summary.income > 0
              ? `${Math.round(((summary.income - summary.expenses) / summary.income) * 100)}%`
              : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="card-title">Spending by category</div>
          {Object.keys(cats).length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div>No expenses yet</div>
          ) : (
            <div className="cat-spending">
              {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <div className="cat-row" key={cat}>
                  <div className="cat-label">{CATEGORY_ICONS[cat] ?? '📦'} {cat}</div>
                  <div className="cat-bar-wrap">
                    <div className="cat-bar" style={{ width: `${(amt / maxCat) * 100}%`, background: CATEGORY_COLORS[cat] ?? '#6366f1' }} />
                  </div>
                  <div className="cat-value">{fmt(amt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Recent transactions</div>
          {transactions.length === 0 ? (
            <div className="empty"><div className="empty-icon">💳</div>No transactions yet</div>
          ) : (
            <div className="txn-list">
              {transactions.map(t => (
                <div className="txn-item" key={t.id}>
                  <div className="txn-icon" style={{ background: `${CATEGORY_COLORS[t.category] ?? '#6366f1'}22` }}>
                    {CATEGORY_ICONS[t.category] ?? '📦'}
                  </div>
                  <div className="txn-info">
                    <div className="txn-desc">{t.description}</div>
                    <div className="txn-meta">{t.date}</div>
                  </div>
                  <div className={`txn-amount ${t.type}`}>
                    {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
