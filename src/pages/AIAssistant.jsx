import { useRef, useState } from 'react'
import { api } from '../storage'
import { analyzeReceipt, getSpendingInsights, getBudgetPlan } from '../utils/gemini'
import { fmt } from '../utils/format'

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Other']
const TABS = ['Receipt Scanner', 'Spending Insights', 'Budget Advisor']

// ── Shared ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 14 }}>
      <div className="ai-spinner" />
      Analyzing with Gemini AI…
    </div>
  )
}

function InsightIcon({ type }) {
  if (type === 'positive') return <span style={{ color: 'var(--green)', fontSize: 18 }}>✓</span>
  if (type === 'warning')  return <span style={{ color: 'var(--yellow)', fontSize: 18 }}>⚠</span>
  return <span style={{ color: 'var(--accent)', fontSize: 18 }}>💡</span>
}

// ── Receipt Scanner ──────────────────────────────────────────────────────────
function ReceiptScanner() {
  const inputRef     = useRef(null)
  const [file, setFile]         = useState(null)
  const [preview, setPreview]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [extracted, setExtracted] = useState(null)  // { merchant, date, transactions }
  const [items, setItems]       = useState([])       // editable rows
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setExtracted(null)
    setSaved(false)
    setError(null)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeReceipt(file)
      setExtracted(result)
      setItems(result.transactions.map((t, i) => ({
        id: i,
        description: t.description,
        amount: String(t.amount),
        category: t.category,
        date: result.date || new Date().toISOString().slice(0, 10),
        type: 'expense',
        include: true,
      })))
    } catch (e) {
      setError(e.message || 'Failed to analyze file. Try a clearer image.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const toSave = items.filter(i => i.include)
    if (!toSave.length) return
    setSaving(true)
    try {
      await Promise.all(toSave.map(i =>
        api.addTransaction({
          description: i.description,
          amount: parseFloat(i.amount),
          category: i.category,
          date: i.date,
          type: i.type,
        })
      ))
      setSaved(true)
      setExtracted(null)
      setFile(null)
      setPreview(null)
      setItems([])
    } catch (e) {
      setError('Failed to save transactions.')
    } finally {
      setSaving(false)
    }
  }

  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))

  const included = items.filter(i => i.include).length

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
        Upload a receipt, invoice, bank statement screenshot, or any financial document. Gemini AI will extract the transactions for you to verify before saving.
      </p>

      {saved && (
        <div className="ai-success">
          ✓ Transactions saved successfully!
          <button className="btn-text" onClick={() => setSaved(false)}>Scan another</button>
        </div>
      )}

      {!saved && (
        <>
          {/* Drop zone */}
          <div
            className={`drop-zone ${file ? 'drop-zone--has-file' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>
                  {file.type.startsWith('image/') ? '🖼️' : '📄'}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {(file.size / 1024).toFixed(0)} KB · Click to change
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📎</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                  Drop a file or click to browse
                </div>
                <div style={{ fontSize: 12 }}>JPG · PNG · WEBP · PDF</div>
              </div>
            )}
          </div>

          {/* Image preview */}
          {preview && (
            <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={preview} alt="Receipt" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#fff' }} />
            </div>
          )}

          {error && <div className="ai-error">{error}</div>}

          {file && !extracted && (
            <button
              className="btn btn-primary ai-analyze-btn"
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? <Spinner /> : (
                <>
                  <span style={{ fontSize: 16 }}>✨</span>
                  Analyze with Gemini AI
                </>
              )}
            </button>
          )}

          {/* Verification form */}
          {extracted && (
            <div className="ai-verify">
              <div className="ai-verify-header">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {extracted.merchant || 'Unknown Merchant'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {extracted.transactions.length} transaction{extracted.transactions.length !== 1 ? 's' : ''} extracted — review and edit before saving
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {items.map(item => (
                  <div key={item.id} className={`verify-item ${!item.include ? 'verify-item--excluded' : ''}`}>
                    <input
                      type="checkbox"
                      checked={item.include}
                      onChange={e => updateItem(item.id, 'include', e.target.checked)}
                      className="verify-checkbox"
                    />
                    <div className="verify-fields">
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Description</label>
                          <input className="form-input" value={item.description}
                            onChange={e => updateItem(item.id, 'description', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Amount (R)</label>
                          <input className="form-input" type="number" min="0" step="0.01" value={item.amount}
                            onChange={e => updateItem(item.id, 'amount', e.target.value)} />
                        </div>
                      </div>
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Category</label>
                          <select className="form-input" value={item.category}
                            onChange={e => updateItem(item.id, 'category', e.target.value)}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Date</label>
                          <input className="form-input" type="date" value={item.date}
                            onChange={e => updateItem(item.id, 'date', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && <div className="ai-error" style={{ marginBottom: 12 }}>{error}</div>}

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSave}
                disabled={saving || included === 0}
              >
                {saving ? 'Saving…' : `Add ${included} Transaction${included !== 1 ? 's' : ''} →`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Spending Insights ────────────────────────────────────────────────────────
function SpendingInsights() {
  const [loading, setLoading]     = useState(false)
  const [insights, setInsights]   = useState(null)
  const [error, setError]         = useState(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const [transactions, goals, subscriptions, summary] = await Promise.all([
        api.getTransactions(),
        api.getGoals(),
        api.getSubscriptions(),
        api.getSummary(),
      ])
      const result = await getSpendingInsights({ summary, goals, subscriptions, transactions })
      setInsights(result)
    } catch (e) {
      setError(e.message || 'Failed to generate insights.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
        Gemini AI will analyze your spending patterns, savings rate, and financial habits to give you personalized insights.
      </p>

      <button className="btn btn-primary ai-analyze-btn" onClick={generate} disabled={loading}>
        {loading ? <Spinner /> : <><span style={{ fontSize: 16 }}>✨</span> Generate Insights</>}
      </button>

      {error && <div className="ai-error">{error}</div>}

      {insights && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {insights.map((ins, i) => (
            <div key={i} className={`insight-card insight-card--${ins.type}`}>
              <div className="insight-icon"><InsightIcon type={ins.type} /></div>
              <div>
                <div className="insight-title">{ins.title}</div>
                <div className="insight-msg">{ins.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Budget Advisor ───────────────────────────────────────────────────────────
function BudgetAdvisor() {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan]       = useState(null)
  const [error, setError]     = useState(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const [goals, summary] = await Promise.all([api.getGoals(), api.getSummary()])
      const result = await getBudgetPlan({ summary, goals })
      setPlan(result)
    } catch (e) {
      setError(e.message || 'Failed to generate budget plan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
        Get a personalized monthly budget based on the 50/30/20 rule, tailored to your income and spending habits.
      </p>

      <button className="btn btn-primary ai-analyze-btn" onClick={generate} disabled={loading}>
        {loading ? <Spinner /> : <><span style={{ fontSize: 16 }}>✨</span> Generate Budget Plan</>}
      </button>

      {error && <div className="ai-error">{error}</div>}

      {plan && (
        <div className="card" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="budget-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Recommended</th>
                  <th>Current</th>
                  <th>Difference</th>
                  <th>Tip</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((row, i) => {
                  const diff = (row.current || 0) - (row.recommended || 0)
                  const over = diff > 0
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{row.category}</td>
                      <td>{fmt(row.recommended, 0)}</td>
                      <td>{fmt(row.current || 0, 0)}</td>
                      <td style={{ color: over ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                        {over ? '+' : ''}{fmt(diff, 0)}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{row.tip}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const [tab, setTab] = useState(0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Assistant</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--accent-glow)', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(99,102,241,0.3)' }}>
          Powered by Gemini 2.5
        </span>
      </div>

      <div className="ai-tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            className={`ai-tab ${tab === i ? 'active' : ''}`}
            onClick={() => setTab(i)}
          >
            {['📎', '💡', '📋'][i]} {t}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 0 && <ReceiptScanner />}
        {tab === 1 && <SpendingInsights />}
        {tab === 2 && <BudgetAdvisor />}
      </div>
    </div>
  )
}
