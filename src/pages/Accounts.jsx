import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAccounts, addAccount, updateAccount, deleteAccount, ACCOUNT_TYPES } from '../utils/accounts'
import { fmt } from '../utils/format'

const EMPTY = { name: '', type: 'cheque', balance: '' }

export default function Accounts() {
  const { user } = useAuth()
  const email = user?.email ?? ''

  const [accounts, setAccounts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)   // account id being edited
  const [form, setForm] = useState(EMPTY)
  const [editBalance, setEditBalance] = useState({}) // { id: newBalanceStr }

  useEffect(() => { setAccounts(getAccounts(email)) }, [email])

  const reload = () => setAccounts(getAccounts(email))

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(acc) {
    setEditing(acc.id)
    setForm({ name: acc.name, type: acc.type, balance: String(acc.balance) })
    setShowModal(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    const balance = parseFloat(form.balance) || 0
    if (editing) {
      updateAccount(email, editing, { name: form.name.trim(), type: form.type, balance })
    } else {
      addAccount(email, { name: form.name.trim(), type: form.type, balance })
    }
    setShowModal(false)
    reload()
  }

  function handleDelete(id) {
    if (!window.confirm('Remove this account?')) return
    deleteAccount(email, id)
    reload()
  }

  function startEditBalance(acc) {
    setEditBalance(eb => ({ ...eb, [acc.id]: String(acc.balance) }))
  }

  function saveBalance(acc) {
    const val = parseFloat(editBalance[acc.id])
    if (!isNaN(val)) {
      updateAccount(email, acc.id, { balance: val })
      reload()
    }
    setEditBalance(eb => { const n = { ...eb }; delete n[acc.id]; return n })
  }

  const totalAssets = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + (a.balance || 0), 0)
  const totalDebt   = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + (a.balance || 0), 0)
  const netWorth    = totalAssets - totalDebt

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add account</button>
      </div>

      {/* Net worth summary */}
      {accounts.length > 0 && (
        <div className="accounts-summary">
          <div className="acc-summary-card">
            <div className="acc-summary-label">Net Worth</div>
            <div className={`acc-summary-value ${netWorth >= 0 ? 'green' : 'red'}`}>{fmt(netWorth)}</div>
          </div>
          <div className="acc-summary-card">
            <div className="acc-summary-label">Total Assets</div>
            <div className="acc-summary-value green">{fmt(totalAssets)}</div>
          </div>
          <div className="acc-summary-card">
            <div className="acc-summary-label">Total Debt</div>
            <div className="acc-summary-value red">{fmt(totalDebt)}</div>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty" style={{ marginTop: 60 }}>
          <div className="empty-icon">🏦</div>
          <p>No accounts yet. Add your FNB cheque, savings, or credit card accounts to track your net worth.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAdd}>Add first account</button>
        </div>
      ) : (
        <div className="accounts-list">
          {accounts.map(acc => {
            const meta = ACCOUNT_TYPES[acc.type] ?? ACCOUNT_TYPES.other
            const inlineEdit = acc.id in editBalance
            return (
              <div className="account-card" key={acc.id}>
                <div className="account-card-left">
                  <div className="account-icon" style={{ background: `${meta.color}22`, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div>
                    <div className="account-name">{acc.name}</div>
                    <div className="account-type">{meta.label} · Updated {acc.updated ?? '—'}</div>
                  </div>
                </div>
                <div className="account-card-right">
                  {inlineEdit ? (
                    <div className="account-balance-edit">
                      <span style={{ color: 'var(--muted)', fontSize: 14 }}>R</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editBalance[acc.id]}
                        onChange={e => setEditBalance(eb => ({ ...eb, [acc.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') saveBalance(acc); if (e.key === 'Escape') setEditBalance(eb => { const n = { ...eb }; delete n[acc.id]; return n }) }}
                        autoFocus
                        className="account-balance-input"
                      />
                      <button className="btn-icon" title="Save" onClick={() => saveBalance(acc)}>✓</button>
                    </div>
                  ) : (
                    <div
                      className={`account-balance ${acc.type === 'credit' ? 'red' : ''}`}
                      title="Click to update balance"
                      onClick={() => startEditBalance(acc)}
                      style={{ cursor: 'pointer' }}
                    >
                      {fmt(acc.balance ?? 0)}
                      <span className="account-edit-hint"> ✎</span>
                    </div>
                  )}
                  <div className="account-actions">
                    <button className="btn-icon" onClick={() => openEdit(acc)}>✎</button>
                    <button className="btn-icon danger" onClick={() => handleDelete(acc.id)}>✕</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tip card */}
      {accounts.length > 0 && (
        <div className="card" style={{ marginTop: 16, borderColor: 'rgba(99,102,241,.3)', background: 'rgba(99,102,241,.05)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            💡 <strong style={{ color: 'var(--text)' }}>Tip:</strong> After importing transactions from a bank CSV, your account balance is automatically updated to the closing balance in the file. You can also click any balance to edit it manually.
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit account' : 'Add account'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Account name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. FNB Cheque, FNB Gold Savings…"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Current balance (R)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.balance}
                  onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editing ? 'Save changes' : 'Add account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
