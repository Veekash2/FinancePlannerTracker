import { useRef, useEffect, useState } from 'react'
import { useImport } from '../context/ImportContext'
import { checkDailyLimit } from '../utils/gemini'

const CATEGORIES   = ['Salary','Freelance','Food','Transport','Entertainment','Shopping','Bills','Health','Other']
const CAT_ICONS    = { Salary:'💼',Freelance:'💻',Food:'🍔',Transport:'🚗',Entertainment:'🎬',Shopping:'🛍️',Bills:'📄',Health:'💊',Other:'📦' }
const SUB_CATS     = ['Streaming','Music','Software','Gaming','Fitness','News','Cloud','Other']
const CYCLE_LABELS = { monthly:'Monthly', yearly:'Yearly', weekly:'Weekly' }
const FREQ_LABELS  = { monthly:'Monthly', weekly:'Weekly', biweekly:'Bi-weekly' }

const FILE_STEPS = [
  { key:'reading',      label:'Reading file',            icon:'📂' },
  { key:'sending',      label:'Sending to AI',           icon:'📡' },
  { key:'extracting',   label:'Extracting transactions', icon:'🤖' },
  { key:'categorising', label:'Categorising & cleaning', icon:'🏷️' },
  { key:'done',         label:'Done',                    icon:'✅' },
]

const fmt  = n => new Intl.NumberFormat('en-ZA', { style:'currency', currency:'ZAR', minimumFractionDigits:2 }).format(n)
const fmtS = n => new Intl.NumberFormat('en-ZA', { style:'currency', currency:'ZAR', maximumFractionDigits:0 }).format(n)

export default function ImportStatement({ onImported }) {
  const {
    PAGE, page, setPage, files, globalStep, rows, recur, income, tab, setTab,
    savedTxns, savedSubs, savedInc, noKey,
    processFiles, cancel, reset, handleSave,
    saveProgress,
    removeRow, updateRow, updateSub, updateInc, toggleAll, toggleAllS, toggleAllI,
  } = useImport()

  const fileRef = useRef()
  const [tokenStatus, setTokenStatus] = useState(null)

  useEffect(() => {
    checkDailyLimit().then(setTokenStatus)
  }, [page])

  const includedRows = rows.filter(r => r._include)
  const includedSubs = recur.filter(s => s._include)
  const includedInc  = income.filter(s => s._include)
  const totalIncome  = includedRows.filter(r => r.type==='income').reduce((s,r) => s+parseFloat(r.amount), 0)
  const totalExpense = includedRows.filter(r => r.type==='expense').reduce((s,r) => s+parseFloat(r.amount), 0)
  const monthlySubCost = includedSubs.reduce((s, sub) => {
    const a = parseFloat(sub.amount)
    return s + (sub.billing_cycle==='yearly' ? a/12 : sub.billing_cycle==='weekly' ? a*4.33 : a)
  }, 0)
  const totalRecurIncome = includedInc.reduce((s, inc) => s + parseFloat(inc.amount), 0)

  // ── Saving ─────────────────────────────────────────────────────────────
  if (page === PAGE.SAVING) {
    const sp = saveProgress || { done: 0, total: 1, phase: 'subscriptions' }
    const pct = Math.round((sp.done / sp.total) * 100)
    const phaseLabel = sp.phase === 'subscriptions' ? '🔁 Saving subscriptions'
      : sp.phase === 'income' ? '💰 Saving income'
      : '💳 Saving transactions'
    return (
      <div className="card" style={{ textAlign:'center', padding:'3rem 2rem', maxWidth:480, margin:'0 auto' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>💾</div>
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Saving to your account…</h2>
        <p style={{ color:'var(--muted)', fontSize:13, marginBottom:24 }}>{phaseLabel}</p>
        <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden', marginBottom:10 }}>
          <div style={{ height:'100%', background:'#6366f1', borderRadius:4, transition:'width .3s ease', width:`${pct}%` }} />
        </div>
        <p style={{ fontSize:13, color:'var(--muted)', fontVariantNumeric:'tabular-nums' }}>
          {sp.done} / {sp.total} saved
        </p>
      </div>
    )
  }

  // ── Done ───────────────────────────────────────────────────────────────
  if (page === PAGE.DONE) return (
    <div className="card" style={{ textAlign:'center', padding:'3rem 2rem', maxWidth:520, margin:'0 auto' }}>
      <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16 }}>Import complete</h2>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:24 }}>
        {savedTxns > 0 && <Pill label={`${savedTxns} transactions`}   color="var(--accent)" />}
        {savedSubs > 0 && <Pill label={`${savedSubs} subscriptions`}  color="#f59e0b" />}
        {savedInc  > 0 && <Pill label={`${savedInc} income entries`}  color="var(--green)" />}
      </div>
      <button className="btn btn-primary" onClick={reset}>
        Import more statements
      </button>
    </div>
  )

  // ── Upload ─────────────────────────────────────────────────────────────
  if (page === PAGE.UPLOAD) return (
    <div style={{ maxWidth:540, margin:'0 auto' }}>
      <div className="page-header"><h1 className="page-title">Import Bank Statements</h1></div>
      {noKey && (
        <div className="card" style={{ padding:'14px 18px', marginBottom:16, border:'1px solid rgba(245,158,11,.3)', background:'rgba(245,158,11,.06)', color:'#f59e0b', fontSize:13 }}>
          ⚠️ <code>VITE_GEMINI_API_KEY</code> not configured — add it to GitHub Secrets.
        </div>
      )}
      {tokenStatus && (
        <div style={{ padding:'10px 16px', marginBottom:14, borderRadius:10, fontSize:13,
          background: tokenStatus.exceeded ? 'rgba(239,68,68,.07)' : 'rgba(99,102,241,.06)',
          border: `1px solid ${tokenStatus.exceeded ? 'rgba(239,68,68,.3)' : 'rgba(99,102,241,.2)'}`,
          color: tokenStatus.exceeded ? '#ef4444' : 'var(--muted)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <span>
            {tokenStatus.exceeded
              ? '🚫 Daily AI limit reached — try again tomorrow.'
              : `🤖 AI tokens used today: ${tokenStatus.used} / ${tokenStatus.limit}`}
          </span>
          {!tokenStatus.exceeded && (
            <div style={{ width:120, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
              <div style={{ height:'100%', borderRadius:3, transition:'width .4s',
                background: tokenStatus.used / tokenStatus.limit > 0.8 ? '#f59e0b' : '#6366f1',
                width: `${Math.min(100, (tokenStatus.used / tokenStatus.limit) * 100)}%` }} />
            </div>
          )}
        </div>
      )}
      <div className="card"
        style={{ padding:'3rem 2rem', textAlign:'center',
          cursor: (noKey || tokenStatus?.exceeded) ? 'not-allowed' : 'pointer',
          border:'2px dashed var(--border)',
          opacity: (noKey || tokenStatus?.exceeded) ? .5 : 1 }}
        onClick={() => !noKey && !tokenStatus?.exceeded && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!tokenStatus?.exceeded) e.currentTarget.style.borderColor='#6366f1' }}
        onDragLeave={e => { e.currentTarget.style.borderColor='' }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor=''; if (!tokenStatus?.exceeded) processFiles(e.dataTransfer.files) }}>
        <div style={{ fontSize:52, marginBottom:12 }}>📄</div>
        <p style={{ fontWeight:700, marginBottom:6 }}>Drop PDF bank statements here</p>
        <p style={{ color:'var(--muted)', fontSize:13 }}>or click to browse · multiple PDFs supported</p>
        <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display:'none' }}
          onChange={e => processFiles(e.target.files)} />
      </div>
      <div style={{ marginTop:20, padding:'14px 18px', borderRadius:12, background:'var(--surface2)', fontSize:13, color:'var(--muted)', lineHeight:1.9 }}>
        <strong style={{ color:'var(--text)' }}>What the AI does</strong><br />
        1. Reads every transaction from your PDFs<br />
        2. Categorises and cleans descriptions<br />
        3. Detects recurring expenses → adds to <strong style={{ color:'var(--text)' }}>Subscriptions</strong><br />
        4. Detects consistent income (e.g. salary) → adds to <strong style={{ color:'var(--text)' }}>Cash Flow</strong><br />
        5. You review and confirm before anything is saved
      </div>
    </div>
  )

  // ── Processing ─────────────────────────────────────────────────────────
  if (page === PAGE.PROCESSING) return (
    <div style={{ maxWidth:640, margin:'0 auto' }}>
      <div className="page-header" style={{ marginBottom:16 }}>
        <h1 className="page-title">Analysing Statements…</h1>
        {globalStep !== 'cancelled' && globalStep !== 'ready' && (
          <button className="btn btn-ghost" style={{ color:'var(--red)', border:'1px solid rgba(239,68,68,.3)' }} onClick={cancel}>
            Cancel
          </button>
        )}
      </div>

      {globalStep === 'cancelled' && (
        <div className="card" style={{ padding:'16px 20px', marginBottom:16, border:'1px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.05)', color:'var(--red)' }}>
          Import cancelled. <button className="btn btn-ghost" style={{ color:'var(--accent)', padding:'0 8px' }}
            onClick={reset}>Start over</button>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {files.map((f, i) => <FileCard key={i} f={f} />)}
      </div>

      {/* Global AI steps */}
      <div className="card" style={{ marginTop:14, padding:'16px 20px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
          AI Analysis Steps
        </div>
        {[
          { key:'detecting-subs',   label:'Detecting recurring expenses & subscriptions', icon:'🔍', desc:'Looking for Netflix, gym, insurance, and other fixed monthly charges' },
          { key:'detecting-income', label:'Detecting consistent income sources',           icon:'💰', desc:'Looking for salary, freelance retainers, and regular transfers in' },
          { key:'ready',            label:'Analysis complete — ready to review',           icon:'✅', desc:'' },
        ].map(step => {
          const stepOrder  = ['detecting-subs','detecting-income','ready']
          const currentIdx = stepOrder.indexOf(globalStep)
          const thisIdx    = stepOrder.indexOf(step.key)
          const isDone     = globalStep === 'ready' || (currentIdx > thisIdx && currentIdx !== -1)
          const isCurrent  = globalStep === step.key
          return (
            <div key={step.key} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'10px 0',
              borderBottom:'1px solid var(--border)', opacity:(isDone||isCurrent)?1:.35 }}>
              <div style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0,
                background: isDone?'rgba(34,197,94,.1)':isCurrent?'rgba(99,102,241,.12)':'var(--surface2)',
                border: isDone?'1px solid rgba(34,197,94,.3)':isCurrent?'1px solid rgba(99,102,241,.3)':'1px solid var(--border)' }}>
                {isCurrent
                  ? <div style={{ width:14,height:14,border:'2px solid rgba(99,102,241,.3)',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .8s linear infinite' }} />
                  : step.icon}
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:14, color:isDone?'var(--green)':isCurrent?'var(--text)':'var(--muted)' }}>{step.label}</div>
                {isCurrent && step.desc && <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{step.desc}</div>}
              </div>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )

  // ── Review ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:1040, margin:'0 auto', paddingBottom:90 }}>
      <div className="page-header" style={{ marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom:2 }}>Review & Confirm</h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>
            {files.length} file{files.length!==1?'s':''} · {recur.length} recurring expenses · {income.length} income sources · {rows.length} one-time transactions
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" onClick={reset}>← Back</button>
          <button className="btn btn-primary"
            disabled={!includedRows.length && !includedSubs.length && !includedInc.length}
            onClick={() => handleSave(onImported)}>
            Confirm & Save All
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        <div className="stat-card" style={{ border:'1px solid rgba(245,158,11,.2)', background:'rgba(245,158,11,.04)' }}>
          <div className="stat-label">Monthly expenses</div>
          <div className="stat-value" style={{ color:'#f59e0b', fontSize:16 }}>{fmtS(monthlySubCost)}/mo</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{includedSubs.length} subscriptions selected</div>
        </div>
        <div className="stat-card" style={{ border:'1px solid rgba(34,197,94,.2)', background:'rgba(34,197,94,.04)' }}>
          <div className="stat-label">Recurring income</div>
          <div className="stat-value" style={{ color:'var(--green)', fontSize:16 }}>{fmtS(totalRecurIncome)}/mo</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{includedInc.length} sources selected</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">One-time income</div>
          <div className="stat-value" style={{ color:'var(--green)', fontSize:16 }}>{fmt(totalIncome)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">One-time expenses</div>
          <div className="stat-value" style={{ color:'var(--red)', fontSize:16 }}>{fmt(totalExpense)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { id:'recurring',    label:`🔁 Recurring Expenses (${recur.length})` },
          { id:'income',       label:`💰 Recurring Income (${income.length})` },
          { id:'transactions', label:`💳 One-time Transactions (${rows.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
              border:'1px solid var(--border)',
              background: tab===t.id ? 'var(--accent-glow)' : 'var(--surface)',
              color:      tab===t.id ? 'var(--accent)' : 'var(--muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recurring' && (
        recur.length === 0
          ? <Empty icon="🔁" msg="No recurring expenses detected." />
          : <>
              <div style={{ marginBottom:10, fontSize:13, color:'var(--muted)' }}>
                These appear every month. Confirmed ones will be added to your <strong style={{ color:'var(--text)' }}>Subscriptions</strong>.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12, marginBottom:10 }}>
                {recur.map(sub => <SubCard key={sub._id} sub={sub} update={updateSub} cycles={CYCLE_LABELS} cats={SUB_CATS} fmtS={fmtS} />)}
              </div>
              <SelectAllToggle items={recur} onToggle={toggleAllS} />
            </>
      )}

      {tab === 'income' && (
        income.length === 0
          ? <Empty icon="💰" msg="No consistent income detected — all income appears as one-time transactions." />
          : <>
              <div style={{ marginBottom:10, fontSize:13, color:'var(--muted)' }}>
                These appear regularly (salary, retainer, etc.). Confirmed ones will be added as income transactions for this month.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12, marginBottom:10 }}>
                {income.map(inc => (
                  <div key={inc._id} className="card" style={{ padding:'14px 16px',
                    opacity: inc._include ? 1 : .45,
                    border: inc._include ? '1px solid rgba(34,197,94,.3)' : '1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <input type="checkbox" checked={inc._include} onChange={e => updateInc(inc._id,'_include',e.target.checked)} />
                      <input type="text" value={inc.name} className="form-input"
                        style={{ padding:'3px 8px', fontSize:14, fontWeight:600, height:28, flex:1 }}
                        onChange={e => updateInc(inc._id,'name',e.target.value)} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div>
                        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Amount</div>
                        <input type="number" min="0" step="0.01" value={inc.amount} className="form-input"
                          style={{ padding:'4px 8px', fontSize:14, height:30, color:'var(--green)', fontWeight:600 }}
                          onChange={e => updateInc(inc._id,'amount',e.target.value)} />
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Frequency</div>
                        <select value={inc.frequency||'monthly'} className="form-input"
                          style={{ padding:'4px 6px', fontSize:12, height:30 }}
                          onChange={e => updateInc(inc._id,'frequency',e.target.value)}>
                          {Object.entries(FREQ_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop:10, fontSize:12, color:'var(--muted)' }}>
                      Category: <strong style={{ color:'var(--text)' }}>{inc.category || 'Salary'}</strong>
                      &ensp;·&ensp;Last seen: {inc.last_date || 'unknown'}
                    </div>
                  </div>
                ))}
              </div>
              <SelectAllToggle items={income} onToggle={toggleAllI} />
            </>
      )}

      {tab === 'transactions' && (
        rows.length === 0
          ? <Empty icon="💳" msg="No one-time transactions to review." />
          : <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'36px 100px 1fr 90px 70px 130px 36px',
                gap:8, padding:'10px 14px', background:'var(--surface2)',
                fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                <label style={{ display:'flex', alignItems:'center' }}>
                  <input type="checkbox" checked={rows.length>0&&rows.every(r=>r._include)} onChange={e=>toggleAll(e.target.checked)} />
                </label>
                <span>Date</span><span>Description</span><span>Amount</span><span>Type</span><span>Category</span><span />
              </div>
              <div style={{ maxHeight:520, overflowY:'auto' }}>
                {rows.map(row => (
                  <div key={row._id} style={{ display:'grid', gridTemplateColumns:'36px 100px 1fr 90px 70px 130px 36px',
                    gap:8, padding:'7px 14px', alignItems:'center', borderBottom:'1px solid var(--border)',
                    opacity:row._include?1:.4, background:row._include?'transparent':'var(--surface2)' }}>
                    <input type="checkbox" checked={row._include} onChange={e=>updateRow(row._id,'_include',e.target.checked)} />
                    <input type="date" value={row.date} className="form-input"
                      style={{ padding:'4px 6px', fontSize:12, height:30 }}
                      onChange={e=>updateRow(row._id,'date',e.target.value)} />
                    <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                      {files.length>1 && <span style={{ width:7,height:7,borderRadius:'50%',flexShrink:0,
                        background:`hsl(${files.findIndex(f=>f.name===row._source)*60},60%,55%)` }} />}
                      <input type="text" value={row.description} className="form-input"
                        style={{ padding:'4px 8px', fontSize:13, height:30, flex:1, minWidth:0 }}
                        onChange={e=>updateRow(row._id,'description',e.target.value)} />
                    </div>
                    <input type="number" min="0" step="0.01" value={row.amount} className="form-input"
                      style={{ padding:'4px 6px', fontSize:13, height:30,
                        color:row.type==='income'?'var(--green)':'var(--red)' }}
                      onChange={e=>updateRow(row._id,'amount',e.target.value)} />
                    <button onClick={()=>updateRow(row._id,'type',row.type==='income'?'expense':'income')}
                      style={{ padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
                        border:'1px solid', height:30,
                        borderColor:row.type==='income'?'rgba(34,197,94,.4)':'rgba(239,68,68,.4)',
                        background:row.type==='income'?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)',
                        color:row.type==='income'?'var(--green)':'var(--red)' }}>
                      {row.type==='income'?'↑ IN':'↓ OUT'}
                    </button>
                    <select value={row.category} className="form-input"
                      style={{ padding:'4px 6px', fontSize:12, height:30 }}
                      onChange={e=>updateRow(row._id,'category',e.target.value)}>
                      {CATEGORIES.map(c=><option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
                    </select>
                    <button onClick={()=>removeRow(row._id)}
                      style={{ color:'var(--muted)', fontSize:16, cursor:'pointer', padding:4 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
      )}

      {/* Bottom bar */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200,
        background:'var(--surface)', borderTop:'1px solid var(--border)',
        padding:'12px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <div style={{ display:'flex', gap:16, fontSize:13, color:'var(--muted)', flexWrap:'wrap' }}>
          {includedSubs.length>0 && <span>🔁 <strong style={{color:'var(--text)'}}>{includedSubs.length}</strong> subs · {fmtS(monthlySubCost)}/mo</span>}
          {includedInc.length>0  && <span>💰 <strong style={{color:'var(--text)'}}>{includedInc.length}</strong> income · {fmtS(totalRecurIncome)}/mo</span>}
          {includedRows.length>0 && <span>💳 <strong style={{color:'var(--text)'}}>{includedRows.length}</strong> transactions</span>}
        </div>
        <button className="btn btn-primary"
          disabled={(!includedRows.length&&!includedSubs.length&&!includedInc.length)||page===PAGE.SAVING}
          onClick={() => handleSave(onImported)} style={{ minWidth:160, justifyContent:'center' }}>
          {page===PAGE.SAVING?'Saving…':'Confirm & Save All'}
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────
function FileCard({ f }) {
  const stepIdx   = FILE_STEPS.findIndex(s => s.key===f.status)
  const isDone    = f.status==='done', isError = f.status==='error'
  const isExtracting = f.status === 'extracting'
  const pct       = isDone?100:isError?0:stepIdx<0?0:Math.round((stepIdx/(FILE_STEPS.length-1))*100)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isExtracting || !f.extractStart) { setElapsed(0); return }
    setElapsed(Math.floor((Date.now() - f.extractStart) / 1000))
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - f.extractStart) / 1000)), 1000)
    return () => clearInterval(t)
  }, [isExtracting, f.extractStart])

  return (
    <div className="card" style={{ padding:'16px 20px',
      border: isDone?'1px solid rgba(34,197,94,.3)':isError?'1px solid rgba(239,68,68,.3)':'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{isDone?'✅':isError?'❌':f.status==='waiting'?'⏳':'⚙️'}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
            <div style={{ fontSize:12, marginTop:2, color:isDone?'var(--green)':isError?'var(--red)':'var(--muted)' }}>
              {isError ? f.error
               : isDone ? `${f.txnCount} transaction${f.txnCount!==1?'s':''} extracted${f.aiModel==='claude' ? ' via Claude' : ' via Gemini'}`
               : f.status==='waiting' ? 'Waiting…'
               : FILE_STEPS.find(s=>s.key===f.status)?.label ?? 'Processing…'}
              {isExtracting && elapsed > 0 && (
                <span style={{ marginLeft:8, color:'var(--accent)', fontVariantNumeric:'tabular-nums' }}>
                  {elapsed}s
                </span>
              )}
            </div>
            {f.retryMsg && (
              <div style={{ fontSize:11, color:'#f59e0b', marginTop:3 }}>⚠️ {f.retryMsg}</div>
            )}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {!isDone && !isError && f.status !== 'waiting' && f.aiModel && (
            <span style={{
              fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
              background: f.aiModel === 'claude' ? 'rgba(245,158,11,.12)' : 'rgba(99,102,241,.12)',
              color:      f.aiModel === 'claude' ? '#f59e0b' : '#818cf8',
              border:     f.aiModel === 'claude' ? '1px solid rgba(245,158,11,.3)' : '1px solid rgba(99,102,241,.3)',
              letterSpacing: '.04em', textTransform: 'uppercase',
            }}>
              {f.aiModel === 'claude' ? '⚡ Claude' : '✦ Gemini'}
            </span>
          )}
          {!isDone&&!isError&&f.status!=='waiting'&&(
            <div style={{ width:18,height:18,border:'2px solid rgba(99,102,241,.2)',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .8s linear infinite' }} />
          )}
        </div>
      </div>
      <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:2, transition:'width .5s ease', width:`${pct}%`,
          background:isDone?'var(--green)':isError?'var(--red)':'#6366f1' }} />
      </div>
      {!isError&&(
        <div style={{ display:'flex', gap:5, marginTop:10, flexWrap:'wrap' }}>
          {FILE_STEPS.map((s,si) => {
            const done=isDone||si<stepIdx, cur=!isDone&&s.key===f.status
            return (
              <div key={s.key} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, fontSize:11,
                background:done?'rgba(34,197,94,.1)':cur?'rgba(99,102,241,.15)':'var(--surface2)',
                color:done?'var(--green)':cur?'#6366f1':'var(--muted)',
                border:cur?'1px solid rgba(99,102,241,.35)':'1px solid transparent',
                fontWeight:cur?700:500 }}>
                <span>{s.icon}</span><span>{s.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SubCard({ sub, update, cycles, cats, fmtS }) {
  const monthly = sub.billing_cycle==='yearly' ? sub.amount/12 : sub.billing_cycle==='weekly' ? sub.amount*4.33 : sub.amount
  return (
    <div className="card" style={{ padding:'14px 16px', opacity:sub._include?1:.45,
      border:sub._include?'1px solid rgba(99,102,241,.3)':'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <input type="checkbox" checked={sub._include} onChange={e=>update(sub._id,'_include',e.target.checked)} />
        <input type="text" value={sub.name} className="form-input"
          style={{ padding:'3px 8px', fontSize:14, fontWeight:600, height:28, flex:1 }}
          onChange={e=>update(sub._id,'name',e.target.value)} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Amount</div>
          <input type="number" min="0" step="0.01" value={sub.amount} className="form-input"
            style={{ padding:'4px 8px', fontSize:14, height:30, color:'var(--red)', fontWeight:600 }}
            onChange={e=>update(sub._id,'amount',e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Cycle</div>
          <select value={sub.billing_cycle||'monthly'} className="form-input"
            style={{ padding:'4px 6px', fontSize:12, height:30 }}
            onChange={e=>update(sub._id,'billing_cycle',e.target.value)}>
            {Object.entries(cycles).map(([v,l])=><option key={v} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Category</div>
          <select value={sub.category||'Other'} className="form-input"
            style={{ padding:'4px 6px', fontSize:12, height:30 }}
            onChange={e=>update(sub._id,'category',e.target.value)}>
            {cats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Next billing</div>
          <input type="date" value={sub.next_billing_date||''} className="form-input"
            style={{ padding:'4px 6px', fontSize:12, height:30 }}
            onChange={e=>update(sub._id,'next_billing_date',e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop:10, fontSize:12, color:'var(--muted)' }}>≈ {fmtS(monthly)}/mo</div>
    </div>
  )
}

function SelectAllToggle({ items, onToggle }) {
  return (
    <div style={{ fontSize:12, color:'var(--muted)' }}>
      <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', width:'fit-content' }}>
        <input type="checkbox" checked={items.every(s=>s._include)} onChange={e=>onToggle(e.target.checked)} />
        Select / deselect all
      </label>
    </div>
  )
}

function Empty({ icon, msg }) {
  return (
    <div className="card" style={{ padding:'2.5rem', textAlign:'center', color:'var(--muted)' }}>
      <div style={{ fontSize:36, marginBottom:10 }}>{icon}</div>
      {msg}
    </div>
  )
}

function Pill({ label, color }) {
  return (
    <div style={{ padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:600,
      background:`${color}18`, color, border:`1px solid ${color}44` }}>{label}</div>
  )
}
