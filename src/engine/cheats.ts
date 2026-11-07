// Menu de triche. Toute utilisation est notée dans la sauvegarde (meta.cheats.used).
import type { GameState } from './model/types'
import { CAR_AREAS, PU_TYPES } from './model/types'
import { addTx } from './finance/ledger'
import { checkEquity, recomputeStakes } from './board/equity'
import { pushMessage } from './inbox/messages'
import { Rng } from './core/rng'
import { clamp } from './core/money'

function mark(state: GameState) {
  state.meta.cheats ??= { used: false, alwaysAccept: false, noFailures: false }
  state.meta.cheats.used = true
  return state.meta.cheats
}

export const CHEATS = {
  addCash(state: GameState, eur: number) {
    mark(state)
    addTx(state, eur, 'event', 'Triche : injection de trésorerie', false)
  },
  resetCostCap(state: GameState) {
    mark(state)
    state.finances.costCap.spentUsd = 0
  },
  setCostCapLimit(state: GameState, usd: number) {
    mark(state)
    state.finances.costCap.limitUsd = Math.max(1e6, usd)
  },
  boostCar(state: GameState, points: number) {
    mark(state)
    const car = state.cars[state.playerTeamId]
    for (const a of CAR_AREAS) car.ratings[a] = clamp(car.ratings[a] + points, 30, 99)
  },
  maxCar(state: GameState) {
    mark(state)
    const car = state.cars[state.playerTeamId]
    for (const a of CAR_AREAS) car.ratings[a] = 99
  },
  finishProjects(state: GameState) {
    mark(state)
    const car = state.cars[state.playerTeamId]
    for (const p of car.projects) {
      if (p.status === 'design') {
        p.dpDone = p.dpRequired
        p.status = 'production'
      }
      if (p.status === 'production') p.productionWeeksLeft = 0
    }
    // Les pièces seront installées à la prochaine semaine ; on force ici la livraison.
    const rng = new Rng(state.meta.rng)
    for (const p of car.projects.filter((x) => x.status === 'production')) {
      const result = Math.max(0, p.expectedGain * (1 + rng.normal(0, p.variance / 2)))
      p.result = Math.round(result * 100) / 100
      p.status = 'done'
      if (p.nextYear) car.nextYearProgress[p.area] += result
      else car.ratings[p.area] = clamp(car.ratings[p.area] + result, 30, 99)
    }
  },
  finishFacilities(state: GameState) {
    mark(state)
    for (const f of Object.values(state.facilities)) {
      if (f.upgrade) {
        f.level = f.upgrade.toLevel
        f.upgrade = undefined
      }
    }
  },
  maxFacilities(state: GameState) {
    mark(state)
    for (const f of Object.values(state.facilities)) {
      f.level = f.maxLevel
      f.upgrade = undefined
    }
  },
  pleaseBoard(state: GameState) {
    mark(state)
    state.player.boardTrust = 100
    state.board.satisfaction = { hyundai: 100, redbird: 100, arctos: 100 }
  },
  setReputation(state: GameState, v: number) {
    mark(state)
    state.teams[state.playerTeamId].reputation = clamp(v, 0, 100)
  },
  setValuation(state: GameState, eur: number) {
    mark(state)
    state.board.valuationEur = Math.max(1e8, eur)
    state.board.valuationHistory.push({ date: state.clock.date, valueEur: state.board.valuationEur })
    checkEquity(state)
  },
  unlockAllEquity(state: GameState) {
    mark(state)
    const e = state.equity
    for (const s of e.sweat) s.unlockedAt ??= state.clock.date
    for (const s of e.earnOuts) s.unlockedAt ??= state.clock.date
    e.founder.vestedPct = e.founder.pct
    recomputeStakes(e)
  },
  maxMorale(state: GameState) {
    mark(state)
    for (const p of [...Object.values(state.drivers), ...Object.values(state.staff)]) if (p.teamId === state.playerTeamId) p.morale = 100
  },
  boostDrivers(state: GameState, points: number) {
    mark(state)
    for (const id of state.teams[state.playerTeamId].driverIds) {
      const d = state.drivers[id]
      for (const k of Object.keys(d.ratings) as (keyof typeof d.ratings)[]) d.ratings[k] = clamp(d.ratings[k] + points, 30, 99)
      d.potential = Math.max(d.potential, Math.min(99, d.potential + points))
    }
  },
  boostStaff(state: GameState, points: number) {
    mark(state)
    for (const s of Object.values(state.staff)) {
      if (s.teamId !== state.playerTeamId) continue
      for (const k of Object.keys(s.ratings)) s.ratings[k] = clamp(s.ratings[k] + points, 30, 99)
    }
  },
  maxPitCrew(state: GameState) {
    mark(state)
    const pc = state.teams[state.playerTeamId].pitCrew
    pc.speed = 99
    pc.consistency = 99
    pc.fatigue = 0
  },
  freshEngines(state: GameState) {
    mark(state)
    const car = state.cars[state.playerTeamId]
    for (const id of Object.keys(car.pu)) {
      for (const t of PU_TYPES) car.pu[id][t] = { used: 1, health: 100 }
      car.pendingGridPenalty[id] = 0
    }
  },
  finishHyundai(state: GameState) {
    mark(state)
    state.hyundai.progress = 100
    for (const m of state.hyundai.milestones) m.reached ??= state.clock.date
  },
  setFlag(state: GameState, flag: 'alwaysAccept' | 'noFailures', value: boolean) {
    const c = mark(state)
    c[flag] = value
  },
}

export function announceCheat(state: GameState, label: string): void {
  pushMessage(state, { category: 'board', title: `Triche activée : ${label}`, body: 'Cette carrière est marquée comme ayant utilisé le menu de triche.' })
}
