import { CITIES, CITIES_BY_ID, type CityDef } from '../data/cities';
import { GOODS, GOODS_BY_ID } from '../data/goods';
import type { CityMarketState } from './types';

/** Dev-level scales how much stock a city can hold/move (bigger city = deeper market). */
const DEV_SCALE: Record<number, number> = { 1: 0.6, 2: 1.0, 3: 1.8 };

/** How far a producing/consuming city's stock settles from the reference equilibrium. */
const SURPLUS_MULTIPLIER = 1.7;
const DEFICIT_MULTIPLIER = 0.45;

/** Fraction of the gap to the target stock closed per tick (exponential approach). */
const ADJUST_SPEED = 0.06;

function targetStockFor(city: CityDef, goodId: string): number {
  const good = GOODS_BY_ID[goodId];
  const scale = DEV_SCALE[city.dev] ?? 1;
  const base = good.equilibriumStock * scale;
  return city.produces.includes(goodId) ? base * SURPLUS_MULTIPLIER : base * DEFICIT_MULTIPLIER;
}

export function createInitialMarkets(): Record<string, CityMarketState> {
  const markets: Record<string, CityMarketState> = {};
  for (const city of CITIES) {
    const stock: Record<string, number> = {};
    for (const good of GOODS) {
      stock[good.id] = targetStockFor(city, good.id);
    }
    markets[city.id] = { stock };
  }
  return markets;
}

export function priceFor(cityId: string, goodId: string, markets: Record<string, CityMarketState>): number {
  const good = GOODS_BY_ID[goodId];
  const city = CITIES_BY_ID[cityId];
  const scale = DEV_SCALE[city.dev] ?? 1;
  const referenceStock = good.equilibriumStock * scale;
  const currentStock = Math.max(1, markets[cityId]?.stock[goodId] ?? referenceStock);
  const ratio = referenceStock / currentStock;
  const price = good.basePrice * Math.pow(ratio, good.elasticity);
  return Math.max(good.basePrice * 0.15, price);
}

/**
 * Advances every city's stock one tick toward its structural target (production
 * surplus or consumption deficit), with light noise. This models the baseline
 * economy (local production/consumption + unmodeled outside trade) that exists
 * even before the player's own routes move any goods.
 */
export function tickMarkets(markets: Record<string, CityMarketState>): Record<string, CityMarketState> {
  const next: Record<string, CityMarketState> = {};
  for (const city of CITIES) {
    const prevStock = markets[city.id]?.stock ?? {};
    const stock: Record<string, number> = {};
    for (const good of GOODS) {
      const target = targetStockFor(city, good.id);
      const current = prevStock[good.id] ?? target;
      const noise = (Math.random() - 0.5) * target * 0.01;
      stock[good.id] = Math.max(1, current + (target - current) * ADJUST_SPEED + noise);
    }
    next[city.id] = { stock };
  }
  return next;
}

/** Apply a direct stock delta on a city's good (e.g. player/route flux). */
export function applyStockDelta(
  markets: Record<string, CityMarketState>,
  cityId: string,
  goodId: string,
  delta: number,
): Record<string, CityMarketState> {
  const prev = markets[cityId]?.stock ?? {};
  return {
    ...markets,
    [cityId]: {
      stock: {
        ...prev,
        [goodId]: Math.max(1, (prev[goodId] ?? 0) + delta),
      },
    },
  };
}
