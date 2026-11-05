import { useGameState } from '../hooks'
import { Badge, Card, PageTitle, Table, TeamDot, td, th } from '../components/ui'
import { formatDate } from '../../engine/core/time'
import { fullName } from '../../engine/people/ratings'

export function CalendarScreen() {
  const game = useGameState()
  return (
    <div>
      <PageTitle title={`Calendrier ${game.clock.season}`} sub={`${game.calendar.length} Grands Prix · ${game.calendar.filter((e) => e.sprint).length} week-ends sprint`} />
      <Card pad={false}>
        <Table>
          <thead>
            <tr>
              <th className={th}>#</th>
              <th className={th}>Grand Prix</th>
              <th className={th}>Date</th>
              <th className={th}>Format</th>
              <th className={th}>Vainqueur</th>
              <th className={th}>Genesis</th>
            </tr>
          </thead>
          <tbody>
            {game.calendar.map((e) => {
              const c = game.circuits[e.circuitId]
              const r = game.results.find((x) => x.round === e.round)
              const win = r?.race[0]
              const mine = r?.race.filter((x) => x.teamId === game.playerTeamId) ?? []
              const isNext = !e.completed && game.calendar.find((x) => !x.completed)?.round === e.round
              return (
                <tr key={e.round} className={isNext ? 'bg-magma-500/10' : e.completed ? 'text-ink-300' : ''}>
                  <td className={td}>{e.round}</td>
                  <td className={td}>
                    <div className="font-medium">{c.gpName}</div>
                    <div className="text-[11px] text-ink-400">
                      {c.name} · {c.laps} tours
                    </div>
                  </td>
                  <td className={td}>
                    {formatDate(e.date)}
                    {e.dateEstimated && <span className="ml-1 text-[10px] text-ink-600" title="Date estimée">(est.)</span>}
                  </td>
                  <td className={td}>{e.sprint ? <Badge tone="magma">Sprint</Badge> : <Badge>Classique</Badge>}</td>
                  <td className={td}>
                    {win ? (
                      <span className="flex items-center gap-1.5">
                        <TeamDot color={game.teams[win.teamId].colors.primary} />
                        {fullName(game.drivers[win.driverId])}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={td}>{mine.length ? mine.map((m) => (m.status === 'dnf' ? 'ABD' : `P${m.position}`)).join(' / ') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
