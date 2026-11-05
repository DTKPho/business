// Moteur de course tour par tour. Le mode direct appelle stepLap() à chaque
// tick d'horloge ; le mode « simuler la course » l'appelle en boucle.
import type { Compound, GameState, PaceMode, RaceCar, RaceLogEntry, RaceState, ResultRow, EngineMode, ErsMode, TeamOrder } from '../model/types'
import { PU_TYPES } from '../model/types'
import { Rng } from '../core/rng'
import { CONFIG } from '../init/data'
import { ensurePu, reliabilityScore } from '../car/car'
import { baseDelta, COMPOUND_OFFSET, COMPOUND_LABEL, pitStopTime, tyreWearPerLap, wearDelta, weatherTyreDelta } from './performance'
import { autoModes, decidePit, isDry, planRace } from './strategy'
import { facilityValue } from '../facilities/facilities'
import { fullName } from '../people/ratings'
import { addTx } from '../finance/ledger'
import { clamp } from '../core/money'

const PACE_DELTA: Record<PaceMode, number> = { push: -0.35, standard: 0, conserve: 0.45 }
const ENGINE_DELTA: Record<EngineMode, number> = { high: -0.18, standard: 0, low: 0.25 }
const ENGINE_WEAR: Record<EngineMode, number> = { high: 1.35, standard: 1, low: 0.75 }

function name(state: GameState, id: string): string {
  const d = state.drivers[id]
  return d ? fullName(d) : id
}

function log(race: RaceState, entry: RaceLogEntry): void {
  race.log.push(entry)
  if (race.log.length > 300) race.log.splice(0, race.log.length - 300)
}

/** Ordre de départ à partir des qualifications, pénalités moteur appliquées pour la course principale. */
export function buildGrid(state: GameState, kind: 'race' | 'sprint'): string[] {
  const w = state.weekend!
  const session = kind === 'sprint' ? w.results.SQ : w.results.Q
  let order = session ? session.rows.map((r) => r.driverId) : Object.values(state.teams).flatMap((t) => t.driverIds)
  order = order.filter((id) => state.drivers[id]?.teamId)
  if (kind === 'race') {
    const withPen = order.map((id, i) => {
      const car = state.cars[state.drivers[id].teamId!]
      return { id, key: i + (car.pendingGridPenalty[id] ?? 0) + i * 0.001 }
    })
    withPen.sort((a, b) => a.key - b.key)
    order = withPen.map((x) => x.id)
  }
  return order
}

export function startRace(state: GameState, kind: 'race' | 'sprint', startCompounds: Record<string, Compound> = {}): RaceState {
  const rng = new Rng(state.meta.rng)
  const w = state.weekend!
  const event = state.calendar.find((e) => e.round === w.round)!
  const circuit = state.circuits[event.circuitId]
  const totalLaps = kind === 'race' ? circuit.laps : Math.ceil(100 / circuit.lengthKm)
  const raining = rng.chance(clamp(circuit.rainChance * (0.4 + w.weatherBias * 1.4), 0, 0.9))
  const race: RaceState = {
    kind,
    round: w.round,
    circuitId: circuit.id,
    lap: 0,
    totalLaps,
    weather: { wetness: raining ? rng.range(0.25, 0.75) : 0, rain: raining ? rng.range(0.2, 0.8) : 0, trend: rng.normal(0, 0.03) },
    neutral: { mode: 'none', lapsLeft: 0 },
    cars: [],
    log: [],
    finished: false,
    fastestLap: null,
  }
  const grid = buildGrid(state, kind)
  grid.forEach((id, i) => {
    const d = state.drivers[id]
    ensurePu(state.cars[d.teamId!], id)
    const car: RaceCar = {
      driverId: id,
      teamId: d.teamId!,
      position: i + 1,
      startPos: i + 1,
      totalTime: i * 0.28,
      lastLap: 0,
      bestLap: 0,
      gapToLeader: i * 0.28,
      interval: i === 0 ? 0 : 0.28,
      lapsCompleted: 0,
      tyre: { compound: 'M', age: 0, wear: 0 },
      tyresUsed: [],
      fuel: kind === 'race' ? 100 : 38,
      pace: 'standard',
      engineMode: 'standard',
      ersMode: 'balanced',
      ersCharge: 100,
      damage: 0,
      status: 'running',
      pitStops: 0,
      pitRequest: null,
      teamOrder: 'free',
      penaltySec: 0,
      autoStrategy: true,
      plannedStops: [],
    }
    planRace(state, car, circuit, race, rng)
    if (startCompounds[id]) car.tyre.compound = startCompounds[id]
    car.tyresUsed.push(car.tyre.compound)
    race.cars.push(car)
  })
  if (kind === 'race') for (const t of Object.values(state.cars)) for (const k of Object.keys(t.pendingGridPenalty)) t.pendingGridPenalty[k] = 0
  log(race, {
    lap: 0,
    type: 'info',
    text: `Départ ${kind === 'sprint' ? 'de la course sprint' : 'du Grand Prix'} — ${race.totalLaps} tours, ${raining ? 'piste humide' : 'piste sèche'}.`,
  })
  state.race = race
  return race
}

function updateWeather(state: GameState, race: RaceState, rng: Rng): void {
  const circuit = state.circuits[race.circuitId]
  const wx = race.weather
  const prevRain = wx.rain
  if (wx.rain > 0) {
    wx.rain = clamp(wx.rain + wx.trend + rng.normal(0, 0.04), 0, 1)
    if (rng.chance(0.03)) wx.trend = rng.normal(-0.01, 0.03)
    if (wx.rain < 0.05) wx.rain = 0
  } else if (rng.chance((circuit.rainChance * (0.4 + (state.weekend?.weatherBias ?? 0.5))) / (race.totalLaps * 0.5))) {
    wx.rain = rng.range(0.15, 0.6)
    wx.trend = rng.normal(0.01, 0.03)
  }
  if (wx.rain > 0) wx.wetness = clamp(wx.wetness + (wx.rain - wx.wetness) * 0.18, 0, 1)
  else wx.wetness = clamp(wx.wetness - 0.035, 0, 1)
  if (prevRain === 0 && wx.rain > 0) log(race, { lap: race.lap, type: 'weather', text: 'La pluie commence à tomber !' })
  if (prevRain > 0 && wx.rain === 0) log(race, { lap: race.lap, type: 'weather', text: "La pluie s'arrête, la piste va sécher." })
}

function triggerNeutral(race: RaceState, rng: Rng, reason: string): void {
  if (race.neutral.mode !== 'none') return
  const r = rng.next()
  if (r < 0.55) {
    race.neutral = { mode: 'sc', lapsLeft: rng.int(3, 5) }
    log(race, { lap: race.lap, type: 'sc', text: `Voiture de sécurité ! (${reason})` })
  } else if (r < 0.88) {
    race.neutral = { mode: 'vsc', lapsLeft: rng.int(2, 3) }
    log(race, { lap: race.lap, type: 'sc', text: `Voiture de sécurité virtuelle (${reason})` })
  }
}

function retire(state: GameState, race: RaceState, car: RaceCar, reason: string): void {
  car.status = 'dnf'
  car.dnfReason = reason
  log(race, { lap: race.lap, type: 'dnf', text: `Abandon de ${name(state, car.driverId)} : ${reason}`, teamId: car.teamId })
}

/** Avance la course d'un tour. */
export function stepLap(state: GameState): void {
  const race = state.race
  if (!race || race.finished) return
  const rng = new Rng(state.meta.rng)
  const circuit = state.circuits[race.circuitId]
  race.lap += 1
  const lap = race.lap
  updateWeather(state, race, rng)
  const w = race.weather.wetness
  const neutral = race.neutral.mode
  const running = race.cars.filter((c) => c.status === 'running').sort((a, b) => a.position - b.position)
  const fuelPerLap = (race.kind === 'race' ? 100 : 38) / race.totalLaps
  const newTotals = new Map<RaceCar, number>()

  for (const car of running) {
    autoModes(car, race)
    const d = state.drivers[car.driverId]
    const r = d.ratings
    let lt = circuit.baseLapSec + baseDelta(state, car.driverId, circuit, 'race')
    lt += w < 0.3 ? COMPOUND_OFFSET[car.tyre.compound] : 0
    lt += weatherTyreDelta(car.tyre.compound, w)
    lt += w * 7 * (1 + (80 - r.wet) / 90)
    lt += wearDelta(car.tyre.wear)
    lt += car.fuel * 0.032
    lt += PACE_DELTA[car.pace] + ENGINE_DELTA[car.engineMode]
    if (car.ersMode === 'attack' && car.ersCharge >= 20) lt -= 0.28
    if (car.ersMode === 'harvest') lt += 0.22
    lt += car.damage * 0.045
    lt += rng.normal(0, 0.12 + (100 - r.consistency) * 0.005)
    if (lap === 1) lt += rng.normal(0, 0.35 + (85 - r.racecraft) * 0.01) + 2
    // Erreur de pilotage
    if (rng.chance((100 - r.consistency) / 2600 + w * 0.004)) {
      const loss = rng.range(0.8, 3.5)
      lt += loss
      if (state.teams[car.teamId].isPlayer) log(race, { lap, type: 'incident', text: `${name(state, car.driverId)} commet une erreur (+${loss.toFixed(1)} s)`, teamId: car.teamId })
    }
    if (neutral === 'sc') lt = circuit.baseLapSec * 1.42 + rng.next() * 0.3
    else if (neutral === 'vsc') lt = lt * 1.32
    car.lastLap = lt
    newTotals.set(car, car.totalTime + lt)

    // Usure pneus, carburant, ERS
    const knowledge = state.weekend?.tyreKnowledge[car.driverId] ?? 40
    const wearMul = neutral === 'none' ? 1 : 0.35
    car.tyre.wear = Math.min(100, car.tyre.wear + tyreWearPerLap(car.tyre.compound, circuit, r.tyreManagement, knowledge, car.pace, w) * wearMul)
    car.tyre.age += 1
    car.fuel = Math.max(0, car.fuel - fuelPerLap)
    if (car.ersMode === 'attack') car.ersCharge = Math.max(0, car.ersCharge - 22)
    else if (car.ersMode === 'harvest') car.ersCharge = Math.min(100, car.ersCharge + 28)
    else car.ersCharge = Math.min(100, car.ersCharge + 6)

    // Usure moteur
    const carObj = state.cars[car.teamId]
    ensurePu(carObj, car.driverId)
    for (const t of PU_TYPES) {
      const u = carObj.pu[car.driverId][t]
      u.health = Math.max(0, u.health - (CONFIG.puWearPerRace[t] / circuit.laps) * ENGINE_WEAR[car.engineMode] * (race.kind === 'sprint' ? 0.9 : 1))
    }

    // Fiabilité
    const rel = reliabilityScore(state, car.teamId)
    let pFail = ((100 - rel) / 100) * 0.0026 * ENGINE_WEAR[car.engineMode]
    for (const t of PU_TYPES) {
      const h = carObj.pu[car.driverId][t].health
      if (h < 25) pFail += ((25 - h) / 25) * 0.004
    }
    if (state.teams[car.teamId].isPlayer) pFail *= 1 - Math.min(0.4, facilityValue(state, 'reliabilityOps'))
    if (rng.chance(pFail)) {
      const parts = ['Moteur', 'Boîte de vitesses', 'Hydraulique', 'MGU-K', 'Électronique', 'Freins', 'Turbo']
      const part = rng.pick(parts)
      if (rng.chance(0.65)) {
        retire(state, race, car, `Problème mécanique (${part})`)
        if (rng.chance(0.35)) triggerNeutral(race, rng, `voiture arrêtée en piste`)
      } else {
        car.damage += 8
        newTotals.set(car, newTotals.get(car)! + rng.range(6, 20))
        log(race, { lap, type: 'incident', text: `${name(state, car.driverId)} signale un souci de ${part.toLowerCase()} et perd du temps`, teamId: car.teamId })
      }
      continue
    }
    // Accident
    const wrongTyres = isDry(car.tyre.compound) && w > 0.3 ? 3 : 1
    const pCrash = 0.00032 * (1 + (80 - r.consistency) / 30) * (car.pace === 'push' ? 1.6 : car.pace === 'conserve' ? 0.7 : 1) * (1 + w * 3) * wrongTyres * (0.6 + circuit.traits.safetyCarProb) * (lap === 1 ? 6 : 1) * (car.tyre.wear > 90 ? 3 : 1)
    if (neutral === 'none' && rng.chance(pCrash)) {
      if (rng.chance(0.7)) {
        retire(state, race, car, 'Accident')
        triggerNeutral(race, rng, `accident de ${name(state, car.driverId)}`)
      } else {
        car.damage += 18
        newTotals.set(car, newTotals.get(car)! + rng.range(8, 18))
        log(race, { lap, type: 'incident', text: `${name(state, car.driverId)} part en tête-à-queue, voiture endommagée`, teamId: car.teamId })
      }
    }
    if (car.tyre.wear >= 99 && rng.chance(0.25) && car.status === 'running') {
      newTotals.set(car, newTotals.get(car)! + 25)
      car.tyre.wear = 100
      car.pitRequest = car.pitRequest ?? (isDry(car.tyre.compound) ? 'H' : car.tyre.compound)
      log(race, { lap, type: 'incident', text: `Crevaison pour ${name(state, car.driverId)} !`, teamId: car.teamId })
    }
  }

  // Dépassements
  const order = running.filter((c) => c.status === 'running')
  for (let i = 1; i < order.length; i++) {
    const behind = order[i]
    const ahead = order[i - 1]
    const tb = newTotals.get(behind)!
    const ta = newTotals.get(ahead)!
    if (tb >= ta + 0.15) continue
    if (neutral !== 'none') {
      newTotals.set(behind, ta + 0.4)
      continue
    }
    const sameTeam = behind.teamId === ahead.teamId
    if (sameTeam && ahead.teamOrder === 'letPass') {
      order[i - 1] = behind
      order[i] = ahead
      newTotals.set(behind, Math.min(tb, ta - 0.1))
      newTotals.set(ahead, Math.max(ta, Math.min(tb, ta - 0.1) + 0.3))
      log(race, { lap, type: 'order', text: `${name(state, ahead.driverId)} laisse passer son équipier ${name(state, behind.driverId)}`, teamId: ahead.teamId })
      continue
    }
    if (sameTeam && behind.teamOrder === 'hold') {
      newTotals.set(behind, ta + 0.5)
      continue
    }
    const rb = state.drivers[behind.driverId].ratings.racecraft
    const ra = state.drivers[ahead.driverId].ratings.racecraft
    const drs = behind.interval < 1.0 && lap > 2 && w < 0.3
    const adv = ta - tb
    const p = clamp(0.1 + circuit.traits.overtaking * 0.45 + adv * 0.35 + (rb - ra) / 250 + (drs ? 0.15 : 0) + (behind.ersMode === 'attack' && behind.ersCharge >= 20 ? 0.08 : 0), 0.03, 0.92)
    if (rng.chance(p)) {
      order[i - 1] = behind
      order[i] = ahead
      const nb = Math.min(tb, ta - 0.05)
      newTotals.set(behind, nb)
      newTotals.set(ahead, Math.max(ta + 0.15, nb + 0.25))
      const involvesPlayer = state.teams[behind.teamId].isPlayer || state.teams[ahead.teamId].isPlayer
      if (involvesPlayer || i <= 3) log(race, { lap, type: 'overtake', text: `${name(state, behind.driverId)} dépasse ${name(state, ahead.driverId)} pour la P${i}`, teamId: behind.teamId })
    } else {
      newTotals.set(behind, ta + 0.35)
      const pCol = 0.012 * (1 - state.drivers[behind.driverId].mentality.temperament / 160)
      if (rng.chance(pCol)) {
        behind.damage += rng.range(5, 25)
        ahead.damage += rng.range(0, 10)
        log(race, { lap, type: 'incident', text: `Contact entre ${name(state, behind.driverId)} et ${name(state, ahead.driverId)} !`, teamId: behind.teamId })
        if (behind.damage > 40 && rng.chance(0.5)) {
          retire(state, race, behind, 'Dommages après contact')
          triggerNeutral(race, rng, 'débris en piste')
        }
      }
    }
  }
  for (const car of order) if (car.status === 'running') car.totalTime = newTotals.get(car)!

  // Débris aléatoires
  if (race.neutral.mode === 'none' && rng.chance((circuit.traits.safetyCarProb * 0.25) / race.totalLaps)) triggerNeutral(race, rng, 'débris en piste')

  // Arrêts aux stands (fin de tour)
  if (lap < race.totalLaps) {
    for (const car of order) {
      if (car.status !== 'running') continue
      const compound = decidePit(state, car, circuit, race)
      if (!compound) continue
      const lossMul = race.neutral.mode === 'sc' ? 0.55 : race.neutral.mode === 'vsc' ? 0.7 : 1
      const stationary = pitStopTime(state, car.teamId, rng.next(), rng.next())
      const repair = car.damage > 15 ? 6 : 0
      car.totalTime += circuit.traits.pitLossSec * lossMul + stationary + repair
      if (repair) car.damage = Math.max(0, car.damage - 15)
      car.tyre = { compound, age: 0, wear: 0 }
      car.tyresUsed.push(compound)
      car.pitStops += 1
      car.pitRequest = null
      car.plannedStops = car.plannedStops.filter((l) => l > lap)
      const team = state.teams[car.teamId]
      team.pitCrew.fatigue = Math.min(30, team.pitCrew.fatigue + 0.5)
      if (team.isPlayer || stationary > 4.5)
        log(race, { lap, type: 'pit', text: `Arrêt de ${name(state, car.driverId)} : ${COMPOUND_LABEL[compound]} (${stationary.toFixed(1)} s)`, teamId: car.teamId })
    }
  }

  // Classement
  const still = race.cars.filter((c) => c.status === 'running').sort((a, b) => a.totalTime - b.totalTime)
  if (race.neutral.mode === 'sc' && still.length) {
    const lead = still[0].totalTime
    // Le peloton se regroupe derrière la voiture de sécurité.
    still.forEach((c, i) => (c.totalTime = lead + Math.min(c.totalTime - lead, i * 0.6)))
  }
  still.sort((a, b) => a.totalTime - b.totalTime)
  const leader = still[0]
  still.forEach((c, i) => {
    c.position = i + 1
    c.lapsCompleted = lap
    c.gapToLeader = leader ? c.totalTime - leader.totalTime : 0
    c.interval = i === 0 ? 0 : c.totalTime - still[i - 1].totalTime
    if (neutral === 'none' && (c.bestLap === 0 || c.lastLap < c.bestLap)) c.bestLap = c.lastLap
    if (neutral === 'none' && (!race.fastestLap || c.lastLap < race.fastestLap.time)) race.fastestLap = { driverId: c.driverId, time: c.lastLap }
  })
  const dnfs = race.cars.filter((c) => c.status === 'dnf').sort((a, b) => b.lapsCompleted - a.lapsCompleted)
  dnfs.forEach((c, i) => (c.position = still.length + i + 1))

  // Neutralisation
  if (race.neutral.mode !== 'none' && neutral !== 'none') {
    race.neutral.lapsLeft -= 1
    if (race.neutral.lapsLeft <= 0) {
      log(race, { lap, type: 'sc', text: race.neutral.mode === 'sc' ? 'La voiture de sécurité rentre : relance !' : 'Fin de la VSC, la course reprend.' })
      race.neutral = { mode: 'none', lapsLeft: 0 }
    }
  }

  if (lap >= race.totalLaps) {
    race.finished = true
    for (const c of race.cars) if (c.status === 'running') c.status = 'finished'
    log(race, { lap, type: 'info', text: `Drapeau à damier ! Victoire de ${leader ? name(state, leader.driverId) : '—'}.` })
  }
}

export function simulateToEnd(state: GameState): void {
  let guard = 0
  while (state.race && !state.race.finished && guard++ < 200) stepLap(state)
}

export interface RaceOrders {
  pace?: PaceMode
  engineMode?: EngineMode
  ersMode?: ErsMode
  teamOrder?: TeamOrder
  pitRequest?: Compound | null
  autoStrategy?: boolean
}

export function setRaceOrders(state: GameState, driverId: string, orders: RaceOrders): void {
  const car = state.race?.cars.find((c) => c.driverId === driverId)
  if (!car || car.status !== 'running') return
  if (state.drivers[driverId].teamId !== state.playerTeamId) return
  const manual = orders.pace !== undefined || orders.engineMode !== undefined || orders.ersMode !== undefined
  Object.assign(car, orders)
  if (manual && orders.autoStrategy === undefined) car.autoStrategy = false
  if (orders.teamOrder && state.race) {
    state.race.log.push({ lap: state.race.lap, type: 'order', text: `Consigne d'équipe pour ${name(state, driverId)} : ${orders.teamOrder === 'hold' ? 'garder la position' : orders.teamOrder === 'letPass' ? 'laisser passer' : 'course libre'}`, teamId: car.teamId })
  }
}

/** Classement final, points et statistiques. Ne vide pas state.race (affichage du résultat). */
export function finishRace(state: GameState): ResultRow[] {
  const race = state.race!
  if (!race.finished) simulateToEnd(state)
  const points = race.kind === 'race' ? CONFIG.pointsRace : CONFIG.pointsSprint
  // Règle des deux composés (course principale sur le sec)
  if (race.kind === 'race') {
    for (const c of race.cars) {
      if (c.status !== 'finished') continue
      const dry = c.tyresUsed.filter(isDry)
      if (dry.length === c.tyresUsed.length && new Set(dry).size < 2) {
        c.penaltySec += 30
        race.log.push({ lap: race.lap, type: 'info', text: `${name(state, c.driverId)} pénalisé de 30 s : un seul composé utilisé`, teamId: c.teamId })
      }
    }
  }
  const finished = race.cars.filter((c) => c.status === 'finished').sort((a, b) => a.totalTime + a.penaltySec - (b.totalTime + b.penaltySec))
  const dnf = race.cars.filter((c) => c.status === 'dnf').sort((a, b) => b.lapsCompleted - a.lapsCompleted)
  const leaderTime = finished[0] ? finished[0].totalTime + finished[0].penaltySec : 0
  const rows: ResultRow[] = []
  finished.forEach((c, i) => {
    rows.push({
      driverId: c.driverId,
      teamId: c.teamId,
      position: i + 1,
      time: c.totalTime + c.penaltySec,
      gap: c.totalTime + c.penaltySec - leaderTime,
      laps: race.totalLaps,
      status: 'finished',
      points: points[i] ?? 0,
    })
  })
  dnf.forEach((c, i) => rows.push({ driverId: c.driverId, teamId: c.teamId, position: finished.length + i + 1, laps: c.lapsCompleted, status: 'dnf', dnfReason: c.dnfReason, points: 0 }))

  // Statistiques
  for (const row of rows) {
    const d = state.drivers[row.driverId]
    d.season.points += row.points ?? 0
    d.career.points += row.points ?? 0
    if (race.kind === 'race') {
      d.career.starts += 1
      if (row.status === 'dnf') d.career.dnfs += 1
      if (row.status === 'finished' && row.position === 1) {
        d.career.wins += 1
        d.season.wins += 1
      }
      if (row.status === 'finished' && row.position <= 3) {
        d.career.podiums += 1
        d.season.podiums += 1
      }
    }
  }
  // Coûts de réparation pour le joueur
  for (const c of race.cars) {
    if (c.teamId !== state.playerTeamId) continue
    const cost = c.dnfReason === 'Accident' ? 1_400_000 : c.damage > 10 ? c.damage * 25_000 : 0
    if (cost) addTx(state, -cost, 'production', `Réparations — ${name(state, c.driverId)}`, true)
  }

  let entry = state.results.find((r) => r.round === race.round)
  if (!entry) {
    entry = { round: race.round, circuitId: race.circuitId, race: [] }
    state.results.push(entry)
  }
  if (race.kind === 'sprint') entry.sprint = rows
  else entry.race = rows
  return rows
}

export function positionLabel(car: RaceCar, race: RaceState, avgLap: number): string {
  if (car.status === 'dnf') return 'ABD'
  if (car.position === 1) return `Tour ${race.lap}`
  const laps = Math.floor(car.gapToLeader / avgLap)
  return laps >= 1 ? `+${laps} T` : `+${car.gapToLeader.toFixed(1)}`
}
