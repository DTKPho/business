import type { GameState, Person, TeamId } from '../model/types'
import type { Rng } from '../core/rng'
import { askingSalary } from './contracts'
import { facilityValue } from '../facilities/facilities'
import { fullName, personOverall, STAFF_ROLE_LABEL } from './ratings'
import { pushMessage } from '../inbox/messages'
import { expectedPosition } from '../finance/sponsors'
import { addTx } from '../finance/ledger'
import { clamp, fmtEur } from '../core/money'

export function moraleLabel(m: number): string {
  if (m >= 80) return 'Excellent'
  if (m >= 65) return 'Bon'
  if (m >= 50) return 'Correct'
  if (m >= 35) return 'Bas'
  return 'Très bas'
}

/** Forme récente de l'écurie : points des 3 dernières courses vs attentes (−1 à +1). */
export function recentForm(state: GameState, teamId: TeamId): number {
  const recent = state.results.filter((r) => r.race.length).slice(-3)
  if (!recent.length) return 0
  const pts = recent.reduce((s, r) => s + r.race.filter((x) => x.teamId === teamId).reduce((a, x) => a + (x.points ?? 0), 0), 0) / recent.length
  const expected = Math.max(0.5, (12 - expectedPosition(state)) * 2.2)
  return clamp((pts - expected) / (expected + 4), -1, 1)
}

export function weeklyMorale(state: GameState, weeks: number, rng: Rng): void {
  const form = recentForm(state, state.playerTeamId)
  const fac = facilityValue(state, 'morale')
  for (const p of [...Object.values(state.drivers), ...Object.values(state.staff)] as Person[]) {
    if (p.retired) continue
    if (p.teamId !== state.playerTeamId) {
      p.morale = clamp(p.morale + (70 - p.morale) * 0.05 * weeks + rng.normal(0, 0.5), 20, 95)
      continue
    }
    const asking = askingSalary(state, p)
    const pay = p.contract ? clamp((p.contract.salaryEur / Math.max(1, asking) - 1) * 30, -15, 12) : -10
    let target = 56 + fac + pay + form * 12
    if (p.kind === 'driver' && p.contract?.role === 'reserve') target -= 8
    if (p.kind === 'driver' && p.contract?.role === 'second' && p.mentality.ambition > 80) target -= 4
    target += (state.player.boardTrust - 50) * 0.05
    p.morale = clamp(p.morale + (target - p.morale) * 0.08 * weeks + rng.normal(0, 0.8), 5, 100)
  }
}

function pendingPoach(state: GameState, personId: string): boolean {
  return state.inbox.some((m) => !m.resolvedChoiceId && m.choices?.some((c) => c.effects.some((e) => e.target?.startsWith(personId + '|'))))
}

/** Tentatives de débauchage par les écuries rivales. */
export function weeklyPoaching(state: GameState, weeks: number, rng: Rng): void {
  const myRep = state.teams[state.playerTeamId].reputation
  const rivals = Object.values(state.teams).filter((t) => !t.isPlayer)
  for (const p of [...Object.values(state.drivers), ...Object.values(state.staff)] as Person[]) {
    if (p.teamId !== state.playerTeamId || !p.contract) continue
    const ov = personOverall(p)
    if (ov < 72) continue
    if (p.kind === 'driver' && p.contract.endSeason > state.clock.season) continue // pilotes : seulement en fin de contrat
    const prob = 0.0035 * weeks * clamp(1 + (62 - p.morale) / 20, 0.2, 3) * (p.mentality.ambition / 70) * ((ov - 65) / 15)
    if (!rng.chance(prob) || pendingPoach(state, p.id)) continue
    const better = rivals.filter((t) => t.reputation > myRep - 5)
    const rival = rng.pick(better.length ? better : rivals)
    const raise = Math.round(p.contract.salaryEur * 0.25)
    const comp = Math.round(p.contract.salaryEur * Math.max(1, p.contract.endSeason - state.clock.season + 0.5))
    const who = p.kind === 'driver' ? 'pilote' : STAFF_ROLE_LABEL[p.role].toLowerCase()
    const tgt = `${p.id}|${rival.id}`
    pushMessage(state, {
      category: p.kind === 'driver' ? 'driver' : 'staff',
      title: `${rival.shortName} tente de débaucher ${fullName(p)}`,
      body:
        p.kind === 'driver'
          ? `${fullName(p)}, en fin de contrat, a été approché par ${rival.name} pour la saison ${state.clock.season + 1}. Son moral actuel : ${Math.round(p.morale)}/100.`
          : `${rival.name} a fait une offre à notre ${who}, ${fullName(p)}. Moral actuel : ${Math.round(p.morale)}/100. ${rival.shortName} est prêt à verser une indemnité de ${fmtEur(comp)}.`,
      choices: [
        { id: 'counter', label: `Contre-offre (+${fmtEur(raise)}/an${p.kind === 'driver' ? ', prolongation 2 ans' : ''})`, effects: [{ kind: 'salaryRaise', target: tgt, value: 0.25 }] },
        ...(p.kind === 'staff' ? [{ id: 'release', label: `Accepter l'indemnité (${fmtEur(comp)})`, effects: [{ kind: 'releaseStaff' as const, target: tgt, value: comp }] }] : []),
        { id: 'ignore', label: 'Ne rien faire', effects: [{ kind: 'poachGamble', target: tgt, value: comp }] },
      ],
      expiresInDays: 14,
    })
  }
}

/** Transfère un membre de Genesis vers une écurie rivale contre indemnité. */
export function transferToRival(state: GameState, personId: string, rivalId: string, compensation: number): void {
  const p = (state.staff[personId] ?? state.drivers[personId]) as Person | undefined
  if (!p || p.teamId !== state.playerTeamId) return
  if (compensation > 0) addTx(state, compensation, 'transfer', `Indemnité reçue : départ de ${fullName(p)}`, false)
  if (p.kind === 'driver') {
    // Le pilote part en fin de saison : son contrat n'est simplement pas prolongé.
    p.mentality.loyalty = Math.max(0, p.mentality.loyalty - 30)
    p.morale = clamp(p.morale - 10, 0, 100)
    p.leavingTo = rivalId
    pushMessage(state, { category: 'driver', title: `${fullName(p)} partira en fin de saison`, body: `${fullName(p)} a donné son accord à ${state.teams[rivalId].name} pour la saison prochaine.` })
    return
  }
  if (p.role === 'raceEngineer') p.assignedDriverId = null
  const displaced = Object.values(state.staff).filter((s) => s.teamId === rivalId && s.role === p.role)
  const limit = p.role === 'raceEngineer' ? 2 : 1
  if (displaced.length >= limit) {
    const out = displaced.sort((a, b) => personOverall(a) - personOverall(b))[0]
    if (out.role === 'raceEngineer') {
      p.assignedDriverId = out.assignedDriverId
      out.assignedDriverId = null
    }
    out.teamId = null
    out.contract = null
  }
  p.teamId = rivalId
  p.contract = { teamId: rivalId, startSeason: state.clock.season, endSeason: state.clock.season + 2, salaryEur: Math.round((p.contract?.salaryEur ?? 1e6) * 1.25), inCostCap: true }
  pushMessage(state, { category: 'staff', title: `${fullName(p)} quitte Genesis`, body: `${fullName(p)} rejoint ${state.teams[rivalId].name}. Pensez à pourvoir le poste.` })
}
