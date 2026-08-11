import { useState } from 'react'
import { api } from '../storage'
import { suggestCategory } from '../utils/gemini'

const EXPENSE_CATS = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Other']
const INCOME_CATS  = ['Salary', 'Freelance', 'Other']

const fresh = () => ({
  description: '', amount: '', type: 'expense', category: 'Food',
  date: new Date().toISOString().slice(0, 10),
})

export default function QuickAdd({ onSaved }) {
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState(fresh())
  const [saving, setSaving]     = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError]       = useState(null)

  const close = () => { setOpen(false); setForm(fresh()); setError(null) }

  const setType = (t) =>
    setForm(f => ({ ...f, type: t, category: t === 'income' ? 'Salary' : 'Food' }))

  const handleBlurDesc = async () => {
    if (!form.description.trim() || form.type === 'income') return
    setSuggesting(true)
    try {
      const cat = await suggestCategory(form.description)
      if (EXPENSE_CATS.includes(cat)) setForm(f => ({ ...f, category: cat }))
    } catch {}
    finally { setSuggesting(false) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    setError(null)
    try {
      await api.addTransaction({ ...form, amount: parseFloat(form.amount) })
      close()
      onSaved?.()
    } catch (err) {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS

  return (
    <>
      <button className="quick-add-fab" onClick={() => setOpen(true)} aria-label="Quick add transaction">
        <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
      </button>

      {open && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal quick-add-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Quick Add</span>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={close}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              {/* Expense / Income toggle */}
              <div className="quick-type-toggle">
                <button type="button"
                  className={`quick-type-btn ${form.type === 'expense' ? 'quick-type-btn--expense' : ''}`}
                  onClick={() => setType('expense')}>− Expense</button>
                <button type="button"
                  className={`quick-type-btn ${form.type === 'income' ? 'quick-type-btn--income' : ''}`}
                  onClick={() => setType('income')}>+ Income</button>
              </div>

              {/* Big amount input */}
              <div className="quick-amount-wrap">
                <span className="quick-amount-prefix">R</span>
                <input
                  className="quick-amount-input"
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={form.amount} autoFocus
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" placeholder="e.g. Checkers groceries"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    onBlur={handleBlurDesc}
                    style={{ paddingRight: suggesting ? 36 : undefined }}
                  />
                  {suggesting && (
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      <div className="ai-spinner" style={{ width: 14, height: 14 }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {cats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              {error && <div className="ai-error" style={{ marginTop: 10 }}>{error}</div>}

              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                disabled={saving || !form.amount || !form.description.trim()}>
                {saving ? 'Saving…' : `Add ${form.type === 'income' ? 'Income' : 'Expense'}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
