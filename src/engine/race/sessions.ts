// Essais libres et qualifications. Chaque séance est générée sous forme de
// chronologie complète (tours en piste, sorties des stands, tours lancés) que
// l'interface peut rejouer en direct ; le classement en découle.
import type { Circuit, Compound, GameState, LiveLap, PendingSession, ResultRow, SessionId } from '../model/types'
import { Rng } from '../core/rng'
import { baseDelta, COMPOUND_OFFSET, engineerSetupBonus, weatherTyreDelta } from './performance'
import { clamp } from '../core/money'
import { fullName } from '../people/ratings'

function sessionWetness(state: GameState, rng: Rng): number {
  const w = state.weekend!
  const circuit = state.circuits[state.calendar.find((e) => e.round === w.round)!.circuitId]
  return rng.chance(clamp(circuit.rainChance * (0.4 + w.weatherBias * 1.4), 0, 0.9)) ? rng.range(0.2, 0.8) : 0
}

function bestCompound(w: number): Compound {
  if (w >= 0.65) return 'W'
  if (w >= 0.18) return 'I'
  return 'S'
}

function allDrivers(state: GameState): string[] {
  return Object.values(state.teams).flatMap((t) => t.driverIds).filter((id) => state.drivers[id])
}

function circuitOf(state: GameState): Circuit {
  const w = state.weekend!
  return state.circuits[state.calendar.find((e) => e.round === w.round)!.circuitId]
}

function wetPenalty(state: GameState, id: string, wet: number, c: Compound): number {
  return weatherTyreDelta(c, wet) + wet * 7 * (1 + (80 - state.drivers[id].ratings.wet) / 90)
}

/** Applique l'effet du programme de roulage sur la confiance et la connaissance des pneus. */
function applyPracticeProgram(state: GameState, id: string): void {
  const w = state.weekend!
  const d = state.drivers[id]
  const fb = d.ratings.feedback
  if (state.teams[d.teamId!].isPlayer) {
    const prog = w.practiceProgram[id] ?? 'setup'
    if (prog === 'setup') w.setupConfidence[id] = clamp((w.setupConfidence[id] ?? 40) + 9 + engineerSetupBonus(state, id) * 0.4 + fb / 25, 0, 100)
    if (prog === 'tyres') {
      w.tyreKnowledge[id] = clamp((w.tyreKnowledge[id] ?? 30) + 14 + fb / 25, 0, 100)
      w.setupConfidence[id] = clamp((w.setupConfidence[id] ?? 40) + 3, 0, 100)
    }
    if (prog === 'raceSim') {
      w.tyreKnowledge[id] = clamp((w.tyreKnowledge[id] ?? 30) + 8, 0, 100)
      w.setupConfidence[id] = clamp((w.setupConfidence[id] ?? 40) + 6, 0, 100)
    }
  } else {
    w.setupConfidence[id] = clamp((w.setupConfidence[id] ?? 40) + 8 + engineerSetupBonus(state, id) * 0.3, 0, 100)
    w.tyreKnowledge[id] = clamp((w.tyreKnowledge[id] ?? 30) + 9, 0, 100)
  }
}

export const PRACTICE_DURATION = 3600

export function runPractice(state: GameState, session: SessionId): PendingSession {
  const rng = new Rng(state.meta.rng)
  const w = state.weekend!
  const circuit = circuitOf(state)
  const wet = sessionWetness(state, rng)
  const laps: LiveLap[] = []
  const rows: ResultRow[] = []
  for (const id of allDrivers(state)) {
    applyPracticeProgram(state, id)
    const d = state.drivers[id]
    const prog = state.teams[d.teamId!].isPlayer ? (w.practiceProgram[id] ?? 'setup') : 'setup'
    const base = circuit.baseLapSec + baseDelta(state, id, circuit, 'quali')
    let t = rng.range(90, 700)
    let best = Infinity
    let count = 0
    const runs = rng.int(3, 5)
    for (let r = 0; r < runs && t < PRACTICE_DURATION - 400; r++) {
      const longRun = prog === 'raceSim' ? r >= 1 : rng.chance(0.3)
      const compound: Compound = wet >= 0.18 ? bestCompound(wet) : longRun ? rng.pick(['M', 'H'] as Compound[]) : rng.pick(['S', 'S', 'M'] as Compound[])
      const fuel = longRun ? rng.range(0.9, 1.6) : rng.range(0.1, 0.6)
      const lapCore = () => base + (wet < 0.18 ? COMPOUND_OFFSET[compound] : 0) + wetPenalty(state, id, wet, compound) + fuel + rng.normal(0, 0.18 + (100 - d.ratings.consistency) * 0.004)
      const out = lapCore() * 1.28
      laps.push({ driverId: id, start: t, end: t + out, lapTime: out, timed: false, compound })
      t += out
      const n = longRun ? rng.int(6, 10) : rng.int(2, 4)
      for (let i = 0; i < n && t < PRACTICE_DURATION; i++) {
        const lt = lapCore() + (longRun ? i * 0.04 : 0)
        laps.push({ driverId: id, start: t, end: t + lt, lapTime: lt, timed: true, compound })
        t += lt
        count++
        best = Math.min(best, lt)
      }
      const inLap = lapCore() * 1.33
      laps.push({ driverId: id, start: t, end: t + inLap, lapTime: inLap, timed: false, compound })
      t += inLap + rng.range(240, 820)
    }
    rows.push({ driverId: id, teamId: d.teamId!, position: 0, time: best, laps: count })
  }
  rows.sort((a, b) => a.time! - b.time!)
  rows.forEach((r, i) => {
    r.position = i + 1
    r.gap = r.time! - rows[0].time!
  })
  const notes: string[] = []
  if (wet > 0) notes.push('Séance disputée sur piste humide.')
  for (const id of state.teams[state.playerTeamId].driverIds) {
    const d = state.drivers[id]
    if (d) notes.push(`${fullName(d)} : confiance réglages ${Math.round(w.setupConfidence[id] ?? 0)}/100, connaissance pneus ${Math.round(w.tyreKnowledge[id] ?? 0)}/100.`)
  }
  laps.sort((a, b) => a.end - b.end)
  return { session, result: { session, rows, notes }, laps, duration: PRACTICE_DURATION, wetness: wet }
}

export function runQualifying(state: GameState, session: 'Q' | 'SQ'): PendingSession {
  const rng = new Rng(state.meta.rng)
  const circuit = circuitOf(state)
  const wet = sessionWetness(state, rng)
  const comp = bestCompound(wet)
  const pushLap = (id: string) => {
    const d = state.drivers[id]
    let t =
      circuit.baseLapSec -
      1.2 + // peu d'essence, moteur en mode qualif
      baseDelta(state, id, circuit, 'quali') +
      (wet < 0.18 ? COMPOUND_OFFSET[comp] : 0) +
      wetPenalty(state, id, wet, comp) +
      rng.normal(0, 0.07 + (100 - d.ratings.consistency) * 0.004)
    if (rng.chance((100 - d.ratings.consistency) / 700 + wet * 0.03)) t += rng.range(0.5, 2.5)
    return t
  }
  const sprint = session === 'SQ'
  const segLen = sprint ? [720, 600, 480] : [1080, 900, 720]
  const gap = sprint ? 300 : 420
  const field = allDrivers(state)
  const n = field.length
  const cut1 = Math.max(10, n - 6)
  const cut2 = Math.max(10, cut1 - 6)
  const sizes = [cut1, cut2, 0]
  const rows = new Map<string, ResultRow>()
  const laps: LiveLap[] = []
  const segments: NonNullable<PendingSession['segments']> = []
  let remaining = field
  let posOffset = n
  let segStart = 0
  for (let k = 0; k < 3; k++) {
    const seg = (k + 1) as 1 | 2 | 3
    const len = segLen[k]
    const times: { id: string; t: number }[] = []
    for (const id of remaining) {
      let best = Infinity
      const runStarts = [segStart + rng.range(40, len * 0.35), segStart + len * 0.6 + rng.range(0, len * 0.16)]
      for (const rs of runStarts) {
        const push = pushLap(id)
        const out = (push + 1.2) * 1.25
        const inLap = (push + 1.2) * 1.3
        laps.push({ driverId: id, start: rs, end: rs + out, lapTime: out, timed: false, compound: comp, segment: seg })
        laps.push({ driverId: id, start: rs + out, end: rs + out + push, lapTime: push, timed: true, compound: comp, segment: seg })
        laps.push({ driverId: id, start: rs + out + push, end: rs + out + push + inLap, lapTime: inLap, timed: false, compound: comp, segment: seg })
        best = Math.min(best, push)
      }
      times.push({ id, t: best })
    }
    times.sort((a, b) => a.t - b.t)
    const out = seg === 3 ? times : times.slice(sizes[k])
    for (let i = out.length - 1; i >= 0; i--) {
      const d = state.drivers[out[i].id]
      rows.set(out[i].id, { driverId: out[i].id, teamId: d.teamId!, position: posOffset--, time: out[i].t, knockedOutIn: seg })
    }
    segments.push({ seg, start: segStart, end: segStart + len, eliminated: seg === 3 ? [] : out.map((x) => x.id) })
    remaining = times.slice(0, sizes[k]).map((x) => x.id)
    segStart += len + gap
  }
  const list = [...rows.values()].sort((a, b) => a.position - b.position)
  const pole = list[0]
  list.forEach((r) => (r.gap = r.knockedOutIn === 3 ? r.time! - pole.time! : undefined))
  const notes: string[] = []
  if (wet > 0) notes.push(`Qualifications sur piste ${wet > 0.6 ? 'détrempée' : 'humide'}.`)
  notes.push(`Pole position : ${fullName(state.drivers[pole.driverId])}.`)
  laps.sort((a, b) => a.end - b.end)
  const duration = Math.max(...laps.map((l) => l.end)) + 30
  return { session, result: { session, rows: list, notes }, laps, duration, wetness: wet, segments }
}

/** Enregistre la pole (appelé quand la séance de qualification est validée). */
export function recordPole(state: GameState, round: number, circuitId: string, poleId: string): void {
  let entry = state.results.find((r) => r.round === round)
  if (!entry) {
    entry = { round, circuitId, race: [] }
    state.results.push(entry)
  }
  entry.pole = poleId
  state.drivers[poleId].career.poles += 1
}
