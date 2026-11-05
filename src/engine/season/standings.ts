import type { GameState, PersonId, RoundResults, TeamId } from '../model/types'

export interface DriverStanding {
  driverId: PersonId
  teamId: TeamId
  points: number
  wins: number
  podiums: number
  best: number
  position: number
}

export interface ConstructorStanding {
  teamId: TeamId
  points: number
  wins: number
  podiums: number
  best: number
  position: number
}

function rowsOf(r: RoundResults) {
  return [...(r.sprint ?? []).map((x) => ({ ...x, sprint: true })), ...r.race.map((x) => ({ ...x, sprint: false }))]
}

export function driverStandings(state: GameState): DriverStanding[] {
  const map = new Map<PersonId, DriverStanding>()
  for (const r of state.results) {
    for (const row of rowsOf(r)) {
      let s = map.get(row.driverId)
      if (!s) {
        s = { driverId: row.driverId, teamId: row.teamId, points: 0, wins: 0, podiums: 0, best: 99, position: 0 }
        map.set(row.driverId, s)
      }
      s.teamId = row.teamId
      s.points += row.points ?? 0
      if (!row.sprint && row.status === 'finished') {
        if (row.position === 1) s.wins++
        if (row.position <= 3) s.podiums++
        s.best = Math.min(s.best, row.position)
      }
    }
  }
  // Inclut les titulaires actuels sans résultat.
  for (const t of Object.values(state.teams)) {
    for (const d of t.driverIds) if (!map.has(d)) map.set(d, { driverId: d, teamId: t.id, points: 0, wins: 0, podiums: 0, best: 99, position: 0 })
  }
  const list = [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best)
  list.forEach((s, i) => (s.position = i + 1))
  return list
}

export function constructorStandings(state: GameState): ConstructorStanding[] {
  const map = new Map<TeamId, ConstructorStanding>()
  for (const id of Object.keys(state.teams)) map.set(id, { teamId: id, points: 0, wins: 0, podiums: 0, best: 99, position: 0 })
  for (const r of state.results) {
    for (const row of rowsOf(r)) {
      const s = map.get(row.teamId)
      if (!s) continue
      s.points += row.points ?? 0
      if (!row.sprint && row.status === 'finished') {
        if (row.position === 1) s.wins++
        if (row.position <= 3) s.podiums++
        s.best = Math.min(s.best, row.position)
      }
    }
  }
  const list = [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best || state.teams[a.teamId].lastConstructorPos - state.teams[b.teamId].lastConstructorPos)
  list.forEach((s, i) => (s.position = i + 1))
  return list
}

export function teamStats(state: GameState, teamId: TeamId) {
  const c = constructorStandings(state).find((s) => s.teamId === teamId)!
  let pointsFinishes = 0
  for (const r of state.results) {
    if (r.race.some((row) => row.teamId === teamId && (row.points ?? 0) > 0)) pointsFinishes++
  }
  return { ...c, pointsFinishes }
}
