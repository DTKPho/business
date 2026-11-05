import type { Car, Circuit, GameState, PowerUnitSupplier, PuType, TeamId } from '../model/types'
import { PU_TYPES } from '../model/types'

export const AREA_LABEL = {
  aero: 'Aérodynamique',
  chassis: 'Châssis',
  powertrain: 'Groupe motopropulseur',
  reliability: 'Fiabilité',
} as const

export function supplierIdFor(state: GameState, teamId: TeamId, season = state.clock.season): string {
  const team = state.teams[teamId]
  const c = team.puContracts.find((p) => season >= p.from && season <= p.to)
  return c ? c.supplierId : (team.puContracts[team.puContracts.length - 1]?.supplierId ?? 'mercedes')
}

export function supplierFor(state: GameState, teamId: TeamId, season = state.clock.season): PowerUnitSupplier {
  return state.powerUnits[supplierIdFor(state, teamId, season)]
}

export function isCustomer(state: GameState, teamId: TeamId): boolean {
  const id = supplierIdFor(state, teamId)
  const works: Record<string, string[]> = {
    mercedes: ['mercedes'],
    ferrari: ['ferrari'],
    redbullford: ['redbull'],
    honda: ['astonmartin'],
    audi: ['audi'],
    cadillac: ['cadillac'],
    hyundai: ['genesis'],
  }
  return !(works[id] ?? []).includes(teamId)
}

export function emptyPu(): Record<PuType, { used: number; health: number }> {
  const o = {} as Record<PuType, { used: number; health: number }>
  for (const t of PU_TYPES) o[t] = { used: 1, health: 100 }
  return o
}

export function ensurePu(car: Car, driverId: string): void {
  if (!car.pu[driverId]) car.pu[driverId] = emptyPu()
  if (car.pendingGridPenalty[driverId] === undefined) car.pendingGridPenalty[driverId] = 0
}

/** Puissance effective du groupe propulseur (moteur fournisseur + intégration écurie). */
export function effectivePower(state: GameState, teamId: TeamId): number {
  const pu = supplierFor(state, teamId)
  const car = state.cars[teamId]
  return pu.power * 0.72 + car.ratings.powertrain * 0.28
}

const NEUTRAL: Circuit['traits'] = {
  downforce: 0.55,
  powerSensitivity: 0.55,
  tyreWear: 0.5,
  overtaking: 0.5,
  safetyCarProb: 0.4,
  pitLossSec: 21,
}

/** Note de performance pure de la voiture (0–100) sur un type de circuit. */
export function carScore(state: GameState, teamId: TeamId, traits: Circuit['traits'] = NEUTRAL): number {
  const car = state.cars[teamId]
  const pu = supplierFor(state, teamId)
  const aeroW = 0.25 + 0.25 * traits.downforce
  const powW = 0.12 + 0.3 * traits.powerSensitivity
  const chW = 0.25
  const drW = 0.08
  return (
    (car.ratings.aero * aeroW + effectivePower(state, teamId) * powW + car.ratings.chassis * chW + pu.driveability * drW) /
    (aeroW + powW + chW + drW)
  )
}

/** Fiabilité globale (voiture + moteur), 0–100. */
export function reliabilityScore(state: GameState, teamId: TeamId): number {
  const car = state.cars[teamId]
  const pu = supplierFor(state, teamId)
  return car.ratings.reliability * 0.6 + pu.reliability * 0.4
}

export function expectedOrder(state: GameState): TeamId[] {
  return Object.keys(state.teams).sort((a, b) => carScore(state, b) - carScore(state, a))
}
