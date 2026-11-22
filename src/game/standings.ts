import type { GameState, TeamId, WeekendResult } from './types';
import { gridIds, teamOf } from './people';
import { TEAM_IDS } from '../data/teams';

export interface DriverStanding {
  driverId: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  bestFinish: number;
  dnfs: number;
  results: (number | 'DNF' | null)[];
  teamId: TeamId | null;
}

export interface TeamStanding {
  teamId: TeamId;
  points: number;
  wins: number;
  podiums: number;
}

export function driverStandings(s: GameState, results: WeekendResult[] = s.results): DriverStanding[] {
  const map = new Map<string, DriverStanding>();
  const ensure = (id: string): DriverStanding => {
    let st = map.get(id);
    if (!st) {
      st = { driverId: id, points: 0, wins: 0, podiums: 0, poles: 0, bestFinish: 99, dnfs: 0, results: Array(results.length).fill(null), teamId: teamOf(s, id) };
      map.set(id, st);
    }
    return st;
  };
  for (const id of gridIds(s)) ensure(id);
  results.forEach((r, i) => {
    for (const e of r.race) {
      const st = ensure(e.driverId);
      st.points += e.points;
      if (e.position === 1) st.wins++;
      if (e.position >= 1 && e.position <= 3) st.podiums++;
      if (e.position >= 1) st.bestFinish = Math.min(st.bestFinish, e.position);
      if (e.dnf) st.dnfs++;
      st.results[i] = e.dnf ? 'DNF' : e.position;
    }
    if (r.sprint) for (const e of r.sprint) ensure(e.driverId).points += e.points;
    const pole = r.quali.find((q) => q.position === 1);
    if (pole) ensure(pole.driverId).poles++;
  });
  return [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.bestFinish - b.bestFinish);
}

export function teamStandings(_s: GameState, results: WeekendResult[]): TeamStanding[] {
  const map = new Map<TeamId, TeamStanding>();
  for (const t of TEAM_IDS) map.set(t, { teamId: t, points: 0, wins: 0, podiums: 0 });
  for (const r of results) {
    for (const e of [...r.race, ...(r.sprint ?? [])]) {
      const st = map.get(e.teamId);
      if (!st) continue;
      st.points += e.points;
    }
    for (const e of r.race) {
      const st = map.get(e.teamId)!;
      if (e.position === 1) st.wins++;
      if (e.position >= 1 && e.position <= 3) st.podiums++;
    }
  }
  return [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export function playerPosition(s: GameState): number {
  const st = driverStandings(s);
  return st.findIndex((d) => d.driverId === 'player') + 1;
}
