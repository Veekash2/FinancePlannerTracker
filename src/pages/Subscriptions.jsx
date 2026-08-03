import { useEffect, useState } from 'react';
import { api } from '../storage';

const SWATCHES = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316'];

const SUB_CATEGORIES = ['Streaming', 'Music', 'Software', 'Gaming', 'Fitness', 'News', 'Cloud', 'Other'];

function fmt(n, cycle) {
  const monthly = cycle === 'yearly' ? n / 12 : cycle === 'weekly' ? n * 4.33 : n;
  return {
    shown: new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n),
    monthly: new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(monthly),
  };
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');
  return Math.round((d - today) / 86400000);
}

const defaultForm = {
  name: '', amount: '', billing_cycle: 'monthly', category: 'Streaming',
  next_billing_date: new Date().toISOString().slice(0, 10), color: '#6366f1',
};

export default function Subscriptions() {
  const [subs, setSubs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const load = () => api.getSubscriptions().then(setSubs);
  useEffect(() => { load(); }, []);

  const totalMonthly = subs.reduce((s, sub) => {
    if (sub.billing_cycle === 'monthly') return s + parseFloat(sub.amount);
    if (sub.billing_cycle === 'yearly') return s + parseFloat(sub.amount) / 12;
    if (sub.billing_cycle === 'weekly') return s + parseFloat(sub.amount) * 4.33;
    return s;
  }, 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    await api.addSubscription({ ...form, amount: parseFloat(form.amount) });
    setForm(defaultForm);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteSubscription(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Subscriptions</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      {subs.length > 0 && (
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Monthly total</div>
            <div className="stat-value red">
              {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(totalMonthly)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Yearly total</div>
            <div className="stat-value" style={{ color: 'var(--yellow)' }}>
              {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(totalMonthly * 12)}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {subs.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔁</div>
            Track your subscriptions here — they add up fast!
          </div>
        ) : (
          <div className="sub-list">
            {subs.map(sub => {
              const days = daysUntil(sub.next_billing_date);
              const { shown, monthly } = fmt(parseFloat(sub.amount), sub.billing_cycle);
              return (
                <div className="sub-item" key={sub.id}>
                  <div className="sub-dot" style={{ background: sub.color }} />
                  <div className="sub-info">
                    <div className="sub-name">{sub.name}</div>
                    <div className="sub-meta">
                      {sub.category} · {sub.billing_cycle} ·{' '}
                      {days <= 0 ? (
                        <span className="badge badge-warning">Due today</span>
                      ) : days <= 7 ? (
                        <span className="badge badge-warning">Due in {days}d</span>
                      ) : (
                        `due ${new Date(sub.next_billing_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      )}
                    </div>
                  </div>
                  <div className="sub-right">
                    <div className="sub-amount">{shown}</div>
                    {sub.billing_cycle !== 'monthly' && (
                      <div className="sub-cycle">{monthly}/mo</div>
                    )}
                  </div>
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleDelete(sub.id)}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Subscription</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Service name</label>
                <input className="form-input" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Netflix" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (R)</label>
                  <input className="form-input" required type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="9.99" />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing cycle</label>
                  <select className="form-input" value={form.billing_cycle}
                    onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {SUB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Next billing</label>
                  <input className="form-input" required type="date" value={form.next_billing_date}
                    onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="color-swatches">
                  {SWATCHES.map(c => (
                    <div key={c} className={`swatch ${form.color === c ? 'selected' : ''}`}
                      style={{ background: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                Add Subscription
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
