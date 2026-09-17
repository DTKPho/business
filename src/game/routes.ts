import { CITIES_BY_ID } from '../data/cities';
import { GOODS } from '../data/goods';
import type { CityMarketState, Route, TransportMode } from './types';
import { applyStockDelta, priceFor } from './simulation';

export const TRANSPORT_MODES: Record<TransportMode, { label: string; capacity: number; speed: number; baseCost: number; dangerMultiplier: number }> = {
  chariot: { label: 'Chariot', capacity: 45, speed: 1, baseCost: 60, dangerMultiplier: 1.3 },
  diligence: { label: 'Diligence', capacity: 80, speed: 1.6, baseCost: 160, dangerMultiplier: 1.0 },
  train: { label: 'Train', capacity: 400, speed: 3, baseCost: 1200, dangerMultiplier: 0.4 },
  bateau: { label: 'Bateau à vapeur', capacity: 300, speed: 2, baseCost: 500, dangerMultiplier: 0.4 },
};

export function distanceBetween(fromCityId: string, toCityId: string): number {
  const a = CITIES_BY_ID[fromCityId];
  const b = CITIES_BY_ID[toCityId];
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Base danger 0..1 from remoteness: longer, low-development routes are riskier. */
export function baseDangerosity(fromCityId: string, toCityId: string): number {
  const a = CITIES_BY_ID[fromCityId];
  const b = CITIES_BY_ID[toCityId];
  const distance = distanceBetween(fromCityId, toCityId);
  const devFactor = (a.dev + b.dev) / 6; // 0.33 (two small towns) .. 1 (two big cities)
  const distanceFactor = Math.min(1, distance / 500);
  return Math.min(0.9, Math.max(0.05, distanceFactor * 0.7 + (1 - devFactor) * 0.3));
}

export function routeConstructionCost(fromCityId: string, toCityId: string): number {
  return Math.round(distanceBetween(fromCityId, toCityId) * 8 + 150);
}

export const DILIGENCE_MIN_CAPITAL = 5000;
export const TRAIN_MIN_TIER = 3;

export function railwayConstructionCost(fromCityId: string, toCityId: string): number {
  return Math.round(distanceBetween(fromCityId, toCityId) * 40 + 2000);
}

export const RAILWAY_MAINTENANCE_PER_TICK = 1.2;
export const GUARD_COST_PER_TICK = 0.8;

/** Which transport modes could legally/physically be assigned to this city pair right now. */
export function availableTransportModes(
  fromCityId: string,
  toCityId: string,
  capital: number,
  charterTier: number,
  infrastructure: 'piste' | 'route' | 'voie_ferree',
): TransportMode[] {
  const a = CITIES_BY_ID[fromCityId];
  const b = CITIES_BY_ID[toCityId];
  const modes: TransportMode[] = ['chariot'];
  if (capital >= DILIGENCE_MIN_CAPITAL) modes.push('diligence');
  if ((a.isPort || a.isRiver) && (b.isPort || b.isRiver)) modes.push('bateau');
  if (charterTier >= TRAIN_MIN_TIER && infrastructure === 'voie_ferree') modes.push('train');
  return modes;
}

const REF_POPULATION = 40000;

function devFactor(fromCityId: string, toCityId: string): number {
  const a = CITIES_BY_ID[fromCityId];
  const b = CITIES_BY_ID[toCityId];
  const combined = Math.sqrt(a.population * b.population);
  return Math.min(1.6, Math.max(0.15, combined / REF_POPULATION));
}

/** Commission rate above this starts discouraging NPC merchants from using the route. */
const COMMISSION_SWEET_SPOT = 0.08;

function commissionVolumePenalty(rate: number): number {
  const excess = Math.max(0, rate - COMMISSION_SWEET_SPOT);
  return Math.max(0.2, 1 - excess * 4);
}

export interface TickRouteResult {
  route: Route;
  markets: Record<string, CityMarketState>;
  revenue: number;
  volume: number;
}

/**
 * Simulates one tick of NPC merchant trade flowing across a route: goods move
 * from whichever city has a price surplus toward the one with a deficit, for
 * every good, and the player collects a commission on the value transferred.
 *
 * `revenueFactorForGood` lets callers scale the commission per good (e.g. to
 * model licenses: goods move regardless, but the player's legal cut differs).
 */
export function tickRoute(
  route: Route,
  markets: Record<string, CityMarketState>,
  revenueFactorForGood?: (goodId: string) => number,
): TickRouteResult {
  let workingMarkets = markets;
  let totalVolume = 0;
  let totalRevenue = 0;

  const modeInfo = TRANSPORT_MODES[route.transportMode];
  const df = devFactor(route.fromCityId, route.toCityId);
  const dangerFactor = 1 - route.dangerosity * 0.35 * modeInfo.dangerMultiplier;
  const commissionFactor = commissionVolumePenalty(route.commissionRate);

  for (const good of GOODS) {
    const priceFrom = priceFor(route.fromCityId, good.id, workingMarkets);
    const priceTo = priceFor(route.toCityId, good.id, workingMarkets);

    const cheaper = priceFrom <= priceTo ? route.fromCityId : route.toCityId;
    const pricier = priceFrom <= priceTo ? route.toCityId : route.fromCityId;
    const lowPrice = Math.min(priceFrom, priceTo);
    const highPrice = Math.max(priceFrom, priceTo);
    const gapRatio = (highPrice - lowPrice) / lowPrice;
    if (gapRatio < 0.03) continue;

    const rawVolume = modeInfo.capacity * Math.min(1.5, gapRatio) * df * dangerFactor * commissionFactor;
    const volume = Math.max(0, rawVolume);
    if (volume < 0.5) continue;

    const avgPrice = (lowPrice + highPrice) / 2;
    const value = volume * avgPrice;
    const factor = revenueFactorForGood ? revenueFactorForGood(good.id) : 1;
    const revenue = value * route.commissionRate * factor;

    workingMarkets = applyStockDelta(workingMarkets, cheaper, good.id, -volume);
    workingMarkets = applyStockDelta(workingMarkets, pricier, good.id, volume);

    totalVolume += volume;
    totalRevenue += revenue;
  }

  return {
    route: { ...route, lastTickRevenue: totalRevenue, lastTickVolume: totalVolume, totalRevenue: route.totalRevenue + totalRevenue },
    markets: workingMarkets,
    revenue: totalRevenue,
    volume: totalVolume,
  };
}
