/**
 * Attentes et verdicts : un résultat se juge par rapport au potentiel réel de
 * la voiture et du pilote. P14 en Cadillac peut être un exploit, P6 en Mercedes
 * une contre-performance.
 */
import { CALENDAR } from '../data/calendar';
import type { GameState } from './types';
import { PLAYER_ID } from './types';
import { gridIds } from './people';
import { aiSetupQuality, basePace } from './sim/pace';

/** Position attendue (classement prévisionnel au rythme pur sur ce circuit). */
export function expectedFinish(s: GameState, driverId: string, raceId: string): number {
  const c = CALENDAR.find((x) => x.id === raceId) ?? CALENDAR[0];
  const ids = gridIds(s);
  if (!ids.includes(driverId)) return 11;
  const ranked = ids
    .map((id) => ({ id, t: basePace(s, id, c, { rain: 0, setupQuality: id === PLAYER_ID ? 0.75 : aiSetupQuality(s, id, raceId) }) }))
    .sort((a, b) => a.t - b.t);
  return ranked.findIndex((x) => x.id === driverId) + 1;
}

/** Fourchette d'objectif fixée par l'équipe avant la course. */
export function teamObjective(s: GameState, raceId: string): { target: number; label: string } {
  const e = expectedFinish(s, PLAYER_ID, raceId);
  const target = Math.max(1, e);
  let label: string;
  if (target <= 1) label = 'Victoire';
  else if (target <= 3) label = 'Podium';
  else if (target <= 6) label = `Top ${Math.min(6, target + 1)}`;
  else if (target <= 10) label = 'Dans les points';
  else if (target <= 13) label = 'Aux portes des points';
  else if (target <= 17) label = `Finir dans le top ${target}`;
  else label = 'Battre au moins une équipe rivale';
  return { target, label };
}

export type Verdict = 'exceptional' | 'great' | 'good' | 'par' | 'poor' | 'disaster' | 'unlucky' | 'crash';

export function verdictFor(actual: number, expected: number, dnf?: string | null): Verdict {
  if (dnf) return /accrochage|mur|sortie|tête|graviers|contact/.test(dnf) ? 'crash' : 'unlucky';
  const diff = expected - actual; // > 0 : mieux que prévu
  if (actual === 1 && expected > 1) return 'exceptional';
  if (diff >= 6 || (actual <= 3 && expected >= 7)) return 'exceptional';
  if (diff >= 3) return 'great';
  if (diff >= 1) return 'good';
  if (diff >= -1) return 'par';
  if (diff >= -4) return 'poor';
  return 'disaster';
}

export const VERDICT_FR: Record<Verdict, { label: string; tone: 'good' | 'bad' | 'neutral' }> = {
  exceptional: { label: 'Exploit !', tone: 'good' },
  great: { label: 'Bien au-dessus des attentes', tone: 'good' },
  good: { label: 'Au-dessus des attentes', tone: 'good' },
  par: { label: 'Conforme aux attentes', tone: 'neutral' },
  poor: { label: 'En dessous des attentes', tone: 'bad' },
  disaster: { label: 'Contre-performance', tone: 'bad' },
  unlucky: { label: 'Abandon (malchance)', tone: 'bad' },
  crash: { label: 'Abandon (erreur / accrochage)', tone: 'bad' },
};

export function isGood(v: Verdict): boolean {
  return v === 'exceptional' || v === 'great' || v === 'good';
}

export function isBad(v: Verdict): boolean {
  return v === 'poor' || v === 'disaster' || v === 'crash';
}

/** Positions attendues de toute la grille (un seul calcul). */
export function expectedMap(s: GameState, raceId: string): Record<string, number> {
  const c = CALENDAR.find((x) => x.id === raceId) ?? CALENDAR[0];
  const ranked = gridIds(s)
    .map((id) => ({ id, t: basePace(s, id, c, { rain: 0, setupQuality: id === PLAYER_ID ? 0.75 : aiSetupQuality(s, id, raceId) }) }))
    .sort((a, b) => a.t - b.t);
  return Object.fromEntries(ranked.map((x, i) => [x.id, i + 1]));
}
