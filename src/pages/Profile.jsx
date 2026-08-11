import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../storage'
import { fmt } from '../utils/format'
import { exportFinancialPDF } from '../utils/exportPDF'

export default function Profile() {
  const { user, logout } = useAuth()
  const [data, setData]         = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([
      api.getTransactions(),
      api.getGoals(),
      api.getSubscriptions(),
      api.getSummary(),
    ]).then(([transactions, goals, subscriptions, summary]) => {
      setData({ transactions, goals, subscriptions, summary })
    })
  }, [])

  const handleExport = () => {
    if (!data) return
    setExporting(true)
    try {
      exportFinancialPDF(data)
    } finally {
      setExporting(false)
    }
  }

  const goalsReached = data?.goals.filter(g => g.current_amount >= g.target_amount).length ?? 0

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      {/* User card */}
      <div className="card profile-user-card">
        {user?.picture
          ? <img src={user.picture} alt="" className="profile-avatar" />
          : <div className="profile-avatar profile-avatar-fallback">
              {(user?.name ?? user?.email ?? '?')[0].toUpperCase()}
            </div>
        }
        <div>
          <div className="profile-name">{user?.name ?? 'User'}</div>
          <div className="profile-email">{user?.email}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Transactions</div>
          <div className="stat-value">{data?.transactions.length ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Goals</div>
          <div className="stat-value">{data?.goals.length ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Subscriptions</div>
          <div className="stat-value">{data?.subscriptions.length ?? '—'}</div>
        </div>
      </div>

      {/* Monthly snapshot */}
      {data?.summary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">This month</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Income</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{fmt(data.summary.income)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Spent</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{fmt(data.summary.expenses)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: data.summary.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(data.summary.balance)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Goals reached</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                {goalsReached} / {data.goals.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Export Financial Report</div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
          Download a professional PDF report with your transactions, savings goals, subscriptions, and monthly summary.
        </p>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting || !data}
          style={{ gap: 8 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {exporting ? 'Generating…' : 'Download PDF Report'}
        </button>
      </div>

      {/* Account */}
      <div className="card">
        <div className="card-title">Account</div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
          Signed in with Google as <strong style={{ color: 'var(--text)' }}>{user?.email}</strong>
        </p>
        <button className="btn btn-ghost" onClick={logout} style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </div>
  )
}
