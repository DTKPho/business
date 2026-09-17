import type { GoodCategory } from '../data/goods';
import { stateEconomicSize } from './licenses';
import type { CharterTier, Concession } from './types';

export const CONCESSION_MIN_TIER: CharterTier = 3;
export const CONCESSION_RENEWAL_INTERVAL_DAYS = 45;
const CONCESSION_LOSS_CHANCE_PER_TICK = 0.0006;

const CATEGORY_VALUE_FACTOR: Record<GoodCategory, number> = {
  agricole: 0.8,
  matieres_premieres: 1,
  manufacture: 1.5,
  luxe: 2.4,
  alcool: 2,
};

export function concessionBribeCost(stateId: string, category: GoodCategory): number {
  const size = stateEconomicSize(stateId);
  return Math.round(1500 + CATEGORY_VALUE_FACTOR[category] * (size / 12));
}

export function concessionRecurringCost(stateId: string, category: GoodCategory): number {
  return Math.round(concessionBribeCost(stateId, category) * 0.08);
}

export function hasConcession(concessions: Concession[], stateId: string, category: GoodCategory): boolean {
  return concessions.some((c) => c.stateId === stateId && c.category === category);
}

export function rollConcessionLoss(): boolean {
  return Math.random() < CONCESSION_LOSS_CHANCE_PER_TICK;
}
