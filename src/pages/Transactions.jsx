import { useEffect, useState } from 'react';
import { api } from '../storage';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Salary', 'Freelance', 'Other'];

const ICONS = {
  Food: '🍔', Transport: '🚗', Entertainment: '🎬', Shopping: '🛍️',
  Bills: '📄', Health: '💊', Other: '📦', Salary: '💼', Freelance: '💻',
};

const COLORS = {
  Food: '#f59e0b', Transport: '#3b82f6', Entertainment: '#ec4899', Shopping: '#8b5cf6',
  Bills: '#ef4444', Health: '#22c55e', Other: '#6366f1', Salary: '#22c55e', Freelance: '#06b6d4',
};

function fmt(n) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);
}

const defaultForm = {
  description: '', amount: '', category: 'Food', type: 'expense',
  date: new Date().toISOString().slice(0, 10),
};

export default function Transactions() {
  const [txns, setTxns] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [filter, setFilter] = useState('all');

  const load = () => api.getTransactions().then(setTxns);
  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await api.addTransaction({ ...form, amount: parseFloat(form.amount) });
    setForm(defaultForm);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteTransaction(id);
    load();
  };

  const visible = txns.filter(t => filter === 'all' || t.type === filter);

  const grouped = visible.reduce((acc, t) => {
    const key = t.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all', 'income', 'expense'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: filter === f ? 'var(--accent-glow)' : 'var(--surface)',
              border: '1px solid var(--border)',
              color: filter === f ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        {visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💳</div>
            No transactions yet — add your first one!
          </div>
        ) : (
          Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => (
            <div key={date} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, padding: '8px 14px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="txn-list">
                {items.map(t => (
                  <div className="txn-item" key={t.id}>
                    <div className="txn-icon" style={{ background: `${COLORS[t.category] ?? '#6366f1'}22` }}>
                      {ICONS[t.category] ?? '📦'}
                    </div>
                    <div className="txn-info">
                      <div className="txn-desc">{t.description}</div>
                      <div className="txn-meta">{t.category}</div>
                    </div>
                    <div className={`txn-amount ${t.type}`}>
                      {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                    </div>
                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleDelete(t.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Transaction</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="type-toggle">
              <button
                className={`type-btn ${form.type === 'expense' ? 'active-expense' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'expense', category: 'Food' }))}
              >Expense</button>
              <button
                className={`type-btn ${form.type === 'income' ? 'active-income' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'income', category: 'Salary' }))}
              >Income</button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" required value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Groceries" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (R)</label>
                  <input className="form-input" required type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" required type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {(form.type === 'income' ? ['Salary', 'Freelance', 'Other'] : CATEGORIES.filter(c => c !== 'Salary' && c !== 'Freelance')).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                Add Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
