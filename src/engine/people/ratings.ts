import type { Driver, GameState, Mentality, Person, StaffMember, StaffRole, TeamId } from '../model/types'
import { ageAt } from '../core/time'
import { stableNoise } from '../core/rng'
import { clamp } from '../core/money'

export const STAFF_ROLE_KEYS: Record<StaffRole, string[]> = {
  technicalDirector: ['leadership', 'innovation', 'efficiency'],
  headOfAero: ['aeroKnowledge', 'innovation', 'efficiency'],
  chiefDesigner: ['chassisKnowledge', 'innovation', 'production'],
  sportingDirector: ['strategy', 'pitCrewManagement', 'regulations'],
  raceEngineer: ['setup', 'communication', 'strategy'],
  headOfScouting: ['judgement', 'network', 'potentialSpotting'],
}

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  technicalDirector: 'Directeur technique',
  headOfAero: 'Responsable aérodynamique',
  chiefDesigner: "Chef du bureau d'études",
  sportingDirector: 'Directeur sportif',
  raceEngineer: 'Ingénieur de course',
  headOfScouting: 'Responsable du scouting',
}

export const RATING_LABEL: Record<string, string> = {
  pace: 'Vitesse',
  qualifying: 'Qualifications',
  racecraft: 'Combativité',
  consistency: 'Régularité',
  tyreManagement: 'Gestion pneus',
  wet: 'Pluie',
  feedback: 'Retour technique',
  experience: 'Expérience',
  leadership: 'Leadership',
  innovation: 'Innovation',
  efficiency: 'Efficacité',
  aeroKnowledge: 'Aérodynamique',
  chassisKnowledge: 'Châssis',
  production: 'Production',
  strategy: 'Stratégie',
  pitCrewManagement: 'Gestion des stands',
  regulations: 'Règlement',
  setup: 'Réglages',
  communication: 'Communication',
  judgement: 'Jugement',
  network: 'Réseau',
  potentialSpotting: 'Détection',
}

export function driverOverall(d: Driver): number {
  const r = d.ratings
  return (
    r.pace * 0.3 +
    r.qualifying * 0.12 +
    r.racecraft * 0.15 +
    r.consistency * 0.13 +
    r.tyreManagement * 0.1 +
    r.wet * 0.06 +
    r.feedback * 0.07 +
    r.experience * 0.07
  )
}

export function staffOverall(s: StaffMember): number {
  const v = Object.values(s.ratings)
  return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)
}

export function personOverall(p: Person): number {
  return p.kind === 'driver' ? driverOverall(p) : staffOverall(p)
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`
}

export function personAge(state: GameState, p: Person): number {
  return ageAt(p.birthDate, state.clock.date)
}

export function teamStaff(state: GameState, teamId: TeamId): StaffMember[] {
  return Object.values(state.staff).filter((s) => s.teamId === teamId && !s.retired)
}

export function teamStaffByRole(state: GameState, teamId: TeamId, role: StaffRole): StaffMember[] {
  return teamStaff(state, teamId).filter((s) => s.role === role)
}

/** Note du meilleur membre du staff pour un rôle (40 si poste vacant). */
export function roleRating(state: GameState, teamId: TeamId, role: StaffRole, key?: string): number {
  const list = teamStaffByRole(state, teamId, role)
  if (list.length === 0) return 40
  return Math.max(...list.map((s) => (key ? (s.ratings[key] ?? staffOverall(s)) : staffOverall(s))))
}

export function raceEngineerFor(state: GameState, driverId: string): StaffMember | undefined {
  return Object.values(state.staff).find((s) => s.role === 'raceEngineer' && s.assignedDriverId === driverId && !s.retired)
}

/** Qualité du scouting de l'écurie du joueur (détermine la précision des notes affichées). */
export function scoutingQuality(state: GameState): number {
  const list = teamStaffByRole(state, state.playerTeamId, 'headOfScouting')
  if (list.length === 0) return 35
  const s = list[0]
  return (s.ratings.judgement * 0.6 + s.ratings.network * 0.2 + s.ratings.potentialSpotting * 0.2)
}

/**
 * Note vue par le joueur : exacte pour son écurie, bruitée selon le scouting sinon.
 * Renvoie la valeur estimée et la marge d'erreur.
 */
export function scoutedValue(state: GameState, p: Person, key: string, value: number): { value: number; margin: number } {
  if (p.teamId === state.playerTeamId) return { value: Math.round(value), margin: 0 }
  const q = scoutingQuality(state)
  const margin = Math.round(clamp((100 - q) / 5, 1, 14))
  let salt = 0
  for (let i = 0; i < key.length; i++) salt += key.charCodeAt(i) * (i + 1)
  const noise = stableNoise(p.scoutSeed, salt) * margin
  return { value: Math.round(clamp(value + noise, 1, 99)), margin }
}

export function randomMentality(rnd: () => number): Mentality {
  const r = () => Math.round(45 + rnd() * 45)
  return { ambition: r(), loyalty: r(), temperament: r(), teamPlayer: r() }
}
