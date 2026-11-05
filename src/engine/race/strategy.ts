import type { Circuit, Compound, GameState, RaceCar, RaceState } from '../model/types'
import type { Rng } from '../core/rng'
import { stintLength } from './performance'
import { roleRating } from '../people/ratings'
import { facilityValue } from '../facilities/facilities'

const DRY: Compound[] = ['S', 'M', 'H']

export function isDry(c: Compound): boolean {
  return c === 'S' || c === 'M' || c === 'H'
}

function strategySkill(state: GameState, teamId: string): number {
  const base = roleRating(state, teamId, 'sportingDirector', 'strategy')
  return base + (state.teams[teamId].isPlayer ? facilityValue(state, 'strategy') : 4)
}

/** Choix du composé pour un relais de `remaining` tours. */
export function chooseDryCompound(car: RaceCar, circuit: Circuit, remaining: number, mustDiffer: boolean, tyreMgmt: number): Compound {
  const used = new Set(car.tyresUsed.filter(isDry))
  const options = DRY.filter((c) => !(mustDiffer && used.size === 1 && used.has(c)))
  for (const c of options) if (stintLength(c, circuit, tyreMgmt) * 1.05 >= remaining) return c
  return options[options.length - 1] ?? 'H'
}

/** Pneus de départ et arrêts prévus. */
export function planRace(state: GameState, car: RaceCar, circuit: Circuit, race: RaceState, rng: Rng): void {
  const L = race.totalLaps
  const tm = state.drivers[car.driverId].ratings.tyreManagement
  const w = race.weather.wetness
  if (w >= 0.18) {
    car.tyre.compound = w >= 0.65 ? 'W' : 'I'
    car.plannedStops = []
    return
  }
  const sS = stintLength('S', circuit, tm)
  const sM = stintLength('M', circuit, tm)
  const sH = stintLength('H', circuit, tm)
  if (race.kind === 'sprint') {
    car.tyre.compound = sS >= L ? (rng.chance(0.6) ? 'S' : 'M') : 'M'
    car.plannedStops = []
    return
  }
  const skillNoise = (100 - strategySkill(state, car.teamId)) / 25
  if (sM + sH >= L * 1.02) {
    const startSoft = sS + sH >= L * 1.02 && car.startPos > 10 ? rng.chance(0.25) : rng.chance(0.12)
    const first = startSoft ? 'S' : 'M'
    const s1 = startSoft ? sS : sM
    const s2 = sH
    car.tyre.compound = first
    car.plannedStops = [Math.round(Math.min(s1, L * (s1 / (s1 + s2))) + rng.normal(0, 1 + skillNoise))]
  } else {
    car.tyre.compound = rng.chance(0.3) ? 'S' : 'M'
    car.plannedStops = [Math.round(L / 3 + rng.normal(0, 1.5 + skillNoise)), Math.round((2 * L) / 3 + rng.normal(0, 1.5 + skillNoise))]
  }
  car.plannedStops = car.plannedStops.map((x) => Math.max(5, Math.min(L - 4, x)))
}

/** Décision d'arrêt (fin de tour). Renvoie le composé à monter ou null. */
export function decidePit(state: GameState, car: RaceCar, circuit: Circuit, race: RaceState): Compound | null {
  if (car.pitRequest) return car.pitRequest
  if (!car.autoStrategy) return null
  const lap = race.lap
  const remaining = race.totalLaps - lap
  if (remaining <= 1) return null
  const w = race.weather.wetness
  const c = car.tyre.compound
  const tm = state.drivers[car.driverId].ratings.tyreManagement
  const dryRace = !car.tyresUsed.some((t) => !isDry(t))
  // Météo
  if (isDry(c) && w > 0.22) return w > 0.7 ? 'W' : 'I'
  if (c === 'I' && w > 0.74) return 'W'
  if (c === 'W' && w < 0.5) return 'I'
  if (!isDry(c) && w < 0.1) return chooseDryCompound(car, circuit, remaining, false, tm)
  const skill = strategySkill(state, car.teamId)
  const threshold = 68 + (skill - 75) / 5
  const mustDiffer = race.kind === 'race' && dryRace
  if (car.tyre.wear >= threshold && remaining > 2) return isDry(c) ? chooseDryCompound(car, circuit, remaining, mustDiffer, tm) : c
  if (race.neutral.mode !== 'none' && car.tyre.wear > 35 && remaining > 6 && car.tyre.age > 6) {
    return isDry(c) ? chooseDryCompound(car, circuit, remaining, mustDiffer, tm) : c
  }
  if (car.plannedStops.includes(lap) && car.tyre.wear > 25) {
    return isDry(c) ? chooseDryCompound(car, circuit, remaining, mustDiffer, tm) : c
  }
  // Règle des deux composés : arrêt obligatoire si nécessaire
  if (race.kind === 'race' && dryRace && w < 0.1 && car.pitStops === 0 && remaining <= 3) {
    return chooseDryCompound(car, circuit, remaining, true, tm)
  }
  return null
}

/** Modes de pilotage automatiques (IA ou stratégie auto du joueur). */
export function autoModes(car: RaceCar, race: RaceState): void {
  if (!car.autoStrategy) return
  const remaining = race.totalLaps - race.lap
  if (car.tyre.wear > 62 && remaining > 8) car.pace = 'conserve'
  else if (remaining <= 8 && car.tyre.wear < 65) car.pace = 'push'
  else car.pace = 'standard'
  car.engineMode = remaining <= 5 ? 'high' : 'standard'
  if (car.interval > 0 && car.interval < 1.0 && car.ersCharge > 35) car.ersMode = 'attack'
  else if (car.ersCharge < 30) car.ersMode = 'harvest'
  else car.ersMode = 'balanced'
}
