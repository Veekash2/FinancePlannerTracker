import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { parseBankStatementPDF, detectSubscriptions, detectRecurringIncome } from '../utils/gemini'
import { api } from '../storage'
import { GEMINI_API_KEY } from '../config'

const ImportContext = createContext(null)
export const useImport = () => useContext(ImportContext)

const PAGE = { UPLOAD: 'upload', PROCESSING: 'processing', REVIEW: 'review', SAVING: 'saving', DONE: 'done' }
const today = () => new Date().toISOString().slice(0, 10)
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

export function ImportProvider({ children }) {
  const [page,        setPage]       = useState(PAGE.UPLOAD)
  const [files,       setFiles]      = useState([])
  const [globalStep,  setGlobalStep] = useState('idle')
  const [rows,        setRows]       = useState([])
  const [recur,       setRecur]      = useState([])
  const [income,      setIncome]     = useState([])
  const [tab,         setTab]        = useState('recurring')
  const [savedTxns,   setSavedTxns]  = useState(0)
  const [savedSubs,   setSavedSubs]  = useState(0)
  const [savedInc,    setSavedInc]   = useState(0)
  const [saveProgress, setSaveProgress] = useState(null) // { done, total, phase }
  const cancelledRef  = useRef(false)
  const noKey = !GEMINI_API_KEY

  const isRunning = page === PAGE.PROCESSING

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setGlobalStep('cancelled')
  }, [])

  const reset = useCallback(() => {
    setPage(PAGE.UPLOAD)
    setFiles([])
    setRows([])
    setRecur([])
    setIncome([])
    setGlobalStep('idle')
  }, [])

  async function processFiles(fileList) {
    const arr = Array.from(fileList).filter(f => f.type === 'application/pdf')
    if (!arr.length) return

    cancelledRef.current = false
    setFiles(arr.map(f => ({ name: f.name, status: 'waiting', txnCount: 0, error: null })))
    setGlobalStep('idle')
    setPage(PAGE.PROCESSING)

    const allTxns = []
    let rowId = 0

    for (let i = 0; i < arr.length; i++) {
      if (cancelledRef.current) break
      const file = arr[i]
      const set = (status, extra = {}) =>
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status, ...extra } : f))

      try {
        set('reading');     await delay(300)
        if (cancelledRef.current) break
        set('sending');     await delay(200)
        if (cancelledRef.current) break
        set('extracting', { extractStart: Date.now(), retryMsg: null, aiModel: 'gemini' })
        const result = await parseBankStatementPDF(file, {
          onRetry: (attempt, wait) =>
            setFiles(prev => prev.map((f, idx) => idx === i
              ? { ...f,
                  aiModel: attempt === 'claude' ? 'claude' : 'gemini',
                  retryMsg: attempt === 'claude'
                    ? null
                    : `Gemini busy — retrying in ${Math.round(wait / 1000)}s (attempt ${attempt})` }
              : f
            ))
        })
        if (cancelledRef.current) break
        set('categorising', { retryMsg: null }); await delay(400)
        const txns = (result.transactions || []).map(t => ({
          ...t, _id: rowId++, _include: true, _source: file.name,
        }))
        allTxns.push(...txns)
        set('done', { txnCount: txns.length })
      } catch (e) {
        set('error', { error: e.message || 'Failed to parse' })
      }
    }

    if (cancelledRef.current) return

    setGlobalStep('detecting-subs')
    let detectedSubs = [], detectedIncome = [], oneTimeTxns = allTxns
    try {
      detectedSubs = await detectSubscriptions(allTxns)
      if (cancelledRef.current) return
      const recurNames = new Set(detectedSubs.map(s => s.name.toLowerCase()))
      oneTimeTxns = allTxns.filter(t => !recurNames.has(t.description?.toLowerCase()))
    } catch {}

    setGlobalStep('detecting-income')
    try {
      detectedIncome = await detectRecurringIncome(allTxns)
      if (cancelledRef.current) return
      const incNames = new Set(detectedIncome.map(s => s.name.toLowerCase()))
      oneTimeTxns = oneTimeTxns.filter(t =>
        !(t.type === 'income' && incNames.has(t.description?.toLowerCase()))
      )
    } catch {}

    // Deduplicate subs and income by name (multiple PDFs detect same recurring items)
    const uniqueSubs = Object.values(
      detectedSubs.reduce((acc, s) => {
        const key = s.name.toLowerCase().trim()
        if (!acc[key]) acc[key] = s
        return acc
      }, {})
    )
    const uniqueIncome = Object.values(
      detectedIncome.reduce((acc, s) => {
        const key = s.name.toLowerCase().trim()
        if (!acc[key]) acc[key] = s
        return acc
      }, {})
    )

    setRows(oneTimeTxns)
    setRecur(uniqueSubs.map((s, i) => ({ ...s, _id: i, _include: true })))
    setIncome(uniqueIncome.map((s, i) => ({ ...s, _id: i, _include: true })))
    setGlobalStep('ready')
    await delay(700)
    if (!cancelledRef.current) {
      setPage(PAGE.REVIEW)
      setTab(detectedSubs.length > 0 ? 'recurring' : detectedIncome.length > 0 ? 'income' : 'transactions')
    }
  }

  async function handleSave(onImported) {
    const toSaveTxns = rows.filter(r => r._include)
    const toSaveSubs = recur.filter(s => s._include)
    const toSaveInc  = income.filter(s => s._include)
    const total = toSaveTxns.length + toSaveSubs.length + toSaveInc.length

    setSaveProgress({ done: 0, total, phase: 'subscriptions' })
    setPage(PAGE.SAVING)

    let tc = 0, sc = 0, ic = 0, done = 0

    // Fetch existing subscription names to avoid duplicates
    const existingSubs = await api.getSubscriptions().catch(() => [])
    const existingSubNames = new Set(existingSubs.map(s => s.name.toLowerCase().trim()))

    for (const sub of toSaveSubs) {
      if (existingSubNames.has(sub.name.toLowerCase().trim())) { done++; setSaveProgress({ done, total, phase: 'subscriptions' }); continue }
      try { await api.addSubscription({ name: sub.name, amount: parseFloat(sub.amount), billing_cycle: sub.billing_cycle || 'monthly', category: sub.category || 'Other', next_billing_date: sub.next_billing_date || today(), color: '#6366f1' }); sc++ } catch {}
      done++; setSaveProgress({ done, total, phase: 'subscriptions' })
    }
    setSaveProgress({ done, total, phase: 'income' })
    for (const inc of toSaveInc) {
      try { await api.addTransaction({ description: inc.name, amount: parseFloat(inc.amount), type: 'income', date: inc.last_date || today(), category: inc.category || 'Salary' }); ic++ } catch {}
      done++; setSaveProgress({ done, total, phase: 'income' })
    }
    setSaveProgress({ done, total, phase: 'transactions' })
    // Save transactions in batches of 10 in parallel for speed
    const BATCH = 10
    for (let i = 0; i < toSaveTxns.length; i += BATCH) {
      const batch = toSaveTxns.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(row =>
        api.addTransaction({ description: row.description, amount: parseFloat(row.amount), type: row.type, date: row.date, category: row.category })
      ))
      tc += results.filter(r => r.status === 'fulfilled').length
      done += batch.length
      setSaveProgress({ done, total, phase: 'transactions' })
    }

    setSavedTxns(tc); setSavedSubs(sc); setSavedInc(ic)
    setPage(PAGE.DONE)
    onImported?.()
  }

  const removeRow  = (id) => setRows(r => r.filter(row => row._id !== id))
  const updateRow  = (id, f, v) => setRows(r => r.map(row => row._id === id ? { ...row, [f]: v } : row))
  const updateSub  = (id, f, v) => setRecur(r => r.map(s => s._id === id ? { ...s, [f]: v } : s))
  const updateInc  = (id, f, v) => setIncome(r => r.map(s => s._id === id ? { ...s, [f]: v } : s))
  const toggleAll  = c => setRows(r => r.map(row => ({ ...row, _include: c })))
  const toggleAllS = c => setRecur(r => r.map(s => ({ ...s, _include: c })))
  const toggleAllI = c => setIncome(r => r.map(s => ({ ...s, _include: c })))

  return (
    <ImportContext.Provider value={{
      PAGE, page, setPage, files, globalStep, rows, recur, income, tab, setTab,
      savedTxns, savedSubs, savedInc, noKey, isRunning,
      processFiles, cancel, reset, handleSave,
      saveProgress,
      removeRow, updateRow, updateSub, updateInc, toggleAll, toggleAllS, toggleAllI,
    }}>
      {children}
    </ImportContext.Provider>
  )
}
