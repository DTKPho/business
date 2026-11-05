import { useRef, useState } from 'react'
import { formatDate } from '../../engine/core/time'
import { fmtEur } from '../../engine/core/money'

/** Courbe de valorisation (série unique) avec réticule et info-bulle au survol. */
export function ValuationChart({ points, thresholds = [] }: { points: { date: string; valueEur: number }[]; thresholds?: number[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 220
  const pad = { l: 56, r: 12, t: 12, b: 26 }
  if (points.length < 2) return <p className="text-sm text-ink-400">L'historique de valorisation se construit mois après mois.</p>
  const vals = points.map((p) => p.valueEur)
  const visibleThresholds = thresholds.filter((t) => t <= Math.max(...vals) * 1.35)
  const min = Math.min(...vals) * 0.95
  const max = Math.max(...vals, ...visibleThresholds) * 1.03
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valueEur).toFixed(1)}`).join('')
  const ticks = [0, 0.5, 1].map((f) => min + (max - min) * f)
  const years = points.map((p, i) => ({ i, y: p.date.slice(0, 4) })).filter((p, k, arr) => k === 0 || arr[k - 1].y !== p.y)

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }
  const hp = hover !== null ? points[hover] : null

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label="Évolution de la valorisation de l'écurie" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#2a2a31" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8a8a96">
              {(t / 1e9).toFixed(2).replace('.', ',')} Md€
            </text>
          </g>
        ))}
        {visibleThresholds.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#b4b4bf" strokeDasharray="4 4" strokeWidth={1} />
            <text x={W - pad.r} y={y(t) - 4} textAnchor="end" fontSize={11} fill="#b4b4bf">
              Earn-out {(t / 1e9).toFixed(0)} Md€
            </text>
          </g>
        ))}
        {years.map((yy) => (
          <text key={yy.i} x={x(yy.i)} y={H - 8} fontSize={11} fill="#8a8a96" textAnchor={yy.i === 0 ? 'start' : 'middle'}>
            {yy.y}
          </text>
        ))}
        <path d={path} fill="none" stroke="#e8541a" strokeWidth={2} strokeLinejoin="round" />
        {hp && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#8a8a96" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(hp.valueEur)} r={5} fill="#e8541a" stroke="#121215" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-xs shadow"
          style={{ left: `${Math.min(80, Math.max(5, (x(hover) / W) * 100))}%`, transform: 'translateX(-50%)' }}
        >
          <div className="text-ink-400">{formatDate(hp.date)}</div>
          <div className="font-semibold tabular">{fmtEur(hp.valueEur)}</div>
        </div>
      )}
    </div>
  )
}
