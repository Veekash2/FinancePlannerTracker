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

  // Catmull-Rom → cubic bezier smooth path
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

  // deterministic gradient ID from color
  const gid = `ag${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Subtle grid */}
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = PAD.t + f * (VH - PAD.t - PAD.b)
        return <line key={f} x1={PAD.l} x2={VW - PAD.r} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      })}
      {/* Gradient fill */}
      <path d={areaPath} fill={`url(#${gid})`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data-point dots */}
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2.5">
          <title>{c.label}: R{c.value.toFixed(0)}</title>
        </circle>
      ))}
      {/* X-axis labels */}
      {coords.map((c, i) => (
        <text key={i} x={c.x} y={VH - 8} textAnchor="middle" fontSize="13" style={{ fill: 'var(--muted)' }}>{c.label}</text>
      ))}
    </svg>
  )
}
