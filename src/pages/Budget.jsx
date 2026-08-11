import { useEffect, useState } from 'react'
import { api } from '../storage'
import { fmt } from '../utils/format'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../utils/format'
import { getAccounts, ACCOUNT_TYPES } from '../utils/accounts'
import { getBudgets, setBudget, getEnvelopes, saveEnvelopes } from '../utils/budgets'
import { useAuth } from '../context/AuthContext'

const EXPENSE_CATS = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Other']

// ── Category Budgets tab ─────────────────────────────────────────────────────
function CategoryBudgets({ email, txns }) {
  const [budgets, setBudgetsState] = useState(getBudgets(email))
  const [editing, setEditing]      = useState(null)
  const [input, setInput]          = useState('')
  const [addCat, setAddCat]        = useState('')

  const now = new Date()
  const thisMonth = txns.filter(t => {
    const d = new Date(t.date)
    return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const spent = {}
  thisMonth.forEach(t => { spent[t.category] = (spent[t.category] || 0) + parseFloat(t.amount) })

  const reload = () => setBudgetsState(getBudgets(email))
  const save   = (cat, val) => { setBudget(email, cat, parseFloat(val) || 0); reload(); setEditing(null) }
  const remove = (cat)      => { setBudget(email, cat, 0); reload() }

  const budgetCats = Object.keys(budgets)
  const allSpentCats = Object.keys(spent).filter(c => !budgetCats.includes(c))
  const remaining = EXPENSE_CATS.filter(c => !budgetCats.includes(c))

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        Set monthly spend limits per category. You'll see your progress and get warned when you're close.
      </p>

      {/* Budget rows */}
      {budgetCats.length === 0 && (
        <div className="empty" style={{ padding: '20px 0' }}>
          <div className="empty-icon">📋</div>
          No category budgets yet — add one below.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        {budgetCats.map(cat => {
          const limit  = budgets[cat]
          const used   = spent[cat] || 0
          const pct    = Math.min((used / limit) * 100, 100)
          const over   = used > limit
          const near   = !over && pct >= 80
          const color  = over ? 'var(--red)' : near ? 'var(--yellow)' : CATEGORY_COLORS[cat] ?? 'var(--accent)'
          const isEdit = editing === cat

          return (
            <div key={cat} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat] ?? '📦'}</span>
                  <span style={{ fontWeight: 700 }}>{cat}</span>
                  {over && <span style={{ fontSize: 11, background: 'rgba(239,68,68,.15)', color: 'var(--red)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Over budget!</span>}
                  {near && <span style={{ fontSize: 11, background: 'rgba(245,158,11,.15)', color: 'var(--yellow)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Nearly full</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-text" style={{ fontSize: 12 }} onClick={() => { setEditing(cat); setInput(String(limit)) }}>✎</button>
                  <button className="btn-text" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => remove(cat)}>×</button>
                </div>
              </div>
              {isEdit ? (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>R</span>
                  <input className="form-input" type="number" min="1" autoFocus value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') save(cat, input); if (e.key === 'Escape') setEditing(null) }}
                    style={{ flex: 1, padding: '6px 10px', fontSize: 14 }} />
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => save(cat, input)}>Save</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                  <span style={{ color: over ? 'var(--red)' : 'var(--text)', fontWeight: 600 }}>{fmt(used, 2)} spent</span>
                  <span>of {fmt(limit)} limit</span>
                </div>
              )}
              <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, textAlign: 'right' }}>
                {over ? `${fmt(used - limit)} over` : `${fmt(limit - used)} remaining`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Untracked spending */}
      {allSpentCats.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Spent without a budget limit:</div>
          {allSpentCats.map(cat => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>{CATEGORY_ICONS[cat] ?? '📦'} {cat}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{fmt(spent[cat])}</span>
                <button className="btn-text" style={{ fontSize: 12 }}
                  onClick={() => { setAddCat(cat); setInput(String(Math.ceil(spent[cat] * 1.2))) }}>+ Set limit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add a new category budget */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Add category budget</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="form-input" value={addCat} onChange={e => setAddCat(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
            <option value="">— Category —</option>
            {remaining.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 160 }}>
            <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>R</span>
            <input className="form-input" type="number" min="1" placeholder="Monthly limit"
              value={addCat ? input : ''}
              onChange={e => setInput(e.target.value)}
              style={{ flex: 1 }} />
            <button className="btn btn-primary" style={{ padding: '8px 14px' }}
              disabled={!addCat || !input}
              onClick={() => { save(addCat, input); setAddCat(''); setInput('') }}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Budget Envelopes tab ─────────────────────────────────────────────────────
function BudgetEnvelopes({ email }) {
  const [envelopes, setEnvelopesState] = useState(getEnvelopes(email))
  const [salary, setSalary]            = useState(() => parseFloat(localStorage.getItem(`fp_envelope_salary_${email}`) || 0))
  const [editSalary, setEditSalary]    = useState(false)
  const [salaryInput, setSalaryInput]  = useState('')
  const [newName, setNewName]          = useState('')
  const [newAmt, setNewAmt]            = useState('')

  const persist = (updated) => { saveEnvelopes(email, updated); setEnvelopesState(updated) }
  const saveSalary = () => {
    const v = parseFloat(salaryInput) || 0
    localStorage.setItem(`fp_envelope_salary_${email}`, String(v))
    setSalary(v)
    setEditSalary(false)
  }

  const allocated   = envelopes.reduce((s, e) => s + (e.amount || 0), 0)
  const unallocated = salary - allocated

  const updateAmt = (id, val) => {
    persist(envelopes.map(e => e.id === id ? { ...e, amount: parseFloat(val) || 0 } : e))
  }
  const remove = (id) => persist(envelopes.filter(e => e.id !== id))
  const addEnvelope = () => {
    if (!newName.trim()) return
    persist([...envelopes, { id: String(Date.now()), name: newName.trim(), amount: parseFloat(newAmt) || 0 }])
    setNewName(''); setNewAmt('')
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        Allocate your salary into named buckets so every rand has a job.
      </p>

      {/* Salary */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Monthly income</span>
          {!editSalary && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{fmt(salary)}</span>
              <button className="btn-text" style={{ fontSize: 12 }} onClick={() => { setSalaryInput(String(salary)); setEditSalary(true) }}>✎</button>
            </div>
          )}
        </div>
        {editSalary && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)' }}>R</span>
            <input className="form-input" type="number" autoFocus value={salaryInput}
              onChange={e => setSalaryInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveSalary(); if (e.key === 'Escape') setEditSalary(false) }}
              style={{ flex: 1 }} />
            <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={saveSalary}>Save</button>
          </div>
        )}
      </div>

      {/* Envelopes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {envelopes.map(env => {
          const pct = salary > 0 ? Math.min((env.amount / salary) * 100, 100) : 0
          return (
            <div key={env.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{env.name}</span>
                  <span style={{ color: 'var(--muted)' }}>{fmt(env.amount)} ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3 }} />
                </div>
              </div>
              <input className="form-input" type="number" value={env.amount}
                onChange={e => updateAmt(env.id, e.target.value)}
                style={{ width: 90, padding: '4px 8px', fontSize: 13 }} />
              <button className="btn-text" style={{ color: 'var(--red)', fontSize: 16 }} onClick={() => remove(env.id)}>×</button>
            </div>
          )
        })}
      </div>

      {/* Unallocated */}
      {salary > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: unallocated < 0 ? 'rgba(239,68,68,.1)' : unallocated === 0 ? 'rgba(34,197,94,.1)' : 'rgba(99,102,241,.1)',
          border: `1px solid ${unallocated < 0 ? 'rgba(239,68,68,.3)' : unallocated === 0 ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.3)'}`,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {unallocated < 0 ? '⚠️ Over-allocated' : unallocated === 0 ? '✅ Fully allocated' : '📦 Unallocated'}
          </span>
          <span style={{ fontWeight: 800, color: unallocated < 0 ? 'var(--red)' : unallocated === 0 ? 'var(--green)' : 'var(--accent)' }}>
            {fmt(Math.abs(unallocated))}
          </span>
        </div>
      )}

      {/* Add envelope */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Envelope name (e.g. Rent)" value={newName}
          onChange={e => setNewName(e.target.value)} style={{ flex: 2, minWidth: 140 }} />
        <input className="form-input" type="number" placeholder="Amount" value={newAmt}
          onChange={e => setNewAmt(e.target.value)} style={{ flex: 1, minWidth: 90 }} />
        <button className="btn btn-primary" onClick={addEnvelope} disabled={!newName.trim()}>Add</button>
      </div>
    </div>
  )
}

// ── Cash Flow Forecast tab ────────────────────────────────────────────────────
function CashFlowForecast({ txns, subs, email }) {
  const income = parseFloat(localStorage.getItem(`fp_income_${email}`) || 0)
  const now = new Date()

  // Avg monthly spend per category over last 3 months
  const avgSpend = {}
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const m = d.getMonth(), y = d.getFullYear()
    txns.filter(t => {
      const td = new Date(t.date)
      return t.type === 'expense' && td.getMonth() === m && td.getFullYear() === y
    }).forEach(t => {
      avgSpend[t.category] = (avgSpend[t.category] || 0) + parseFloat(t.amount) / 3
    })
  }

  // Next month subscriptions
  const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const subsNextMonth = subs.reduce((s, sub) => {
    if (sub.billing_cycle === 'monthly') return s + parseFloat(sub.amount)
    if (sub.billing_cycle === 'yearly')  return s + parseFloat(sub.amount) / 12
    if (sub.billing_cycle === 'weekly')  return s + parseFloat(sub.amount) * 4.33
    return s
  }, 0)

  const projectedExpenses = Object.values(avgSpend).reduce((s, v) => s + v, 0) + subsNextMonth
  const projectedBalance  = income - projectedExpenses

  const nextMonthName = nextM.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        Projection for <strong style={{ color: 'var(--text)' }}>{nextMonthName}</strong> based on your last 3 months of spending + subscriptions.
      </p>

      <div className="grid-2col" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Expected income</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>
            {income > 0 ? fmt(income) : '—'}
          </div>
          {income === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Set your income in Overview</div>}
        </div>
        <div className="card">
          <div className="card-title">Projected spend</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--red)' }}>{fmt(projectedExpenses)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Projected balance</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: projectedBalance >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>
          {income > 0 ? fmt(projectedBalance) : '—'}
        </div>
        {income > 0 && projectedBalance < 0 && (
          <div style={{ fontSize: 13, color: 'var(--red)', padding: '10px 14px', background: 'rgba(239,68,68,.1)', borderRadius: 8 }}>
            ⚠️ Based on your spending patterns, you may overspend by {fmt(Math.abs(projectedBalance))} next month.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>Projected breakdown</div>
        {Object.entries(avgSpend).sort((a, b) => b[1] - a[1]).map(([cat, avg]) => (
          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>{CATEGORY_ICONS[cat] ?? '📦'} {cat}</span>
            <span style={{ fontWeight: 600 }}>{fmt(avg)}</span>
          </div>
        ))}
        {subsNextMonth > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>🔁 Subscriptions</span>
            <span style={{ fontWeight: 600 }}>{fmt(subsNextMonth)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Debt Payoff Planner tab ───────────────────────────────────────────────────
function DebtPlanner({ accounts, email }) {
  const creditAccounts = accounts.filter(a => a.type === 'credit' && (a.balance || 0) > 0)

  const rateKey = (id) => `fp_debtrate_${email}_${id}`
  const pmtKey  = (id) => `fp_debtpmt_${email}_${id}`

  const [rates, setRates] = useState(() => {
    const r = {}
    creditAccounts.forEach(a => { r[a.id] = parseFloat(localStorage.getItem(rateKey(a.id)) || 20) })
    return r
  })
  const [pmts, setPmts] = useState(() => {
    const p = {}
    creditAccounts.forEach(a => { p[a.id] = parseFloat(localStorage.getItem(pmtKey(a.id)) || Math.max(a.balance * 0.02, 100).toFixed(0)) })
    return p
  })

  const setRate = (id, v) => { localStorage.setItem(rateKey(id), v); setRates(r => ({ ...r, [id]: parseFloat(v) || 0 })) }
  const setPmt  = (id, v) => { localStorage.setItem(pmtKey(id), v); setPmts(p => ({ ...p, [id]: parseFloat(v) || 0 })) }

  const calcPayoff = (balance, annualRate, monthlyPayment) => {
    if (!monthlyPayment || monthlyPayment <= 0) return null
    const r = (annualRate / 100) / 12
    if (r === 0) {
      const months = Math.ceil(balance / monthlyPayment)
      return { months, totalInterest: 0 }
    }
    if (monthlyPayment <= balance * r) return null // payment doesn't cover interest
    const months = Math.ceil(-Math.log(1 - (balance * r) / monthlyPayment) / Math.log(1 + r))
    const totalPaid = months * monthlyPayment
    return { months, totalInterest: totalPaid - balance }
  }

  if (creditAccounts.length === 0) {
    return (
      <div className="empty" style={{ paddingTop: 40 }}>
        <div className="empty-icon">💳</div>
        No credit accounts with a balance. Add credit accounts in the Accounts page.
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        Enter your interest rate and monthly payment to see when you'll be debt-free.
      </p>
      {creditAccounts.map(acc => {
        const meta    = ACCOUNT_TYPES[acc.type] ?? ACCOUNT_TYPES.credit
        const rate    = rates[acc.id] || 20
        const pmt     = pmts[acc.id] || Math.max((acc.balance || 0) * 0.02, 100)
        const result  = calcPayoff(acc.balance || 0, rate, pmt)
        const payoffDate = result ? new Date(new Date().getFullYear(), new Date().getMonth() + result.months).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null

        return (
          <div className="card" key={acc.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${meta.color}22`, fontSize: 18 }}>
                {meta.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{acc.name}</div>
                <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{fmt(acc.balance || 0)} owed</div>
              </div>
            </div>

            <div className="grid-2col" style={{ marginBottom: 12, gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Annual interest rate (%)</label>
                <input className="form-input" type="number" min="0" max="100" step="0.1"
                  value={rates[acc.id] ?? 20}
                  onChange={e => setRate(acc.id, e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Monthly payment (R)</label>
                <input className="form-input" type="number" min="1" step="10"
                  value={pmts[acc.id] ?? Math.max((acc.balance || 0) * 0.02, 100).toFixed(0)}
                  onChange={e => setPmt(acc.id, e.target.value)} />
              </div>
            </div>

            {result ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ textAlign: 'center', padding: '10px', background: 'var(--surface2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Months</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{result.months}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px', background: 'var(--surface2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Paid off</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{payoffDate}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px', background: 'var(--surface2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Total interest</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{fmt(result.totalInterest)}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--red)', padding: '10px 14px', background: 'rgba(239,68,68,.1)', borderRadius: 8 }}>
                ⚠️ Monthly payment doesn't cover the interest. Increase your payment.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Emergency Fund tab ────────────────────────────────────────────────────────
function EmergencyFund({ txns, accounts }) {
  const savingsAccounts = accounts.filter(a => a.type === 'savings' || a.type === 'cheque')
  const totalSavings    = savingsAccounts.reduce((s, a) => s + (a.balance || 0), 0)

  const now = new Date()
  // Avg monthly expenses over last 3 months
  let monthlyAvg = 0
  let count = 0
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const m = d.getMonth(), y = d.getFullYear()
    const monthExp = txns.filter(t => {
      const td = new Date(t.date)
      return t.type === 'expense' && td.getMonth() === m && td.getFullYear() === y
    }).reduce((s, t) => s + parseFloat(t.amount), 0)
    if (monthExp > 0) { monthlyAvg += monthExp; count++ }
  }
  if (count > 0) monthlyAvg /= count

  const monthsCovered = monthlyAvg > 0 ? totalSavings / monthlyAvg : 0
  const target3m = monthlyAvg * 3
  const target6m = monthlyAvg * 6
  const pct3m    = Math.min((totalSavings / target3m) * 100, 100)

  const statusColor = monthsCovered >= 6 ? 'var(--green)' : monthsCovered >= 3 ? 'var(--yellow)' : 'var(--red)'
  const statusLabel = monthsCovered >= 6 ? '✅ Excellent' : monthsCovered >= 3 ? '🟡 Good' : monthsCovered >= 1 ? '⚠️ Building' : '🔴 Critical'

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        Financial advisors recommend 3–6 months of expenses in an emergency fund.
      </p>

      <div className="grid-2col" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Avg monthly expenses</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>
            {monthlyAvg > 0 ? fmt(monthlyAvg) : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>based on last 3 months</div>
        </div>
        <div className="card">
          <div className="card-title">Liquid savings</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{fmt(totalSavings)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>cheque + savings accounts</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Emergency fund coverage</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: statusColor, marginBottom: 4 }}>
          {monthsCovered.toFixed(1)}
        </div>
        <div style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 12 }}>months</div>
        <span style={{
          display: 'inline-block', fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 20,
          background: monthsCovered >= 6 ? 'rgba(34,197,94,.15)' : monthsCovered >= 3 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)',
          color: statusColor,
        }}>
          {statusLabel}
        </span>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            <span>3-month goal: {fmt(target3m)}</span>
            <span>{pct3m.toFixed(0)}%</span>
          </div>
          <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct3m}%`, background: statusColor, borderRadius: 5, transition: 'width .5s' }} />
          </div>
          {monthlyAvg > 0 && totalSavings < target3m && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              {fmt(target3m - totalSavings)} more needed for 3 months · {fmt(target6m - totalSavings)} for 6 months
            </div>
          )}
        </div>
      </div>

      {savingsAccounts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10 }}>
          💡 Add your savings and cheque account balances in the Accounts page to track your emergency fund.
        </div>
      )}
    </div>
  )
}

// ── Main Budget page ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'budgets',   label: '📋 Budgets'  },
  { id: 'envelopes', label: '📦 Envelopes' },
  { id: 'forecast',  label: '🔮 Forecast' },
  { id: 'debt',      label: '💳 Debt'     },
  { id: 'emergency', label: '🏥 Emergency' },
]

export default function Budget() {
  const { user } = useAuth()
  const email    = user?.email ?? ''

  const [tab, setTab]       = useState('budgets')
  const [txns, setTxns]     = useState([])
  const [subs, setSubs]     = useState([])
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    api.getTransactions().then(setTxns)
    api.getSubscriptions().then(setSubs)
    setAccounts(getAccounts(email))
  }, [email])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Budget</h1>
      </div>

      {/* Tab bar */}
      <div className="budget-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`budget-tab${tab === t.id ? ' budget-tab--active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === 'budgets'   && <CategoryBudgets email={email} txns={txns} />}
        {tab === 'envelopes' && <BudgetEnvelopes email={email} />}
        {tab === 'forecast'  && <CashFlowForecast txns={txns} subs={subs} email={email} />}
        {tab === 'debt'      && <DebtPlanner accounts={accounts} email={email} />}
        {tab === 'emergency' && <EmergencyFund txns={txns} accounts={accounts} />}
      </div>
    </div>
  )
}
