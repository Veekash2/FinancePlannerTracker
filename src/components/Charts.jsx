// ─── Donut / ring chart ───────────────────────────────────────────────────────
// segments: [{label, value, color}]
export function DonutChart({ segments, centerLabel, centerSub, size = 200 }) {
  const total = segments.reduce((s, d) => s + d.value, 0)
  if (!total) return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
      No data
    </div>
  )

  const cx = size / 2, cy = size / 2
  const R = size * 0.43, ri = size * 0.27
  const GAP = segments.length > 1 ? 0.04 : 0

  let angle = -Math.PI / 2
  const slices = segments.map(seg => {
    const span = (seg.value / total) * Math.PI * 2 - GAP
    const a1 = angle, a2 = angle + span
    angle = a2 + GAP
    return { ...seg, a1, a2 }
  })

  const arcPath = (a1, a2) => {
    const cos = Math.cos, sin = Math.sin
    const x1 = cx + R * cos(a1),    y1 = cy + R * sin(a1)
    const x2 = cx + R * cos(a2),    y2 = cy + R * sin(a2)
    const xi1 = cx + ri * cos(a2),  yi1 = cy + ri * sin(a2)
    const xi2 = cx + ri * cos(a1),  yi2 = cy + ri * sin(a1)
    const lg = a2 - a1 > Math.PI ? 1 : 0
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${xi1.toFixed(2)} ${yi1.toFixed(2)} A ${ri} ${ri} 0 ${lg} 0 ${xi2.toFixed(2)} ${yi2.toFixed(2)} Z`
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, maxWidth: '100%', flexShrink: 0 }}>
      {slices.map((s, i) => (
        <path key={i} d={arcPath(s.a1, s.a2)} fill={s.color} style={{ transition: 'opacity .15s' }}>
          <title>{s.label}: R{s.value.toFixed(0)} ({Math.round((s.value / total) * 100)}%)</title>
        </path>
      ))}
      {centerLabel && (
        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.09} fontWeight="800" fill="currentColor" style={{ fill: 'var(--text)' }}>
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + size * 0.13} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.065} style={{ fill: 'var(--muted)' }}>
          {centerSub}
        </text>
      )}
    </svg>
  )
}

// ─── Smooth area / line chart ─────────────────────────────────────────────────
// points: [{label, value}]
export function AreaChart({ points, color = '#6366f1' }) {
  if (!points || points.length < 2) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Not enough data yet
    </div>
  )

  const PAD = { t: 14, r: 12, b: 30, l: 10 }
  const VW = 600, VH = 140

  const maxV = Math.max(...points.map(p => p.value), 1)
  const coords = points.map((p, i) => ({
    x: PAD.l + (i / (points.length - 1)) * (VW - PAD.l - PAD.r),
    y: PAD.t + (1 - p.value / maxV) * (VH - PAD.t - PAD.b),
    label: p.label,
    value: p.value,
  }))

  function buildPath(pts) {
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(i + 2, pts.length - 1)]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  }

  const linePath = buildPath(coords)
  const bott = VH - PAD.b
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${bott} L ${coords[0].x.toFixed(1)} ${bott} Z`
  const gid = `ag${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = PAD.t + f * (VH - PAD.t - PAD.b)
        return <line key={f} x1={PAD.l} x2={VW - PAD.r} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      })}
      <path d={areaPath} fill={`url(#${gid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2.5">
          <title>{c.label}: R{c.value.toFixed(0)}</title>
        </circle>
      ))}
      {coords.map((c, i) => (
        <text key={i} x={c.x} y={VH - 8} textAnchor="middle" fontSize="13" style={{ fill: 'var(--muted)' }}>{c.label}</text>
      ))}
    </svg>
  )
}

// ─── Dual-series trend chart: income + expenses bars + net cash flow line ─────
// income:   [{label, value}]  — green bars
// expenses: [{label, value}]  — red bars
// Both arrays must be same length and same labels
function shortR(n) {
  if (n >= 1000000) return `R${(n / 1000000).toFixed(1)}M`
  if (n >= 1000)    return `R${(n / 1000).toFixed(0)}k`
  return `R${Math.round(n)}`
}

export function TrendChart({ income = [], expenses = [] }) {
  if (!income.length || !expenses.length) return (
    <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Not enough data yet
    </div>
  )

  const VW = 700, VH = 220
  const PAD = { t: 20, r: 16, b: 40, l: 64 }
  const chartW = VW - PAD.l - PAD.r
  const chartH = VH - PAD.t - PAD.b
  const n = income.length
  const colW = chartW / n
  const barW = colW * 0.28
  const gap = barW * 0.4

  const allVals = [...income.map(p => p.value), ...expenses.map(p => p.value), 1]
  const maxV = Math.max(...allVals)

  // Nice rounded Y-axis max
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxV)))
  const niceMax = Math.ceil(maxV / magnitude) * magnitude

  const toY = v => PAD.t + chartH * (1 - v / niceMax)
  const toX = i => PAD.l + i * colW + colW / 2

  // Y-axis grid lines (4 steps)
  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({ y: PAD.t + chartH * (1 - f), label: shortR(niceMax * f) }))

  // Net cash flow line (smooth)
  const netPts = income.map((p, i) => ({
    x: toX(i),
    y: toY(Math.max(0, p.value - expenses[i].value)),
    net: p.value - expenses[i].value,
    label: p.label,
  }))

  function buildLinePath(pts) {
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)]
      const p1 = pts[i], p2 = pts[i + 1]
      const p3 = pts[Math.min(i + 2, pts.length - 1)]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  }

  const netPath = buildLinePath(netPts)
  const baseY = PAD.t + chartH

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 12 }}>
        {[
          { color: '#22c55e', label: 'Income' },
          { color: '#ef4444', label: 'Expenses' },
          { color: '#06b6d4', label: 'Net cash flow', dashed: true },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
            <span style={{ width: 24, height: l.dashed ? 0 : 10, borderRadius: 2, background: l.dashed ? 'none' : l.color,
              borderTop: l.dashed ? `2px dashed ${l.color}` : 'none', display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="inc-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="exp-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.5" />
          </linearGradient>
          <filter id="glow-cyan">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Y-axis grid + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={VW - PAD.r} y1={t.y} y2={t.y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={PAD.l - 8} y={t.y + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--muted)' }}>{t.label}</text>
          </g>
        ))}

        {/* Baseline */}
        <line x1={PAD.l} x2={VW - PAD.r} y1={baseY} y2={baseY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* Bars */}
        {income.map((p, i) => {
          const cx = toX(i)
          const incH = chartH * (p.value / niceMax)
          const expH = chartH * (expenses[i].value / niceMax)
          const incX = cx - gap / 2 - barW
          const expX = cx + gap / 2
          return (
            <g key={i}>
              {/* Income bar */}
              <rect x={incX} y={baseY - incH} width={barW} height={incH} rx="3" fill="url(#inc-grad)">
                <title>Income {p.label}: {shortR(p.value)}</title>
              </rect>
              {/* Value above income bar */}
              {p.value > 0 && (
                <text x={incX + barW / 2} y={baseY - incH - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" style={{ fill: '#22c55e' }}>
                  {shortR(p.value)}
                </text>
              )}

              {/* Expense bar */}
              <rect x={expX} y={baseY - expH} width={barW} height={expH} rx="3" fill="url(#exp-grad)">
                <title>Expenses {expenses[i].label}: {shortR(expenses[i].value)}</title>
              </rect>
              {expenses[i].value > 0 && (
                <text x={expX + barW / 2} y={baseY - expH - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" style={{ fill: '#ef4444' }}>
                  {shortR(expenses[i].value)}
                </text>
              )}

              {/* X-axis label */}
              <text x={cx} y={VH - 8} textAnchor="middle" fontSize="12" style={{ fill: 'var(--muted)' }}>{p.label}</text>

              {/* Vertical column separator */}
              {i > 0 && (
                <line x1={PAD.l + i * colW} x2={PAD.l + i * colW} y1={PAD.t} y2={baseY}
                  stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              )}
            </g>
          )
        })}

        {/* Net cash flow line */}
        <path d={netPath} fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="5 3"
          strokeLinecap="round" filter="url(#glow-cyan)" />

        {/* Net dots + values */}
        {netPts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#06b6d4" stroke="var(--surface)" strokeWidth="2">
              <title>Net {p.label}: {p.net >= 0 ? '+' : ''}{shortR(Math.abs(p.net))}</title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  )
}
