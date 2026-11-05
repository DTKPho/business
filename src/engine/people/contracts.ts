import type { Driver, GameState, Person, StaffMember } from '../model/types'
import { driverAskingSalary, staffAskingSalary } from './generate'
import { driverOverall, fullName, personAge, staffOverall } from './ratings'
import { teamAttractiveness } from '../facilities/facilities'
import { addTx } from '../finance/ledger'
import { ensurePu, expectedOrder } from '../car/car'
import { pushMessage } from '../inbox/messages'
import { Rng } from '../core/rng'
import { clamp } from '../core/money'

export function getPerson(state: GameState, id: string): Person | undefined {
  return state.drivers[id] ?? state.staff[id]
}

export function askingSalary(state: GameState, p: Person): number {
  if (p.kind === 'driver') {
    const base = driverAskingSalary(driverOverall(p), personAge(state, p))
    return Math.round((base * (0.85 + p.mentality.ambition / 400)) / 10000) * 10000
  }
  return staffAskingSalary(staffOverall(p), p.role)
}

/** Indemnité à verser à l'écurie actuelle pour libérer la personne. */
export function buyoutCost(state: GameState, p: Person): number {
  if (!p.contract || !p.teamId || p.teamId === state.playerTeamId) return 0
  if (state.clock.phase === 'postseason' && p.contract.endSeason <= state.clock.season) return 0
  const yearsLeft = Math.max(1, p.contract.endSeason - state.clock.season + (state.clock.phase === 'preseason' ? 1 : 0.5))
  return Math.round((p.contract.salaryEur * yearsLeft * (p.kind === 'driver' ? 1.4 : 1.0)) / 100000) * 100000
}

export interface Offer {
  salaryEur: number
  years: number
  role?: 'first' | 'second' | 'reserve'
}

export interface NegotiationResult {
  accepted: boolean
  message: string
  counterSalary?: number
}

function seasonStart(state: GameState): number {
  return state.clock.phase === 'postseason' ? state.clock.season + 1 : state.clock.season
}

/** Évalue l'offre : salaire, attractivité de Genesis, situation actuelle, mentalité. */
export function evaluateOffer(state: GameState, p: Person, offer: Offer): NegotiationResult {
  const asking = askingSalary(state, p)
  const ratio = offer.salaryEur / Math.max(1, asking)
  const attract = teamAttractiveness(state)
  const genesisRank = expectedOrder(state).indexOf(state.playerTeamId) + 1
  let currentPrestige = 40
  if (p.teamId && p.teamId !== state.playerTeamId) {
    currentPrestige = state.teams[p.teamId].reputation
  } else if (p.kind === 'driver' && (p.series === 'F2' || p.series === 'F3')) {
    currentPrestige = 20 // un volant de F1 est une promotion
  }
  let score = (ratio - 1) * 120 + (attract - currentPrestige) * 0.6 + (6 - genesisRank) * 1.5
  if (p.kind === 'driver') {
    if (p.affiliation === 'ferrari') score += 12 // partenaire moteur : Ferrari favorise le placement de ses juniors
    if (p.affiliation === 'redbull' || p.affiliation === 'mercedes' || p.affiliation === 'mclaren') score -= 10
    if (offer.role === 'reserve' && p.series !== 'F2' && p.series !== 'F3') score -= 20
    if (offer.role === 'first') score += 4
    score += (p.mentality.ambition - 60) * -0.1 * (genesisRank - 5)
  }
  if (offer.years >= 3 && personAge(state, p) > 33) score += 5
  if (offer.years >= 3 && p.mentality.ambition > 80) score -= 5
  if (p.teamId && p.teamId !== state.playerTeamId) score -= p.mentality.loyalty * 0.12
  score += (p.morale - 60) * -0.15 * (p.teamId && p.teamId !== state.playerTeamId ? 1 : 0)
  if (score >= 0) return { accepted: true, message: `${fullName(p)} accepte votre proposition.` }
  const needed = Math.round((asking * (1 + -score / 120)) / 10000) * 10000
  if (score > -60) return { accepted: false, message: `${fullName(p)} hésite. Son entourage évoque un salaire d'environ ${(needed / 1e6).toFixed(2)} M€ par an.`, counterSalary: needed }
  return { accepted: false, message: `${fullName(p)} n'est pas intéressé par le projet Genesis pour le moment.` }
}

function removeFromTeam(state: GameState, p: Person): void {
  if (!p.teamId) return
  const team = state.teams[p.teamId]
  if (p.kind === 'driver') {
    team.driverIds = team.driverIds.filter((d) => d !== p.id)
    if (team.reserveDriverId === p.id) team.reserveDriverId = null
    for (const s of Object.values(state.staff)) if (s.assignedDriverId === p.id) s.assignedDriverId = null
  } else if (p.role === 'raceEngineer') {
    p.assignedDriverId = null
  }
}

/** Signature d'un contrat (le joueur recrute ou prolonge). */
export function signWithPlayer(state: GameState, personId: string, offer: Offer): NegotiationResult {
  const p = getPerson(state, personId)
  if (!p) return { accepted: false, message: 'Personne introuvable.' }
  const teamId = state.playerTeamId
  const team = state.teams[teamId]
  const isExtension = p.teamId === teamId
  const buyout = buyoutCost(state, p)
  if (state.finances.cashEur < buyout + offer.salaryEur * 0.1) return { accepted: false, message: 'Trésorerie insuffisante pour couvrir l’indemnité de transfert.' }
  if (p.kind === 'driver' && !isExtension && offer.role !== 'reserve' && team.driverIds.length >= 2) {
    return { accepted: false, message: 'Vos deux baquets titulaires sont occupés. Libérez un pilote ou proposez un rôle de réserviste.' }
  }
  const result = isExtension ? evaluateExtension(state, p, offer) : evaluateOffer(state, p, offer)
  if (!result.accepted) {
    p.morale = clamp(p.morale - (isExtension ? 3 : 0), 0, 100)
    return result
  }
  if (buyout > 0) addTx(state, -buyout, 'transfer', `Indemnité de transfert : ${fullName(p)} (${state.teams[p.teamId!].shortName})`, false)
  const prevTeam = p.teamId
  if (!isExtension) removeFromTeam(state, p)
  const start = isExtension ? p.contract?.startSeason ?? seasonStart(state) : seasonStart(state)
  p.contract = {
    teamId,
    startSeason: start,
    endSeason: seasonStart(state) + offer.years - 1,
    salaryEur: offer.salaryEur,
    role: p.kind === 'driver' ? (offer.role ?? 'second') : undefined,
    inCostCap: p.kind === 'staff' && p.role !== 'technicalDirector',
  }
  p.teamId = teamId
  p.morale = clamp(p.morale + 10, 0, 100)
  if (p.kind === 'driver') {
    if (p.series !== 'F1') p.series = 'F1'
    if (!isExtension) {
      if (offer.role === 'reserve') team.reserveDriverId = p.id
      else team.driverIds.push(p.id)
      ensurePu(state.cars[teamId], p.id)
    }
  }
  if (prevTeam && prevTeam !== teamId) {
    pushMessage(state, { category: p.kind === 'driver' ? 'driver' : 'staff', title: `Transfert : ${fullName(p)} rejoint Genesis`, body: `${state.teams[prevTeam].shortName} a accepté une indemnité de ${(buyout / 1e6).toFixed(1)} M€.` })
  }
  return result
}

function evaluateExtension(state: GameState, p: Person, offer: Offer): NegotiationResult {
  const asking = askingSalary(state, p)
  const ratio = offer.salaryEur / Math.max(1, asking)
  const score = (ratio - 1) * 120 + (p.morale - 55) * 0.6 + (p.mentality.loyalty - 60) * 0.3
  if (score >= 0) return { accepted: true, message: `${fullName(p)} prolonge son contrat.` }
  const needed = Math.round((asking * (1 + -score / 120)) / 10000) * 10000
  return { accepted: false, message: `${fullName(p)} souhaite environ ${(needed / 1e6).toFixed(2)} M€ par an pour prolonger.`, counterSalary: needed }
}

/** Libère une personne sous contrat avec Genesis (indemnité = 50 % du salaire restant). */
export function releaseFromPlayer(state: GameState, personId: string): { ok: boolean; cost: number } {
  const p = getPerson(state, personId)
  if (!p || p.teamId !== state.playerTeamId) return { ok: false, cost: 0 }
  const yearsLeft = p.contract ? Math.max(0, p.contract.endSeason - state.clock.season + (state.clock.phase === 'postseason' ? 0 : 0.5)) : 0
  const cost = p.contract ? Math.round(p.contract.salaryEur * yearsLeft * 0.5) : 0
  if (cost) addTx(state, -cost, 'transfer', `Indemnité de licenciement : ${fullName(p)}`, false)
  removeFromTeam(state, p)
  p.teamId = null
  p.contract = null
  if (p.kind === 'driver') p.series = 'FA'
  return { ok: true, cost }
}

export function assignEngineer(state: GameState, engineerId: string, driverId: string | null): void {
  const e = state.staff[engineerId]
  if (!e || e.teamId !== state.playerTeamId || e.role !== 'raceEngineer') return
  if (driverId) for (const s of Object.values(state.staff)) if (s.teamId === state.playerTeamId && s.assignedDriverId === driverId) s.assignedDriverId = null
  e.assignedDriverId = driverId
}

/** Échange titulaire / réserviste. */
export function promoteReserve(state: GameState, outDriverId: string): { ok: boolean; reason?: string } {
  const team = state.teams[state.playerTeamId]
  if (state.clock.phase === 'raceWeekend') return { ok: false, reason: 'Impossible pendant un week-end de course.' }
  const reserve = team.reserveDriverId
  if (!reserve) return { ok: false, reason: 'Aucun réserviste.' }
  team.driverIds = team.driverIds.map((d) => (d === outDriverId ? reserve : d))
  team.reserveDriverId = outDriverId
  const r = state.drivers[reserve]
  if (r.contract) r.contract.role = 'second'
  const o = state.drivers[outDriverId]
  if (o.contract) o.contract.role = 'reserve'
  ensurePu(state.cars[team.id], reserve)
  for (const s of Object.values(state.staff)) if (s.assignedDriverId === outDriverId && s.teamId === team.id) s.assignedDriverId = reserve
  return { ok: true }
}

export function playerDrivers(state: GameState): Driver[] {
  return state.teams[state.playerTeamId].driverIds.map((id) => state.drivers[id]).filter(Boolean)
}

export function playerStaff(state: GameState): StaffMember[] {
  return Object.values(state.staff).filter((s) => s.teamId === state.playerTeamId)
}

export function rngFor(state: GameState): Rng {
  return new Rng(state.meta.rng)
}
