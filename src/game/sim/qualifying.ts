import type { CircuitDef } from '../../data/calendar';
import type { GameState, QualiEntry } from '../types';
import { PLAYER_ID } from '../types';
import { gridIds, statsOf, lastNameOf } from '../people';
import { aiSetupQuality, basePace } from './pace';
import { chance, gauss, rand } from '../rng';

export type QualiRisk = 'safe' | 'normal' | 'attack';

export interface QualiLapOutcome {
  time: number | null;
  note: string | null;
}

export function qualiLap(s: GameState, id: string, c: CircuitDef, rain: number, setupQ: number, risk: QualiRisk, phase: number): QualiLapOutcome {
  const st = statsOf(s, id);
  const pace = basePace(s, id, c, { rain, setupQuality: setupQ });
  const cons = st.consistency / 100;
  let sd = 0.0028 * (1.35 - cons) * (1 + rain * 1.5);
  let mean = -0.0006 * phase; // la piste se gomme, Q3 plus rapide
  // la pression des Q3 joue sur le mental
  mean += phase === 2 ? (75 - st.mental) * 0.00003 : 0;
  let mistakeP = 0.035 * (1.3 - cons) * (1 + rain * 2) * (c.street ? 1.4 : 1);
  if (risk === 'safe') {
    mean += 0.0012;
    sd *= 0.7;
    mistakeP *= 0.35;
  } else if (risk === 'attack') {
    mean -= 0.0022;
    sd *= 1.2;
    mistakeP *= 2.4;
  }
  if (chance(mistakeP)) {
    if (chance(c.street ? 0.3 : 0.12)) return { time: null, note: `${lastNameOf(s, id)} tape le mur ! Drapeau rouge.` };
    return { time: pace * (1 + rand(0.012, 0.03)), note: `${lastNameOf(s, id)} part à la faute, tour gâché.` };
  }
  return { time: pace * (1 + mean + gauss(0, sd)), note: null };
}

export interface QualiSessionResult {
  entries: QualiEntry[];
  notes: string[];
}

/**
 * Simule une séance complète Q1/Q2/Q3. Le risque du joueur s'applique à chaque segment.
 * `playerRisks` : risque choisi pour Q1, Q2, Q3.
 */
export function runQualifying(s: GameState, c: CircuitDef, rain: number, playerSetup: number, playerRisks: QualiRisk[], raceId: string): QualiSessionResult {
  const ids = gridIds(s);
  const n = ids.length;
  const cut1 = Math.max(10, n - 6);
  const cut2 = Math.max(10, n - 12);
  const entries: Record<string, QualiEntry> = {};
  const notes: string[] = [];
  for (const id of ids) entries[id] = { driverId: id, q1: null, q2: null, q3: null, position: 0 };

  const run = (pool: string[], phase: 0 | 1 | 2): string[] => {
    const key = (['q1', 'q2', 'q3'] as const)[phase];
    for (const id of pool) {
      const isP = id === PLAYER_ID;
      const setupQ = isP ? playerSetup : aiSetupQuality(s, id, raceId);
      const risk: QualiRisk = isP ? playerRisks[phase] ?? 'normal' : 'normal';
      // deux tentatives, on garde la meilleure
      let best: number | null = null;
      for (let a = 0; a < 2; a++) {
        const o = qualiLap(s, id, c, rain, setupQ, risk, phase);
        if (o.note && (isP || Math.random() < 0.5)) notes.push(`${['Q1', 'Q2', 'Q3'][phase]} — ${o.note}`);
        if (o.time !== null && (best === null || o.time < best)) best = o.time;
        if (o.time === null) break;
      }
      entries[id][key] = best;
    }
    return [...pool].sort((a, b) => (entries[a][key] ?? 9999) - (entries[b][key] ?? 9999));
  };

  const q1 = run(ids, 0);
  const q2 = run(q1.slice(0, cut1), 1);
  const q3 = run(q2.slice(0, cut2), 2);
  const order = [...q3, ...q2.slice(cut2), ...q1.slice(cut1)];
  order.forEach((id, i) => (entries[id].position = i + 1));
  return { entries: order.map((id) => entries[id]), notes };
}

/** Qualif sprint simplifiée (SQ1-SQ3 avec un seul tour). */
export function runSprintQuali(s: GameState, c: CircuitDef, rain: number, playerSetup: number, risk: QualiRisk, raceId: string): QualiSessionResult {
  return runQualifying(s, c, rain, playerSetup, [risk, risk, risk], raceId + '-sq');
}
