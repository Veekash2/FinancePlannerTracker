import { useEffect, useState } from 'react'
import { api } from '../storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, fmt, fmtDate } from '../utils/format'
import { suggestCategory } from '../utils/gemini'
import { getAccounts, ACCOUNT_TYPES } from '../utils/accounts'
import { setTxnAccount, removeTxnAccount, getAllTxnAccounts } from '../utils/txnAccounts'
import { saveRecurringTxn, getRecurringTxns, removeRecurringTxn } from '../utils/recurringTxns'
import { exportTransactionsCSV } from '../utils/exportCSV'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Salary', 'Freelance', 'Other']
const INCOME_CATS  = ['Salary', 'Freelance', 'Other']
const EXPENSE_CATS = CATEGORIES.filter(c => c !== 'Salary' && c !== 'Freelance')

const emptyForm = {
  description: '', amount: '', category: 'Food', type: 'expense',
  date: new Date().toISOString().slice(0, 10), accountId: '',
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
  const { user } = useAuth()
  const email = user?.email ?? ''

  const [txns, setTxns]               = useState([])
  const [accounts, setAccounts]       = useState([])
  const [txnAccMap, setTxnAccMap]     = useState({})
  const [recurringTpls, setRecTpls]   = useState([])
  const [showModal, setShowModal]     = useState(false)
  const [editTxn, setEditTxn]         = useState(null)
  const [form, setForm]               = useState(emptyForm)
  const [saveAsRecurring, setSaveAsRecurring] = useState(false)
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [suggesting, setSuggesting]   = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const loadAll = () => {
    api.getTransactions().then(setTxns)
    setRecTpls(getRecurringTxns(email))
  }
  const load = () => api.getTransactions().then(setTxns)
  useEffect(() => {
    loadAll()
    setAccounts(getAccounts(email))
    setTxnAccMap(getAllTxnAccounts(email))
  }, [email])

  const openAdd  = () => { setForm(emptyForm); setEditTxn(null); setSaveAsRecurring(false); setShowModal(true) }
  const openEdit = (t) => {
    setForm({
      description: t.description, amount: String(t.amount),
      category: t.category, type: t.type, date: t.date,
      accountId: txnAccMap[t.id] ?? '',
    })
    setEditTxn(t)
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditTxn(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const body = { ...form, amount: parseFloat(form.amount) }

    // Duplicate check — only on new transactions
    if (!editTxn) {
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const dupe = txns.find(t => {
        const tDate = new Date(t.date)
        return tDate >= sevenDaysAgo &&
          Math.abs(parseFloat(t.amount) - body.amount) < 0.01 &&
          t.description.toLowerCase().slice(0, 10) === body.description.toLowerCase().slice(0, 10)
      })
      if (dupe) {
        const ok = window.confirm(
          `Similar transaction found (${dupe.date}): "${dupe.description}" R${dupe.amount}\n\nAdd anyway?`
        )
        if (!ok) return
      }
    }

    if (editTxn) {
      await api.updateTransaction(editTxn.id, body)
      if (form.accountId) setTxnAccount(email, editTxn.id, form.accountId)
      else removeTxnAccount(email, editTxn.id)
    } else {
      const result = await api.addTransaction(body)
      if (form.accountId && result?.id) setTxnAccount(email, result.id, form.accountId)
      if (saveAsRecurring) saveRecurringTxn(email, { ...form, amount: parseFloat(form.amount) })
    }
    setTxnAccMap(getAllTxnAccounts(email))
    setRecTpls(getRecurringTxns(email))
    closeModal()
    load()
  }

  const handleDelete = async (id) => {
    await api.deleteTransaction(id)
    load()
  }

  const handleAISuggest = async () => {
    if (!form.description.trim()) return
    setSuggesting(true)
    try {
      const cat = await suggestCategory(form.description)
      const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS
      if (cats.includes(cat)) setForm(f => ({ ...f, category: cat }))
    } catch {}
    finally { setSuggesting(false) }
  }

  const visible = txns.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo   && t.date > dateTo)   return false
    return true
  })
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
            onClick={() => exportTransactionsCSV(txns)}>⬇ CSV</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add</button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input className="form-input" placeholder="🔍 Search description or category…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ paddingRight: search ? 36 : undefined }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 16 }}>✕</button>
        )}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'income', 'expense'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: filter === f ? 'var(--accent-glow)' : 'var(--surface)',
            border: '1px solid var(--border)',
            color: filter === f ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={() => setShowFilters(f => !f)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 13,
          background: (dateFrom || dateTo) ? 'var(--accent-glow)' : 'var(--surface)',
          border: '1px solid var(--border)',
          color: (dateFrom || dateTo) ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer',
        }}>
          📅 {showFilters ? 'Hide' : 'Dates'}
        </button>
        {(dateFrom || dateTo) && (
          <button className="btn-text" style={{ fontSize: 12 }}
            onClick={() => { setDateFrom(''); setDateTo('') }}>Clear dates</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{visible.length} shown</span>
      </div>

      {/* Date filter panel */}
      {showFilters && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Recurring templates */}
      {recurringTpls.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🔁 Recurring templates</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recurringTpls.map(tpl => (
              <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tpl.category} · {fmt(tpl.amount)}</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => {
                    setForm({ description: tpl.description, amount: String(tpl.amount), category: tpl.category, type: tpl.type, date: new Date().toISOString().slice(0,10), accountId: tpl.accountId ?? '' })
                    setSaveAsRecurring(false)
                    setEditTxn(null)
                    setShowModal(true)
                  }}>
                  + Re-add
                </button>
                <button className="btn-text" style={{ color: 'var(--red)', fontSize: 16 }}
                  onClick={() => { removeRecurringTxn(email, tpl.id); setRecTpls(getRecurringTxns(email)) }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                      <div className="txn-meta" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{t.category}</span>
                        {(() => {
                          const accId = txnAccMap[t.id]
                          const acc   = accId && accounts.find(a => a.id === accId)
                          const meta  = acc && (ACCOUNT_TYPES[acc.type] ?? ACCOUNT_TYPES.other)
                          return acc ? (
                            <span style={{ fontSize: 10, background: `${meta.color}22`, color: meta.color, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {meta.icon} {acc.name}
                            </span>
                          ) : null
                        })()}
                      </div>
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="form-input"
                    required
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Groceries at Checkers"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost ai-suggest-btn"
                    title="AI: suggest category"
                    onClick={handleAISuggest}
                    disabled={suggesting || !form.description.trim()}
                  >
                    {suggesting ? '…' : '✨'}
                  </button>
                </div>
                {suggesting && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3 }}>Suggesting category…</div>}
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

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {cats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {accounts.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Account</label>
                    <select className="form-input" value={form.accountId}
                      onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                      <option value="">— None —</option>
                      {accounts.map(a => {
                        const meta = ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other
                        return <option key={a.id} value={a.id}>{meta.icon} {a.name}</option>
                      })}
                    </select>
                  </div>
                )}
              </div>

              {!editTxn && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', margin: '10px 0 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={saveAsRecurring} onChange={e => setSaveAsRecurring(e.target.checked)} />
                  Save as recurring template
                </label>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
                {editTxn ? 'Save Changes' : 'Add Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
