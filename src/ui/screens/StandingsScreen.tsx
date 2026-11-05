import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Card, Empty, PageTitle, Table, Tabs, TeamDot, cx, td, th } from '../components/ui'
import { constructorStandings, driverStandings } from '../../engine/season/standings'
import { fullName } from '../../engine/people/ratings'

export function StandingsScreen() {
  const game = useGameState()
  const openPerson = useGame((s) => s.openPerson)
  const [tab, setTab] = useState<'drivers' | 'teams' | 'history'>('drivers')
  const ds = driverStandings(game)
  const cs = constructorStandings(game)
  return (
    <div className="space-y-4">
      <PageTitle title={`Championnats ${game.clock.season}`} sub={`${game.calendar.filter((e) => e.completed).length}/${game.calendar.length} manches disputées`} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'drivers', label: 'Pilotes' },
          { id: 'teams', label: 'Constructeurs' },
          { id: 'history', label: 'Palmarès' },
        ]}
      />
      <Card pad={false}>
        {tab === 'drivers' && (
          <Table>
            <thead>
              <tr>
                <th className={th}>Pos</th>
                <th className={th}>Pilote</th>
                <th className={th}>Écurie</th>
                <th className={cx(th, 'text-right')}>Victoires</th>
                <th className={cx(th, 'text-right')}>Podiums</th>
                <th className={cx(th, 'text-right')}>Points</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((d) => (
                <tr key={d.driverId} className={d.teamId === game.playerTeamId ? 'bg-magma-500/10' : ''}>
                  <td className={td}>{d.position}</td>
                  <td className={td}>
                    <button className="hover:text-copper-300" onClick={() => openPerson(d.driverId)}>
                      {fullName(game.drivers[d.driverId])}
                    </button>
                  </td>
                  <td className={td}>
                    <span className="flex items-center gap-1.5">
                      <TeamDot color={game.teams[d.teamId].colors.primary} />
                      {game.teams[d.teamId].shortName}
                    </span>
                  </td>
                  <td className={cx(td, 'text-right tabular')}>{d.wins}</td>
                  <td className={cx(td, 'text-right tabular')}>{d.podiums}</td>
                  <td className={cx(td, 'text-right font-semibold tabular')}>{d.points}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {tab === 'teams' && (
          <Table>
            <thead>
              <tr>
                <th className={th}>Pos</th>
                <th className={th}>Écurie</th>
                <th className={cx(th, 'text-right')}>Victoires</th>
                <th className={cx(th, 'text-right')}>Podiums</th>
                <th className={cx(th, 'text-right')}>Meilleur résultat</th>
                <th className={cx(th, 'text-right')}>Points</th>
              </tr>
            </thead>
            <tbody>
              {cs.map((c) => (
                <tr key={c.teamId} className={c.teamId === game.playerTeamId ? 'bg-magma-500/10' : ''}>
                  <td className={td}>{c.position}</td>
                  <td className={td}>
                    <span className="flex items-center gap-1.5">
                      <TeamDot color={game.teams[c.teamId].colors.primary} />
                      {game.teams[c.teamId].name}
                    </span>
                  </td>
                  <td className={cx(td, 'text-right tabular')}>{c.wins}</td>
                  <td className={cx(td, 'text-right tabular')}>{c.podiums}</td>
                  <td className={cx(td, 'text-right tabular')}>{c.best < 99 ? `P${c.best}` : '—'}</td>
                  <td className={cx(td, 'text-right font-semibold tabular')}>{c.points}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {tab === 'history' &&
          (game.history.length === 0 ? (
            <div className="p-4">
              <Empty>Le palmarès se remplira à la fin de la première saison.</Empty>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>Saison</th>
                  <th className={th}>Champion pilotes</th>
                  <th className={th}>Champion constructeurs</th>
                  <th className={th}>Genesis</th>
                  <th className={th}>Parts de Liam</th>
                </tr>
              </thead>
              <tbody>
                {[...game.history].reverse().map((h) => (
                  <tr key={h.season}>
                    <td className={td}>{h.season}</td>
                    <td className={td}>
                      {h.driverStandings[0]?.name} ({h.driverStandings[0]?.points} pts)
                    </td>
                    <td className={td}>{h.constructorStandings[0]?.name}</td>
                    <td className={td}>
                      P{h.genesisPosition} · {h.genesisPoints} pts
                    </td>
                    <td className={td}>{h.liamStake.toFixed(2).replace('.', ',')} %</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}
      </Card>
    </div>
  )
}
