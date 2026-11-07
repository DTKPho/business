import type { Facility, GameState } from '../model/types'
import { addTx } from '../finance/ledger'
import { pushMessage } from '../inbox/messages'

export const BRANCH_LABEL = {
  carDevelopment: 'Développement voiture',
  staff: 'Personnel',
  operations: 'Opérations',
} as const

/** Somme des effets des installations du joueur pour une clé donnée. */
export function facilityValue(state: GameState, key: string): number {
  let v = 0
  for (const f of Object.values(state.facilities)) {
    for (const e of f.effects) if (e.key === key) v += (e.base ?? 0) + e.perLevel * f.level
  }
  return v
}

export function upgradeCost(f: Facility): number {
  return f.levels[f.level]?.upgradeCostEur ?? 0
}

export function monthlyFacilityCost(state: GameState): number {
  return Object.values(state.facilities).reduce((s, f) => s + (f.levels[f.level]?.monthlyCostEur ?? 0), 0)
}

export function canUpgrade(state: GameState, id: string): { ok: boolean; reason?: string } {
  const f = state.facilities[id]
  if (!f) return { ok: false, reason: 'Installation inconnue' }
  if (f.upgrade) return { ok: false, reason: 'Travaux déjà en cours' }
  if (f.level >= f.maxLevel) return { ok: false, reason: 'Niveau maximal atteint' }
  if (state.finances.cashEur < upgradeCost(f)) return { ok: false, reason: 'Trésorerie insuffisante' }
  return { ok: true }
}

export function startUpgrade(state: GameState, id: string): { ok: boolean; reason?: string } {
  const check = canUpgrade(state, id)
  if (!check.ok) return check
  const f = state.facilities[id]
  const cost = upgradeCost(f)
  const weeks = f.levels[f.level].weeks
  // Les investissements en infrastructure sont hors plafond de dépenses.
  addTx(state, -cost, 'facilityUpgrade', `Travaux : ${f.name} niveau ${f.level + 1}`, false)
  f.upgrade = { toLevel: f.level + 1, weeksLeft: weeks }
  return { ok: true }
}

/** Remboursement en cas de revente d'un niveau (30 % du coût de construction). */
export function sellValue(f: Facility): number {
  return f.level > 0 ? Math.round(f.levels[f.level - 1].upgradeCostEur * 0.3) : 0
}

/** Rétrograde une installation d'un niveau : économise les coûts de fonctionnement. */
export function downgrade(state: GameState, id: string): { ok: boolean; reason?: string } {
  const f = state.facilities[id]
  if (!f) return { ok: false, reason: 'Installation inconnue' }
  if (f.upgrade) return { ok: false, reason: 'Travaux en cours' }
  if (f.level <= 0) return { ok: false, reason: 'Rien à revendre' }
  const refund = sellValue(f)
  f.level -= 1
  addTx(state, refund, 'facilityUpgrade', `Revente : ${f.name} (niveau ${f.level + 1})`, false)
  return { ok: true }
}

/** Coût pour diviser par deux le temps de travaux restant. */
export function rushCost(f: Facility): number {
  if (!f.upgrade) return 0
  return Math.round((f.levels[f.level].upgradeCostEur * 0.35) / 100000) * 100000
}

export function rushUpgrade(state: GameState, id: string): { ok: boolean; reason?: string } {
  const f = state.facilities[id]
  if (!f?.upgrade) return { ok: false, reason: 'Aucun chantier en cours' }
  if (f.upgrade.weeksLeft <= 1) return { ok: false, reason: 'Les travaux sont presque terminés' }
  const cost = rushCost(f)
  if (state.finances.cashEur < cost) return { ok: false, reason: 'Trésorerie insuffisante' }
  addTx(state, -cost, 'facilityUpgrade', `Accélération des travaux : ${f.name}`, false)
  f.upgrade.weeksLeft = Math.ceil(f.upgrade.weeksLeft / 2)
  return { ok: true }
}

/** Annule un chantier : 50 % du coût est remboursé. */
export function cancelUpgrade(state: GameState, id: string): { ok: boolean; reason?: string } {
  const f = state.facilities[id]
  if (!f?.upgrade) return { ok: false, reason: 'Aucun chantier en cours' }
  addTx(state, Math.round(f.levels[f.level].upgradeCostEur * 0.5), 'facilityUpgrade', `Annulation des travaux : ${f.name}`, false)
  f.upgrade = undefined
  return { ok: true }
}

export function tickFacilities(state: GameState, weeks: number): void {
  for (const f of Object.values(state.facilities)) {
    if (!f.upgrade) continue
    f.upgrade.weeksLeft -= weeks
    if (f.upgrade.weeksLeft <= 0) {
      f.level = f.upgrade.toLevel
      f.upgrade = undefined
      pushMessage(state, {
        category: 'facility',
        title: `${f.name} : niveau ${f.level} opérationnel`,
        body: `Les travaux sont terminés. ${f.description}`,
      })
      state.player.reputation = Math.min(100, state.player.reputation + 0.5)
    }
  }
}

/** Attractivité de l'écurie pour recruter (0–100). */
export function teamAttractiveness(state: GameState, teamId = state.playerTeamId): number {
  const team = state.teams[teamId]
  let v = team.reputation * 0.7
  if (teamId === state.playerTeamId) {
    v += facilityValue(state, 'attractiveness')
    v += facilityValue(state, 'morale') * 0.8
  } else {
    v += team.budgetTier * 4
  }
  return Math.min(100, v)
}
