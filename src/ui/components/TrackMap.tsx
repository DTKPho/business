import { useMemo } from 'react'
import { DATA } from '../../engine/init/data'

export interface TrackDot {
  id: string
  f: number // position sur le tour (0–1)
  color: string
  label?: string
  highlight?: boolean
  dim?: boolean
}

interface Geo {
  pts: number[][]
  cum: number[]
  total: number
  d: string
}

const cache = new Map<string, Geo>()

export function trackGeo(circuitId: string): Geo | null {
  const hit = cache.get(circuitId)
  if (hit) return hit
  const pts = DATA.tracks.tracks[circuitId]
  if (!pts) return null
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const closing = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1])
  const total = cum[cum.length - 1] + closing
  const d = `M${pts.map((p) => `${p[0]},${p[1]}`).join(' L')} Z`
  const g = { pts, cum, total, d }
  cache.set(circuitId, g)
  return g
}

export function pointAt(g: Geo, f: number): [number, number] {
  const x = ((f % 1) + 1) % 1
  const target = x * g.total
  let i = 1
  while (i < g.cum.length && g.cum[i] < target) i++
  if (i >= g.cum.length) {
    const a = g.pts[g.pts.length - 1]
    const b = g.pts[0]
    const seg = g.total - g.cum[g.cum.length - 1]
    const t = seg ? (target - g.cum[g.cum.length - 1]) / seg : 0
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
  const a = g.pts[i - 1]
  const b = g.pts[i]
  const seg = g.cum[i] - g.cum[i - 1]
  const t = seg ? (target - g.cum[i - 1]) / seg : 0
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Tracé du circuit (vue globale), avec voitures en option (radar). */
export function TrackMap({ circuitId, dots = [], accent = '#ff5a1f', className, labels = false, thin = false }: { circuitId: string; dots?: TrackDot[]; accent?: string; className?: string; labels?: boolean; thin?: boolean }) {
  const g = useMemo(() => trackGeo(circuitId), [circuitId])
  if (!g) return null
  const [sx, sy] = g.pts[0]
  const [nx, ny] = g.pts[1]
  const ang = Math.atan2(ny - sy, nx - sx) + Math.PI / 2
  const sw = thin ? 10 : 18
  return (
    <svg viewBox="-20 -20 1040 1040" className={className} role="img" aria-label="Tracé du circuit">
      <path d={g.d} fill="none" stroke="var(--track-casing)" strokeWidth={sw + 10} strokeLinejoin="round" opacity={0.9} />
      <path d={g.d} fill="none" stroke="var(--track-stroke)" strokeWidth={sw} strokeLinejoin="round" />
      <line x1={sx - Math.cos(ang) * 22} y1={sy - Math.sin(ang) * 22} x2={sx + Math.cos(ang) * 22} y2={sy + Math.sin(ang) * 22} stroke={accent} strokeWidth={8} />
      {dots
        .slice()
        .sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight))
        .map((d) => {
          const [x, y] = pointAt(g, d.f)
          return (
            <g key={d.id} opacity={d.dim ? 0.35 : 1}>
              <circle cx={x} cy={y} r={d.highlight ? 19 : 14} fill={d.color} stroke="var(--track-casing)" strokeWidth={4} />
              {(labels || d.highlight) && d.label && (
                <text x={x + 22} y={y - 16} fontSize={30} fontWeight={700} fill="var(--color-ink-100)" stroke="var(--track-casing)" strokeWidth={6} paintOrder="stroke">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
    </svg>
  )
}
