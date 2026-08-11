import { useEffect, useState } from 'react'
import { api } from '../storage'
import { fmt } from '../utils/format'
import { detectSubscriptions } from '../utils/gemini'

const SWATCHES = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316']
const SUB_CATEGORIES = ['Streaming', 'Music', 'Software', 'Gaming', 'Fitness', 'News', 'Cloud', 'Other']
const SWATCH_FOR_CAT = {
  Streaming: '#ef4444', Music: '#22c55e', Software: '#6366f1',
  Gaming: '#8b5cf6', Fitness: '#f59e0b', News: '#06b6d4', Cloud: '#3b82f6', Other: '#ec4899',
}

function monthlyEquiv(amount, cycle) {
  if (cycle === 'yearly') return amount / 12
  if (cycle === 'weekly') return amount * 4.33
  return amount
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T12:00:00')
  return Math.round((d - today) / 86400000)
}

const emptyForm = {
  name: '', amount: '', billing_cycle: 'monthly', category: 'Streaming',
  next_billing_date: new Date().toISOString().slice(0, 10), color: '#6366f1',
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

export default function Subscriptions() {
  const [subs, setSubs]           = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editSub, setEditSub]     = useState(null)
  const [form, setForm]           = useState(emptyForm)

  // AI detection state
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected]   = useState(null)   // array of candidates
  const [detectErr, setDetectErr] = useState(null)
  const [saving, setSaving]       = useState(false)

  const load = () => api.getSubscriptions().then(setSubs)
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(emptyForm); setEditSub(null); setShowModal(true) }
  const openEdit = (s) => {
    setForm({ name: s.name, amount: String(s.amount), billing_cycle: s.billing_cycle, category: s.category, next_billing_date: s.next_billing_date, color: s.color })
    setEditSub(s)
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditSub(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const body = { ...form, amount: parseFloat(form.amount) }
    if (editSub) {
      await api.updateSubscription(editSub.id, body)
    } else {
      await api.addSubscription(body)
    }
    closeModal()
    load()
  }

  const handleDelete = async (id) => {
    await api.deleteSubscription(id)
    load()
  }

  // AI detection
  const handleDetect = async () => {
    setDetecting(true)
    setDetectErr(null)
    setDetected(null)
    try {
      const txns = await api.getTransactions()
      if (!txns.length) { setDetectErr('No transactions found. Import some bank transactions first.'); return }
      const result = await detectSubscriptions(txns)
      if (!result.length) { setDetectErr('No recurring subscriptions detected in your transactions.'); return }
      // Pre-select all, add include flag and auto-assign color
      setDetected(result.map((s, i) => ({
        ...s,
        include: true,
        color: SWATCH_FOR_CAT[s.category] ?? SWATCHES[i % SWATCHES.length],
        id: i,
      })))
    } catch (e) {
      setDetectErr(e.message || 'Detection failed. Try again.')
    } finally {
      setDetecting(false)
    }
  }

  const handleImportDetected = async () => {
    const toAdd = detected.filter(s => s.include)
    if (!toAdd.length) return
    setSaving(true)
    try {
      await Promise.all(toAdd.map(s =>
        api.addSubscription({ name: s.name, amount: s.amount, billing_cycle: s.billing_cycle, category: s.category, next_billing_date: s.next_billing_date, color: s.color })
      ))
      setDetected(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  const updateDetected = (id, field, value) =>
    setDetected(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))

  const totalMonthly = subs.reduce((s, sub) => s + monthlyEquiv(parseFloat(sub.amount), sub.billing_cycle), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Subscriptions</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleDetect} disabled={detecting}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {detecting
              ? <><div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> Scanning…</>
              : <><span>✨</span> AI Detect</>
            }
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add</button>
        </div>
      </div>

      {/* AI detection results */}
      {detectErr && (
        <div className="ai-error" style={{ marginBottom: 16 }}>{detectErr}</div>
      )}

      {detected && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(99,102,241,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>✨ {detected.length} subscription{detected.length !== 1 ? 's' : ''} detected</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Review and edit before adding. Uncheck any that shouldn't be added.</div>
            </div>
            <button className="btn-icon danger" onClick={() => setDetected(null)}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {detected.map(s => (
              <div key={s.id} className={`verify-item ${!s.include ? 'verify-item--excluded' : ''}`} style={{ padding: '10px 12px' }}>
                <input type="checkbox" checked={s.include} className="verify-checkbox"
                  onChange={e => updateDetected(s.id, 'include', e.target.checked)} />
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', minWidth: 0 }}>
                  <div>
                    <input className="form-input" style={{ fontSize: 13, padding: '4px 8px' }}
                      value={s.name} onChange={e => updateDetected(s.id, 'name', e.target.value)} />
                  </div>
                  <select className="form-input" value={s.category} style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
                    onChange={e => updateDetected(s.id, 'category', e.target.value)}>
                    {SUB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>R</span>
                    <input className="form-input" type="number" min="0" step="0.01"
                      style={{ fontSize: 13, padding: '4px 8px', width: 80 }}
                      value={s.amount} onChange={e => updateDetected(s.id, 'amount', parseFloat(e.target.value) || 0)} />
                  </div>
                  <select className="form-input" value={s.billing_cycle} style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
                    onChange={e => updateDetected(s.id, 'billing_cycle', e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setDetected(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImportDetected} disabled={saving || !detected.some(s => s.include)}>
              {saving ? 'Adding…' : `Add ${detected.filter(s => s.include).length} subscription${detected.filter(s => s.include).length !== 1 ? 's' : ''} →`}
            </button>
          </div>
        </div>
      )}

      {subs.length > 0 && (
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Monthly total</div>
            <div className="stat-value red">{fmt(totalMonthly)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Yearly total</div>
            <div className="stat-value" style={{ color: 'var(--yellow)' }}>{fmt(totalMonthly * 12)}</div>
          </div>
        </div>
      )}

      <div className="card">
        {subs.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔁</div>
            <p>Track your subscriptions here — they add up fast!</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              Use <strong>✨ AI Detect</strong> to automatically find subscriptions in your transactions.
            </p>
          </div>
        ) : (
          <div className="sub-list">
            {subs.map(sub => {
              const days = daysUntil(sub.next_billing_date)
              const monthly = monthlyEquiv(parseFloat(sub.amount), sub.billing_cycle)
              return (
                <div className="sub-item" key={sub.id}>
                  <div className="sub-dot" style={{ background: sub.color }} />
                  <div className="sub-info">
                    <div className="sub-name">{sub.name}</div>
                    <div className="sub-meta">
                      {sub.category} · {sub.billing_cycle} ·{' '}
                      {days <= 0
                        ? <span className="badge badge-warning">Due today</span>
                        : days <= 7
                          ? <span className="badge badge-warning">Due in {days}d</span>
                          : `due ${new Date(sub.next_billing_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      }
                    </div>
                  </div>
                  <div className="sub-right">
                    <div className="sub-amount">{fmt(sub.amount, 2)}</div>
                    {sub.billing_cycle !== 'monthly' && (
                      <div className="sub-cycle">{fmt(monthly)}/mo</div>
                    )}
                  </div>
                  <button className="btn-icon" title="Edit" onClick={() => openEdit(sub)}><PencilIcon /></button>
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleDelete(sub.id)}>×</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editSub ? 'Edit Subscription' : 'Add Subscription'}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Service name</label>
                <input className="form-input" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Netflix" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (R)</label>
                  <input className="form-input" required type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="9.99" />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing cycle</label>
                  <select className="form-input" value={form.billing_cycle}
                    onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {SUB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Next billing</label>
                  <input className="form-input" required type="date" value={form.next_billing_date}
                    onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="color-swatches">
                  {SWATCHES.map(c => (
                    <div key={c} className={`swatch ${form.color === c ? 'selected' : ''}`}
                      style={{ background: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                {editSub ? 'Save Changes' : 'Add Subscription'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
