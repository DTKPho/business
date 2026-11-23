/** Mode triche : imposer des résultats. */
import type { GameState, QualiEntry, RaceState } from './types';

export function cheatsOn(s: GameState): boolean {
  return !!s.cheats?.enabled;
}

/** Réordonne une liste en plaçant les pilotes forcés à leur position cible. */
export function forcedOrder(ids: string[], forced: Record<string, number>): string[] {
  const n = ids.length;
  const slots: (string | null)[] = Array(n).fill(null);
  const pinned = Object.entries(forced)
    .filter(([id, pos]) => ids.includes(id) && pos >= 1)
    .sort((a, b) => a[1] - b[1]);
  for (const [id, pos] of pinned) {
    let p = Math.min(n, pos) - 1;
    while (p < n && slots[p]) p++;
    if (p >= n) {
      p = n - 1;
      while (p >= 0 && slots[p]) p--;
    }
    if (p >= 0) slots[p] = id;
  }
  const rest = ids.filter((id) => !pinned.some(([x]) => x === id));
  let k = 0;
  return slots.map((x) => x ?? rest[k++]);
}

/** Applique les positions imposées à une séance de qualification. */
export function applyQualiCheats(s: GameState, entries: QualiEntry[]): QualiEntry[] {
  if (!cheatsOn(s) || !Object.keys(s.cheats!.quali).length) return entries;
  const byId = Object.fromEntries(entries.map((e) => [e.driverId, { ...e }]));
  const order = forcedOrder(
    entries.map((e) => e.driverId),
    s.cheats!.quali,
  );
  const n = order.length;
  const cut2 = Math.max(10, n - 12);
  const cut1 = Math.max(10, n - 6);
  const out = order.map((id, i) => ({ ...byId[id], position: i + 1 }));
  // Cohérence des chronos : temps croissants dans chaque segment atteint
  for (const [key, limit] of [['q1', n], ['q2', cut1], ['q3', cut2]] as const) {
    let prev = 0;
    out.forEach((e, i) => {
      if (i >= limit) {
        if (key !== 'q1') e[key] = null;
        return;
      }
      const base = e[key] ?? e.q1 ?? prev + 0.1;
      e[key] = Math.max(base, prev + 0.008 + Math.random() * 0.06);
      prev = e[key]!;
    });
  }
  return out;
}

/** Ajustements de rythme pendant la course pour atteindre la position imposée. */
export function racePaceNudge(s: GameState, r: RaceState, driverId: string, pos: number): number {
  if (!cheatsOn(s)) return 0;
  const target = s.cheats!.race[driverId];
  if (target === undefined || target === 'DNF') return 0;
  const progress = r.lap / r.totalLaps;
  if (pos > target) return -(0.5 + progress * 1.5);
  if (pos < target) return 0.4 + progress * 1.2;
  return 0;
}

/** Ordre final imposé à l'arrivée (les abandons restent hors classement). */
export function applyRaceCheats(s: GameState, r: RaceState) {
  if (!cheatsOn(s)) return;
  const forced = Object.fromEntries(Object.entries(s.cheats!.race).filter(([, v]) => v !== 'DNF')) as Record<string, number>;
  if (!Object.keys(forced).length) return;
  const fin = r.cars.filter((c) => c.status !== 'out').sort((a, b) => a.totalTime + a.penalties - (b.totalTime + b.penalties));
  const order = forcedOrder(
    fin.map((c) => c.driverId),
    forced,
  );
  let prev = -Infinity;
  order.forEach((id, i) => {
    const car = fin.find((c) => c.driverId === id)!;
    const t = car.totalTime + car.penalties;
    const nt = Math.max(t, prev + 0.25 + Math.random() * 1.5);
    car.totalTime = nt - car.penalties;
    car.pos = i + 1;
    prev = nt;
  });
}
