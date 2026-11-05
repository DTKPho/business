import type { BoardObjective, GameState, ShareholderId } from '../model/types'
import { DATA } from '../init/data'
import { expectedPosition, sponsorIncomeAnnual } from '../finance/sponsors'
import { conditionMet, conditionValue } from './conditions'
import { pushMessage } from '../inbox/messages'
import { clamp } from '../core/money'

export const SHAREHOLDER_LABEL: Record<ShareholderId | 'liam', string> = {
  hyundai: 'Hyundai Motor Group',
  redbird: 'RedBird Capital Partners',
  arctos: 'Arctos Partners',
  liam: 'Liam Robert',
}

export const SHAREHOLDER_WEIGHT: Record<ShareholderId, number> = { hyundai: 0.58, redbird: 0.24, arctos: 0.18 }

function resolveValue(state: GameState, v: number | string): number {
  if (typeof v === 'number') return v
  const e = expectedPosition(state)
  switch (v) {
    case 'expectedPos':
      return e
    case 'expectedPointsFinishes':
      return Math.max(1, Math.round((12 - e) * 1.4))
    case 'programTarget':
      return Math.min(100, Math.round(state.hyundai.progress + 30))
    case 'sponsorTarget':
      return Math.round((sponsorIncomeAnnual(state) * 1.1) / 1e6)
    case 'valuationTarget':
      return Math.round((state.board.valuationEur * 1.05) / 1e7) / 100
    case 'cashTarget':
      return Math.max(40, Math.round((state.finances.cashEur * 0.4) / 1e6))
    case 'expectedBest':
      return clamp(Math.round(e * 0.9), 1, 15)
    default:
      return 0
  }
}

export function generateBoardObjectives(state: GameState): void {
  const list: BoardObjective[] = []
  for (const t of DATA.boardTemplates) {
    if (t.kind === 'hyundaiProgress' && state.hyundai.progress >= 100) continue
    const value = resolveValue(state, t.value)
    list.push({
      id: `${t.id}-${state.clock.season}`,
      by: t.by,
      description: t.description.replace('{value}', String(value).replace('.', ',')),
      condition: { kind: t.kind, op: t.op, value },
      weight: t.weight,
      status: 'pending',
    })
  }
  state.board.objectives = list
  pushMessage(state, {
    category: 'board',
    title: `Objectifs du conseil d'administration — saison ${state.clock.season}`,
    body:
      `Le conseil a fixé les objectifs de la saison ${state.clock.season} :\n` +
      list.map((o) => `• [${SHAREHOLDER_LABEL[o.by]}] ${o.description}`).join('\n'),
  })
}

export function objectiveProgress(state: GameState, o: BoardObjective) {
  return { value: conditionValue(state, o.condition), met: conditionMet(state, o.condition) }
}

/** Évaluation de fin de saison : satisfaction de chaque actionnaire et confiance envers Liam. */
export function evaluateBoard(state: GameState): string[] {
  const notes: string[] = []
  const b = state.board
  for (const o of b.objectives) {
    const met = conditionMet(state, o.condition)
    o.status = met ? 'met' : 'failed'
    const d = (met ? 6 : -7) * o.weight
    b.satisfaction[o.by] = clamp(b.satisfaction[o.by] + d, 0, 100)
    notes.push(`${met ? '✔' : '✘'} ${o.description}`)
  }
  const trust = (Object.keys(SHAREHOLDER_WEIGHT) as ShareholderId[]).reduce((s, k) => s + b.satisfaction[k] * SHAREHOLDER_WEIGHT[k], 0)
  state.player.boardTrust = clamp(Math.round(state.player.boardTrust * 0.4 + trust * 0.6), 0, 100)
  b.annualContributionEur = Math.round(DATA.scenario.hyundaiAnnualContributionEur * (0.7 + (b.satisfaction.hyundai / 100) * 0.6))
  return notes
}
