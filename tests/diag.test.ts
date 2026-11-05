import { it } from 'vitest'
import { newTestGame, playUntil } from './helpers'
import { advance } from '../src/engine/season/loop'
import { runCurrentSession, currentSession } from '../src/engine/season/weekend'
import { stepLap } from '../src/engine/race/race'

it.skipIf(!process.env.DIAG)('diagnostic course', () => {
  const s = newTestGame(process.env.DIAG)
  for (let i = 0; i < 30 && s.clock.phase !== 'raceWeekend'; i++) {
    const r = advance(s)
    if (!r.ok) throw new Error(r.reason)
  }
  console.log('date', s.clock.date, s.clock.phase, currentSession(s))
  for (let i = 0; i < 10 && currentSession(s) !== 'RACE'; i++) runCurrentSession(s)
  runCurrentSession(s)
  for (let i = 0; i < 100 && !s.race!.finished; i++) stepLap(s)
  for (const l of s.race!.log) console.log(`T${l.lap} ${l.type} ${l.text}`)
  for (const c of s.race!.cars.sort((a, b) => a.position - b.position)) console.log(c.position, c.driverId, c.status, c.gapToLeader.toFixed(1), c.pitStops, c.tyresUsed.join(''), c.bestLap.toFixed(3))
  playUntil(s, (x) => x.clock.phase === 'postseason')
  let dnf = 0
  for (const r of s.results) dnf += r.race.filter((x) => x.status === 'dnf').length
  console.log('DNF saison', dnf)
  console.log(s.history[0].constructorStandings.map((c) => `${c.name}: ${c.points}`).join(' | '))
  console.log(s.history[0].driverStandings.slice(0, 8).map((c) => `${c.name}: ${c.points}`).join(' | '))
  console.log('cash', Math.round(s.finances.cashEur / 1e6), 'cap', Math.round(s.finances.seasonSummaries[0].capSpentUsd / 1e6))
})
