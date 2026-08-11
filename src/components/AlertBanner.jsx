import { useEffect, useState } from 'react'
import { api } from '../storage'

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T12:00:00')
  return Math.round((d - today) / 86400000)
}

export default function AlertBanner() {
  const [alerts, setAlerts]       = useState([])
  const [dismissed, setDismissed] = useState(new Set())

  useEffect(() => {
    api.getSubscriptions()
      .then(subs => {
        setAlerts(subs.filter(s => {
          const d = daysUntil(s.next_billing_date)
          return d >= 0 && d <= 3
        }))
      })
      .catch(() => {})
  }, [])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (!visible.length) return null

  return (
    <div className="alert-stack">
      {visible.map(sub => {
        const days = daysUntil(sub.next_billing_date)
        return (
          <div key={sub.id} className="alert-item">
            <span className="alert-dot" style={{ background: sub.color }} />
            <span style={{ flex: 1, fontSize: 13 }}>
              <strong>{sub.name}</strong>{' '}
              {days === 0 ? 'bills today' : `bills in ${days} day${days !== 1 ? 's' : ''}`}
              {' — '}R{parseFloat(sub.amount).toFixed(2)}
            </span>
            <button className="alert-dismiss"
              onClick={() => setDismissed(s => new Set([...s, sub.id]))}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
