import { useEffect, useState } from 'react'
import { api } from '../storage'
import { getAccounts } from '../utils/accounts'
import { useAuth } from '../context/AuthContext'
import { exportCashFlowPDF } from '../utils/exportPDF'

const fmt = n =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n)

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const DEFAULT_INCOME_ROWS = [
  { cat: 'Salary',             label: 'Salary' },
  { cat: 'Freelance',          label: 'Freelance / Side Income' },
  { cat: 'Interest/Dividends', label: 'Interest / Dividends' },
  { cat: 'Rental',             label: 'Rental Income' },
  { cat: 'Business',           label: 'Business Income' },
  { cat: 'Other',              label: 'Other Income' },
]

const DEFAULT_EXPENSE_ROWS = [
  { cat: 'Mortgage/Rent',  label: 'Mortgage / Rent' },
  { cat: 'Food',           label: 'Food & Groceries' },
  { cat: 'Transport',      label: 'Transport' },
  { cat: 'Bills',          label: 'Bills & Utilities' },
  { cat: 'Health',         label: 'Health & Medical' },
  { cat: 'Entertainment',  label: 'Entertainment' },
  { cat: 'Shopping',       label: 'Shopping' },
  { cat: 'Subscriptions',  label: 'Subscriptions' },
  { cat: 'School/Loan',    label: 'Loans / Education' },
  { cat: 'Other',          label: 'Other Expenses' },
]

function monthKey(email, year, month) {
  return `cashflow_${email}_${year}_${month}`
}

function loadSaved(email, year, month) {
  try {
    const raw = localStorage.getItem(monthKey(email, year, month))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveToDisk(email, year, month, data) {
  localStorage.setItem(monthKey(email, year, month), JSON.stringify(data))
}

function monthlySubAmount(sub) {
  const a = parseFloat(sub.amount)
  if (sub.billing_cycle === 'yearly')  return a / 12
  if (sub.billing_cycle === 'weekly')  return a * 4.33
  return a
}

export default function Statement() {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const now   = new Date()

  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [txns,  setTxns]  = useState([])
  const [subs,  setSubs]  = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  // Manual entry state
  const [income,   setIncome]   = useState([])   // [{cat, label, amount: ''}]
  const [expenses, setExpenses] = useState([])
  const [editing,  setEditing]  = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([api.getTransactions(), api.getSubscriptions(), api.getGoals()])
      .then(([t, s, g]) => { setTxns(t); setSubs(s); setGoals(g) })
      .finally(() => setLoading(false))
  }, [])

  // Load saved data when month/year changes
  useEffect(() => {
    const saved = loadSaved(email, year, month)
    if (saved) {
      setIncome(saved.income)
      setExpenses(saved.expenses)
    } else {
      setIncome(DEFAULT_INCOME_ROWS.map(r => ({ ...r, amount: '' })))
      setExpenses(DEFAULT_EXPENSE_ROWS.map(r => ({ ...r, amount: '' })))
    }
    setSaved(false)
    setEditing(false)
  }, [year, month, email])

  const accounts = user?.email ? getAccounts(user.email) : []

  // ── Suggestions from actual transactions ──────────────────────────────────
  const monthTxns = txns.filter(t => {
    const parts = (t.date || '').split('-')
    if (parts.length !== 3) return false
    return parseInt(parts[1], 10) - 1 === month && parseInt(parts[0], 10) === year
  })

  const txnIncomeByCat = {}
  monthTxns.filter(t => t.type === 'income').forEach(t => {
    const c = t.category || 'Other'
    txnIncomeByCat[c] = (txnIncomeByCat[c] || 0) + parseFloat(t.amount)
  })
  const txnExpenseByCat = {}
  monthTxns.filter(t => t.type === 'expense').forEach(t => {
    const c = t.category || 'Other'
    txnExpenseByCat[c] = (txnExpenseByCat[c] || 0) + parseFloat(t.amount)
  })
  const subsCost = subs.reduce((s, sub) => s + monthlySubAmount(sub), 0)
  if (subsCost > 0) txnExpenseByCat['Subscriptions'] = (txnExpenseByCat['Subscriptions'] || 0) + subsCost

  // ── Totals from manual entries ────────────────────────────────────────────
  const totalIncome   = income.reduce((s, r)   => s + (parseFloat(r.amount) || 0), 0)
  const totalExpenses = expenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const cashFlow      = totalIncome - totalExpenses
  const passiveIncome = income.filter(r => r.cat !== 'Salary').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  // ── Assets / Liabilities ──────────────────────────────────────────────────
  const savingsAccounts    = accounts.filter(a => a.type === 'savings')
  const investmentAccounts = accounts.filter(a => a.type === 'investment')
  const creditAccounts     = accounts.filter(a => a.type === 'credit')
  const goalAssets         = goals.map(g => ({ name: g.name, value: g.current_amount, color: g.color }))
  const totalAssets        = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + parseFloat(a.balance || 0), 0)
  const totalLiabilities   = creditAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0)
  const netWorth           = totalAssets - totalLiabilities

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    const next = new Date(year, month + 1)
    if (next > now) return
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    saveToDisk(email, year, month, { income, expenses })
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleEdit = () => setEditing(true)

  const acceptSuggestion = (type, cat) => {
    const val = type === 'income'
      ? Math.round(txnIncomeByCat[cat] || 0)
      : Math.round(txnExpenseByCat[cat] || 0)
    if (!val) return
    if (type === 'income') {
      setIncome(rows => rows.map(r => r.cat === cat ? { ...r, amount: String(val) } : r))
    } else {
      setExpenses(rows => rows.map(r => r.cat === cat ? { ...r, amount: String(val) } : r))
    }
  }

  const acceptAllSuggestions = () => {
    setIncome(rows => rows.map(r => {
      const v = Math.round(txnIncomeByCat[r.cat] || 0)
      return v ? { ...r, amount: String(v) } : r
    }))
    setExpenses(rows => rows.map(r => {
      const v = Math.round(txnExpenseByCat[r.cat] || 0)
      return v ? { ...r, amount: String(v) } : r
    }))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div className="spinner" />
    </div>
  )

  const hasAnySuggestions = Object.keys(txnIncomeByCat).length > 0 || Object.keys(txnExpenseByCat).length > 0

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="page-title">Cash Flow Statement</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {editing ? (
            <>
              {hasAnySuggestions && (
                <button className="btn btn-ghost" style={{ fontSize: 13, color: '#06b6d4', borderColor: 'rgba(6,182,212,.3)' }}
                  onClick={acceptAllSuggestions}>
                  ✦ Use all suggestions
                </button>
              )}
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleSave}>Save</button>
            </>
          ) : (
            <>
              {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Saved</span>}
              <button className="btn btn-ghost" style={{ fontSize: 13 }}
                onClick={() => exportCashFlowPDF({
                  monthName: `${MONTH_NAMES[month]} ${year}`,
                  totalIncome, totalExpenses, cashFlow, passiveIncome, netWorth, totalAssets, totalLiabilities,
                  incomeRows: Object.fromEntries(income.filter(r => r.amount).map(r => [r.label, parseFloat(r.amount)])),
                  expenseRows: Object.fromEntries(expenses.filter(r => r.amount).map(r => [r.label, parseFloat(r.amount)])),
                  savingsGoals: goals.map(g => ({ name: g.name, value: g.current_amount })),
                })}>⬇ PDF</button>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={handleEdit}>✏ Edit</button>
            </>
          )}
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={prevMonth}>‹</button>
          <span style={{ minWidth: 110, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', opacity: isCurrentMonth ? .3 : 1 }}
            onClick={nextMonth} disabled={isCurrentMonth}>›</button>
        </div>
      </div>

      {/* ── Edit mode banner ── */}
      {editing && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10,
          background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.2)', fontSize: 13, color: '#06b6d4' }}>
          ✦ Enter your actual amounts. Cyan suggestions are pulled from your imported transactions — click to use them.
        </div>
      )}

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <SummaryTile label="Total Income"   value={fmt(totalIncome)}   color="var(--green)" />
        <SummaryTile label="Total Expenses" value={fmt(totalExpenses)} color="var(--red)"   />
        <SummaryTile label="Passive Income" value={fmt(passiveIncome)} color="#06b6d4"      />
        <SummaryTile label="Cash Flow"      value={fmt(cashFlow)}
          color={cashFlow >= 0 ? 'var(--green)' : 'var(--red)'} highlight />
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* LEFT: Income */}
        <Section title="INCOME" accent="#22c55e">
          {income.map((row, i) => {
            const suggestion = Math.round(txnIncomeByCat[row.cat] || 0)
            return editing ? (
              <EditRow key={i} row={row} suggestion={suggestion}
                onChange={v => setIncome(rows => rows.map((r, j) => j === i ? { ...r, amount: v } : r))}
                onLabelChange={v => setIncome(rows => rows.map((r, j) => j === i ? { ...r, label: v, cat: v } : r))}
                onAccept={() => acceptSuggestion('income', row.cat)}
                onDelete={() => setIncome(rows => rows.filter((_, j) => j !== i))} />
            ) : row.amount ? (
              <Row key={i} label={row.label} value={fmt(parseFloat(row.amount))} valueColor="#22c55e" />
            ) : null
          })}
          {editing && (
            <button onClick={() => setIncome(rows => [...rows, { cat: 'Custom', label: 'New Income', amount: '' }])}
              style={{ display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left', fontSize: 13,
                color: '#22c55e', background: 'rgba(34,197,94,.05)', border: 'none', borderTop: '1px solid var(--border)',
                cursor: 'pointer', fontWeight: 600 }}>+ Add income row</button>
          )}
          {!editing && income.filter(r => r.amount).length === 0 && (
            <EmptyRow label={<span>No income entered — <button onClick={handleEdit} style={{ color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontSize:13 }}>click Edit to add</button></span>} />
          )}
          <TotalRow label="Total Income" value={fmt(totalIncome)} color="#22c55e" />
        </Section>

        {/* RIGHT: Assets */}
        <Section title="ASSETS" accent="#6366f1">
          {savingsAccounts.length > 0 && (
            <>
              <SubHeader label="Savings / Cash" />
              {savingsAccounts.map(a => <Row key={a.id} label={a.name} value={fmt(a.balance || 0)} />)}
            </>
          )}
          {investmentAccounts.length > 0 && (
            <>
              <SubHeader label="Investments" />
              {investmentAccounts.map(a => <Row key={a.id} label={a.name} value={fmt(a.balance || 0)} />)}
            </>
          )}
          {goalAssets.length > 0 && (
            <>
              <SubHeader label="Savings Goals" />
              {goalAssets.map(g => <Row key={g.name} label={g.name} value={fmt(g.value)} dot={g.color} />)}
            </>
          )}
          {accounts.filter(a => !['credit','investment','savings'].includes(a.type)).map(a => (
            <Row key={a.id} label={a.name} value={fmt(a.balance || 0)} />
          ))}
          {accounts.length === 0 && goalAssets.length === 0 && <EmptyRow label="No assets recorded" />}
          <TotalRow label="Total Assets" value={fmt(totalAssets)} color="#6366f1" />
        </Section>

        {/* LEFT: Expenses */}
        <Section title="EXPENSES" accent="#ef4444">
          {expenses.map((row, i) => {
            const suggestion = Math.round(txnExpenseByCat[row.cat] || 0)
            return editing ? (
              <EditRow key={i} row={row} suggestion={suggestion}
                onChange={v => setExpenses(rows => rows.map((r, j) => j === i ? { ...r, amount: v } : r))}
                onLabelChange={v => setExpenses(rows => rows.map((r, j) => j === i ? { ...r, label: v, cat: v } : r))}
                onAccept={() => acceptSuggestion('expense', row.cat)}
                onDelete={() => setExpenses(rows => rows.filter((_, j) => j !== i))} />
            ) : row.amount ? (
              <Row key={i} label={row.label} value={fmt(parseFloat(row.amount))} valueColor="#ef4444" />
            ) : null
          })}
          {editing && (
            <button onClick={() => setExpenses(rows => [...rows, { cat: 'Custom', label: 'New Expense', amount: '' }])}
              style={{ display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left', fontSize: 13,
                color: '#ef4444', background: 'rgba(239,68,68,.05)', border: 'none', borderTop: '1px solid var(--border)',
                cursor: 'pointer', fontWeight: 600 }}>+ Add expense row</button>
          )}
          {!editing && expenses.filter(r => r.amount).length === 0 && (
            <EmptyRow label={<span>No expenses entered — <button onClick={handleEdit} style={{ color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontSize:13 }}>click Edit to add</button></span>} />
          )}
          <TotalRow label="Total Expenses" value={fmt(totalExpenses)} color="#ef4444" />
        </Section>

        {/* RIGHT: Liabilities */}
        <Section title="LIABILITIES" accent="#f59e0b">
          {creditAccounts.length === 0
            ? <EmptyRow label="No liabilities recorded" />
            : creditAccounts.map(a => <Row key={a.id} label={a.name} value={fmt(a.balance || 0)} valueColor="#f59e0b" />)
          }
          <TotalRow label="Total Liabilities" value={fmt(totalLiabilities)} color="#f59e0b" />
        </Section>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Net Worth (Assets − Liabilities)</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: netWorth >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmt(netWorth)}
          </span>
        </div>
        <div className="card" style={{
          padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          border: `1px solid ${cashFlow >= 0 ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'}`,
          background: cashFlow >= 0 ? 'rgba(34,197,94,.05)' : 'rgba(239,68,68,.05)',
        }}>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Monthly Cash Flow</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: cashFlow >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {cashFlow >= 0 ? '+' : ''}{fmt(cashFlow)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EditRow({ row, suggestion, onChange, onAccept, onDelete, onLabelChange }) {
  return (
    <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={onDelete} title="Remove row"
        style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(239,68,68,.12)', color: '#ef4444', fontSize: 14, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
      <input value={row.label} onChange={e => onLabelChange(e.target.value)}
        className="form-input"
        style={{ flex: 1, padding: '3px 8px', fontSize: 13, height: 28, minWidth: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {suggestion > 0 && (
          <button onClick={onAccept} title="Use suggested value from your transactions"
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'rgba(6,182,212,.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,.3)', fontWeight: 600 }}>
            ✦ {fmt(suggestion)}
          </button>
        )}
        <input type="number" min="0" step="1" value={row.amount}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="form-input"
          style={{ width: 90, padding: '3px 8px', fontSize: 13, height: 28, textAlign: 'right' }} />
      </div>
    </div>
  )
}

function SummaryTile({ label, value, color, highlight }) {
  return (
    <div className="stat-card" style={highlight ? { border: `1px solid ${color}44`, background: `${color}08` } : {}}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color, fontSize: highlight ? 22 : 18 }}>{value}</div>
    </div>
  )
}

function Section({ title, accent, children }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ background: accent, color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '.12em', padding: '10px 16px' }}>
        {title}
      </div>
      <div style={{ padding: '8px 0 4px' }}>{children}</div>
    </div>
  )
}

function SubHeader({ label }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: '.08em',
      textTransform: 'uppercase', padding: '8px 16px 2px' }}>{label}</div>
  )
}

function Row({ label, value, valueColor, dot }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 16px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: 14 }}>
        {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
        {label}
      </span>
      <span style={{ fontWeight: 600, fontSize: 14, color: valueColor || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

function TotalRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 16px', borderTop: '2px solid var(--border)', marginTop: 2 }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 16, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function EmptyRow({ label }) {
  return (
    <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>{label}</div>
  )
}
