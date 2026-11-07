import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Button, Card, Table, TeamDot, cx, td, th } from './ui'
import { TrackMap } from './TrackMap'
import type { TrackDot } from './TrackMap'
import { TyreIcon } from './TyreIcon'
import type { LiveLap, PendingSession } from '../../engine/model/types'
import { SESSION_LABEL, commitPendingSession, formatLap } from '../../engine/season/weekend'
import { fullName } from '../../engine/people/ratings'

const SPEEDS = [
  { id: 'pause', label: '❚❚', k: 0 },
  { id: '10', label: '×10', k: 10 },
  { id: '30', label: '×30', k: 30 },
  { id: '60', label: '×60', k: 60 },
  { id: '150', label: '×150', k: 150 },
] as const

function clock(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Rejoue une séance d'essais ou de qualifications en direct (chronos + radar). */
export function LiveSession({ pending, circuitId, accent }: { pending: PendingSession; circuitId: string; accent: string }) {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const [t, setT] = useState(0)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]['id']>('30')
  const k = SPEEDS.find((s) => s.id === speed)!.k
  const last = useRef<number | null>(null)
  const done = t >= pending.duration

  useEffect(() => {
    if (!k || done) return
    let raf = 0
    const loop = (now: number) => {
      if (last.current !== null) setT((x) => Math.min(pending.duration, x + ((now - last.current!) / 1000) * k))
      last.current = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      last.current = null
    }
  }, [k, done, pending.duration])

  const byDriver = useMemo(() => {
    const m = new Map<string, LiveLap[]>()
    for (const l of pending.laps) {
      const arr = m.get(l.driverId) ?? []
      arr.push(l)
      m.set(l.driverId, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.start - b.start)
    return m
  }, [pending])

  const isQ = !!pending.segments
  const segIdx = isQ ? Math.max(0, pending.segments!.filter((s) => s.start <= t).length - 1) : 0
  const seg = isQ ? pending.segments![segIdx] : null
  const eliminatedAt = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of pending.segments ?? []) for (const id of s.eliminated) m.set(id, s.seg)
    return m
  }, [pending])

  // Classement à l'instant t
  const rows = [...byDriver.entries()].map(([id, laps]) => {
    const out = isQ ? eliminatedAt.get(id) : undefined
    const knocked = out !== undefined && t > pending.segments![out - 1].end + 60
    const relevantSeg = knocked ? out : seg?.seg
    let best = Infinity
    let lastLap: LiveLap | null = null
    let count = 0
    let onTrack: LiveLap | null = null
    for (const l of laps) {
      if (l.start <= t && t < l.end) onTrack = l
      if (l.end > t || !l.timed) continue
      count++
      lastLap = l
      if (!isQ || l.segment === relevantSeg) best = Math.min(best, l.lapTime)
    }
    return { id, best, lastLap, count, onTrack, knocked, out }
  })
  rows.sort((a, b) => {
    if (a.knocked !== b.knocked) return a.knocked ? 1 : -1
    if (a.knocked && b.knocked && a.out !== b.out) return (b.out ?? 0) - (a.out ?? 0)
    return a.best - b.best
  })
  const fastest = rows.find((r) => r.best < Infinity)?.best ?? Infinity
  const cutoff = isQ && seg && seg.seg < 3 ? rows.filter((r) => !r.knocked).length - 6 : null

  const dots: TrackDot[] = rows
    .filter((r) => r.onTrack)
    .map((r) => {
      const d = game.drivers[r.id]
      const team = game.teams[d.teamId!]
      const l = r.onTrack!
      return { id: r.id, f: (t - l.start) / (l.end - l.start), color: team.colors.primary, label: d.lastName.slice(0, 3).toUpperCase(), highlight: team.isPlayer, dim: !l.timed }
    })

  // Fil des derniers tours marquants
  const feed = useMemo(() => {
    const items: { t: number; text: string; mine: boolean }[] = []
    let best = Infinity
    for (const l of pending.laps) {
      if (l.end > t) break
      if (!l.timed) continue
      const mine = game.drivers[l.driverId].teamId === game.playerTeamId
      if (l.lapTime < best) {
        best = l.lapTime
        items.push({ t: l.end, text: `Meilleur temps : ${fullName(game.drivers[l.driverId])} en ${formatLap(l.lapTime)}`, mine })
      } else if (mine) items.push({ t: l.end, text: `${fullName(game.drivers[l.driverId])} : ${formatLap(l.lapTime)}`, mine })
    }
    return items.slice(-8).reverse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(t / 5), pending])

  const commit = () => {
    const r = act((s) => commitPendingSession(s), { save: 'now' })
    if (r) {
      const mine = r.rows.filter((x) => x.teamId === game.playerTeamId)
      toast(`${SESSION_LABEL[r.session]} : ${mine.map((m) => `${fullName(game.drivers[m.driverId])} P${m.position}`).join(', ')}`, 'good')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-lg bg-bad/10 px-2 py-1 text-xs font-bold text-bad">
              <span className="h-2 w-2 rounded-full bg-bad" style={{ animation: done ? undefined : 'pulse-dot 1.2s infinite' }} />
              {done ? 'TERMINÉ' : 'EN DIRECT'}
            </span>
            <div>
              <div className="font-semibold">
                {SESSION_LABEL[pending.session]}
                {seg && <span className="ml-2 text-magma-500">{pending.session === 'SQ' ? 'SQ' : 'Q'}{seg.seg}</span>}
              </div>
              <div className="text-xs text-ink-400 tabular">
                {clock(t)} / {clock(pending.duration)} · {pending.wetness > 0 ? `piste humide (${Math.round(pending.wetness * 100)} %)` : 'piste sèche'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-ink-700 bg-ink-850 p-0.5">
              {SPEEDS.map((s) => (
                <button key={s.id} onClick={() => setSpeed(s.id)} className={cx('rounded-lg px-2.5 py-1 text-xs font-medium', speed === s.id ? 'bg-magma-500 text-white' : 'text-ink-300 hover:text-ink-100')}>
                  {s.label}
                </button>
              ))}
            </div>
            {done ? (
              <Button variant="primary" onClick={commit}>
                Valider le classement ▸
              </Button>
            ) : (
              <Button onClick={commit}>⏭ Passer à la fin</Button>
            )}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full bg-magma-500" style={{ width: `${(t / pending.duration) * 100}%` }} />
        </div>
        {isQ && (
          <div className="mt-2 flex gap-1">
            {pending.segments!.map((s) => (
              <div key={s.seg} className={cx('flex-1 rounded-md px-2 py-1 text-center text-[11px] font-medium', t >= s.start && t <= s.end + 60 ? 'bg-magma-500 text-white' : t > s.end ? 'bg-ink-700 text-ink-300' : 'bg-ink-800 text-ink-400')}>
                {pending.session === 'SQ' ? 'SQ' : 'Q'}
                {s.seg} · {clock(s.end - s.start)}
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card title="Radar du circuit">
          <TrackMap circuitId={circuitId} dots={dots} accent={accent} className="mx-auto aspect-square w-full max-w-[520px]" />
          <p className="mt-2 text-center text-[11px] text-ink-400">Points pâles : tours de sortie ou de rentrée. Vos voitures sont signalées par leur nom.</p>
        </Card>
        <Card title="Chronométrage" pad={false}>
          <Table>
            <thead>
              <tr>
                <th className={th}>P</th>
                <th className={th}>Pilote</th>
                <th className={cx(th, 'text-right')}>Meilleur</th>
                <th className={cx(th, 'text-right')}>Écart</th>
                <th className={th}>État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const d = game.drivers[r.id]
                const team = game.teams[d.teamId!]
                const danger = cutoff !== null && !r.knocked && i >= cutoff
                return (
                  <tr key={r.id} className={cx(team.isPlayer && 'bg-magma-500/10', r.knocked && 'opacity-50')}>
                    <td className={cx(td, 'tabular', danger && 'text-bad font-semibold')}>{i + 1}</td>
                    <td className={td}>
                      <span className="flex items-center gap-1.5">
                        <TeamDot color={team.colors.primary} />
                        <span className={team.isPlayer ? 'font-semibold' : ''}>{fullName(d)}</span>
                      </span>
                    </td>
                    <td className={cx(td, 'text-right tabular')}>{r.best < Infinity ? formatLap(r.best) : '—'}</td>
                    <td className={cx(td, 'text-right tabular text-ink-400')}>{r.best < Infinity && r.best !== fastest ? `+${(r.best - fastest).toFixed(3)}` : ''}</td>
                    <td className={td}>
                      {r.knocked ? (
                        <Badge>Éliminé Q{r.out}</Badge>
                      ) : r.onTrack ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <TyreIcon c={r.onTrack.compound} />
                          {r.onTrack.timed ? 'Tour lancé' : 'En piste'}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">Stand · {r.count} t.</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card title="Fil de la séance">
        {feed.length === 0 ? (
          <p className="text-sm text-ink-400">Les premières voitures sortent des stands…</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {feed.map((f, i) => (
              <li key={i} className={f.mine ? 'text-magma-500' : ''}>
                <span className="mr-2 text-xs text-ink-400 tabular">{clock(f.t)}</span>
                {f.text}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
