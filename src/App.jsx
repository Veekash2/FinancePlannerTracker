import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Goals from './pages/Goals'
import Subscriptions from './pages/Subscriptions'
import Profile from './pages/Profile'
import Login from './pages/Login'
import { useAuth } from './context/AuthContext'

const PAGES = [
  { id: 'dashboard', label: 'Overview', icon: '📊' },
  { id: 'transactions', label: 'Transactions', icon: '💳' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '🔁' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

function NavItem({ page, active, onClick }) {
  return (
    <a
      href="#"
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={e => { e.preventDefault(); onClick(page.id) }}
    >
      <span style={{ fontSize: 16 }}>{page.icon}</span>
      {page.label}
    </a>
  )
}

export default function App() {
  const { isAuthed, loading, user, logout } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(99,102,241,.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!isAuthed) return <Login />

  const renderPage = () => {
    if (page === 'dashboard') return <Dashboard />
    if (page === 'transactions') return <Transactions />
    if (page === 'goals') return <Goals />
    if (page === 'subscriptions') return <Subscriptions />
    if (page === 'profile') return <Profile />
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">💰 Spendwise</div>
        <nav>
          {PAGES.map(p => (
            <NavItem key={p.id} page={p} active={page === p.id} onClick={setPage} />
          ))}
        </nav>
        <div style={{ padding: '16px 10px 0', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          {user?.picture && (
            <button
              className="nav-item"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => setPage('profile')}
            >
              <img src={user.picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email}
              </span>
            </button>
          )}
          <a href="#" className="nav-item" onClick={e => { e.preventDefault(); logout() }} style={{ color: 'var(--muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </a>
        </div>
      </aside>

      <main className="main">
        {renderPage()}
      </main>

      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {PAGES.map(p => (
            <a
              key={p.id}
              href="#"
              className={`mobile-nav-item ${page === p.id ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); setPage(p.id) }}
            >
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              {p.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
