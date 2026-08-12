import { useRef, useState } from 'react'
import { parseBankStatementPDF } from '../utils/gemini'
import { api } from '../storage'
import { GEMINI_API_KEY } from '../config'

const CATEGORIES = ['Salary', 'Freelance', 'Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Other']
const CAT_ICONS  = { Salary:'💼', Freelance:'💻', Food:'🍔', Transport:'🚗', Entertainment:'🎬', Shopping:'🛍️', Bills:'📄', Health:'💊', Other:'📦' }

const fmt = n => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n)

const STEPS = { UPLOAD: 'upload', PARSING: 'parsing', REVIEW: 'review', SAVING: 'saving', DONE: 'done' }

export default function ImportStatement({ onImported }) {
  const [step,     setStep]     = useState(STEPS.UPLOAD)
  const [meta,     setMeta]     = useState(null)       // { bank, account, period }
  const [rows,     setRows]     = useState([])          // parsed + editable transactions
  const [error,    setError]    = useState(null)
  const [saved,    setSaved]    = useState(0)
  const fileRef = useRef()

  const noKey = !GEMINI_API_KEY

  // ── Upload & parse ───────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return }
    setError(null)
    setStep(STEPS.PARSING)
    try {
      const result = await parseBankStatementPDF(file)
      setMeta({ bank: result.bank, account: result.account, period: result.period })
      setRows(result.transactions.map((t, i) => ({ ...t, _id: i, _include: true })))
      setStep(STEPS.REVIEW)
    } catch (e) {
      setError(e.message || 'Failed to parse statement.')
      setStep(STEPS.UPLOAD)
    }
  }

  // ── Row editing ──────────────────────────────────────────────────────────
  const update = (id, field, value) =>
    setRows(r => r.map(row => row._id === id ? { ...row, [field]: value } : row))

  const toggleAll = checked =>
    setRows(r => r.map(row => ({ ...row, _include: checked })))

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    const toSave = rows.filter(r => r._include)
    if (!toSave.length) return
    setStep(STEPS.SAVING)
    let count = 0
    for (const row of toSave) {
      try {
        await api.addTransaction({
          description: row.description,
          amount:      parseFloat(row.amount),
          type:        row.type,
          date:        row.date,
          category:    row.category,
        })
        count++
      } catch {}
    }
    setSaved(count)
    setStep(STEPS.DONE)
    onImported?.()
  }

  const included = rows.filter(r => r._include)
  const totalIncome  = included.filter(r => r.type === 'income').reduce((s, r) => s + parseFloat(r.amount), 0)
  const totalExpense = included.filter(r => r.type === 'expense').reduce((s, r) => s + parseFloat(r.amount), 0)

  // ── Render ───────────────────────────────────────────────────────────────
  if (step === STEPS.DONE) return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{saved} transactions imported</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Your transactions have been saved.</p>
      <button className="btn btn-primary" onClick={() => { setStep(STEPS.UPLOAD); setRows([]); setMeta(null) }}>
        Import another statement
      </button>
    </div>
  )

  if (step === STEPS.PARSING) return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(99,102,241,.2)', borderTopColor: '#6366f1',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: 'var(--muted)' }}>Reading your statement with AI… this may take 10–20 seconds.</p>
    </div>
  )

  if (step === STEPS.UPLOAD) return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">Import Bank Statement</h1>
      </div>

      {noKey && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.06)', color: '#f59e0b', fontSize: 13 }}>
          ⚠️ Gemini API key not configured — set <code>VITE_GEMINI_API_KEY</code> in GitHub Secrets to enable AI parsing.
        </div>
      )}

      <div
        className="card"
        style={{ padding: '3rem 2rem', textAlign: 'center', cursor: noKey ? 'not-allowed' : 'pointer',
          border: '2px dashed var(--border)', opacity: noKey ? .5 : 1,
          transition: 'border-color .2s, background .2s' }}
        onClick={() => !noKey && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#6366f1' }}
        onDragLeave={e => { e.currentTarget.style.borderColor = '' }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; handleFile(e.dataTransfer.files[0]) }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
        <p style={{ fontWeight: 700, marginBottom: 6 }}>Drop your PDF bank statement here</p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>or click to browse · PDF only</p>
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12,
        background: 'var(--surface2)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text)' }}>How it works</strong><br />
        1. Upload your bank statement PDF<br />
        2. AI reads and extracts every transaction<br />
        3. Review, edit or remove any rows<br />
        4. Confirm to import into your account
      </div>
    </div>
  )

  // ── Review step ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 80 }}>
      <div className="page-header" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>Review Transactions</h1>
          {meta && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {[meta.bank, meta.account, meta.period].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setStep(STEPS.UPLOAD); setRows([]); setMeta(null) }}>
            ← Back
          </button>
          <button className="btn btn-primary" disabled={!included.length} onClick={handleSave}>
            Import {included.length} transaction{included.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Income selected</div>
          <div className="stat-value" style={{ color: 'var(--green)', fontSize: 16 }}>{fmt(totalIncome)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expenses selected</div>
          <div className="stat-value" style={{ color: 'var(--red)', fontSize: 16 }}>{fmt(totalExpense)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Selected / Total</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{included.length} / {rows.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 100px 1fr 90px 70px 130px 36px',
          gap: 8, padding: '10px 14px', background: 'var(--surface2)',
          fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={rows.every(r => r._include)}
              onChange={e => toggleAll(e.target.checked)} />
          </label>
          <span>Date</span>
          <span>Description</span>
          <span>Amount</span>
          <span>Type</span>
          <span>Category</span>
          <span />
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {rows.map(row => (
            <div key={row._id} style={{
              display: 'grid', gridTemplateColumns: '36px 100px 1fr 90px 70px 130px 36px',
              gap: 8, padding: '8px 14px', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              opacity: row._include ? 1 : .4,
              background: row._include ? 'transparent' : 'var(--surface2)',
            }}>
              {/* Checkbox */}
              <input type="checkbox" checked={row._include}
                onChange={e => update(row._id, '_include', e.target.checked)} />

              {/* Date */}
              <input type="date" value={row.date} className="form-input"
                style={{ padding: '4px 6px', fontSize: 12, height: 30 }}
                onChange={e => update(row._id, 'date', e.target.value)} />

              {/* Description */}
              <input type="text" value={row.description} className="form-input"
                style={{ padding: '4px 8px', fontSize: 13, height: 30 }}
                onChange={e => update(row._id, 'description', e.target.value)} />

              {/* Amount */}
              <input type="number" min="0" step="0.01" value={row.amount} className="form-input"
                style={{ padding: '4px 6px', fontSize: 13, height: 30,
                  color: row.type === 'income' ? 'var(--green)' : 'var(--red)' }}
                onChange={e => update(row._id, 'amount', e.target.value)} />

              {/* Type toggle */}
              <button
                onClick={() => update(row._id, 'type', row.type === 'income' ? 'expense' : 'income')}
                style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  border: '1px solid',
                  borderColor: row.type === 'income' ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)',
                  background: row.type === 'income' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                  color: row.type === 'income' ? 'var(--green)' : 'var(--red)',
                  cursor: 'pointer' }}>
                {row.type === 'income' ? '↑ IN' : '↓ OUT'}
              </button>

              {/* Category */}
              <select value={row.category} className="form-input"
                style={{ padding: '4px 6px', fontSize: 12, height: 30 }}
                onChange={e => update(row._id, 'category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>
                ))}
              </select>

              {/* Remove */}
              <button onClick={() => setRows(r => r.filter(x => x._id !== row._id))}
                style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: 4, cursor: 'pointer' }}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          {included.length} of {rows.length} selected · {fmt(totalIncome - totalExpense)} net
        </span>
        <button className="btn btn-primary" disabled={!included.length || step === STEPS.SAVING} onClick={handleSave}
          style={{ minWidth: 180, justifyContent: 'center' }}>
          {step === STEPS.SAVING ? 'Saving…' : `Import ${included.length} transaction${included.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
