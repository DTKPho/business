import { DRIVERS_BY_ID, type DriverDef, type Persona } from '../data/drivers';
import { TEAMS_BY_ID } from '../data/teams';
import { PLAYER_ID, type DriverStats, type GameState, type TeamId } from './types';

export interface Identity {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  code: string;
  number: number;
  nationality: string;
  birthYear: number;
  isPlayer: boolean;
  def: DriverDef | null;
}

export function identity(s: GameState, id: string): Identity {
  if (id === PLAYER_ID) {
    const p = s.player;
    return { id, firstName: p.firstName, lastName: p.lastName, name: `${p.firstName} ${p.lastName}`, code: p.code, number: p.number, nationality: p.nationality, birthYear: p.birthYear, isPlayer: true, def: null };
  }
  const def = DRIVERS_BY_ID[id];
  if (def) {
    return { id, firstName: def.firstName, lastName: def.lastName, name: `${def.firstName} ${def.lastName}`, code: def.code, number: def.number, nationality: def.nationality, birthYear: Number(def.birthDate.slice(0, 4)), isPlayer: false, def };
  }
  const g = s.generatedDrivers[id];
  if (g) return { id, firstName: g.firstName, lastName: g.lastName, name: `${g.firstName} ${g.lastName}`, code: g.code, number: g.number, nationality: g.nationality, birthYear: g.birthYear, isPlayer: false, def: null };
  return { id, firstName: '?', lastName: id, name: id, code: id.slice(0, 3).toUpperCase(), number: 0, nationality: 'XX', birthYear: 2000, isPlayer: false, def: null };
}

export function nameOf(s: GameState, id: string): string {
  return identity(s, id).name;
}

export function lastNameOf(s: GameState, id: string): string {
  return identity(s, id).lastName;
}

export function teamOf(s: GameState, id: string): TeamId | null {
  if (id === PLAYER_ID) return s.player.contract?.teamId ?? null;
  return s.drivers[id]?.teamId ?? null;
}

export function statsOf(s: GameState, id: string): DriverStats {
  if (id === PLAYER_ID) return s.player.stats;
  return s.drivers[id].stats;
}

export function overall(st: DriverStats): number {
  return Math.round(
    st.pace * 0.28 + st.racecraft * 0.14 + st.overtaking * 0.08 + st.defending * 0.07 + st.consistency * 0.12 + st.tyreManagement * 0.09 +
      st.wet * 0.05 + st.starts * 0.04 + st.feedback * 0.05 + st.mental * 0.05 + st.fitness * 0.03,
  );
}

export function ageOf(s: GameState, id: string): number {
  return s.season - identity(s, id).birthYear;
}

export function personaOf(id: string): Persona | null {
  return DRIVERS_BY_ID[id]?.persona ?? null;
}

/** Tous les pilotes actuellement titulaires (joueur inclus). */
export function gridIds(s: GameState): string[] {
  const ids = Object.values(s.drivers)
    .filter((d) => d.teamId && !d.retired)
    .map((d) => d.id);
  if (s.player.contract) ids.push(PLAYER_ID);
  return ids;
}

export function teamDrivers(s: GameState, teamId: TeamId): string[] {
  return gridIds(s).filter((id) => teamOf(s, id) === teamId);
}

export function teammateOf(s: GameState, id: string): string | null {
  const t = teamOf(s, id);
  if (!t) return null;
  return teamDrivers(s, t).find((d) => d !== id) ?? null;
}

export function teamColor(teamId: TeamId | null): string {
  return teamId ? TEAMS_BY_ID[teamId].color : '#666';
}

/** Valeur marchande du pilote (€ / saison). */
export function marketValue(s: GameState, id: string): number {
  const st = statsOf(s, id);
  const ov = overall(st);
  const age = ageOf(s, id);
  const youth = age < 24 ? 1.15 : age > 35 ? 0.7 : 1;
  const fame = id === PLAYER_ID ? Math.min(1.4, 0.8 + Math.log10(Math.max(10_000, s.player.followers)) / 12) : 1;
  const base = Math.pow(Math.max(0, ov - 65) / 32, 3.5) * 40_000_000 + 500_000;
  const recent = recentPoints(s, id);
  const perf = s.results.length ? 0.6 + Math.min(0.8, (recent / Math.max(1, s.results.length)) * 24 / 250) : 1;
  return Math.round(base * youth * fame * perf);
}

export function recentPoints(s: GameState, id: string): number {
  let pts = 0;
  for (const r of s.results) {
    pts += r.race.find((e) => e.driverId === id)?.points ?? 0;
    pts += r.sprint?.find((e) => e.driverId === id)?.points ?? 0;
  }
  return pts;
}
