import { CITIES } from '../data/cities';
import type { GoodCategory } from '../data/goods';
import type { CharterTier, License } from './types';

const CATEGORY_FACTOR: Record<GoodCategory, number> = {
  agricole: 1,
  matieres_premieres: 1.2,
  manufacture: 1.6,
  luxe: 2.2,
  alcool: 0, // never legally licensable
};

/** Charter tier required before a category's license can even be purchased. */
export const CATEGORY_MIN_TIER: Record<GoodCategory, CharterTier> = {
  agricole: 1,
  matieres_premieres: 1,
  manufacture: 2,
  luxe: 2,
  alcool: 4, // effectively unreachable: alcohol is never officially licensable
};

export const LICENSE_RENEWAL_INTERVAL_DAYS = 30;
export const MIN_REPUTATION_TO_LICENSE = 25;
export const REPUTATION_REVOCATION_THRESHOLD = 15;

export function stateEconomicSize(stateId: string): number {
  return CITIES.filter((c) => c.stateId === stateId).reduce((sum, c) => sum + c.population, 0);
}

export function licenseCost(stateId: string, category: GoodCategory): number {
  const size = stateEconomicSize(stateId);
  return Math.round(300 + CATEGORY_FACTOR[category] * (size / 25));
}

export function licenseRenewalCost(stateId: string, category: GoodCategory): number {
  return Math.round(licenseCost(stateId, category) * 0.25);
}

export function hasLicense(licenses: License[], stateId: string, category: GoodCategory): boolean {
  return licenses.some((l) => l.stateId === stateId && l.category === category);
}

/** Revenue multiplier applied to a good's commission depending on legal status. */
export function categoryCommissionFactor(
  category: GoodCategory,
  fromStateId: string,
  toStateId: string,
  licenses: License[],
  charterTier: CharterTier,
): number {
  if (category === 'alcool') return 1.35; // always contraband, higher margin
  if (charterTier >= 4) return 1; // federal charter: licensed everywhere automatically
  const licensedFrom = hasLicense(licenses, fromStateId, category);
  const licensedTo = hasLicense(licenses, toStateId, category);
  return licensedFrom && licensedTo ? 1 : 0.22;
}
