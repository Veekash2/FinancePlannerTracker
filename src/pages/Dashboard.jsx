import { useEffect, useState } from 'react'
import { api } from '../storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, fmt } from '../utils/format'
import { getAccounts, ACCOUNT_TYPES, getManualIncome, saveManualIncome } from '../utils/accounts'
import { getSetting, setSetting } from '../utils/settings'
import { useAuth } from '../context/AuthContext'

// ── Spending heatmap (last 13 weeks) ────────────────────────────────────────
function SpendHeatmap({ txns }) {
  const spendMap = {}
  txns.forEach(t => {
    if (t.type === 'expense') {
      spendMap[t.date] = (spendMap[t.date] || 0) + parseFloat(t.amount)
    }
  })

  const today = new Date(); today.setHours(0, 0, 0, 0)
  // Build 91-day grid starting from a Monday
  const startOffset = (today.getDay() + 6) % 7  // days since last Monday
  const gridStart = new Date(today)
  gridStart.setDate(gridStart.getDate() - startOffset - 84) // 13 weeks back

  const cells = []
  for (let i = 0; i < 91; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    cells.push({ dateStr, spend: spendMap[dateStr] || 0, isToday: dateStr === today.toISOString().slice(0, 10) })
  }

  const maxSpend = Math.max(...cells.map(c => c.spend), 1)

  const intensity = (spend) => {
    if (spend === 0) return 0
    const r = spend / maxSpend
    if (r < 0.25) return 1
    if (r < 0.5)  return 2
    if (r < 0.75) return 3
    return 4
  }

  const COLORS = ['var(--surface2)', 'rgba(99,102,241,.25)', 'rgba(99,102,241,.5)', 'rgba(99,102,241,.75)', '#6366f1']
  const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // Group into weeks (columns of 7)
  const weeks = []
  for (let w = 0; w < 13; w++) weeks.push(cells.slice(w * 7, w * 7 + 7))

  return (
    <div>
      <div style={{ display: 'flex', gap: 3 }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
          {DOW.map((d, i) => (
            <div key={i} style={{ height: 12, fontSize: 9, color: 'var(--muted)', lineHeight: '12px', width: 10 }}>{d}</div>
          ))}
        </div>
        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map((cell, di) => (
              <div
                key={di}
                title={cell.spend > 0 ? `${cell.dateStr}: ${fmt(cell.spend, 2)}` : cell.dateStr}
                style={{
                  width: 12, height: 12,
                  borderRadius: 3,
                  background: COLORS[intensity(cell.spend)],
                  outline: cell.isToday ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
        <span>Less</span>
        {COLORS.map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
        <span>More</span>
      </div>
    </div>
  )
}

// ── Month-over-month comparison ──────────────────────────────────────────────
function MonthComparison({ allTxns }) {
  const now = new Date()
  const thisM = now.getMonth(), thisY = now.getFullYear()
  const lastM = thisM === 0 ? 11 : thisM - 1
  const lastY = thisM === 0 ? thisY - 1 : thisY

  const buckets = { this: {}, last: {} }
  allTxns.forEach(t => {
    if (t.type !== 'expense') return
    const d = new Date(t.date)
    const m = d.getMonth(), y = d.getFullYear()
    const bucket = (m === thisM && y === thisY) ? 'this' : (m === lastM && y === lastY) ? 'last' : null
    if (!bucket) return
    buckets[bucket][t.category] = (buckets[bucket][t.category] || 0) + parseFloat(t.amount)
  })

  const cats = [...new Set([...Object.keys(buckets.this), ...Object.keys(buckets.last)])]
    .sort((a, b) => (buckets.this[b] || 0) - (buckets.this[a] || 0))
    .slice(0, 5)

  if (!cats.length) return <div className="empty" style={{ padding: 0 }}><div className="empty-icon" style={{ fontSize: 24 }}>📊</div>No data yet</div>

  const lastMonthName = new Date(lastY, lastM).toLocaleDateString('en-US', { month: 'short' })
  const thisMonthName = new Date(thisY, thisM).toLocaleDateString('en-US', { month: 'short' })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 8, fontSize: 11, color: 'var(--muted)' }}>
        <span>{lastMonthName}</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{thisMonthName}</span>
      </div>
      {cats.map(cat => {
        const cur  = buckets.this[cat] || 0
        const prev = buckets.last[cat] || 0
        const diff = prev > 0 ? ((cur - prev) / prev) * 100 : null
        return (
          <div key={cat} className="mom-row">
            <div className="mom-cat">{CATEGORY_ICONS[cat] ?? '📦'} {cat}</div>
            <div className="mom-prev">{prev > 0 ? fmt(prev) : '—'}</div>
            <div className="mom-cur">{fmt(cur)}</div>
            <div className={`mom-delta ${diff === null ? '' : diff > 0 ? 'red' : 'green'}`}>
              {diff === null ? '' : `${diff > 0 ? '↑' : '↓'}${Math.abs(Math.round(diff))}%`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const email = user?.email ?? ''

  const [summary, setSummary]           = useState(null)
  const [allTxns, setAllTxns]           = useState([])
  const [recentTxns, setRecentTxns]     = useState([])
  const [accounts, setAccounts]         = useState([])
  const [manualIncome, setManualIncome] = useState(0)
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput, setIncomeInput]   = useState('')
  const [dailyLimit, setDailyLimit]     = useState(0)
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitInput, setLimitInput]     = useState('')

  useEffect(() => {
    api.getSummary().then(setSummary)
    api.getTransactions().then(txns => { setAllTxns(txns); setRecentTxns(txns.slice(0, 8)) })
    setAccounts(getAccounts(email))
    setManualIncome(getManualIncome(email))
    setDailyLimit(getSetting(email, 'dailyLimit', 0))
  }, [email])

  const effectiveIncome  = manualIncome > 0 ? manualIncome : (summary?.income ?? 0)
  const effectiveBalance = effectiveIncome - (summary?.expenses ?? 0)
  const savingsRate      = effectiveIncome > 0 ? Math.round((effectiveBalance / effectiveIncome) * 100) : null

  const todayStr   = new Date().toISOString().slice(0, 10)
  const todaySpend = allTxns.filter(t => t.date === todayStr && t.type === 'expense')
    .reduce((s, t) => s + parseFloat(t.amount), 0)
  const limitPct   = dailyLimit > 0 ? Math.min((todaySpend / dailyLimit) * 100, 100) : 0
  const limitColor = limitPct >= 100 ? 'var(--red)' : limitPct >= 75 ? 'var(--yellow)' : 'var(--green)'

  function saveIncome() {
    const val = parseFloat(incomeInput) || 0
    saveManualIncome(email, val)
    setManualIncome(val)
    setEditingIncome(false)
  }
  function clearIncome() { saveManualIncome(email, 0); setManualIncome(0); setEditingIncome(false) }

  function saveLimit() {
    const val = parseFloat(limitInput) || 0
    setSetting(email, 'dailyLimit', val)
    setDailyLimit(val)
    setEditingLimit(false)
  }

  const cats = summary?.spendingByCategory ?? {}
  const maxCat = Math.max(...Object.values(cats), 1)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Balance</div>
          <div className={`stat-value ${effectiveBalance >= 0 ? 'green' : 'red'}`}>
            {summary ? fmt(effectiveBalance) : '—'}
          </div>
        </div>

        <div className="stat-card stat-card--editable" onClick={!editingIncome ? () => { setIncomeInput(String(manualIncome || summary?.income || '')); setEditingIncome(true) } : undefined}>
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Income
            {manualIncome > 0
              ? <span style={{ fontSize: 10, background: 'rgba(99,102,241,.18)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>manual</span>
              : <span style={{ fontSize: 11, color: 'var(--muted)', opacity: .6 }}>✎</span>}
          </div>
          {editingIncome ? (
            <div className="income-edit-row" onClick={e => e.stopPropagation()}>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>R</span>
              <input className="income-edit-input" type="number" min="0" step="0.01" placeholder="e.g. 25000"
                value={incomeInput} onChange={e => setIncomeInput(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveIncome(); if (e.key === 'Escape') setEditingIncome(false) }} />
              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={saveIncome}>Save</button>
              {manualIncome > 0 && <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={clearIncome}>Clear</button>}
            </div>
          ) : (
            <div className="stat-value green">{summary ? fmt(effectiveIncome) : '—'}</div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-label">Spent</div>
          <div className="stat-value red">{summary ? fmt(summary.expenses) : '—'}</div>
        </div>
      </div>

      {manualIncome > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, marginTop: -8 }}>
          Income set manually.{' '}
          <button className="btn-text" style={{ fontSize: 12 }} onClick={() => { setIncomeInput(String(manualIncome)); setEditingIncome(true) }}>Edit</button>
          {' · '}
          <button className="btn-text" style={{ fontSize: 12 }} onClick={clearIncome}>Use calculated</button>
        </div>
      )}

      {/* Daily spend limit bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dailyLimit > 0 ? 10 : 0 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Today's spending</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: dailyLimit > 0 ? limitColor : 'var(--text)' }}>
              {fmt(todaySpend, 2)}
              {dailyLimit > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> / {fmt(dailyLimit)}</span>}
            </span>
            {!editingLimit && (
              <button className="btn-text" style={{ fontSize: 12 }}
                onClick={() => { setLimitInput(String(dailyLimit || '')); setEditingLimit(true) }}>
                {dailyLimit > 0 ? '✎ limit' : '+ set limit'}
              </button>
            )}
          </div>
        </div>

        {editingLimit && (
          <div className="income-edit-row" style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>Daily limit R</span>
            <input className="income-edit-input" type="number" min="0" step="1" placeholder="e.g. 300"
              value={limitInput} onChange={e => setLimitInput(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveLimit(); if (e.key === 'Escape') setEditingLimit(false) }} />
            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={saveLimit}>Save</button>
            {dailyLimit > 0 && <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setSetting(email, 'dailyLimit', 0); setDailyLimit(0); setEditingLimit(false) }}>Clear</button>}
          </div>
        )}

        {dailyLimit > 0 && (
          <div className="daily-bar-track">
            <div className="daily-bar-fill" style={{ width: `${limitPct}%`, background: limitColor }} />
          </div>
        )}
      </div>

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
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
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
          {recentTxns.length === 0 ? (
            <div className="empty"><div className="empty-icon">💳</div>No transactions yet</div>
          ) : (
            <div className="txn-list">
              {recentTxns.map(t => (
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

      {/* Month-over-month comparison */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Month-over-month spending</div>
        <MonthComparison allTxns={allTxns} />
      </div>

      {/* Spending heatmap */}
      {allTxns.length > 0 && (
        <div className="card">
          <div className="card-title">Spending activity — last 13 weeks</div>
          <SpendHeatmap txns={allTxns} />
        </div>
      )}
    </div>
  )
}
