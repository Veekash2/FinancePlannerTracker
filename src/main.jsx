import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ImportProvider } from './context/ImportContext.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/FinancePlannerTracker/sw.js', { scope: '/FinancePlannerTracker/' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ImportProvider>
        <App />
      </ImportProvider>
    </AuthProvider>
  </StrictMode>,
)
