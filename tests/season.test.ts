import { describe, expect, it } from 'vitest'
import { newTestGame, playUntil } from './helpers'
import { constructorStandings, driverStandings } from '../src/engine/season/standings'

describe('boucle de saison', () => {
  it('recrute deux pilotes et le staff en pré-saison', () => {
    const s = newTestGame()
    expect(s.teams.genesis.driverIds).toHaveLength(2)
    expect(Object.values(s.staff).filter((x) => x.teamId === 'genesis').length).toBeGreaterThanOrEqual(6)
  })

  it('joue une saison complète puis démarre la suivante', () => {
    const s = newTestGame()
    playUntil(s, (x) => x.clock.phase === 'postseason')
    expect(s.calendar.every((e) => e.completed)).toBe(true)
    const ds = driverStandings(s)
    const cs = constructorStandings(s)
    expect(cs).toHaveLength(11)
    const totalPoints = cs.reduce((a, c) => a + c.points, 0)
    // 24 GP × 101 pts + 10 sprints × 36 pts
    expect(totalPoints).toBe(24 * 101 + 10 * 36)
    expect(ds[0].points).toBeGreaterThan(150)
    expect(s.history).toHaveLength(1)
    playUntil(s, (x) => x.clock.season === 2028)
    expect(s.clock.phase).toBe('preseason')
    expect(s.calendar[0].date.startsWith('2028')).toBe(true)
    for (const t of Object.values(s.teams)) if (!t.isPlayer) expect(t.driverIds).toHaveLength(2)
    console.log('Trésorerie fin 2027 :', Math.round(s.finances.cashEur / 1e6), 'M€ ; plafond',
      Math.round(s.finances.seasonSummaries[0].capSpentUsd / 1e6), '/', Math.round(s.finances.seasonSummaries[0].capLimitUsd / 1e6),
      'M$ ; Genesis', s.history[0].genesisPosition, 'e,', s.history[0].genesisPoints, 'pts ; valo', Math.round(s.board.valuationEur / 1e6), 'M€')
    console.log(s.history[0].constructorStandings.map((c) => `${c.name}: ${c.points}`).join(' | '))
    console.log(s.history[0].driverStandings.slice(0, 5).map((c) => `${c.name}: ${c.points}`).join(' | '))
  })
})
