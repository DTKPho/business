import type { Compound, GameState, PracticeProgram, SessionId, SessionResult } from '../model/types'
import { Rng } from '../core/rng'
import { addDays } from '../core/time'
import { runPractice, runQualifying } from '../race/sessions'
import { finishRace, startRace } from '../race/race'
import { engineerSetupBonus } from '../race/performance'
import { aiPuManagement } from '../car/powerUnit'
import { ensurePu } from '../car/car'
import { facilityValue } from '../facilities/facilities'
import { driverBonuses, raceWeekendCosts } from '../finance/weekly'
import { afterRaceSponsors, expectedPosition } from '../finance/sponsors'
import { checkEquity } from '../board/equity'
import { pushMessage } from '../inbox/messages'
import { fullName } from '../people/ratings'
import { endSeason } from './offseason'
import { clamp } from '../core/money'

export const SESSION_LABEL: Record<SessionId, string> = {
  FP1: 'Essais libres 1',
  FP2: 'Essais libres 2',
  FP3: 'Essais libres 3',
  SQ: 'Qualifications sprint',
  SPRINT: 'Course sprint',
  Q: 'Qualifications',
  RACE: 'Grand Prix',
}

export function nextEvent(state: GameState) {
  return state.calendar.find((e) => !e.completed)
}

export function startWeekend(state: GameState, round: number): void {
  const rng = new Rng(state.meta.rng)
  const event = state.calendar.find((e) => e.round === round)!
  const sessions: SessionId[] = event.sprint ? ['FP1', 'SQ', 'SPRINT', 'Q', 'RACE'] : ['FP1', 'FP2', 'FP3', 'Q', 'RACE']
  const conf: Record<string, number> = {}
  const know: Record<string, number> = {}
  for (const team of Object.values(state.teams)) {
    for (const id of team.driverIds) {
      ensurePu(state.cars[team.id], id)
      const sim = team.isPlayer ? facilityValue(state, 'setupConfidence') : team.budgetTier * 2.5
      conf[id] = clamp(38 + engineerSetupBonus(state, id) + sim, 10, 90)
      know[id] = 30
    }
  }
  state.weekend = {
    round,
    sessions,
    sessionIndex: 0,
    practiceProgram: Object.fromEntries(state.teams[state.playerTeamId].driverIds.map((id) => [id, 'setup' as PracticeProgram])),
    setupConfidence: conf,
    tyreKnowledge: know,
    results: {},
    weatherBias: rng.next(),
    form: Object.fromEntries([
      ...Object.keys(state.teams).map((t) => [t, rng.normal(0, 0.22)]),
      ...Object.values(state.teams).flatMap((t) => t.driverIds).map((d) => [d, rng.normal(0, 0.12)]),
    ]),
  }
  state.clock.phase = 'raceWeekend'
  state.clock.date = addDays(event.date, -2)
  aiPuManagement(state)
  raceWeekendCosts(state)
  for (const t of Object.values(state.teams)) t.pitCrew.fatigue = Math.max(0, t.pitCrew.fatigue - 5)
}

export function currentSession(state: GameState): SessionId | null {
  const w = state.weekend
  if (!w || w.sessionIndex >= w.sessions.length) return null
  return w.sessions[w.sessionIndex]
}

export function setPracticeProgram(state: GameState, driverId: string, p: PracticeProgram): void {
  if (state.weekend) state.weekend.practiceProgram[driverId] = p
}

/** Lance la séance en cours. Pour une course, crée l'état de course (à jouer en direct ou simuler). */
export function runCurrentSession(state: GameState, startCompounds: Record<string, Compound> = {}): SessionResult | null {
  const w = state.weekend
  const s = currentSession(state)
  if (!w || !s || state.race) return null
  const event = state.calendar.find((e) => e.round === w.round)!
  const dayOffset: Record<SessionId, number> = { FP1: -2, FP2: -2, FP3: -1, SQ: -2, SPRINT: -1, Q: -1, RACE: 0 }
  state.clock.date = addDays(event.date, dayOffset[s])
  if (s === 'FP1' || s === 'FP2' || s === 'FP3') {
    const r = runPractice(state, s)
    w.results[s] = r
    w.sessionIndex++
    return r
  }
  if (s === 'Q' || s === 'SQ') {
    const r = runQualifying(state, s)
    w.results[s] = r
    w.sessionIndex++
    return r
  }
  startRace(state, s === 'SPRINT' ? 'sprint' : 'race', startCompounds)
  return null
}

/** Termine la course en cours (simule les tours restants si besoin) et enregistre le résultat. */
export function completeRace(state: GameState): SessionResult | null {
  const w = state.weekend
  const race = state.race
  if (!w || !race) return null
  const s = currentSession(state)!
  const rows = finishRace(state)
  driverBonuses(state, rows)
  const notes = race.log.filter((l) => l.type === 'sc' || l.type === 'dnf' || l.type === 'weather').map((l) => `T${l.lap} — ${l.text}`)
  if (race.fastestLap) notes.unshift(`Meilleur tour : ${fullName(state.drivers[race.fastestLap.driverId])} (${formatLap(race.fastestLap.time)})`)
  const result: SessionResult = { session: s, rows, notes }
  w.results[s] = result
  w.sessionIndex++
  state.race = null
  return result
}

export function formatLap(t: number): string {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

/** Clôture du week-end : moral, sponsors, conseil, parts de Liam, rapport. */
export function closeWeekend(state: GameState): void {
  const w = state.weekend
  if (!w || currentSession(state) !== null) return
  const event = state.calendar.find((e) => e.round === w.round)!
  event.completed = true
  state.clock.date = event.date
  const race = w.results.RACE?.rows ?? []
  const mine = race.filter((r) => r.teamId === state.playerTeamId)
  const best = mine.length ? Math.min(...mine.map((r) => (r.status === 'finished' ? r.position : 25))) : 25
  const pts = mine.reduce((s, r) => s + (r.points ?? 0), 0) + (w.results.SPRINT?.rows ?? []).filter((r) => r.teamId === state.playerTeamId).reduce((s, r) => s + (r.points ?? 0), 0)
  const expected = expectedPosition(state)
  // Moral des pilotes selon le résultat
  for (const r of mine) {
    const d = state.drivers[r.driverId]
    const delta = r.status === 'dnf' ? -4 : clamp((expected * 2 - r.position) * 0.8, -6, 8)
    d.morale = clamp(d.morale + delta, 0, 100)
  }
  afterRaceSponsors(state, best)
  // Réputation (toutes les écuries)
  for (const team of Object.values(state.teams)) {
    const tp = race.filter((r) => r.teamId === team.id).reduce((s, r) => s + (r.points ?? 0), 0)
    team.reputation = clamp(team.reputation + (tp > 0 ? Math.min(1.2, tp / 20) : -0.05), 0, 100)
  }
  const hy = state.board.satisfaction
  hy.hyundai = clamp(hy.hyundai + (pts > 0 ? 1.5 : -0.5), 0, 100)
  checkEquity(state)
  const circuit = state.circuits[event.circuitId]
  pushMessage(state, {
    category: 'race',
    title: `${circuit.gpName} : ${pts} point${pts > 1 ? 's' : ''} pour Genesis`,
    body:
      `Vainqueur : ${race[0] ? fullName(state.drivers[race[0].driverId]) : '—'}.\n` +
      mine.map((r) => `• ${fullName(state.drivers[r.driverId])} : ${r.status === 'dnf' ? `abandon (${r.dnfReason})` : `P${r.position}`}${r.points ? ` (+${r.points} pts)` : ''}`).join('\n'),
  })
  state.weekend = null
  state.clock.phase = 'season'
  if (state.calendar.every((e) => e.completed)) endSeason(state)
}
