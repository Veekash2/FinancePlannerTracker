import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, loading } = useAuth()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - .5) * .35,
      vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.2 + .4,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(99,102,241,.4)'
        ctx.fill()
      })
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(99,102,241,${.12 * (1 - dist / 120)})`
            ctx.lineWidth = .5
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, opacity: .7 }} />

      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 500, height: 500,
        background: 'radial-gradient(ellipse, rgba(99,102,241,.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 380,
        padding: '2.5rem',
        background: 'rgba(26,26,36,.95)',
        border: '1px solid rgba(99,102,241,.25)',
        borderRadius: 16,
        boxShadow: '0 0 40px rgba(99,102,241,.1), 0 0 80px rgba(99,102,241,.04), inset 0 1px 0 rgba(99,102,241,.08)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Corner brackets */}
        {[['top',8,'left',8,'borderTop','borderLeft'],['top',8,'right',8,'borderTop','borderRight'],['bottom',8,'left',8,'borderBottom','borderLeft'],['bottom',8,'right',8,'borderBottom','borderRight']].map(([v1,o1,v2,o2,b1,b2], i) => (
          <span key={i} style={{ position:'absolute', [v1]:o1, [v2]:o2, width:14, height:14, [b1]:'1.5px solid rgba(99,102,241,.6)', [b2]:'1.5px solid rgba(99,102,241,.6)' }} />
        ))}

        <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,rgba(99,102,241,.8),transparent)', borderRadius:1 }} />

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(99,102,241,.08)',
            border: '1px solid rgba(99,102,241,.35)',
            boxShadow: '0 0 20px rgba(99,102,241,.2), inset 0 1px 0 rgba(99,102,241,.15)',
            marginBottom: 16,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26, filter: 'drop-shadow(0 0 6px rgba(99,102,241,.6))' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>

          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 800,
            letterSpacing: '.18em', textTransform: 'uppercase',
            color: '#6366f1',
            textShadow: '0 0 16px rgba(99,102,241,.6), 0 0 32px rgba(99,102,241,.2)',
          }}>
            Spendwise
          </h1>

          <p style={{ margin: '8px 0 0', fontSize: 11, letterSpacing: '.12em', color: '#4d4d6a', textTransform: 'uppercase' }}>
            Personal Finance Tracker
          </p>
        </div>

        <div style={{ height: 1, background: 'rgba(99,102,241,.08)', marginBottom: '1.5rem' }} />

        <p style={{ textAlign: 'center', fontSize: 13, color: '#6666aa', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Track spending · Plan goals · Manage subscriptions.<br/>
          Sign in to access your finance dashboard.
        </p>

        <button
          onClick={login}
          disabled={loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '11px 16px',
            background: loading ? 'rgba(99,102,241,.04)' : 'rgba(99,102,241,.09)',
            border: '1px solid rgba(99,102,241,.45)',
            borderRadius: 10,
            color: '#6366f1',
            fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? .5 : 1,
            transition: 'all .2s',
            boxShadow: '0 0 14px rgba(99,102,241,.1)',
          }}
          onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(99,102,241,.16)'; e.currentTarget.style.boxShadow = '0 0 22px rgba(99,102,241,.25)' } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,.09)'; e.currentTarget.style.boxShadow = '0 0 14px rgba(99,102,241,.1)' }}
        >
          {loading ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeOpacity=".4"/>
              </svg>
              Connecting…
            </>
          ) : (
            <>
              <GoogleIcon />
              Sign in with Google
            </>
          )}
        </button>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 10, color: '#2e2e55', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Your data stays local · No server storage
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.51h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.16 7.09-10.36 7.09-17.14z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.79-3-.79-4.59s.29-3.14.79-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    </svg>
  )
}
