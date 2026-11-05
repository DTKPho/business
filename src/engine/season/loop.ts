import type { GameState } from '../model/types'
import { Rng } from '../core/rng'
import { addDays, daysBetween, monthOf, yearOf } from '../core/time'
import { nextEvent, startWeekend } from './weekend'
import { startNewSeason } from './offseason'
import { weeklyFinances, monthlyFinances } from '../finance/weekly'
import { monthlySponsorTick } from '../finance/sponsors'
import { tickAiDevelopment, tickPlayerRnd } from '../car/rnd'
import { tickHyundai } from '../car/powerUnit'
import { facilityValue, tickFacilities } from '../facilities/facilities'
import { weeklyMorale, weeklyPoaching } from '../people/morale'
import { expireMessages, weeklyRandomEvents } from '../inbox/events'
import { fillVacancies } from '../ai/aiTeams'
import { monthlyValuation } from '../board/valuation'
import { checkEquity } from '../board/equity'
import { pushMessage } from '../inbox/messages'
import { fullName } from '../people/ratings'
import { clamp } from '../core/money'

export interface AdvanceResult {
  ok: boolean
  reason?: string
  event?: 'weekend' | 'newSeason' | 'week'
}

export function canAdvance(state: GameState): AdvanceResult {
  if (state.clock.phase === 'raceWeekend') return { ok: false, reason: 'Terminez d’abord le week-end de course.' }
  const ev = nextEvent(state)
  if (ev && state.clock.phase !== 'postseason') {
    const wStart = addDays(ev.date, -2)
    if (daysBetween(state.clock.date, wStart) <= 7 && state.teams[state.playerTeamId].driverIds.length < 2) {
      return { ok: false, reason: 'Il vous faut deux pilotes titulaires avant le prochain Grand Prix (onglet Marché).' }
    }
  }
  return { ok: true }
}

/** Traitements d'une période de `days` jours (≤ 7). */
export function processPeriod(state: GameState, days: number, nextDate: string): void {
  if (days <= 0) return
  const rng = new Rng(state.meta.rng)
  const weeks = days / 7
  weeklyFinances(state, weeks)
  tickPlayerRnd(state, weeks, rng)
  tickAiDevelopment(state, weeks, rng)
  tickHyundai(state, weeks, rng)
  tickFacilities(state, weeks)
  weeklyMorale(state, weeks, rng)
  if (state.clock.phase !== 'postseason') weeklyPoaching(state, weeks, rng)
  weeklyRandomEvents(state, weeks, rng)
  // Entraînement des mécaniciens
  const pc = state.teams[state.playerTeamId].pitCrew
  const train = 0.05 * weeks * (1 + facilityValue(state, 'pitTraining'))
  if (pc.trainingFocus === 'speed') pc.speed = clamp(pc.speed + train, 30, 99)
  else if (pc.trainingFocus === 'consistency') pc.consistency = clamp(pc.consistency + train, 30, 99)
  pc.fatigue = Math.max(0, pc.fatigue - (pc.trainingFocus === 'rest' ? 3 : 1) * weeks)
  fillVacancies(state, rng)
  // Changement de mois
  if (monthOf(nextDate) !== monthOf(state.clock.date)) {
    const prev = state.clock.date
    state.clock.date = nextDate
    monthlyFinances(state)
    monthlySponsorTick(state, rng)
    monthlyValuation(state, rng)
    checkEquity(state)
    if (monthOf(nextDate) === 8) contractWarnings(state)
    state.clock.date = prev
  }
  state.clock.date = nextDate
  expireMessages(state)
}

function contractWarnings(state: GameState): void {
  const expiring = [...Object.values(state.drivers), ...Object.values(state.staff)].filter((p) => p.teamId === state.playerTeamId && p.contract && p.contract.endSeason <= state.clock.season)
  if (!expiring.length) return
  pushMessage(state, {
    category: 'staff',
    title: 'Contrats arrivant à échéance',
    body: `Ces contrats expirent à la fin de la saison ${state.clock.season} :\n` + expiring.map((p) => `• ${fullName(p)}`).join('\n') + '\nProlongez-les depuis les fiches Personnel / Pilotes si vous souhaitez les garder.',
  })
}

/** Avance d'une semaine (ou jusqu'au prochain week-end de course / nouvelle saison). */
export function advance(state: GameState): AdvanceResult {
  const check = canAdvance(state)
  if (!check.ok) return check
  const date = state.clock.date
  let target = addDays(date, 7)
  if (state.clock.phase === 'postseason') {
    const newYear = `${state.clock.season + 1}-01-04`
    if (target >= newYear) {
      processPeriod(state, daysBetween(date, newYear), newYear)
      startNewSeason(state)
      return { ok: true, event: 'newSeason' }
    }
    processPeriod(state, 7, target)
    return { ok: true, event: 'week' }
  }
  const ev = nextEvent(state)
  if (ev) {
    const wStart = addDays(ev.date, -2)
    if (wStart <= target) {
      target = wStart < date ? date : wStart
      processPeriod(state, daysBetween(date, target), target)
      startWeekend(state, ev.round)
      return { ok: true, event: 'weekend' }
    }
  }
  processPeriod(state, 7, target)
  if (yearOf(target) > state.clock.season) {
    // Sécurité : saison sans course restante
    state.clock.phase = 'postseason'
  }
  return { ok: true, event: 'week' }
}

/** Avance jusqu'au prochain événement notable (week-end, nouvelle décision, nouvelle saison). */
export function advanceToNext(state: GameState): AdvanceResult {
  const pendingBefore = state.inbox.filter((m) => m.choices && !m.resolvedChoiceId).length
  let last: AdvanceResult = { ok: true }
  for (let i = 0; i < 60; i++) {
    last = advance(state)
    if (!last.ok || last.event === 'weekend' || last.event === 'newSeason') return last
    const pending = state.inbox.filter((m) => m.choices && !m.resolvedChoiceId).length
    if (pending > pendingBefore) return { ok: true, event: 'week', reason: 'Une décision vous attend dans la boîte de réception.' }
  }
  return last
}
