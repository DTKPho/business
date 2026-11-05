import type { Ambition, CarArea, GameState, RnDProject, TeamId } from '../model/types'
import { CAR_AREAS } from '../model/types'
import { DATA, CONFIG } from '../init/data'
import type { Rng } from '../core/rng'
import { roleRating } from '../people/ratings'
import { facilityValue } from '../facilities/facilities'
import { addTx } from '../finance/ledger'
import { nextId } from '../core/ids'
import { pushMessage } from '../inbox/messages'
import { AREA_LABEL } from './car'
import { clamp } from '../core/money'

export const AMBITION: Record<Ambition, { label: string; dp: number; cost: number; gain: number; variance: number; failure: number; reliability: number }> = {
  conservative: { label: 'Prudent', dp: 0.8, cost: 0.85, gain: 0.7, variance: 0.15, failure: 0.03, reliability: 0 },
  standard: { label: 'Standard', dp: 1, cost: 1, gain: 1, variance: 0.3, failure: 0.08, reliability: -0.2 },
  aggressive: { label: 'Agressif', dp: 1.35, cost: 1.3, gain: 1.6, variance: 0.5, failure: 0.15, reliability: -0.8 },
}

export const MAX_PROJECTS = 4

/** Rang au championnat constructeurs utilisé pour les restrictions d'essais aérodynamiques (ATR). */
export function atrFactor(state: GameState, teamId: TeamId): number {
  const pos = state.teams[teamId].lastConstructorPos
  return CONFIG.atrWindTunnelByPosition[clamp(pos, 1, 11) - 1] ?? 1
}

export interface DpBreakdown {
  total: number
  staff: number
  facilities: number
  aeroMultiplier: number
  powertrainMultiplier: number
  atr: number
  sanction: number
}

export function designPoints(state: GameState, teamId: TeamId = state.playerTeamId): DpBreakdown {
  const td = roleRating(state, teamId, 'technicalDirector')
  const aero = roleRating(state, teamId, 'headOfAero')
  const cd = roleRating(state, teamId, 'chiefDesigner')
  const staffAvg = td * 0.4 + aero * 0.3 + cd * 0.3
  const staff = 0.35 + (staffAvg / 100) * 0.9
  const isPlayer = teamId === state.playerTeamId
  const facilities = isPlayer ? 1 + facilityValue(state, 'designPoints') : 1 + state.teams[teamId].budgetTier * 0.05
  const atr = atrFactor(state, teamId)
  const aeroMultiplier = (isPlayer ? facilityValue(state, 'aeroEfficiency') : 0.9 + state.teams[teamId].budgetTier * 0.03) * atr
  const powertrainMultiplier = isPlayer ? facilityValue(state, 'powertrainEfficiency') : 1
  const sanction = isPlayer && state.finances.sanction?.season === state.clock.season ? state.finances.sanction.dpFactor : 1
  return { total: CONFIG.designPointsBase * staff * facilities * sanction, staff, facilities, aeroMultiplier, powertrainMultiplier, atr, sanction }
}

function diminishing(rating: number): number {
  return clamp((96 - rating) / 22, 0.2, 1.4)
}

export function previewProject(state: GameState, templateId: string, ambition: Ambition, nextYear: boolean) {
  const t = DATA.rndTemplates.find((x) => x.id === templateId)!
  const a = AMBITION[ambition]
  const car = state.cars[state.playerTeamId]
  const prodMul = 1 + facilityValue(state, 'productionCost')
  const gain = t.gain * a.gain * diminishing(car.ratings[t.area] + (nextYear ? car.nextYearProgress[t.area] : 0)) * (1 + facilityValue(state, 'partQuality'))
  return {
    template: t,
    dpRequired: Math.round(t.dp * a.dp),
    designCostEur: Math.round(t.designCostEur * a.cost),
    unitCostEur: Math.round(t.unitCostEur * a.cost * prodMul),
    units: t.units,
    productionWeeks: Math.max(1, Math.round(t.productionWeeks * (1.2 - state.facilities.factory.level * 0.08))),
    expectedGain: Math.round(gain * 100) / 100,
    variance: a.variance,
    failureRisk: a.failure,
    reliabilityImpact: t.area === 'reliability' ? 0 : a.reliability,
  }
}

export function startProject(state: GameState, templateId: string, ambition: Ambition, nextYear: boolean): { ok: boolean; reason?: string } {
  const car = state.cars[state.playerTeamId]
  const active = car.projects.filter((p) => p.status === 'design' || p.status === 'production')
  if (active.length >= MAX_PROJECTS) return { ok: false, reason: `Maximum ${MAX_PROJECTS} projets simultanés.` }
  const p = previewProject(state, templateId, ambition, nextYear)
  if (state.finances.cashEur < p.designCostEur) return { ok: false, reason: 'Trésorerie insuffisante.' }
  const project: RnDProject = {
    id: nextId(state, 'rnd'),
    area: p.template.area,
    templateId,
    name: p.template.name,
    ambition,
    nextYear,
    dpRequired: p.dpRequired,
    dpDone: 0,
    designCostEur: p.designCostEur,
    unitCostEur: p.unitCostEur,
    units: p.units,
    productionWeeks: p.productionWeeks,
    productionWeeksLeft: p.productionWeeks,
    expectedGain: p.expectedGain,
    variance: p.variance,
    failureRisk: p.failureRisk,
    reliabilityImpact: p.reliabilityImpact,
    status: 'design',
    startedAt: state.clock.date,
  }
  addTx(state, -p.designCostEur, 'rnd', `Conception : ${project.name}${nextYear ? ` (${state.clock.season + 1})` : ''}`, true)
  car.projects.push(project)
  return { ok: true }
}

export function cancelProject(state: GameState, id: string): void {
  const car = state.cars[state.playerTeamId]
  const p = car.projects.find((x) => x.id === id)
  if (p && p.status === 'design') p.status = 'failed'
}

/** Avancement hebdomadaire des projets du joueur. */
export function tickPlayerRnd(state: GameState, weeks: number, rng: Rng): void {
  const car = state.cars[state.playerTeamId]
  const dp = designPoints(state)
  const designing = car.projects.filter((p) => p.status === 'design')
  let pool = dp.total * weeks + state.finances.extraDesignPoints
  state.finances.extraDesignPoints = 0
  if (designing.length) {
    const share = pool / designing.length
    for (const p of designing) {
      const mul = p.area === 'aero' ? dp.aeroMultiplier : p.area === 'powertrain' ? dp.powertrainMultiplier : 1
      p.dpDone += share * mul
      if (p.dpDone >= p.dpRequired) {
        p.dpDone = p.dpRequired
        if (rng.chance(p.failureRisk)) {
          p.status = 'failed'
          pushMessage(state, {
            category: 'car',
            title: `Échec du projet : ${p.name}`,
            body: `Les essais en soufflerie et au banc n'ont pas confirmé les gains attendus. Le projet ${p.name} (${AREA_LABEL[p.area]}) est abandonné.`,
          })
        } else {
          p.status = 'production'
          const cost = p.unitCostEur * p.units
          addTx(state, -cost, 'production', `Production : ${p.name} ×${p.units}`, true)
        }
      }
    }
    pool = 0
  }
  for (const p of car.projects.filter((x) => x.status === 'production')) {
    p.productionWeeksLeft -= weeks
    if (p.productionWeeksLeft <= 0) completeProject(state, p, rng)
  }
  // Ménage : on garde les 30 derniers projets terminés
  const done = car.projects.filter((p) => p.status === 'done' || p.status === 'failed')
  if (done.length > 30) car.projects = car.projects.filter((p) => !done.slice(0, done.length - 30).includes(p))
}

function completeProject(state: GameState, p: RnDProject, rng: Rng): void {
  const car = state.cars[state.playerTeamId]
  const result = Math.max(-0.3, p.expectedGain * (1 + rng.normal(0, p.variance)))
  p.result = Math.round(result * 100) / 100
  p.status = 'done'
  if (p.nextYear) {
    car.nextYearProgress[p.area] += result
  } else {
    car.ratings[p.area] = clamp(car.ratings[p.area] + result, 30, 99)
    if (p.reliabilityImpact) car.ratings.reliability = clamp(car.ratings.reliability + p.reliabilityImpact, 30, 99)
  }
  pushMessage(state, {
    category: 'car',
    title: `Nouvelle pièce : ${p.name}`,
    body: p.nextYear
      ? `La pièce est validée pour la voiture ${state.clock.season + 1} : ${result >= 0 ? '+' : ''}${result.toFixed(2)} en ${AREA_LABEL[p.area].toLowerCase()}.`
      : `La pièce est montée sur les deux voitures : ${result >= 0 ? '+' : ''}${result.toFixed(2)} en ${AREA_LABEL[p.area].toLowerCase()}${p.reliabilityImpact ? ` (fiabilité ${p.reliabilityImpact})` : ''}.`,
  })
}

/** Développement simplifié des écuries IA. */
export function tickAiDevelopment(state: GameState, weeks: number, rng: Rng): void {
  const lateSeason = state.calendar.filter((e) => e.completed).length / Math.max(1, state.calendar.length) > 0.6
  for (const team of Object.values(state.teams)) {
    if (team.isPlayer) continue
    const car = state.cars[team.id]
    const dp = designPoints(state, team.id)
    const profile = team.aiProfile === 'aggressive' ? 1.15 : team.aiProfile === 'conservative' ? 0.9 : 1
    for (const area of CAR_AREAS) {
      const mul = area === 'aero' ? dp.aeroMultiplier : 1
      const gain = (dp.total / 60) * 0.06 * mul * profile * diminishing(car.ratings[area]) * rng.range(0.3, 1.7) * weeks
      if (lateSeason && rng.chance(0.5)) car.nextYearProgress[area] += gain
      else car.ratings[area] = clamp(car.ratings[area] + gain, 30, 99)
    }
  }
}

export function areaList(): CarArea[] {
  return CAR_AREAS
}
