import type { Driver, DriverRatings, GameState, StaffMember } from '../model/types'
import type { Rng } from '../core/rng'
import { driverOverall, fullName, personAge } from './ratings'
import { facilityValue } from '../facilities/facilities'
import { generateRookie } from './generate'
import { clamp } from '../core/money'

const KEYS: (keyof DriverRatings)[] = ['pace', 'qualifying', 'racecraft', 'consistency', 'tyreManagement', 'wet', 'feedback']

export function developDriver(state: GameState, d: Driver, rng: Rng): number {
  const age = personAge(state, d)
  const ov = driverOverall(d)
  const room = d.potential - ov
  let base: number
  if (age <= 23) base = Math.max(0, rng.range(0.4, 2.2) * (room / 7))
  else if (age <= 29) base = rng.range(-0.3, 1.0) * Math.max(0.2, room / 8)
  else if (age <= 33) base = rng.range(-0.8, 0.4)
  else if (age <= 36) base = rng.range(-1.6, -0.2)
  else base = rng.range(-2.6, -0.8)
  if (d.teamId === state.playerTeamId) base += facilityValue(state, 'driverGrowth')
  for (const k of KEYS) {
    d.ratings[k] = clamp(Math.round((d.ratings[k] + base + rng.normal(0, 0.6)) * 10) / 10, 30, Math.max(d.potential + 3, d.ratings[k]))
  }
  d.ratings.experience = clamp(d.ratings.experience + (d.series === 'F1' ? rng.range(2, 4) : rng.range(1, 2.5)), 0, 99)
  return base
}

export function developStaff(state: GameState, s: StaffMember, rng: Rng): void {
  const age = personAge(state, s)
  let base = age < 45 ? rng.range(0, 1.2) : age <= 60 ? rng.range(-0.4, 0.6) : rng.range(-1.2, 0)
  if (s.teamId === state.playerTeamId) base += facilityValue(state, 'staffGrowth') * 2
  for (const k of Object.keys(s.ratings)) s.ratings[k] = clamp(Math.round((s.ratings[k] + base + rng.normal(0, 0.4)) * 10) / 10, 30, 99)
}

/** Fin de saison : progression, retraites, championnats F2/F3, nouveaux espoirs. Renvoie des notes. */
export function seasonEndPeople(state: GameState, rng: Rng): string[] {
  const notes: string[] = []
  const nextSeason = state.clock.season + 1
  // Championnats F2 et F3 (résumé)
  for (const series of ['F2', 'F3'] as const) {
    const field = Object.values(state.drivers).filter((d) => d.series === series && !d.retired)
    const ranked = field
      .map((d) => ({ d, s: d.ratings.pace * 0.6 + d.ratings.racecraft * 0.2 + d.ratings.consistency * 0.2 + rng.normal(0, 3) }))
      .sort((a, b) => b.s - a.s)
    ranked.forEach((x, i) => (x.d.season.feederPos = i + 1))
    if (ranked[0]) notes.push(`Champion ${series} ${state.clock.season} : ${fullName(ranked[0].d)}.`)
  }
  for (const d of Object.values(state.drivers)) {
    if (d.retired) continue
    developDriver(state, d, rng)
  }
  for (const s of Object.values(state.staff)) if (!s.retired) developStaff(state, s, rng)

  // Promotions F3 → F2, départs de F2
  const f3 = Object.values(state.drivers).filter((d) => d.series === 'F3' && !d.retired).sort((a, b) => (a.season.feederPos ?? 99) - (b.season.feederPos ?? 99))
  const f2 = Object.values(state.drivers).filter((d) => d.series === 'F2' && !d.retired)
  for (const d of f2) {
    const age = nextSeason - Number(d.birthDate.slice(0, 4))
    if (age >= 26 || ((d.season.feederPos ?? 99) > 15 && d.potential < 78 && age >= 23)) d.series = 'FA'
  }
  const f2Count = Object.values(state.drivers).filter((d) => d.series === 'F2' && !d.retired).length
  let slots = Math.max(0, 22 - f2Count)
  for (const d of f3) {
    if (slots <= 0) break
    if ((d.season.feederPos ?? 99) <= 12) {
      d.series = 'F2'
      slots--
    }
  }
  const f3Count = Object.values(state.drivers).filter((d) => d.series === 'F3' && !d.retired).length
  for (let i = f3Count; i < 22; i++) generateRookie(state, rng, nextSeason)

  // Retraites (personnes sans contrat pour la saison suivante)
  for (const d of Object.values(state.drivers)) {
    if (d.retired || (d.contract && d.contract.endSeason >= nextSeason)) continue
    const age = nextSeason - Number(d.birthDate.slice(0, 4))
    const ov = driverOverall(d)
    let p = 0
    if (age >= 37) p = 0.3 + (age - 37) * 0.15
    if (d.series === 'FA' && ov < 72 && age >= 29) p = Math.max(p, 0.35)
    if (rng.chance(p)) {
      d.retired = true
      d.teamId = null
      d.contract = null
      if (d.career.starts > 50) notes.push(`${fullName(d)} prend sa retraite (${d.career.starts} départs, ${d.career.wins} victoires).`)
    }
  }
  for (const s of Object.values(state.staff)) {
    if (s.retired || (s.contract && s.contract.endSeason >= nextSeason)) continue
    const age = nextSeason - Number(s.birthDate.slice(0, 4))
    if (age >= 65 && rng.chance(0.3)) {
      s.retired = true
      s.teamId = null
    }
  }
  for (const d of Object.values(state.drivers)) d.season = { points: 0, wins: 0, podiums: 0, feederPos: d.season.feederPos }
  return notes
}
