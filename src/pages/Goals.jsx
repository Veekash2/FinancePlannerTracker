import { useEffect, useState } from 'react'
import { api } from '../storage'
import { fmt } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import { setGoalPriority, getAllGoalPriorities } from '../utils/goalMeta'

const SWATCHES = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316']
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIORITY_META = {
  high:   { label: '🔴 High',   bg: 'rgba(239,68,68,.15)',   color: 'var(--red)' },
  medium: { label: '🟡 Medium', bg: 'rgba(245,158,11,.15)',  color: 'var(--yellow)' },
  low:    { label: '🟢 Low',    bg: 'rgba(34,197,94,.15)',   color: 'var(--green)' },
}

const emptyForm = { name: '', target_amount: '', current_amount: '', color: '#6366f1', deadline: '', priority: 'medium' }

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

export default function Goals() {
  const { user } = useAuth()
  const email = user?.email ?? ''

  const [goals, setGoals]           = useState([])
  const [priorities, setPriorities] = useState({})
  const [showModal, setShowModal]   = useState(false)
  const [editGoal, setEditGoal]     = useState(null)
  const [depositGoal, setDepositGoal] = useState(null)
  const [depositAmt, setDepositAmt] = useState('')
  const [form, setForm]             = useState(emptyForm)

  const load = () => {
    api.getGoals().then(setGoals)
    setPriorities(getAllGoalPriorities(email))
  }
  useEffect(() => { load() }, [email])

  const openAdd = () => { setForm(emptyForm); setEditGoal(null); setShowModal(true) }
  const openEdit = (g) => {
    setForm({
      name: g.name,
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      color: g.color,
      deadline: g.deadline ?? '',
      priority: priorities[g.id] ?? 'medium',
    })
    setEditGoal(g)
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditGoal(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const body = {
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount || 0),
      color: form.color,
      deadline: form.deadline || null,
    }
    let goalId
    if (editGoal) {
      await api.updateGoal(editGoal.id, body)
      goalId = editGoal.id
    } else {
      const result = await api.addGoal(body)
      goalId = result?.id
    }
    if (goalId) setGoalPriority(email, goalId, form.priority)
    closeModal()
    load()
  }

  const handleDeposit = async (e) => {
    e.preventDefault()
    const newAmt = parseFloat(depositGoal.current_amount) + parseFloat(depositAmt)
    await api.updateGoal(depositGoal.id, { current_amount: newAmt })
    setDepositGoal(null)
    setDepositAmt('')
    load()
  }

  const handleDelete = async (id) => {
    await api.deleteGoal(id)
    load()
  }

  // Sort by priority (High → Medium → Low → unprioritised)
  const sortedGoals = [...goals].sort((a, b) => {
    const pa = PRIORITY_ORDER[priorities[a.id]] ?? 3
    const pb = PRIORITY_ORDER[priorities[b.id]] ?? 3
    return pa - pb
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Savings Goals</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ New Goal</button>
      </div>

      {sortedGoals.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">🎯</div>
            Set your first savings goal to get started!
          </div>
        </div>
      ) : (
        <div className="goals-grid">
          {sortedGoals.map(g => {
            const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100))
            const remaining = g.target_amount - g.current_amount
            const pri = priorities[g.id]
            const priMeta = PRIORITY_META[pri]
            return (
              <div className="goal-card" key={g.id}>
                <div className="goal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <div className="goal-name">{g.name}</div>
                    {priMeta && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                        background: priMeta.bg, color: priMeta.color,
                      }}>
                        {priMeta.label}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn-icon" title="Edit" onClick={() => openEdit(g)}><PencilIcon /></button>
                    <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => handleDelete(g.id)}>×</button>
                  </div>
                </div>
                <div className="goal-amounts">{fmt(g.current_amount)} of {fmt(g.target_amount)}</div>
                {g.deadline && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    By {new Date(g.deadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: g.color }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="goal-pct" style={{ color: g.color }}>{pct}%</div>
                  {pct < 100
                    ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt(remaining)} to go</div>
                    : <span className="badge badge-success">Reached! 🎉</span>
                  }
                </div>
                {pct < 100 && (
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 12, width: '100%', justifyContent: 'center', fontSize: 13 }}
                    onClick={() => { setDepositGoal(g); setDepositAmt('') }}
                  >
                    + Add funds
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editGoal ? 'Edit Goal' : 'New Savings Goal'}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Goal name</label>
                <input className="form-input" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Emergency fund" />
              </div>

              {/* Priority selector */}
              <div className="form-group">
                <label className="form-label">Priority</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(PRIORITY_META).map(([v, meta]) => (
                    <button type="button" key={v}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${form.priority === v ? meta.color : 'var(--border)'}`,
                        background: form.priority === v ? meta.bg : 'var(--surface2)',
                        color: form.priority === v ? meta.color : 'var(--muted)',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                      onClick={() => setForm(f => ({ ...f, priority: v }))}>
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target (R)</label>
                  <input className="form-input" required type="number" min="1" step="1" value={form.target_amount}
                    onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="5000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Saved so far (R)</label>
                  <input className="form-input" type="number" min="0" step="1" value={form.current_amount}
                    onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} placeholder="0" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Deadline (optional)</label>
                <input className="form-input" type="date" value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
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
                {editGoal ? 'Save Changes' : 'Create Goal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Deposit modal */}
      {depositGoal && (
        <div className="modal-overlay" onClick={() => setDepositGoal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add funds — {depositGoal.name}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setDepositGoal(null)}>✕</button>
            </div>
            <form onSubmit={handleDeposit}>
              <div className="form-group">
                <label className="form-label">Amount (R)</label>
                <input className="form-input" required type="number" min="0.01" step="0.01"
                  value={depositAmt} onChange={e => setDepositAmt(e.target.value)} placeholder="100" autoFocus />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Add Funds
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
