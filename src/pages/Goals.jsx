import { useEffect, useState } from 'react';
import { api } from '../storage';

const SWATCHES = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316'];

function fmt(n) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
}

const defaultForm = { name: '', target_amount: '', current_amount: '', color: '#6366f1', deadline: '' };

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [depositGoal, setDepositGoal] = useState(null);
  const [depositAmt, setDepositAmt] = useState('');
  const [form, setForm] = useState(defaultForm);

  const load = () => api.getGoals().then(setGoals);
  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await api.addGoal({
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount || 0),
      color: form.color,
      deadline: form.deadline || undefined,
    });
    setForm(defaultForm);
    setShowModal(false);
    load();
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    const newAmt = parseFloat(depositGoal.current_amount) + parseFloat(depositAmt);
    await api.updateGoal(depositGoal.id, { current_amount: newAmt });
    setDepositGoal(null);
    setDepositAmt('');
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteGoal(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Savings Goals</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Goal</button>
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">🎯</div>
            Set your first savings goal to get started!
          </div>
        </div>
      ) : (
        <div className="goals-grid">
          {goals.map(g => {
            const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
            const remaining = g.target_amount - g.current_amount;
            return (
              <div className="goal-card" key={g.id}>
                <div className="goal-header">
                  <div className="goal-name">{g.name}</div>
                  <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => handleDelete(g.id)}>×</button>
                </div>
                <div className="goal-amounts">{fmt(g.current_amount)} of {fmt(g.target_amount)}</div>
                {g.deadline && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    By {new Date(g.deadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: g.color }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="goal-pct" style={{ color: g.color }}>{pct}%</div>
                  {pct < 100 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt(remaining)} to go</div>
                  )}
                  {pct >= 100 && (
                    <span className="badge badge-success">Reached! 🎉</span>
                  )}
                </div>
                {pct < 100 && (
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 12, width: '100%', justifyContent: 'center', fontSize: 13 }}
                    onClick={() => { setDepositGoal(g); setDepositAmt(''); }}
                  >
                    + Add funds
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Savings Goal</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Goal name</label>
                <input className="form-input" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Emergency fund" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target ($)</label>
                  <input className="form-input" required type="number" min="1" step="1" value={form.target_amount}
                    onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="5000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Saved so far ($)</label>
                  <input className="form-input" type="number" min="0" step="1" value={form.current_amount}
                    onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Deadline (optional)</label>
                <input className="form-input" type="date" value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
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
                Create Goal
              </button>
            </form>
          </div>
        </div>
      )}

      {depositGoal && (
        <div className="modal-overlay" onClick={() => setDepositGoal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add funds — {depositGoal.name}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setDepositGoal(null)}>✕</button>
            </div>
            <form onSubmit={handleDeposit}>
              <div className="form-group">
                <label className="form-label">Amount (R)</label>
                <input className="form-input" required type="number" min="0.01" step="0.01"
                  value={depositAmt} onChange={e => setDepositAmt(e.target.value)} placeholder="100" autoFocus />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Add Funds
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
