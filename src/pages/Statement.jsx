import { useEffect, useState } from 'react'
import { api } from '../storage'
import { getAccounts } from '../utils/accounts'
import { useAuth } from '../context/AuthContext'
import { exportCashFlowPDF } from '../utils/exportPDF'

const fmt = n =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n)

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Interest/Dividends', 'Rental', 'Business', 'Other']
const EXPENSE_CATEGORIES = ['Taxes', 'Mortgage/Rent', 'School/Loan', 'Car Payment', 'Credit Card', 'Food', 'Transport',
  'Bills', 'Health', 'Entertainment', 'Shopping', 'Subscriptions', 'Other']

function monthlySubAmount(sub) {
  const a = parseFloat(sub.amount)
  if (sub.billing_cycle === 'yearly')  return a / 12
  if (sub.billing_cycle === 'weekly')  return a * 4.33
  return a
}

export default function Statement() {
  const { user } = useAuth()
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())   // 0-indexed
  const [txns,  setTxns]  = useState([])
  const [subs,  setSubs]  = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([api.getTransactions(), api.getSubscriptions(), api.getGoals()])
      .then(([t, s, g]) => { setTxns(t); setSubs(s); setGoals(g) })
      .finally(() => setLoading(false))
  }, [])

  const accounts = user?.email ? getAccounts(user.email) : []

  // Filter to selected month
  const monthTxns = txns.filter(t => {
    // Parse date string directly to avoid UTC→local timezone shift
    const parts = (t.date || '').split('-')
    if (parts.length !== 3) return false
    return parseInt(parts[1], 10) - 1 === month && parseInt(parts[0], 10) === year
  })

  // ── INCOME ──────────────────────────────────────────────────────────────
  const incomeRows = {}
  monthTxns.filter(t => t.type === 'income').forEach(t => {
    const cat = t.category || 'Other'
    incomeRows[cat] = (incomeRows[cat] || 0) + parseFloat(t.amount)
  })

  // ── EXPENSES ────────────────────────────────────────────────────────────
  const expenseRows = {}
  monthTxns.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'Other'
    expenseRows[cat] = (expenseRows[cat] || 0) + parseFloat(t.amount)
  })
  // Add subscriptions as their own group
  const subsCost = subs.reduce((s, sub) => s + monthlySubAmount(sub), 0)
  if (subsCost > 0) expenseRows['Subscriptions'] = (expenseRows['Subscriptions'] || 0) + subsCost

  const totalIncome   = Object.values(incomeRows).reduce((s, v) => s + v, 0)
  const totalExpenses = Object.values(expenseRows).reduce((s, v) => s + v, 0)
  const cashFlow      = totalIncome - totalExpenses

  // Passive income = non-salary income
  const passiveIncome = Object.entries(incomeRows)
    .filter(([k]) => k !== 'Salary')
    .reduce((s, [, v]) => s + v, 0)

  // ── ASSETS ──────────────────────────────────────────────────────────────
  const investmentAccounts = accounts.filter(a => a.type === 'investment')
  const savingsAccounts    = accounts.filter(a => a.type === 'savings')
  const goalAssets = goals.map(g => ({ name: g.name, value: g.current_amount, color: g.color }))

  const totalAssets = accounts
    .filter(a => a.type !== 'credit')
    .reduce((s, a) => s + parseFloat(a.balance || 0), 0)

  // ── LIABILITIES ──────────────────────────────────────────────────────────
  const creditAccounts = accounts.filter(a => a.type === 'credit')
  const totalLiabilities = creditAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0)

  const netWorth = totalAssets - totalLiabilities

  // ── Month navigation ─────────────────────────────────────────────────────
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 80 }}>
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 className="page-title">Cash Flow Statement</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
            onClick={() => exportCashFlowPDF({
              monthName: `${MONTH_NAMES[month]} ${year}`,
              totalIncome, totalExpenses, cashFlow, passiveIncome, netWorth, totalAssets, totalLiabilities,
              incomeRows, expenseRows,
              savingsGoals: goals.map(g => ({ name: g.name, value: g.current_amount })),
            })}>
            ⬇ PDF
          </button>
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={prevMonth}>‹</button>
          <span style={{ minWidth: 110, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', opacity: isCurrentMonth ? .3 : 1 }}
            onClick={nextMonth} disabled={isCurrentMonth}>›</button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <SummaryTile label="Total Income"    value={fmt(totalIncome)}   color="var(--green)" />
        <SummaryTile label="Total Expenses"  value={fmt(totalExpenses)} color="var(--red)"   />
        <SummaryTile label="Passive Income"  value={fmt(passiveIncome)} color="#06b6d4"      />
        <SummaryTile label="Cash Flow"       value={fmt(cashFlow)}
          color={cashFlow >= 0 ? 'var(--green)' : 'var(--red)'}
          highlight
        />
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* LEFT: Income */}
        <Section title="INCOME" accent="#22c55e">
          {Object.keys(incomeRows).length === 0
            ? <EmptyRow label="No income recorded" />
            : Object.entries(incomeRows).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
              <Row key={cat} label={cat} value={fmt(amt)} valueColor="#22c55e" />
            ))
          }
          <TotalRow label="Total Income" value={fmt(totalIncome)} color="#22c55e" />
        </Section>

        {/* RIGHT: Assets */}
        <Section title="ASSETS" accent="#6366f1">
          {savingsAccounts.length > 0 && (
            <>
              <SubHeader label="Savings / Cash" />
              {savingsAccounts.map(a => (
                <Row key={a.id} label={a.name} value={fmt(a.balance || 0)} />
              ))}
            </>
          )}
          {investmentAccounts.length > 0 && (
            <>
              <SubHeader label="Investments" />
              {investmentAccounts.map(a => (
                <Row key={a.id} label={a.name} value={fmt(a.balance || 0)} />
              ))}
            </>
          )}
          {goalAssets.length > 0 && (
            <>
              <SubHeader label="Savings Goals" />
              {goalAssets.map(g => (
                <Row key={g.name} label={g.name} value={fmt(g.value)}
                  dot={g.color} />
              ))}
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
          {Object.keys(expenseRows).length === 0
            ? <EmptyRow label="No expenses recorded" />
            : Object.entries(expenseRows).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
              <Row key={cat} label={cat} value={fmt(amt)} valueColor="#ef4444" />
            ))
          }
          {subsCost > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 0 4px', fontStyle: 'italic' }}>
              * Subscriptions shown as estimated monthly cost
            </div>
          )}
          <TotalRow label="Total Expenses" value={fmt(totalExpenses)} color="#ef4444" />
        </Section>

        {/* RIGHT: Liabilities */}
        <Section title="LIABILITIES" accent="#f59e0b">
          {creditAccounts.length === 0
            ? <EmptyRow label="No liabilities recorded" />
            : creditAccounts.map(a => (
              <Row key={a.id} label={a.name} value={fmt(a.balance || 0)} valueColor="#f59e0b" />
            ))
          }
          <TotalRow label="Total Liabilities" value={fmt(totalLiabilities)} color="#f59e0b" />
        </Section>
      </div>

      {/* ── Net Worth & Cash Flow footer ── */}
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
      <div style={{
        background: accent, color: '#fff', fontWeight: 800,
        fontSize: 13, letterSpacing: '.12em', padding: '10px 16px',
      }}>
        {title}
      </div>
      <div style={{ padding: '8px 0 4px' }}>
        {children}
      </div>
    </div>
  )
}

function SubHeader({ label }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: '.08em',
      textTransform: 'uppercase', padding: '8px 16px 2px' }}>
      {label}
    </div>
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
    <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
      {label}
    </div>
  )
}
