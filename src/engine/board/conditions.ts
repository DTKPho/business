import type { Condition, GameState } from '../model/types'
import { teamStats } from '../season/standings'
import { sponsorIncomeAnnual } from '../finance/sponsors'

export function conditionValue(state: GameState, c: Condition): number {
  const teamId = state.playerTeamId
  switch (c.kind) {
    case 'constructorPosition':
      return teamStats(state, teamId).position
    case 'bestRaceResult':
      return teamStats(state, teamId).best
    case 'pointsTotal':
      return teamStats(state, teamId).points
    case 'podiums':
      return teamStats(state, teamId).podiums
    case 'wins':
      return teamStats(state, teamId).wins
    case 'pointsFinishes':
      return teamStats(state, teamId).pointsFinishes
    case 'valuation':
      return state.board.valuationEur / 1e9
    case 'cashAbove':
      return state.finances.cashEur / 1e6
    case 'costCapRespected':
      return state.finances.costCap.spentUsd <= state.finances.costCap.limitUsd ? 1 : 0
    case 'sponsorIncome':
      return sponsorIncomeAnnual(state) / 1e6
    case 'hyundaiProgress':
      return state.hyundai.progress
  }
}

export function conditionMet(state: GameState, c: Condition): boolean {
  const v = conditionValue(state, c)
  return c.op === '<=' ? v <= c.value : v >= c.value
}
