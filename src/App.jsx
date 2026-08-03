import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Goals from './pages/Goals';
import Subscriptions from './pages/Subscriptions';

const PAGES = [
  { id: 'dashboard', label: 'Overview', icon: '📊' },
  { id: 'transactions', label: 'Transactions', icon: '💳' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '🔁' },
];

function NavItem({ page, active, onClick }) {
  return (
    <a
      href="#"
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={e => { e.preventDefault(); onClick(page.id); }}
    >
      <span style={{ fontSize: 16 }}>{page.icon}</span>
      {page.label}
    </a>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    if (page === 'dashboard') return <Dashboard />;
    if (page === 'transactions') return <Transactions />;
    if (page === 'goals') return <Goals />;
    if (page === 'subscriptions') return <Subscriptions />;
  };

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
      </aside>

      {/* Page content */}
      <main className="main">
        {renderPage()}
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {PAGES.map(p => (
            <a
              key={p.id}
              href="#"
              className={`mobile-nav-item ${page === p.id ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); setPage(p.id); }}
            >
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              {p.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
