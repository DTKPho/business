import type { Driver, GameState, StaffMember, StaffRole, Team } from '../model/types'
import type { Rng } from '../core/rng'
import { driverOverall, fullName, staffOverall, personAge } from '../people/ratings'
import { askingSalary } from '../people/contracts'
import { generateStaff } from '../people/generate'
import { ensurePu } from '../car/car'
import { pushMessage } from '../inbox/messages'

const ROLE_LIMITS: [StaffRole, number][] = [
  ['technicalDirector', 1],
  ['headOfAero', 1],
  ['chiefDesigner', 1],
  ['sportingDirector', 1],
  ['raceEngineer', 2],
  ['headOfScouting', 1],
]

const JUNIOR_HOMES: Record<string, string[]> = {
  ferrari: ['ferrari', 'genesis', 'cadillac'],
  redbull: ['redbull', 'racingbulls'],
  mercedes: ['mercedes', 'williams', 'alpine'],
  mclaren: ['mclaren'],
  williams: ['williams'],
  alpine: ['alpine'],
  astonmartin: ['astonmartin'],
}

function availableDrivers(state: GameState): Driver[] {
  return Object.values(state.drivers).filter((d) => !d.retired && !d.teamId && (d.series === 'FA' || d.series === 'F2'))
}

function signAi(state: GameState, team: Team, p: Driver | StaffMember, years: number, season: number): void {
  p.teamId = team.id
  p.contract = {
    teamId: team.id,
    startSeason: season,
    endSeason: season + years - 1,
    salaryEur: askingSalary(state, p),
    role: p.kind === 'driver' ? 'second' : undefined,
    inCostCap: p.kind === 'staff',
  }
  if (p.kind === 'driver') {
    p.series = 'F1'
    team.driverIds.push(p.id)
    ensurePu(state.cars[team.id], p.id)
  }
}

/** Complète les baquets et postes vacants des écuries IA. */
export function fillVacancies(state: GameState, rng: Rng, opts: { announce?: boolean } = {}): void {
  const season = state.clock.phase === 'postseason' ? state.clock.season + 1 : state.clock.season
  for (const team of Object.values(state.teams)) {
    if (team.isPlayer) continue
    team.driverIds = team.driverIds.filter((id) => state.drivers[id]?.teamId === team.id)
    while (team.driverIds.length < 2) {
      const pool = availableDrivers(state)
      if (!pool.length) break
      const best = pool
        .map((d) => {
          let s = driverOverall(d) + (d.potential - driverOverall(d)) * (team.budgetTier >= 4 ? 0.15 : 0.3) + rng.normal(0, 2)
          if (d.affiliation && JUNIOR_HOMES[d.affiliation]?.includes(team.id)) s += 6
          if (d.affiliation && JUNIOR_HOMES[d.affiliation] && !JUNIOR_HOMES[d.affiliation].includes(team.id)) s -= 4
          if (personAge(state, d) > 36) s -= 4
          return { d, s }
        })
        .sort((a, b) => b.s - a.s)[0].d
      signAi(state, team, best, rng.int(1, 3), season)
      if (opts.announce) pushMessage(state, { category: 'rumour', title: `${team.shortName} recrute ${fullName(best)}`, body: `${fullName(best)} pilotera pour ${team.name} en ${season}.` })
    }
    for (const [role, limit] of ROLE_LIMITS) {
      const have = Object.values(state.staff).filter((s) => s.teamId === team.id && s.role === role).length
      for (let i = have; i < limit; i++) {
        const pool = Object.values(state.staff).filter((s) => !s.retired && !s.teamId && s.role === role)
        const threshold = 60 + team.budgetTier * 3
        const best = pool.sort((a, b) => staffOverall(b) - staffOverall(a))[0]
        if (best && staffOverall(best) >= threshold - 4 && rng.chance(0.7)) signAi(state, team, best, rng.int(1, 3), season)
        else generateStaff(state, rng, role, team.id, 64 + team.budgetTier * 3.5, season)
      }
    }
    // Affectation des ingénieurs de course
    const engineers = Object.values(state.staff).filter((s) => s.teamId === team.id && s.role === 'raceEngineer')
    for (const e of engineers) if (e.assignedDriverId && !team.driverIds.includes(e.assignedDriverId)) e.assignedDriverId = null
    for (const d of team.driverIds) {
      if (!engineers.some((e) => e.assignedDriverId === d)) {
        const free = engineers.find((e) => !e.assignedDriverId)
        if (free) free.assignedDriverId = d
      }
    }
  }
}

/** Fin de saison : contrats expirés, renouvellements IA, pilotes ayant signé ailleurs. */
export function seasonEndContracts(state: GameState, rng: Rng): string[] {
  const notes: string[] = []
  const season = state.clock.season
  const freePlayer: string[] = []
  // Pilotes ayant déjà signé ailleurs
  for (const d of Object.values(state.drivers)) {
    if (!d.leavingTo) continue
    const from = d.teamId
    if (from) state.teams[from].driverIds = state.teams[from].driverIds.filter((x) => x !== d.id)
    if (from && state.teams[from].reserveDriverId === d.id) state.teams[from].reserveDriverId = null
    const to = state.teams[d.leavingTo]
    if (to.driverIds.length >= 2) {
      const out = to.driverIds.map((id) => state.drivers[id]).sort((a, b) => driverOverall(a) - driverOverall(b))[0]
      to.driverIds = to.driverIds.filter((x) => x !== out.id)
      out.teamId = null
      out.contract = null
      out.series = 'FA'
    }
    d.teamId = null
    d.contract = null
    signAi(state, to, d, 2, season + 1)
    notes.push(`${fullName(d)} rejoint ${to.shortName}.`)
    d.leavingTo = undefined
  }
  const people = [...Object.values(state.drivers), ...Object.values(state.staff)]
  for (const p of people) {
    if (p.retired || !p.contract || !p.teamId) continue
    if (p.contract.endSeason > season) continue
    const team = state.teams[p.teamId]
    if (team.isPlayer) {
      freePlayer.push(fullName(p))
      if (p.kind === 'driver') {
        team.driverIds = team.driverIds.filter((x) => x !== p.id)
        if (team.reserveDriverId === p.id) team.reserveDriverId = null
        p.series = 'FA'
      } else if (p.role === 'raceEngineer') p.assignedDriverId = null
      p.teamId = null
      p.contract = null
      continue
    }
    const ov = p.kind === 'driver' ? driverOverall(p) : staffOverall(p)
    const age = personAge(state, p)
    const keep = p.kind === 'driver' ? (ov >= 82 ? 0.85 : ov >= 77 ? 0.6 : 0.35) * (age > 36 ? 0.5 : 1) : ov >= 75 ? 0.8 : 0.55
    if (rng.chance(keep)) {
      p.contract.endSeason = season + rng.int(1, 3)
      p.contract.salaryEur = Math.round(askingSalary(state, p))
    } else {
      if (p.kind === 'driver') {
        team.driverIds = team.driverIds.filter((x) => x !== p.id)
        p.series = 'FA'
        notes.push(`${fullName(p)} quitte ${team.shortName}.`)
      } else if (p.role === 'raceEngineer') p.assignedDriverId = null
      p.teamId = null
      p.contract = null
    }
  }
  if (freePlayer.length) notes.push(`Fin de contrat chez Genesis : ${freePlayer.join(', ')}.`)
  return notes
}
