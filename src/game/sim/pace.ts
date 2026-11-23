import type { CircuitDef } from '../../data/calendar';
import type { GameState, TeamState, TyreCompound, SetupValues } from '../types';
import { PLAYER_ID } from '../types';
import { statsOf, teamOf } from '../people';
import { clamp, hash01, rand } from '../rng';

export function carScore(team: TeamState, c: CircuitDef): number {
  const a = c.aeroSens;
  const p = c.powerSens;
  const ch = 0.5;
  return (team.car.aero * a + team.car.power * p + team.car.chassis * ch) / (a + p + ch);
}

export interface PaceOpts {
  rain: number; // 0..1
  setupQuality: number; // 0..1
}

/** Temps au tour de base (qualification, sans carburant, pneus neufs tendres). */
export function basePace(s: GameState, driverId: string, c: CircuitDef, o: PaceOpts): number {
  const teamId = teamOf(s, driverId)!;
  const team = s.teams[teamId];
  const car = carScore(team, c);
  const st = statsOf(s, driverId);
  const form = driverId === PLAYER_ID ? (s.player.morale - 60) / 8 - s.player.stress / 25 + (s.player.energy - 60) / 20 : s.drivers[driverId].form;
  let deficit = (100 - car) * 0.0009 + (100 - st.pace) * 0.00042 - form * 0.00018;
  deficit += o.rain * (100 - st.wet) * 0.0011;
  deficit += (1 - o.setupQuality) * 0.0055;
  if (s.cheats?.enabled) deficit -= (s.cheats.pace[driverId] ?? 0) / 100;
  if (driverId === PLAYER_ID) {
    const d = s.settings.difficulty;
    deficit += d === 'easy' ? -0.0035 : d === 'hard' ? 0.0015 : 0;
  }
  return c.baseLap * (1 + deficit) * (1 + o.rain * 0.11);
}

/** Qualité de réglages d'un pilote IA, basée sur son feedback technique. */
export function aiSetupQuality(s: GameState, driverId: string, raceId: string): number {
  const st = statsOf(s, driverId);
  return clamp(0.55 + st.feedback / 260 + (hash01(driverId + raceId + s.season) - 0.5) * 0.18, 0.4, 1);
}

// ───────────── Réglages (mini-jeu des essais libres) ─────────────

export const SETUP_KEYS: (keyof SetupValues)[] = ['frontWing', 'rearWing', 'suspension', 'rideHeight', 'brakeBias'];

export const SETUP_LABELS: Record<keyof SetupValues, { name: string; low: string; high: string }> = {
  frontWing: { name: 'Aileron avant', low: 'Peu d’appui', high: 'Beaucoup d’appui' },
  rearWing: { name: 'Aileron arrière', low: 'Vitesse de pointe', high: 'Stabilité' },
  suspension: { name: 'Suspensions', low: 'Souples', high: 'Rigides' },
  rideHeight: { name: 'Hauteur de caisse', low: 'Basse', high: 'Haute' },
  brakeBias: { name: 'Répartition de freinage', low: 'Arrière', high: 'Avant' },
};

export function optimalSetup(c: CircuitDef, seed: string): SetupValues {
  const j = (k: string) => (hash01(seed + k) - 0.5) * 24;
  return {
    frontWing: clamp(Math.round(30 + c.aeroSens * 55 + j('fw')), 5, 95),
    rearWing: clamp(Math.round(20 + c.aeroSens * 65 - c.powerSens * 10 + j('rw')), 5, 95),
    suspension: clamp(Math.round(c.street ? 30 + j('su') : 60 + j('su')), 5, 95),
    rideHeight: clamp(Math.round(c.street ? 60 + j('rh') : 35 + j('rh')), 5, 95),
    brakeBias: clamp(Math.round(55 + (1 - c.overtaking) * 10 + j('bb')), 5, 95),
  };
}

export function setupQuality(setup: SetupValues, opt: SetupValues): number {
  let err = 0;
  for (const k of SETUP_KEYS) err += Math.pow((setup[k] - opt[k]) / 100, 2);
  return clamp(1 - Math.sqrt(err / SETUP_KEYS.length) * 2.6, 0, 1);
}

/** Retours de l'ingénieur / du pilote après un relais. Précision selon le feedback. */
export function setupFeedback(setup: SetupValues, opt: SetupValues, feedbackStat: number, engineerName: string): string[] {
  const lines: string[] = [];
  const noise = (100 - feedbackStat) / 6;
  const sorted = [...SETUP_KEYS].sort((a, b) => Math.abs(setup[b] - opt[b]) - Math.abs(setup[a] - opt[a]));
  for (const k of sorted.slice(0, 3)) {
    const diff = setup[k] - opt[k] + rand(-noise, noise);
    const a = Math.abs(diff);
    if (a < 4) {
      lines.push(`✅ ${SETUP_LABELS[k].name} : on est dans la fenêtre.`);
      continue;
    }
    const strength = a > 25 ? 'beaucoup' : a > 12 ? 'nettement' : 'légèrement';
    const msgs: Record<keyof SetupValues, [string, string]> = {
      frontWing: [`Sous-virage en entrée de virage → monter ${strength} l’aileron avant.`, `Avant trop incisif, l’arrière décroche → baisser ${strength} l’aileron avant.`],
      rearWing: [`Arrière nerveux dans les courbes rapides → ajouter ${strength} d’aileron arrière.`, `On manque de vitesse de pointe → réduire ${strength} l’aileron arrière.`],
      suspension: [`Voiture paresseuse dans les changements de direction → rigidifier ${strength}.`, `La voiture saute sur les vibreurs et les bosses → assouplir ${strength}.`],
      rideHeight: [`Ça talonne et ça marsouine → remonter ${strength} la hauteur de caisse.`, `On perd de l’appui au plancher → abaisser ${strength} la caisse.`],
      brakeBias: [`Blocages de l’arrière au freinage → ramener ${strength} la répartition vers l’avant.`, `Blocages de roue avant → décaler ${strength} la répartition vers l’arrière.`],
    };
    lines.push(`🔧 ${diff < 0 ? msgs[k][0] : msgs[k][1]}`);
  }
  if (lines.every((l) => l.startsWith('✅'))) lines.push(`📻 ${engineerName} : « La voiture est très bien née, on ne touche plus à rien. »`);
  return lines;
}

// ───────────── Pneus ─────────────

export const TYRE_INFO: Record<TyreCompound, { name: string; color: string; offset: number; wear: number }> = {
  S: { name: 'Tendre', color: '#ff2d2d', offset: 0, wear: 3.1 },
  M: { name: 'Medium', color: '#ffd400', offset: 0.45, wear: 2.05 },
  H: { name: 'Dur', color: '#f2f2f2', offset: 0.85, wear: 1.4 },
  I: { name: 'Intermédiaire', color: '#2fbf4a', offset: 0.6, wear: 1.9 },
  W: { name: 'Pluie', color: '#1e7cff', offset: 1.4, wear: 1.6 },
};

/** Pénalité (s) selon pneu et humidité de la piste. */
export function weatherTyrePenalty(t: TyreCompound, rain: number): number {
  if (t === 'I') {
    if (rain < 0.2) return (0.2 - rain) * 18 + 1.2;
    if (rain > 0.7) return (rain - 0.7) * 25;
    return 0;
  }
  if (t === 'W') {
    if (rain < 0.6) return (0.6 - rain) * 14 + 1.5;
    return 0;
  }
  if (rain > 0.18) return (rain - 0.18) * 30;
  return 0;
}

export function bestTyreForRain(rain: number): TyreCompound | null {
  if (rain > 0.65) return 'W';
  if (rain > 0.2) return 'I';
  return null;
}
