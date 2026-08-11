import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Goals from './pages/Goals'
import Subscriptions from './pages/Subscriptions'
import Profile from './pages/Profile'
import AIAssistant from './pages/AIAssistant'
import Accounts from './pages/Accounts'
import Login from './pages/Login'
import QuickAdd from './components/QuickAdd'
import AlertBanner from './components/AlertBanner'
import { useAuth } from './context/AuthContext'

// Desktop sidebar — all 6 pages
const PAGES = [
  { id: 'dashboard',    label: 'Overview',      icon: '📊' },
  { id: 'accounts',     label: 'Accounts',      icon: '🏦' },
  { id: 'transactions', label: 'Transactions',  icon: '💳' },
  { id: 'goals',        label: 'Goals',         icon: '🎯' },
  { id: 'subscriptions',label: 'Subscriptions', icon: '🔁' },
  { id: 'ai',           label: 'AI Assistant',  icon: '✨' },
]

// Mobile bottom nav — 5 core pages (AI + Profile live in the top header)
const MOBILE_PAGES = [
  { id: 'dashboard',    label: 'Overview',      icon: '📊' },
  { id: 'accounts',     label: 'Accounts',      icon: '🏦' },
  { id: 'transactions', label: 'Transactions',  icon: '💳' },
  { id: 'goals',        label: 'Goals',         icon: '🎯' },
  { id: 'subscriptions',label: 'Subscriptions', icon: '🔁' },
]

function NavItem({ page, active, onClick }) {
  return (
    <a href="#" className={`nav-item ${active ? 'active' : ''}`}
      onClick={e => { e.preventDefault(); onClick(page.id) }}>
      <span style={{ fontSize: 16 }}>{page.icon}</span>
      {page.label}
    </a>
  )
}

export default function App() {
  const { isAuthed, loading, user, logout } = useAuth()
  const [page, setPage]         = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(99,102,241,.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!isAuthed) return <Login />

  // Bump refreshKey so the active page re-mounts and reloads data after QuickAdd saves
  const handleQuickSaved = () => setRefreshKey(k => k + 1)

  const renderPage = () => {
    const key = refreshKey
    if (page === 'dashboard')     return <Dashboard key={key} />
    if (page === 'accounts')      return <Accounts />
    if (page === 'transactions')  return <Transactions key={key} />
    if (page === 'goals')         return <Goals />
    if (page === 'subscriptions') return <Subscriptions key={key} />
    if (page === 'ai')            return <AIAssistant />
    if (page === 'profile')       return <Profile />
  }

  return (
    <div className="app">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">💰 Spendwise</div>
        <nav>
          {PAGES.map(p => (
            <NavItem key={p.id} page={p} active={page === p.id} onClick={setPage} />
          ))}
        </nav>
        <div style={{ padding: '16px 10px 0', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          {user?.picture && (
            <button className="nav-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => setPage('profile')}>
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

      {/* Mobile top header */}
      <header className="mobile-header">
        <div className="mobile-header-logo">💰 Spendwise</div>
        <div className="mobile-header-right">
          <button className={`mobile-header-btn ${page === 'ai' ? 'mobile-header-btn--active' : ''}`}
            onClick={() => setPage('ai')} title="AI Assistant">✨</button>
          <button className={`mobile-avatar-btn ${page === 'profile' ? 'mobile-avatar-btn--active' : ''}`}
            onClick={() => setPage('profile')} title="Profile">
            {user?.picture
              ? <img src={user.picture} alt="Profile" style={{ width: 30, height: 30, borderRadius: '50%', display: 'block' }} />
              : <span style={{ fontSize: 20 }}>👤</span>}
          </button>
        </div>
      </header>

      {/* Subscription due-soon alerts */}
      <AlertBanner />

      <main className="main">
        {renderPage()}
      </main>

      {/* Quick-add FAB */}
      <QuickAdd onSaved={handleQuickSaved} />

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {MOBILE_PAGES.map(p => (
            <a key={p.id} href="#"
              className={`mobile-nav-item ${page === p.id ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); setPage(p.id) }}>
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              {p.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
