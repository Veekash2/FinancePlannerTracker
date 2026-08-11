import { useEffect, useState } from 'react'
import { api } from '../storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, fmt } from '../utils/format'
import { getAccounts, ACCOUNT_TYPES, getManualIncome, saveManualIncome } from '../utils/accounts'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const email = user?.email ?? ''

  const [summary, setSummary]         = useState(null)
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts]       = useState([])
  const [manualIncome, setManualIncome] = useState(0)
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput, setIncomeInput] = useState('')

  useEffect(() => {
    api.getSummary().then(setSummary)
    api.getTransactions().then(d => setTransactions(d.slice(0, 8)))
    setAccounts(getAccounts(email))
    setManualIncome(getManualIncome(email))
  }, [email])

  // Effective income: manual override takes precedence if set
  const effectiveIncome  = manualIncome > 0 ? manualIncome : (summary?.income ?? 0)
  const effectiveBalance = effectiveIncome - (summary?.expenses ?? 0)
  const savingsRate      = effectiveIncome > 0
    ? Math.round((effectiveBalance / effectiveIncome) * 100)
    : null

  const cats = summary?.spendingByCategory ?? {}
  const maxCat = Math.max(...Object.values(cats), 1)

  function openIncomeEdit() {
    setIncomeInput(String(manualIncome || summary?.income || ''))
    setEditingIncome(true)
  }
  function saveIncome() {
    const val = parseFloat(incomeInput) || 0
    saveManualIncome(email, val)
    setManualIncome(val)
    setEditingIncome(false)
  }
  function clearIncome() {
    saveManualIncome(email, 0)
    setManualIncome(0)
    setEditingIncome(false)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="stats-grid">
        {/* Balance — derived, not editable */}
        <div className="stat-card">
          <div className="stat-label">Balance</div>
          <div className={`stat-value ${effectiveBalance >= 0 ? 'green' : 'red'}`}>
            {summary ? fmt(effectiveBalance) : '—'}
          </div>
        </div>

        {/* Income — editable */}
        <div className="stat-card stat-card--editable" onClick={!editingIncome ? openIncomeEdit : undefined}
          title="Click to set your monthly income">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Income
            {manualIncome > 0
              ? <span style={{ fontSize: 10, background: 'rgba(99,102,241,.18)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>manual</span>
              : <span style={{ fontSize: 11, color: 'var(--muted)', opacity: .7 }}>✎</span>
            }
          </div>
          {editingIncome ? (
            <div className="income-edit-row" onClick={e => e.stopPropagation()}>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>R</span>
              <input
                className="income-edit-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 25000"
                value={incomeInput}
                onChange={e => setIncomeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveIncome(); if (e.key === 'Escape') setEditingIncome(false) }}
                autoFocus
              />
              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={saveIncome}>Save</button>
              {manualIncome > 0 && (
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={clearIncome}>Clear</button>
              )}
            </div>
          ) : (
            <div className="stat-value green">{summary ? fmt(effectiveIncome) : '—'}</div>
          )}
        </div>

        {/* Spent */}
        <div className="stat-card">
          <div className="stat-label">Spent</div>
          <div className="stat-value red">{summary ? fmt(summary.expenses) : '—'}</div>
        </div>
      </div>

      {manualIncome > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, marginTop: -8 }}>
          Income set manually. <button className="btn-text" style={{ fontSize: 12 }} onClick={openIncomeEdit}>Edit</button> · <button className="btn-text" style={{ fontSize: 12 }} onClick={clearIncome}>Use calculated</button>
        </div>
      )}

      {/* Accounts widget */}
      {accounts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>My Accounts</div>
          <div className="dash-accounts-grid">
            {accounts.map(acc => {
              const meta = ACCOUNT_TYPES[acc.type] ?? ACCOUNT_TYPES.other
              return (
                <div className="dash-account-item" key={acc.id}>
                  <div className="dash-acc-icon" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dash-acc-name">{acc.name}</div>
                    <div className="dash-acc-type">{meta.label}</div>
                  </div>
                  <div className={`dash-acc-bal ${acc.type === 'credit' ? 'red' : 'green'}`}>{fmt(acc.balance ?? 0)}</div>
                </div>
              )
            })}
          </div>
          {(() => {
            const assets = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + (a.balance || 0), 0)
            const debt   = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + (a.balance || 0), 0)
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Net worth</span>
                <span style={{ fontWeight: 700, color: (assets - debt) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(assets - debt)}</span>
              </div>
            )
          })()}
        </div>
      )}

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
            {savingsRate !== null ? `${savingsRate}%` : '—'}
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
                    {t.type === 'expense' ? '-' : '+'}{fmt(t.amount, 2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
