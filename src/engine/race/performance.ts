import type { Circuit, Compound, GameState, PersonId } from '../model/types'
import { carScore } from '../car/car'
import { raceEngineerFor } from '../people/ratings'
import { facilityValue } from '../facilities/facilities'

/** Delta de temps au tour (s) dû à la voiture, au pilote et à la préparation du week-end. */
export function baseDelta(state: GameState, driverId: PersonId, circuit: Circuit, mode: 'quali' | 'race'): number {
  const d = state.drivers[driverId]
  const teamId = d.teamId!
  const car = carScore(state, teamId, circuit.traits)
  const r = d.ratings
  const skill = mode === 'quali' ? r.pace * 0.55 + r.qualifying * 0.45 : r.pace * 0.7 + r.racecraft * 0.1 + r.experience * 0.1 + r.consistency * 0.1
  const moraleAdj = (d.morale - 60) * 0.004
  const conf = state.weekend?.setupConfidence[driverId] ?? 50
  const form = (state.weekend?.form[teamId] ?? 0) + (state.weekend?.form[driverId] ?? 0)
  return form + (100 - car) * 0.062 + (100 - skill) * 0.03 + (100 - conf) * 0.0045 - moraleAdj
}

export const COMPOUND_LABEL: Record<Compound, string> = { S: 'Tendre', M: 'Medium', H: 'Dur', I: 'Intermédiaire', W: 'Pluie' }
export const COMPOUND_COLOR: Record<Compound, string> = { S: '#ef4444', M: '#facc15', H: '#e5e7eb', I: '#22c55e', W: '#3b82f6' }

export const COMPOUND_OFFSET: Record<Compound, number> = { S: -0.6, M: 0, H: 0.45, I: 0, W: 0 }
const BASE_DEG: Record<Compound, number> = { S: 3.4, M: 2.3, H: 1.55, I: 2.2, W: 1.8 }

/** Pénalité de temps liée à l'adéquation pneus / piste mouillée (wetness 0–1). */
export function weatherTyreDelta(c: Compound, w: number): number {
  if (c === 'I') return w < 0.25 ? (0.25 - w) * 14 + 0.6 : w > 0.7 ? (w - 0.7) * 12 + 0.3 : 0.3
  if (c === 'W') return w < 0.6 ? (0.6 - w) * 12 + 0.9 : 0.5
  return w < 0.08 ? 0 : w * 18
}

export function tyreWearPerLap(c: Compound, circuit: Circuit, tyreMgmt: number, knowledge: number, pace: 'push' | 'standard' | 'conserve', wetness: number): number {
  let base = BASE_DEG[c] * (0.45 + circuit.traits.tyreWear)
  if ((c === 'I' || c === 'W') && wetness < 0.2) base *= 2.4
  const paceMul = pace === 'push' ? 1.35 : pace === 'conserve' ? 0.7 : 1
  return base * paceMul * (1.18 - tyreMgmt / 260 - knowledge / 600)
}

export function wearDelta(wear: number): number {
  return wear * 0.022 + (wear > 72 ? (wear - 72) * 0.16 : 0)
}

/** Durée de relais (tours) avant d'atteindre ~70 % d'usure. */
export function stintLength(c: Compound, circuit: Circuit, tyreMgmt = 80, knowledge = 50): number {
  return Math.max(4, Math.floor(70 / tyreWearPerLap(c, circuit, tyreMgmt, knowledge, 'standard', 0)))
}

export function pitStopTime(state: GameState, teamId: string, rand: number, rand2: number): number {
  const crew = state.teams[teamId].pitCrew
  const training = state.teams[teamId].isPlayer ? facilityValue(state, 'pitTraining') : 0.3
  let t = 2.0 + (100 - crew.speed) * 0.028 + crew.fatigue * 0.01 - training * 0.15 + rand * 0.5
  if (rand2 < (100 - crew.consistency) / 900) t += 2.5 + rand * 6
  return Math.max(1.8, t)
}

export function driverWetSkill(state: GameState, driverId: string): number {
  return state.drivers[driverId].ratings.wet
}

export function engineerSetupBonus(state: GameState, driverId: string): number {
  const e = raceEngineerFor(state, driverId)
  return e ? (e.ratings.setup - 60) * 0.25 : -5
}
