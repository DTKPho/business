import type { GameState, Sponsor, SponsorObjective } from '../model/types'
import type { Rng } from '../core/rng'
import { expectedOrder } from '../car/car'
import { pushMessage } from '../inbox/messages'
import { facilityValue } from '../facilities/facilities'
import { addTx } from './ledger'
import { fmtEur } from '../core/money'

export const TIER_LABEL = { title: 'Sponsor titre', major: 'Partenaire majeur', partner: 'Partenaire' } as const
export const TIER_SLOTS = { title: 1, major: 3, partner: 8 } as const

export function activeSponsors(state: GameState): Sponsor[] {
  return Object.values(state.sponsors).filter((s) => s.status === 'active')
}

export function sponsorIncomeAnnual(state: GameState): number {
  return activeSponsors(state).reduce((s, x) => s + x.annualEur, 0)
}

export function expectedPosition(state: GameState): number {
  return expectedOrder(state).indexOf(state.playerTeamId) + 1
}

export function generateSponsorObjectives(state: GameState, s: Sponsor, rng: Rng): SponsorObjective[] {
  const e = expectedPosition(state)
  const pool: SponsorObjective[] = [
    {
      description: `Marquer des points dans au moins ${Math.max(1, Math.round((12 - e) * 1.3))} courses`,
      condition: { kind: 'pointsFinishes', op: '>=', value: Math.max(1, Math.round((12 - e) * 1.3)) },
      bonusEur: Math.round(s.annualEur * 0.1),
    },
    {
      description: `Terminer ${e}e ou mieux au championnat constructeurs`,
      condition: { kind: 'constructorPosition', op: '<=', value: e },
      bonusEur: Math.round(s.annualEur * 0.15),
    },
    {
      description: `Meilleur résultat en course : ${Math.max(1, Math.round(e * 0.9))}e ou mieux`,
      condition: { kind: 'bestRaceResult', op: '<=', value: Math.max(1, Math.round(e * 0.9)) },
      bonusEur: Math.round(s.annualEur * 0.08),
    },
  ]
  if (e <= 6) pool.push({ description: 'Obtenir au moins un podium', condition: { kind: 'podiums', op: '>=', value: 1 }, bonusEur: Math.round(s.annualEur * 0.2) })
  if (e <= 3) pool.push({ description: 'Remporter au moins une course', condition: { kind: 'wins', op: '>=', value: 1 }, bonusEur: Math.round(s.annualEur * 0.25) })
  rng.shuffle(pool)
  return pool.slice(0, s.tier === 'partner' ? 1 : 2)
}

export function slotsUsed(state: GameState, tier: Sponsor['tier']): number {
  return activeSponsors(state).filter((s) => s.tier === tier).length
}

/** Prépare une offre de sponsor et l'envoie dans la boîte de réception. */
export function makeSponsorOffer(state: GameState, sponsorId: string, rng: Rng): boolean {
  const s = state.sponsors[sponsorId]
  if (!s || s.status === 'active' || s.status === 'offer') return false
  if (slotsUsed(state, s.tier) >= TIER_SLOTS[s.tier]) return false
  const rep = state.teams[state.playerTeamId].reputation
  const base = s.annualEur
  const value = Math.round((base * (0.6 + rep / 125) * (1 + facilityValue(state, 'sponsorAppeal')) * rng.range(0.9, 1.1)) / 50000) * 50000
  const years = rng.int(1, 3)
  const start = state.clock.phase === 'postseason' ? state.clock.season + 1 : state.clock.season
  s.annualEur = value
  s.startSeason = start
  s.endSeason = start + years - 1
  s.status = 'offer'
  s.objectives = generateSponsorObjectives(state, s, rng)
  pushMessage(state, {
    category: 'sponsor',
    title: `Offre de partenariat : ${s.name}`,
    body:
      `${s.name} (${s.sector}) propose un contrat de ${TIER_LABEL[s.tier].toLowerCase()} : ${fmtEur(value)} par an, ` +
      `de ${start} à ${s.endSeason}.\nObjectifs bonus :\n` +
      s.objectives.map((o) => `• ${o.description} (+${fmtEur(o.bonusEur)})`).join('\n'),
    choices: [
      { id: 'accept', label: 'Signer le contrat', effects: [{ kind: 'acceptSponsor', target: s.id, value: 0 }] },
      { id: 'decline', label: 'Décliner', effects: [{ kind: 'rejectSponsor', target: s.id, value: 0 }] },
    ],
    expiresInDays: 21,
  })
  return true
}

export function acceptSponsor(state: GameState, id: string): { ok: boolean; reason?: string } {
  const s = state.sponsors[id]
  if (!s || s.status !== 'offer') return { ok: false, reason: "L'offre n'est plus valable." }
  if (slotsUsed(state, s.tier) >= TIER_SLOTS[s.tier]) return { ok: false, reason: 'Plus d’emplacement disponible pour ce type de sponsor.' }
  s.status = 'active'
  s.satisfaction = 65
  return { ok: true }
}

export function rejectSponsor(state: GameState, id: string): void {
  const s = state.sponsors[id]
  if (s && s.status === 'offer') s.status = 'available'
}

/** Démarche active du joueur auprès d'une marque. */
export function approachSponsor(state: GameState, id: string, rng: Rng): { ok: boolean; reason: string } {
  const s = state.sponsors[id]
  const rep = state.teams[state.playerTeamId].reputation
  if (!s || s.status !== 'available') return { ok: false, reason: 'Cette marque n’est pas disponible.' }
  if (slotsUsed(state, s.tier) >= TIER_SLOTS[s.tier]) return { ok: false, reason: 'Aucun emplacement libre pour ce niveau de partenariat.' }
  const p = Math.max(0.05, Math.min(0.9, 0.45 + (rep - s.minReputation) / 40 + facilityValue(state, 'sponsorAppeal')))
  if (rng.chance(p)) {
    makeSponsorOffer(state, id, rng)
    return { ok: true, reason: `${s.name} est intéressé : une offre vous attend dans la boîte de réception.` }
  }
  s.status = 'expired' // ne pourra être relancé qu'à la saison suivante
  return { ok: false, reason: `${s.name} a décliné pour cette saison.` }
}

export function weeklySponsorIncome(state: GameState, weeks: number): void {
  for (const s of activeSponsors(state)) addTx(state, (s.annualEur / 52) * weeks, 'sponsor', s.name)
}

export function monthlySponsorTick(state: GameState, rng: Rng): void {
  const rep = state.teams[state.playerTeamId].reputation
  const eligible = Object.values(state.sponsors).filter((s) => s.status === 'available' && s.minReputation <= rep + 5 && slotsUsed(state, s.tier) < TIER_SLOTS[s.tier])
  if (eligible.length && rng.chance(0.35)) makeSponsorOffer(state, rng.pick(eligible).id, rng)
  const sat = facilityValue(state, 'sponsorSatisfaction')
  for (const s of activeSponsors(state)) s.satisfaction = Math.max(0, Math.min(100, s.satisfaction + (sat - 1) * 0.5))
}

export function afterRaceSponsors(state: GameState, bestPos: number): void {
  const e = expectedPosition(state) * 2
  const delta = bestPos <= e ? Math.min(6, (e - bestPos) * 0.6 + 1) : -Math.min(4, (bestPos - e) * 0.3)
  for (const s of activeSponsors(state)) s.satisfaction = Math.max(0, Math.min(100, s.satisfaction + delta))
}
