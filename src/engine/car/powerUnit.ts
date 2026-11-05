import type { GameState, PuType } from '../model/types'
import { PU_TYPES } from '../model/types'
import { CONFIG } from '../init/data'
import type { Rng } from '../core/rng'
import { pushMessage } from '../inbox/messages'
import { facilityValue } from '../facilities/facilities'
import { ensurePu } from './car'
import { addTx } from '../finance/ledger'
import { clamp } from '../core/money'

export const PU_LABEL: Record<PuType, string> = {
  ICE: 'Moteur thermique (ICE)',
  TC: 'Turbocompresseur (TC)',
  MGUK: 'MGU-K',
  ES: 'Batterie (ES)',
  CE: 'Électronique de contrôle (CE)',
  EX: 'Échappement (EX)',
}

/** Monte une nouvelle unité ; pénalité sur la grille si l'allocation est dépassée. */
export function installComponent(state: GameState, teamId: string, driverId: string, type: PuType): number {
  const car = state.cars[teamId]
  ensurePu(car, driverId)
  const u = car.pu[driverId][type]
  u.used += 1
  u.health = 100
  const over = u.used - CONFIG.puAllocation[type]
  let penalty = 0
  if (over === 1) penalty = 10
  else if (over > 1) penalty = 5
  car.pendingGridPenalty[driverId] = Math.min(40, (car.pendingGridPenalty[driverId] ?? 0) + penalty)
  return penalty
}

/** Les IA remplacent automatiquement les composants très usés avant le week-end. */
export function aiPuManagement(state: GameState): void {
  for (const team of Object.values(state.teams)) {
    if (team.isPlayer) continue
    for (const d of team.driverIds) {
      const car = state.cars[team.id]
      ensurePu(car, d)
      for (const t of PU_TYPES) if (car.pu[d][t].health < 22) installComponent(state, team.id, d, t)
    }
  }
}

/** Progression hebdomadaire du programme moteur Hyundai (financé par Hyundai). */
export function tickHyundai(state: GameState, weeks: number, rng: Rng): void {
  const h = state.hyundai
  if (h.progress >= 100) return
  const years = Math.max(1, h.debutSeason - h.startSeason)
  const sat = state.board.satisfaction.hyundai
  const rate = (100 / (years * 50)) * (1 + facilityValue(state, 'hyundaiProgress')) * (0.8 + sat / 250)
  const before = h.progress
  h.progress = clamp(h.progress + rate * weeks * rng.range(0.7, 1.3), 0, 100)
  h.spentEur = Math.min(h.budgetEur, h.spentEur + (h.budgetEur / (years * 52)) * weeks)
  for (const m of h.milestones) {
    if (!m.reached && before < m.at && h.progress >= m.at) {
      m.reached = state.clock.date
      pushMessage(state, { category: 'car', title: `Namyang : ${m.label}`, body: `Le programme moteur Hyundai franchit une étape clé (${Math.round(h.progress)} % d'avancement). Les 4 ingénieurs détachés chez Ferrari transmettent leurs retours d'expérience.` })
    }
  }
  // Puissance projetée du futur moteur
  const pu = state.powerUnits.hyundai
  if (pu && state.clock.season < h.debutSeason) {
    pu.power = Math.round((72 + h.progress * 0.12) * 10) / 10
    pu.reliability = Math.round((66 + h.progress * 0.14) * 10) / 10
    pu.driveability = Math.round((70 + h.progress * 0.1) * 10) / 10
  }
}

/** Investissement supplémentaire de Genesis dans le programme (hors plafond : budget moteur). */
export function investInHyundai(state: GameState, amountEur: number): { ok: boolean; reason?: string } {
  if (state.hyundai.progress >= 100) return { ok: false, reason: 'Programme déjà terminé.' }
  if (state.finances.cashEur < amountEur) return { ok: false, reason: 'Trésorerie insuffisante.' }
  addTx(state, -amountEur, 'engine', 'Contribution au programme moteur Hyundai', false)
  state.hyundai.progress = clamp(state.hyundai.progress + (amountEur / 1e6) * 0.3, 0, 100)
  state.board.satisfaction.hyundai = clamp(state.board.satisfaction.hyundai + (amountEur / 1e6) * 0.3, 0, 100)
  return { ok: true }
}
