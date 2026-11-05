import { createNewGame } from '../src/engine/init/newGame'
import type { GameState, StaffRole } from '../src/engine/model/types'
import { askingSalary, signWithPlayer } from '../src/engine/people/contracts'
import { driverOverall, staffOverall } from '../src/engine/people/ratings'
import { advance } from '../src/engine/season/loop'
import { closeWeekend, completeRace, currentSession, runCurrentSession } from '../src/engine/season/weekend'

/** Recrute automatiquement deux pilotes et un staff complet (pour les tests). */
export function autoRecruit(state: GameState): void {
  const team = state.teams[state.playerTeamId]
  const drivers = Object.values(state.drivers)
    .filter((d) => !d.teamId && !d.retired && (d.series === 'FA' || d.series === 'F2'))
    .sort((a, b) => driverOverall(b) - driverOverall(a))
  for (const d of drivers) {
    if (team.driverIds.length >= 2) break
    signWithPlayer(state, d.id, { salaryEur: askingSalary(state, d) * 2, years: 2, role: 'first' })
  }
  const roles: StaffRole[] = ['technicalDirector', 'headOfAero', 'chiefDesigner', 'sportingDirector', 'raceEngineer', 'raceEngineer', 'headOfScouting']
  for (const role of roles) {
    const pool = Object.values(state.staff)
      .filter((s) => !s.teamId && !s.retired && s.role === role)
      .sort((a, b) => staffOverall(b) - staffOverall(a))
    for (const s of pool) {
      const r = signWithPlayer(state, s.id, { salaryEur: askingSalary(state, s) * 2, years: 2 })
      if (r.accepted) break
    }
  }
  const engineers = Object.values(state.staff).filter((s) => s.teamId === team.id && s.role === 'raceEngineer')
  engineers.forEach((e, i) => (e.assignedDriverId = team.driverIds[i] ?? null))
}

/** Joue un week-end entier en mode simulé. */
export function playWeekend(state: GameState): void {
  while (currentSession(state)) {
    runCurrentSession(state)
    if (state.race) completeRace(state)
  }
  closeWeekend(state)
}

export function playUntil(state: GameState, predicate: (s: GameState) => boolean, maxSteps = 400): void {
  for (let i = 0; i < maxSteps && !predicate(state); i++) {
    if (state.clock.phase === 'raceWeekend') playWeekend(state)
    else {
      const r = advance(state)
      if (!r.ok) throw new Error(r.reason)
    }
  }
}

export function newTestGame(seed = 'test-seed'): GameState {
  const s = createNewGame({ seed })
  autoRecruit(s)
  return s
}
