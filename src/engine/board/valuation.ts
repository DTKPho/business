import type { GameState } from '../model/types'
import type { Rng } from '../core/rng'
import { sponsorIncomeAnnual } from '../finance/sponsors'
import { constructorStandings } from '../season/standings'

/** Valeur cible de l'écurie, recalculée chaque mois. */
export function targetValuation(state: GameState): number {
  const team = state.teams[state.playerTeamId]
  const pos = state.results.length >= 3 ? constructorStandings(state).find((c) => c.teamId === team.id)!.position : team.lastConstructorPos
  const fomUsd = [140, 130, 120, 110, 100, 92, 84, 76, 70, 64, 60][pos - 1] * 1e6
  const revenue = sponsorIncomeAnnual(state) + fomUsd * state.finances.eurPerUsd
  const facilitiesValue = Object.values(state.facilities).reduce((s, f) => {
    let v = 0
    for (let l = 0; l < f.level; l++) v += f.levels[l].upgradeCostEur
    return s + v
  }, 0)
  const marketIndex = Math.pow(1.06, state.clock.season - 2027)
  const performance = (12 - pos) * 90e6
  const brand = team.reputation * 24e6
  const hyundai = state.hyundai.progress * 3e6
  const franchise = 750e6 // valeur d'une place sur la grille (accords Concorde)
  return (revenue * 8 + brand + facilitiesValue * 0.8 + performance + hyundai + franchise) * marketIndex
}

export function monthlyValuation(state: GameState, rng: Rng): void {
  const b = state.board
  const target = targetValuation(state)
  b.valuationEur = Math.round(b.valuationEur + (target - b.valuationEur) * 0.07 + b.valuationEur * rng.normal(0, 0.006))
  b.valuationHistory.push({ date: state.clock.date, valueEur: b.valuationEur })
  if (b.valuationHistory.length > 600) b.valuationHistory.splice(0, b.valuationHistory.length - 600)
}
