import type { Compound, GameState, ResultRow, SessionId, SessionResult } from '../model/types'
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

export function runPractice(state: GameState, session: SessionId): SessionResult {
  const rng = new Rng(state.meta.rng)
  const w = state.weekend!
  const circuit = state.circuits[state.calendar.find((e) => e.round === w.round)!.circuitId]
  const wet = sessionWetness(state, rng)
  const notes: string[] = []
  const rows: ResultRow[] = []
  for (const id of allDrivers(state)) {
    const d = state.drivers[id]
    const team = state.teams[d.teamId!]
    const fb = d.ratings.feedback
    if (team.isPlayer) {
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
    const comp: Compound = wet >= 0.18 ? bestCompound(wet) : rng.pick(['S', 'M', 'M', 'H'] as Compound[])
    const t =
      circuit.baseLapSec +
      baseDelta(state, id, circuit, 'quali') +
      (wet < 0.18 ? COMPOUND_OFFSET[comp] : 0) +
      weatherTyreDelta(comp, wet) +
      wet * 7 * (1 + (80 - d.ratings.wet) / 90) +
      rng.range(0.4, 1.4) + // programme de roulage / carburant inconnu
      rng.normal(0, 0.2)
    rows.push({ driverId: id, teamId: d.teamId!, position: 0, time: t, laps: rng.int(18, 32) })
  }
  rows.sort((a, b) => a.time! - b.time!)
  rows.forEach((r, i) => {
    r.position = i + 1
    r.gap = r.time! - rows[0].time!
  })
  if (wet > 0) notes.push('Séance disputée sur piste humide.')
  for (const id of state.teams[state.playerTeamId].driverIds) {
    const d = state.drivers[id]
    if (d) notes.push(`${fullName(d)} : confiance réglages ${Math.round(w.setupConfidence[id] ?? 0)}/100, connaissance pneus ${Math.round(w.tyreKnowledge[id] ?? 0)}/100.`)
  }
  return { session, rows, notes }
}

export function runQualifying(state: GameState, session: 'Q' | 'SQ'): SessionResult {
  const rng = new Rng(state.meta.rng)
  const w = state.weekend!
  const circuit = state.circuits[state.calendar.find((e) => e.round === w.round)!.circuitId]
  const wet = sessionWetness(state, rng)
  const comp = bestCompound(wet)
  const lapTime = (id: string) => {
    const d = state.drivers[id]
    let t =
      circuit.baseLapSec -
      1.2 + // peu d'essence, moteur en mode qualif
      baseDelta(state, id, circuit, 'quali') +
      (wet < 0.18 ? COMPOUND_OFFSET[comp] : 0) +
      weatherTyreDelta(comp, wet) +
      wet * 7 * (1 + (80 - d.ratings.wet) / 90) +
      rng.normal(0, 0.07 + (100 - d.ratings.consistency) * 0.004)
    if (rng.chance((100 - d.ratings.consistency) / 700 + wet * 0.03)) t += rng.range(0.5, 2.5)
    return t
  }
  const field = allDrivers(state)
  const n = field.length
  const cut1 = Math.max(10, n - 6)
  const cut2 = Math.max(10, cut1 - 6)
  const rows = new Map<string, ResultRow>()
  let remaining = field
  const segments: { size: number; seg: 1 | 2 | 3 }[] = [
    { size: cut1, seg: 1 },
    { size: cut2, seg: 2 },
    { size: 0, seg: 3 },
  ]
  let posOffset = n
  for (const s of segments) {
    const times = remaining.map((id) => ({ id, t: lapTime(id) })).sort((a, b) => a.t - b.t)
    const out = s.seg === 3 ? times : times.slice(s.size)
    for (let i = out.length - 1; i >= 0; i--) {
      const d = state.drivers[out[i].id]
      rows.set(out[i].id, { driverId: out[i].id, teamId: d.teamId!, position: posOffset--, time: out[i].t, knockedOutIn: s.seg })
    }
    remaining = times.slice(0, s.size).map((x) => x.id)
  }
  const list = [...rows.values()].sort((a, b) => a.position - b.position)
  const pole = list[0]
  list.forEach((r) => (r.gap = r.knockedOutIn === 3 ? r.time! - pole.time! : undefined))
  const notes: string[] = []
  if (wet > 0) notes.push(`Qualifications sur piste ${wet > 0.6 ? 'détrempée' : 'humide'}.`)
  notes.push(`Pole position : ${fullName(state.drivers[pole.driverId])}.`)
  if (session === 'Q') {
    let entry = state.results.find((r) => r.round === w.round)
    if (!entry) {
      entry = { round: w.round, circuitId: circuit.id, race: [] }
      state.results.push(entry)
    }
    entry.pole = pole.driverId
    state.drivers[pole.driverId].career.poles += 1
  }
  return { session, rows: list, notes }
}
