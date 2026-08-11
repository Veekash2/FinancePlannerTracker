import { useEffect, useState } from 'react'
import { api } from '../storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, fmt, fmtDate } from '../utils/format'

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Salary', 'Freelance', 'Other']
const INCOME_CATS = ['Salary', 'Freelance', 'Other']
const EXPENSE_CATS = CATEGORIES.filter(c => c !== 'Salary' && c !== 'Freelance')

const emptyForm = {
  description: '', amount: '', category: 'Food', type: 'expense',
  date: new Date().toISOString().slice(0, 10),
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

export default function Transactions() {
  const [txns, setTxns] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState('all')

  const load = () => api.getTransactions().then(setTxns)
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(emptyForm); setEditTxn(null); setShowModal(true) }
  const openEdit = (t) => {
    setForm({ description: t.description, amount: String(t.amount), category: t.category, type: t.type, date: t.date })
    setEditTxn(t)
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditTxn(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const body = { ...form, amount: parseFloat(form.amount) }
    if (editTxn) {
      await api.updateTransaction(editTxn.id, body)
    } else {
      await api.addTransaction(body)
    }
    closeModal()
    load()
  }

  const handleDelete = async (id) => {
    await api.deleteTransaction(id)
    load()
  }

  const visible = txns.filter(t => filter === 'all' || t.type === filter)
  const grouped = visible.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = []
    acc[t.date].push(t)
    return acc
  }, {})

  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all', 'income', 'expense'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
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
                {fmtDate(date)}
              </div>
              <div className="txn-list">
                {items.map(t => (
                  <div className="txn-item" key={t.id}>
                    <div className="txn-icon" style={{ background: `${CATEGORY_COLORS[t.category] ?? '#6366f1'}22` }}>
                      {CATEGORY_ICONS[t.category] ?? '📦'}
                    </div>
                    <div className="txn-info">
                      <div className="txn-desc">{t.description}</div>
                      <div className="txn-meta">{t.category}</div>
                    </div>
                    <div className={`txn-amount ${t.type}`}>
                      {t.type === 'expense' ? '-' : '+'}{fmt(t.amount, 2)}
                    </div>
                    <button className="btn-icon" title="Edit" onClick={() => openEdit(t)}><PencilIcon /></button>
                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleDelete(t.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editTxn ? 'Edit Transaction' : 'Add Transaction'}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={closeModal}>✕</button>
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

            <form onSubmit={handleSubmit}>
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
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                {editTxn ? 'Save Changes' : 'Add Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
