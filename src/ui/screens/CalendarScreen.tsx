import { useState } from 'react'
import { useGameState } from '../hooks'
import { Badge, Modal, PageTitle, Tile, TeamDot, cx } from '../components/ui'
import { TrackMap } from '../components/TrackMap'
import { CircuitSheet } from './WeekendScreen'
import { formatDate } from '../../engine/core/time'
import { fullName } from '../../engine/people/ratings'

export function CalendarScreen() {
  const game = useGameState()
  const [open, setOpen] = useState<number | null>(null)
  const nextRound = game.calendar.find((x) => !x.completed)?.round
  const ev = open !== null ? game.calendar.find((e) => e.round === open) : null
  const res = ev ? game.results.find((r) => r.round === ev.round) : null
  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Course" title={`Calendrier ${game.clock.season}`} sub={`${game.calendar.length} Grands Prix · ${game.calendar.filter((e) => e.sprint).length} week-ends sprint · cliquez sur une manche pour découvrir le circuit`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {game.calendar.map((e) => {
          const c = game.circuits[e.circuitId]
          const r = game.results.find((x) => x.round === e.round)
          const win = r?.race[0]
          const mine = r?.race.filter((x) => x.teamId === game.playerTeamId) ?? []
          const isNext = e.round === nextRound
          return (
            <Tile key={e.round} onClick={() => setOpen(e.round)} active={isNext} className={cx(e.completed && 'opacity-80')}>
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${c.accent?.[0] ?? '#ff5a1f'}, ${c.accent?.[1] ?? '#c08a5a'})` }} />
              <div className="flex gap-3 p-3">
                <div className="h-20 w-20 shrink-0 rounded-xl bg-ink-850 p-1">
                  <TrackMap circuitId={c.id} accent={c.accent?.[0]} thin className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-400">
                    <span>Manche {e.round}</span>
                    {isNext && <Badge tone="magma">Prochain</Badge>}
                    {!isNext && e.sprint && <Badge>Sprint</Badge>}
                  </div>
                  <div className="truncate font-semibold">
                    {c.flag} {c.gpName.replace('Grand Prix ', 'GP ')}
                  </div>
                  <div className="text-xs text-ink-400">
                    {formatDate(e.date)}
                    {e.dateEstimated && <span title="Date estimée"> (est.)</span>}
                  </div>
                  {win && (
                    <div className="mt-1 flex items-center gap-1 truncate text-xs">
                      🏆 <TeamDot color={game.teams[win.teamId].colors.primary} size={8} /> {game.drivers[win.driverId].lastName}
                      {mine.length > 0 && <span className="ml-auto text-magma-500">{mine.map((m) => (m.status === 'dnf' ? 'ABD' : `P${m.position}`)).join('/')}</span>}
                    </div>
                  )}
                </div>
              </div>
            </Tile>
          )
        })}
      </div>
      <Modal open={!!ev} onClose={() => setOpen(null)} title={ev ? `${game.circuits[ev.circuitId].flag ?? ''} ${game.circuits[ev.circuitId].gpName} — ${formatDate(ev.date)}` : ''} wide>
        {ev && (
          <div className="space-y-4">
            <CircuitSheet circuit={game.circuits[ev.circuitId]} />
            {res && res.race.length > 0 && (
              <div className="rounded-xl border border-ink-700/70 bg-ink-850 p-3 text-sm">
                <div className="mb-2 font-semibold">Résultat</div>
                <ol className="grid gap-1 sm:grid-cols-2">
                  {res.race.slice(0, 10).map((r) => (
                    <li key={r.driverId} className={cx('flex items-center gap-2', r.teamId === game.playerTeamId && 'font-semibold text-magma-500')}>
                      <span className="w-5 text-right text-ink-400 tabular">{r.position}</span>
                      <TeamDot color={game.teams[r.teamId].colors.primary} size={8} />
                      {fullName(game.drivers[r.driverId])}
                      <span className="ml-auto text-xs text-ink-400">{r.points ? `${r.points} pts` : ''}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
