import { useRef, useState } from 'react'
import { parseBankStatementPDF } from '../utils/gemini'
import { api } from '../storage'
import { GEMINI_API_KEY } from '../config'

const CATEGORIES = ['Salary','Freelance','Food','Transport','Entertainment','Shopping','Bills','Health','Other']
const CAT_ICONS  = { Salary:'💼',Freelance:'💻',Food:'🍔',Transport:'🚗',Entertainment:'🎬',Shopping:'🛍️',Bills:'📄',Health:'💊',Other:'📦' }
const fmt = n => new Intl.NumberFormat('en-ZA', { style:'currency', currency:'ZAR', minimumFractionDigits:2 }).format(n)

// Steps each file goes through
const FILE_STEPS = [
  { key:'reading',     label:'Reading file',               icon:'📂' },
  { key:'sending',     label:'Sending to AI',              icon:'📡' },
  { key:'extracting',  label:'Extracting transactions',    icon:'🤖' },
  { key:'categorising',label:'Categorising & cleaning',    icon:'🏷️' },
  { key:'done',        label:'Done',                       icon:'✅' },
]

const PAGE = { UPLOAD:'upload', PROCESSING:'processing', REVIEW:'review', SAVING:'saving', DONE:'done' }

export default function ImportStatement({ onImported }) {
  const [page,     setPage]    = useState(PAGE.UPLOAD)
  const [files,    setFiles]   = useState([])   // [{ name, status:'waiting'|step.key|'error', txnCount, error }]
  const [rows,     setRows]    = useState([])
  const [saved,    setSaved]   = useState(0)
  const fileRef = useRef()

  const noKey = !GEMINI_API_KEY

  // ── Start processing all files ───────────────────────────────────────────
  async function processFiles(fileList) {
    const arr = Array.from(fileList).filter(f => f.type === 'application/pdf')
    if (!arr.length) return

    const initialState = arr.map(f => ({ name: f.name, status: 'waiting', txnCount: 0, error: null }))
    setFiles(initialState)
    setPage(PAGE.PROCESSING)

    const allRows = []
    let rowId = 0

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]

      const setFileStatus = (status, extra = {}) =>
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status, ...extra } : f))

      try {
        setFileStatus('reading')
        await delay(300)   // small pause so the UI updates visibly

        setFileStatus('sending')
        await delay(200)

        setFileStatus('extracting')
        const result = await parseBankStatementPDF(file)

        setFileStatus('categorising')
        await delay(400)

        const txns = (result.transactions || []).map(t => ({
          ...t,
          _id: rowId++,
          _include: true,
          _source: file.name,
        }))

        allRows.push(...txns)
        setFileStatus('done', { txnCount: txns.length })
      } catch (e) {
        setFileStatus('error', { error: e.message || 'Failed to parse' })
      }
    }

    setRows(allRows)
    // Small pause so "Done" status is visible before switching to review
    await delay(800)
    setPage(PAGE.REVIEW)
  }

  // ── Row editing ──────────────────────────────────────────────────────────
  const update    = (id, field, val) => setRows(r => r.map(row => row._id === id ? { ...row, [field]: val } : row))
  const toggleAll = checked => setRows(r => r.map(row => ({ ...row, _include: checked })))

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    const toSave = rows.filter(r => r._include)
    if (!toSave.length) return
    setPage(PAGE.SAVING)
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
    setPage(PAGE.DONE)
    onImported?.()
  }

  const included     = rows.filter(r => r._include)
  const totalIncome  = included.filter(r => r.type === 'income').reduce((s, r)  => s + parseFloat(r.amount), 0)
  const totalExpense = included.filter(r => r.type === 'expense').reduce((s, r) => s + parseFloat(r.amount), 0)

  // ── Done ─────────────────────────────────────────────────────────────────
  if (page === PAGE.DONE) return (
    <div className="card" style={{ textAlign:'center', padding:'3rem 2rem', maxWidth:520, margin:'0 auto' }}>
      <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{saved} transactions imported</h2>
      <p style={{ color:'var(--muted)', marginBottom:24 }}>All selected transactions have been saved.</p>
      <button className="btn btn-primary" onClick={() => { setPage(PAGE.UPLOAD); setRows([]); setFiles([]) }}>
        Import more statements
      </button>
    </div>
  )

  // ── Upload ────────────────────────────────────────────────────────────────
  if (page === PAGE.UPLOAD) return (
    <div style={{ maxWidth:540, margin:'0 auto' }}>
      <div className="page-header"><h1 className="page-title">Import Bank Statements</h1></div>

      {noKey && (
        <div className="card" style={{ padding:'14px 18px', marginBottom:16, border:'1px solid rgba(245,158,11,.3)',
          background:'rgba(245,158,11,.06)', color:'#f59e0b', fontSize:13 }}>
          ⚠️ <code>VITE_GEMINI_API_KEY</code> not set — add it to GitHub Secrets to enable AI parsing.
        </div>
      )}

      <div
        className="card"
        style={{ padding:'3rem 2rem', textAlign:'center', cursor: noKey ? 'not-allowed' : 'pointer',
          border:'2px dashed var(--border)', opacity: noKey ? .5 : 1, transition:'border-color .2s' }}
        onClick={() => !noKey && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='#6366f1' }}
        onDragLeave={e => { e.currentTarget.style.borderColor='' }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor=''; processFiles(e.dataTransfer.files) }}
      >
        <div style={{ fontSize:52, marginBottom:12 }}>📄</div>
        <p style={{ fontWeight:700, marginBottom:6 }}>Drop your PDF bank statements here</p>
        <p style={{ color:'var(--muted)', fontSize:13 }}>or click to browse · multiple PDFs supported</p>
        <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display:'none' }}
          onChange={e => processFiles(e.target.files)} />
      </div>

      <div style={{ marginTop:20, padding:'14px 18px', borderRadius:12, background:'var(--surface2)',
        fontSize:13, color:'var(--muted)', lineHeight:1.8 }}>
        <strong style={{ color:'var(--text)' }}>How it works</strong><br />
        1. Drop one or more PDF bank statements<br />
        2. Each PDF is read and sent to AI for extraction<br />
        3. Watch live progress per file<br />
        4. Review, edit and confirm before importing
      </div>
    </div>
  )

  // ── Processing ────────────────────────────────────────────────────────────
  if (page === PAGE.PROCESSING) return (
    <div style={{ maxWidth:600, margin:'0 auto' }}>
      <div className="page-header"><h1 className="page-title">Reading Statements…</h1></div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {files.map((f, i) => {
          const stepIdx  = FILE_STEPS.findIndex(s => s.key === f.status)
          const isDone   = f.status === 'done'
          const isError  = f.status === 'error'
          const isActive = !isDone && !isError && f.status !== 'waiting'
          const pct      = isDone ? 100 : isError ? 0 : stepIdx < 0 ? 0 : Math.round((stepIdx / (FILE_STEPS.length - 1)) * 100)

          return (
            <div key={i} className="card" style={{ padding:'16px 20px',
              border: isDone ? '1px solid rgba(34,197,94,.3)' : isError ? '1px solid rgba(239,68,68,.3)' : '1px solid var(--border)' }}>

              {/* File name + status icon */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>
                    {isDone ? '✅' : isError ? '❌' : f.status === 'waiting' ? '⏳' : '⚙️'}
                  </span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize:12, color: isDone ? 'var(--green)' : isError ? 'var(--red)' : 'var(--muted)', marginTop:2 }}>
                      {isError  ? f.error
                       : isDone ? `${f.txnCount} transaction${f.txnCount !== 1 ? 's' : ''} extracted`
                       : f.status === 'waiting' ? 'Waiting…'
                       : FILE_STEPS.find(s => s.key === f.status)?.label ?? 'Processing…'}
                    </div>
                  </div>
                </div>
                {!isDone && !isError && f.status !== 'waiting' && (
                  <div style={{ width:20, height:20, border:'2px solid rgba(99,102,241,.2)', borderTopColor:'#6366f1',
                    borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                )}
              </div>

              {/* Progress bar */}
              <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:2, transition:'width .5s ease',
                  width: `${pct}%`,
                  background: isDone ? 'var(--green)' : isError ? 'var(--red)' : '#6366f1' }} />
              </div>

              {/* Step pills */}
              {!isError && (
                <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                  {FILE_STEPS.map((s, si) => {
                    const done    = isDone || si < stepIdx
                    const current = !isDone && s.key === f.status
                    return (
                      <div key={s.key} style={{ display:'flex', alignItems:'center', gap:4,
                        padding:'3px 8px', borderRadius:20, fontSize:11,
                        background: done ? 'rgba(34,197,94,.1)' : current ? 'rgba(99,102,241,.15)' : 'var(--surface2)',
                        color: done ? 'var(--green)' : current ? '#6366f1' : 'var(--muted)',
                        border: current ? '1px solid rgba(99,102,241,.35)' : '1px solid transparent',
                        fontWeight: current ? 700 : 500 }}>
                        <span>{s.icon}</span>
                        <span>{s.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )

  // ── Review ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:1040, margin:'0 auto', paddingBottom:80 }}>
      <div className="page-header" style={{ marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom:2 }}>Review Transactions</h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>
            {files.length} file{files.length !== 1 ? 's' : ''} · {rows.length} transactions extracted
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" onClick={() => { setPage(PAGE.UPLOAD); setRows([]); setFiles([]) }}>← Back</button>
          <button className="btn btn-primary" disabled={!included.length} onClick={handleSave}>
            Import {included.length} transaction{included.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        <div className="stat-card">
          <div className="stat-label">Income selected</div>
          <div className="stat-value" style={{ color:'var(--green)', fontSize:16 }}>{fmt(totalIncome)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expenses selected</div>
          <div className="stat-value" style={{ color:'var(--red)', fontSize:16 }}>{fmt(totalExpense)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Selected / Total</div>
          <div className="stat-value" style={{ fontSize:16 }}>{included.length} / {rows.length}</div>
        </div>
      </div>

      {/* File source legend */}
      {files.length > 1 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {files.filter(f => f.status === 'done').map((f, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
              borderRadius:20, background:'var(--surface2)', fontSize:12, color:'var(--muted)' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:`hsl(${i*60},60%,55%)`, flexShrink:0 }} />
              {f.name} ({f.txnCount})
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'36px 100px 1fr 90px 70px 130px 36px',
          gap:8, padding:'10px 14px', background:'var(--surface2)',
          fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>
          <label style={{ display:'flex', alignItems:'center' }}>
            <input type="checkbox" checked={rows.length > 0 && rows.every(r => r._include)}
              onChange={e => toggleAll(e.target.checked)} />
          </label>
          <span>Date</span><span>Description</span><span>Amount</span><span>Type</span><span>Category</span><span />
        </div>

        <div style={{ maxHeight:520, overflowY:'auto' }}>
          {rows.map(row => (
            <div key={row._id} style={{ display:'grid', gridTemplateColumns:'36px 100px 1fr 90px 70px 130px 36px',
              gap:8, padding:'7px 14px', alignItems:'center', borderBottom:'1px solid var(--border)',
              opacity: row._include ? 1 : .4, background: row._include ? 'transparent' : 'var(--surface2)' }}>

              <input type="checkbox" checked={row._include} onChange={e => update(row._id, '_include', e.target.checked)} />

              <input type="date" value={row.date} className="form-input"
                style={{ padding:'4px 6px', fontSize:12, height:30 }}
                onChange={e => update(row._id, 'date', e.target.value)} />

              <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                {files.length > 1 && (
                  <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                    background:`hsl(${files.findIndex(f=>f.name===row._source)*60},60%,55%)` }} />
                )}
                <input type="text" value={row.description} className="form-input"
                  style={{ padding:'4px 8px', fontSize:13, height:30, flex:1, minWidth:0 }}
                  onChange={e => update(row._id, 'description', e.target.value)} />
              </div>

              <input type="number" min="0" step="0.01" value={row.amount} className="form-input"
                style={{ padding:'4px 6px', fontSize:13, height:30,
                  color: row.type === 'income' ? 'var(--green)' : 'var(--red)' }}
                onChange={e => update(row._id, 'amount', e.target.value)} />

              <button onClick={() => update(row._id, 'type', row.type === 'income' ? 'expense' : 'income')}
                style={{ padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
                  border:'1px solid', height:30,
                  borderColor: row.type==='income' ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)',
                  background:  row.type==='income' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                  color:       row.type==='income' ? 'var(--green)' : 'var(--red)' }}>
                {row.type === 'income' ? '↑ IN' : '↓ OUT'}
              </button>

              <select value={row.category} className="form-input"
                style={{ padding:'4px 6px', fontSize:12, height:30 }}
                onChange={e => update(row._id, 'category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
              </select>

              <button onClick={() => setRows(r => r.filter(x => x._id !== row._id))}
                style={{ color:'var(--muted)', fontSize:16, cursor:'pointer', padding:4 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200,
        background:'var(--surface)', borderTop:'1px solid var(--border)',
        padding:'12px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ color:'var(--muted)', fontSize:13 }}>
          {included.length} of {rows.length} selected · net {fmt(totalIncome - totalExpense)}
        </span>
        <button className="btn btn-primary" disabled={!included.length || page === PAGE.SAVING} onClick={handleSave}
          style={{ minWidth:190, justifyContent:'center' }}>
          {page === PAGE.SAVING ? 'Saving…' : `Import ${included.length} transaction${included.length!==1?'s':''}`}
        </button>
      </div>
    </div>
  )
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
