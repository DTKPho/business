import { CITIES } from '../data/cities';
import { RIVAL_DEFS } from '../data/rivalDefs';
import { tickRoute, distanceBetween, baseDangerosity } from './routes';
import type { CityMarketState, Rival, Route } from './types';

export function createInitialRivals(): Rival[] {
  return RIVAL_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    color: def.color,
    behavior: def.behavior,
    capital: def.startingCapital,
    routes: [],
    defeated: false,
    playerStake: 0,
  }));
}

const RATE_BY_BEHAVIOR: Record<Rival['behavior'], number> = {
  agressif: 0.04,
  opportuniste: 0.08,
  defensif: 0.11,
};

function randomCityPairFor(rival: Rival): [string, string] | null {
  const attempts = 12;
  for (let i = 0; i < attempts; i++) {
    const a = CITIES[Math.floor(Math.random() * CITIES.length)];
    const b = CITIES[Math.floor(Math.random() * CITIES.length)];
    if (a.id === b.id) continue;
    const exists = rival.routes.some(
      (r) => (r.fromCityId === a.id && r.toCityId === b.id) || (r.fromCityId === b.id && r.toCityId === a.id),
    );
    if (exists) continue;
    if (rival.behavior === 'defensif' && baseDangerosity(a.id, b.id) > 0.5) continue;
    return [a.id, b.id];
  }
  return null;
}

/** Every ~15 ticks a rival may open a new route, if it can afford it and behaves accordingly. */
export function maybeRivalExpansion(rival: Rival, day: number, tickCount: number): Rival {
  if (rival.defeated) return rival;
  if (tickCount % 15 !== 0) return rival;
  const expansionChance = rival.behavior === 'agressif' ? 0.7 : rival.behavior === 'opportuniste' ? 0.5 : 0.25;
  if (Math.random() > expansionChance) return rival;
  if (rival.routes.length >= 6) return rival;

  const pair = randomCityPairFor(rival);
  if (!pair) return rival;
  const [fromCityId, toCityId] = pair;
  const cost = Math.round(distanceBetween(fromCityId, toCityId) * 8 + 150);
  if (rival.capital < cost * 1.5) return rival;

  const newRoute: Route = {
    id: `rival-route-${rival.id}-${fromCityId}-${toCityId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fromCityId,
    toCityId,
    distance: Math.round(distanceBetween(fromCityId, toCityId)),
    dangerosity: baseDangerosity(fromCityId, toCityId),
    infrastructure: 'piste',
    transportMode: 'chariot',
    commissionRate: RATE_BY_BEHAVIOR[rival.behavior],
    createdAtDay: day,
    totalRevenue: 0,
    lastTickRevenue: 0,
    lastTickVolume: 0,
    hasGuards: false,
  };

  return { ...rival, capital: rival.capital - cost, routes: [...rival.routes, newRoute] };
}

export interface RivalTickResult {
  rival: Rival;
  markets: Record<string, CityMarketState>;
}

export function tickRival(
  rival: Rival,
  markets: Record<string, CityMarketState>,
  day: number,
  tickCount: number,
  playerCapitalGainOut: { value: number },
): RivalTickResult {
  if (rival.defeated) return { rival, markets };

  let workingMarkets = markets;
  let capitalGain = 0;
  const routes: Route[] = [];
  for (const route of rival.routes) {
    const result = tickRoute(route, workingMarkets);
    workingMarkets = result.markets;
    capitalGain += result.revenue;
    routes.push(result.route);
  }

  let nextRival: Rival = { ...rival, capital: rival.capital + capitalGain, routes };
  if (rival.playerStake > 0) {
    playerCapitalGainOut.value += capitalGain * rival.playerStake;
  }
  nextRival = maybeRivalExpansion(nextRival, day, tickCount);

  return { rival: nextRival, markets: workingMarkets };
}

export function totalMarketCapital(rivals: Rival[], playerCapital: number): number {
  return playerCapital + rivals.reduce((sum, r) => sum + (r.defeated ? 0 : r.capital), 0);
}

const WEAKENED_CAPITAL_THRESHOLD = 1200;

export function isRivalWeakened(rival: Rival): boolean {
  return !rival.defeated && rival.capital < WEAKENED_CAPITAL_THRESHOLD;
}

export function partialStakeCost(rival: Rival, fraction: number): number {
  return Math.round(rival.capital * 1.4 * fraction);
}

export function fullBuyoutCost(rival: Rival, amicable: boolean): number {
  const base = rival.capital * (isRivalWeakened(rival) ? 1.8 : 3.2);
  return Math.round(amicable ? base * 1.6 : base);
}
