import type { Warehouse } from './types';

export const WAREHOUSE_BONUS: Record<1 | 2 | 3, number> = { 1: 0.2, 2: 0.35, 3: 0.5 };
export const WAREHOUSE_BASE_COST = 900;
export const WAREHOUSE_UPGRADE_COST: Record<1 | 2 | 3, number> = { 1: 0, 2: 1800, 3: 4200 };
export const WAREHOUSE_MAINTENANCE: Record<1 | 2 | 3, number> = { 1: 0.4, 2: 0.9, 3: 1.6 };

/**
 * Multiplier applied to a route's revenue for the side of it that touches
 * cityId. If a rival also holds a warehouse in the same city, both sides'
 * bonuses are diluted (competing for the same pool of local trade).
 */
export function warehouseBonusForOwner(warehouses: Warehouse[], cityId: string, ownerId: string): number {
  const own = warehouses.find((w) => w.cityId === cityId && w.ownerId === ownerId);
  if (!own) return 1;
  const competitorCount = warehouses.filter((w) => w.cityId === cityId && w.ownerId !== ownerId).length;
  const dilution = competitorCount > 0 ? 0.5 : 1;
  return 1 + WAREHOUSE_BONUS[own.level] * dilution;
}

export function bestWarehouseBonus(warehouses: Warehouse[], cityIds: string[], ownerId: string): number {
  return Math.max(1, ...cityIds.map((id) => warehouseBonusForOwner(warehouses, id, ownerId)));
}
