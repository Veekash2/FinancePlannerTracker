import { useEffect, useState } from 'react'
import { api } from '../storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, fmt } from '../utils/format'
import { getAccounts, updateAccount, ACCOUNT_TYPES, getManualIncome, saveManualIncome } from '../utils/accounts'
import { getSetting, setSetting } from '../utils/settings'
import { useAuth } from '../context/AuthContext'
import { DonutChart, AreaChart } from '../components/Charts'

// ── Spending heatmap (last 13 weeks) ────────────────────────────────────────
function SpendHeatmap({ txns }) {
  const spendMap = {}
  txns.forEach(t => {
    if (t.type === 'expense') spendMap[t.date] = (spendMap[t.date] || 0) + parseFloat(t.amount)
  })

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const startOffset = (today.getDay() + 6) % 7
  const gridStart = new Date(today)
  gridStart.setDate(gridStart.getDate() - startOffset - 84)

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
  const weeks = []
  for (let w = 0; w < 13; w++) weeks.push(cells.slice(w * 7, w * 7 + 7))

  return (
    <div>
      <div style={{ display: 'flex', gap: 3 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
          {DOW.map((d, i) => <div key={i} style={{ height: 12, fontSize: 9, color: 'var(--muted)', lineHeight: '12px', width: 10 }}>{d}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map((cell, di) => (
              <div key={di} title={cell.spend > 0 ? `${cell.dateStr}: ${fmt(cell.spend, 2)}` : cell.dateStr}
                style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[intensity(cell.spend)], outline: cell.isToday ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }} />
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

// ── Visual month-over-month comparison ───────────────────────────────────────
function VisualMonthComparison({ allTxns }) {
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
    .slice(0, 6)

  if (!cats.length) return <div className="empty" style={{ padding: 0 }}><div className="empty-icon" style={{ fontSize: 24 }}>📊</div>No data yet</div>

  const maxVal = Math.max(...cats.flatMap(c => [buckets.this[c] || 0, buckets.last[c] || 0]), 1)
  const lastMonthName = new Date(lastY, lastM).toLocaleDateString('en-US', { month: 'short' })
  const thisMonthName = new Date(thisY, thisM).toLocaleDateString('en-US', { month: 'short' })

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12 }}>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />
          {thisMonthName} (this)
        </span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(99,102,241,.3)', display: 'inline-block' }} />
          {lastMonthName} (last)
        </span>
      </div>
      {cats.map(cat => {
        const cur  = buckets.this[cat] || 0
        const prev = buckets.last[cat] || 0
        const diff = prev > 0 ? ((cur - prev) / prev) * 100 : null
        const color = CATEGORY_COLORS[cat] ?? 'var(--accent)'
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: 'var(--muted)' }}>{CATEGORY_ICONS[cat] ?? '📦'} {cat}</span>
              <span style={{ fontWeight: 700 }}>
                {fmt(cur)}
                {diff !== null && (
                  <span style={{ fontWeight: 500, marginLeft: 6, color: diff > 0 ? 'var(--red)' : 'var(--green)', fontSize: 11 }}>
                    {diff > 0 ? '↑' : '↓'}{Math.abs(Math.round(diff))}%
                  </span>
                )}
              </span>
            </div>
            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--surface2)' }}>
              {prev > 0 && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 4,
                  width: `${(prev / maxVal) * 100}%`, background: color, opacity: 0.28,
                }} />
              )}
              {cur > 0 && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 4,
                  width: `${(cur / maxVal) * 100}%`, background: color, opacity: 0.85,
                }} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Editable account balance row ─────────────────────────────────────────────
function AccountRow({ acc, onSave }) {
  const meta = ACCOUNT_TYPES[acc.type] ?? ACCOUNT_TYPES.other
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  const commit = () => {
    onSave(acc.id, parseFloat(input) || 0)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="dash-account-item" onClick={e => e.stopPropagation()}>
        <div className="dash-acc-icon" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dash-acc-name">{acc.name}</div>
          <div className="dash-acc-type">{meta.label}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>R</span>
          <input className="form-input" type="number" min="0" step="0.01" autoFocus value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            style={{ width: 100, padding: '4px 8px', fontSize: 14, height: 34 }} />
          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12, height: 34 }} onClick={commit}>✓</button>
          <button className="btn" style={{ padding: '4px 10px', fontSize: 12, height: 34 }} onClick={() => setEditing(false)}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-account-item dash-account-item--editable"
      onClick={() => { setInput(String(acc.balance || 0)); setEditing(true) }}
      title="Click to update balance">
      <div className="dash-acc-icon" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dash-acc-name">{acc.name}</div>
        <div className="dash-acc-type">{meta.label}</div>
      </div>
      <div className={`dash-acc-bal ${acc.type === 'credit' ? 'red' : 'green'}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {fmt(acc.balance ?? 0)}
        <span style={{ fontSize: 10, opacity: 0.45, color: 'var(--muted)' }}>✎</span>
      </div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const email = user?.email ?? ''

  const [summary, setSummary]             = useState(null)
  const [allTxns, setAllTxns]             = useState([])
  const [recentTxns, setRecentTxns]       = useState([])
  const [accounts, setAccounts]           = useState([])
  const [manualIncome, setManualIncome]   = useState(0)
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput, setIncomeInput]     = useState('')
  const [dailyLimit, setDailyLimit]       = useState(0)
  const [editingLimit, setEditingLimit]   = useState(false)
  const [limitInput, setLimitInput]       = useState('')

  const reloadAccounts = () => setAccounts(getAccounts(email))

  useEffect(() => {
    api.getSummary().then(setSummary)
    api.getTransactions().then(txns => { setAllTxns(txns); setRecentTxns(txns.slice(0, 8)) })
    reloadAccounts()
    setManualIncome(getManualIncome(email))
    setDailyLimit(getSetting(email, 'dailyLimit', 0))
  }, [email])

  // ── Income / balance calculations ─────────────────────────────────────────
  const effectiveIncome  = manualIncome > 0 ? manualIncome : (summary?.income ?? 0)
  const calcBalance      = effectiveIncome - (summary?.expenses ?? 0)
  const savingsRate      = effectiveIncome > 0 ? Math.round((calcBalance / effectiveIncome) * 100) : null

  // Net worth from real account balances (if set up)
  const assets    = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + (a.balance || 0), 0)
  const creditOwed = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + (a.balance || 0), 0)
  const netWorth  = accounts.length > 0 ? assets - creditOwed : null

  // Today spend
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

  function handleAccountSave(accId, balance) {
    updateAccount(email, accId, { balance })
    reloadAccounts()
  }

  // ── Chart data ────────────────────────────────────────────────────────────
  const cats = summary?.spendingByCategory ?? {}
  const donutSegments = Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amt]) => ({ label: cat, value: amt, color: CATEGORY_COLORS[cat] ?? '#6366f1' }))

  const donutTotal = donutSegments.reduce((s, d) => s + d.value, 0)

  // 6-month spending trend
  const now = new Date()
  const monthlySpend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const m = d.getMonth(), y = d.getFullYear()
    const value = allTxns
      .filter(t => { const td = new Date(t.date); return t.type === 'expense' && td.getMonth() === m && td.getFullYear() === y })
      .reduce((s, t) => s + parseFloat(t.amount), 0)
    return { label: d.toLocaleDateString('en-US', { month: 'short' }), value }
  })

  const hasSpendingData = monthlySpend.some(p => p.value > 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* ── Stat cards ── */}
      <div className="stats-grid">
        {/* Balance — uses net worth if accounts exist, else calculated */}
        <div className="stat-card">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {netWorth !== null ? 'Net Worth' : 'Balance'}
            {netWorth !== null && <span style={{ fontSize: 10, background: 'rgba(16,185,129,.15)', color: 'var(--green)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>accounts</span>}
          </div>
          <div className={`stat-value ${(netWorth ?? calcBalance) >= 0 ? 'green' : 'red'}`}>
            {summary || netWorth !== null ? fmt(netWorth ?? calcBalance) : '—'}
          </div>
          {netWorth === null && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Add accounts for real balance</div>
          )}
        </div>

        {/* Income — editable */}
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

        {/* Spent */}
        <div className="stat-card">
          <div className="stat-label">Spent this month</div>
          <div className="stat-value red">{summary ? fmt(summary.expenses) : '—'}</div>
        </div>
      </div>

      {manualIncome > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, marginTop: -8 }}>
          Income set manually.{' '}
          <button className="btn-text" style={{ fontSize: 12 }} onClick={() => { setIncomeInput(String(manualIncome)); setEditingIncome(true) }}>Edit</button>
          {' · '}
          <button className="btn-text" style={{ fontSize: 12 }} onClick={clearIncome}>Use transactions</button>
        </div>
      )}

      {/* ── Daily spend limit bar ── */}
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

      {/* ── 6-month spending trend ── */}
      {hasSpendingData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Spending trend — last 6 months</div>
          <AreaChart points={monthlySpend} color="#6366f1" />
        </div>
      )}

      {/* ── Accounts (editable balances) ── */}
      {accounts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>My Accounts</div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Tap balance to update</span>
          </div>
          <div className="dash-accounts-grid">
            {accounts.map(acc => (
              <AccountRow key={acc.id} acc={acc} onSave={handleAccountSave} />
            ))}
          </div>
          {(() => {
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Net worth</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: (assets - creditOwed) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmt(assets - creditOwed)}
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Spending by category (donut) + Recent transactions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Spending by category</div>
          {donutSegments.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div>No expenses yet</div>
          ) : (
            <div className="chart-donut-wrap">
              <DonutChart
                segments={donutSegments}
                centerLabel={fmt(donutTotal)}
                centerSub="total"
                size={160}
              />
              <div className="chart-legend">
                {donutSegments.map((s, i) => (
                  <div key={i} className="chart-legend-item">
                    <div className="chart-legend-dot" style={{ background: s.color }} />
                    <span className="chart-legend-label">{CATEGORY_ICONS[s.label] ?? '📦'} {s.label}</span>
                    <span className="chart-legend-value">{fmt(s.value)}</span>
                  </div>
                ))}
              </div>
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

      {/* ── Subscriptions/mo + Savings rate ── */}
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

      {/* ── Month-over-month visual comparison ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Month-over-month spending</div>
        <VisualMonthComparison allTxns={allTxns} />
      </div>

      {/* ── Spending heatmap ── */}
      {allTxns.length > 0 && (
        <div className="card">
          <div className="card-title">Spending activity — last 13 weeks</div>
          <SpendHeatmap txns={allTxns} />
        </div>
      )}
    </div>
  )
}
