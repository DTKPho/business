import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import type { SessionResult } from '../../engine/model/types'
import { Table, TeamDot, cx, td, th } from './ui'
import { fullName } from '../../engine/people/ratings'
import { formatLap } from '../../engine/season/weekend'

export function ResultTable({ result }: { result: SessionResult }) {
  const game = useGameState()
  const openPerson = useGame((s) => s.openPerson)
  const isRace = result.session === 'RACE' || result.session === 'SPRINT'
  const isQ = result.session === 'Q' || result.session === 'SQ'
  return (
    <div className="space-y-2">
      {result.notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-ink-400">
          {result.notes.slice(0, 8).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      <Table>
        <thead>
          <tr>
            <th className={th}>Pos</th>
            <th className={th}>Pilote</th>
            <th className={th}>Écurie</th>
            <th className={cx(th, 'text-right')}>{isRace ? 'Écart' : 'Temps'}</th>
            {isRace && <th className={cx(th, 'text-right')}>Pts</th>}
            {isQ && <th className={th}>Éliminé</th>}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r) => {
            const mine = r.teamId === game.playerTeamId
            const team = game.teams[r.teamId]
            return (
              <tr key={r.driverId} className={mine ? 'bg-magma-500/10' : ''}>
                <td className={cx(td, 'tabular')}>{r.position}</td>
                <td className={td}>
                  <button className="hover:text-copper-300" onClick={() => openPerson(r.driverId)}>
                    {fullName(game.drivers[r.driverId])}
                  </button>
                </td>
                <td className={td}>
                  <span className="flex items-center gap-1.5">
                    <TeamDot color={team.colors.primary} /> {team.shortName}
                  </span>
                </td>
                <td className={cx(td, 'text-right tabular')}>
                  {isRace
                    ? r.status === 'dnf'
                      ? <span className="text-bad">ABD · {r.dnfReason}</span>
                      : r.position === 1
                        ? formatTotal(r.time ?? 0)
                        : `+${(r.gap ?? 0).toFixed(3)}`
                    : r.time
                      ? formatLap(r.time)
                      : '—'}
                </td>
                {isRace && <td className={cx(td, 'text-right tabular')}>{r.points || ''}</td>}
                {isQ && <td className={td}>{r.knockedOutIn === 3 ? '' : `Q${r.knockedOutIn}`}</td>}
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}

function formatTotal(t: number): string {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
}
