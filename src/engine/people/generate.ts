import type { Driver, GameState, StaffMember, StaffRole, TeamId } from '../model/types'
import type { Rng } from '../core/rng'
import { DATA } from '../init/data'
import { STAFF_ROLE_KEYS, randomMentality } from './ratings'
import { slugify } from '../core/ids'
import { clamp } from '../core/money'
import { addDays } from '../core/time'

function uniqueId(state: GameState, base: string): string {
  let id = slugify(base)
  let i = 2
  while (state.staff[id] || state.drivers[id]) id = `${slugify(base)}-${i++}`
  return id
}

export function generateStaff(
  state: GameState,
  rng: Rng,
  role: StaffRole,
  teamId: TeamId | null,
  quality: number,
  season: number,
): StaffMember {
  const first = rng.pick(DATA.names.first)
  const last = rng.pick(DATA.names.last)
  const id = uniqueId(state, `${first} ${last}`)
  const ratings: Record<string, number> = {}
  for (const k of STAFF_ROLE_KEYS[role]) ratings[k] = Math.round(clamp(quality + rng.normal(0, 4), 35, 95))
  const age = rng.int(30, 55)
  const overall = Object.values(ratings).reduce((a, b) => a + b, 0) / 3
  const salary = staffAskingSalary(overall, role)
  const s: StaffMember = {
    kind: 'staff',
    id,
    firstName: first,
    lastName: last,
    nationality: rng.pick(DATA.names.nat),
    birthDate: addDays(`${season - age}-01-01`, rng.int(0, 364)),
    role,
    teamId,
    ratings,
    mentality: randomMentality(() => rng.next()),
    morale: 70,
    contract: teamId
      ? { teamId, startSeason: season, endSeason: season + rng.int(0, 2), salaryEur: salary, inCostCap: role !== 'technicalDirector' }
      : null,
    generated: true,
    scoutSeed: rng.int(1, 1e9),
  }
  state.staff[id] = s
  return s
}

export function staffAskingSalary(overall: number, role: StaffRole): number {
  const mult: Record<StaffRole, number> = {
    technicalDirector: 1.6,
    headOfAero: 1.2,
    chiefDesigner: 1.1,
    sportingDirector: 0.9,
    raceEngineer: 0.45,
    headOfScouting: 0.4,
  }
  return Math.round((Math.exp((overall - 70) / 8) * 0.9 * mult[role] * 1e6) / 10000) * 10000
}

export function driverAskingSalary(overall: number, age: number): number {
  const youth = age < 22 ? 0.6 : 1
  return Math.round((Math.max(0.15, Math.exp((overall - 72) / 5.2) * 0.7) * youth * 1e6) / 10000) * 10000
}

/** Nouveau pilote de F3 généré (fictif) pour renouveler le vivier chaque saison. */
export function generateRookie(state: GameState, rng: Rng, season: number): Driver {
  const first = rng.pick(DATA.names.first.filter((n) => !['Sophie', 'Hannah', 'Claire', 'Elena', 'Laura', 'Sara', 'Martina', 'Emma', 'Rachel'].includes(n)))
  const last = rng.pick(DATA.names.last)
  const id = uniqueId(state, `${first} ${last}`)
  const base = rng.range(60, 68)
  const r = () => Math.round(clamp(base + rng.normal(0, 3), 50, 80))
  const d: Driver = {
    kind: 'driver',
    id,
    firstName: first,
    lastName: last,
    nationality: rng.pick(DATA.names.nat),
    birthDate: addDays(`${season - rng.int(16, 18)}-01-01`, rng.int(0, 364)),
    series: 'F3',
    teamId: null,
    ratings: { pace: r(), qualifying: r(), racecraft: r(), consistency: r(), tyreManagement: r(), wet: r(), feedback: r() - 4, experience: rng.int(5, 15) },
    potential: Math.round(clamp(base + rng.range(8, 28), 65, 95)),
    mentality: randomMentality(() => rng.next()),
    morale: 70,
    contract: null,
    career: { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, titles: 0, dnfs: 0 },
    season: { points: 0, wins: 0, podiums: 0 },
    scoutSeed: rng.int(1, 1e9),
    generated: true,
  }
  state.drivers[id] = d
  return d
}
