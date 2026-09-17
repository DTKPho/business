import { CITIES_BY_ID } from '../data/cities';
import { GANGS, gangForStateId } from '../data/gangs';
import { TRANSPORT_MODES } from './routes';
import type { Route } from './types';

export interface GangAttackResult {
  attacked: boolean;
  gangName?: string;
  revenueLoss: number;
  ransom: number;
}

export function routeGangIds(route: Route): string[] {
  const from = CITIES_BY_ID[route.fromCityId];
  const to = CITIES_BY_ID[route.toCityId];
  const ids = new Set<string>();
  const fromGang = gangForStateId(from.stateId);
  const toGang = gangForStateId(to.stateId);
  if (fromGang) ids.add(fromGang.id);
  if (toGang) ids.add(toGang.id);
  return Array.from(ids);
}

export function isRouteProtected(route: Route, gangProtection: Record<string, boolean>): boolean {
  return routeGangIds(route).every((id) => gangProtection[id]);
}

export function resolveGangAttack(
  route: Route,
  tickRevenue: number,
  gangProtection: Record<string, boolean>,
): GangAttackResult {
  if (tickRevenue <= 0) return { attacked: false, revenueLoss: 0, ransom: 0 };
  const gangIds = routeGangIds(route);
  if (gangIds.length === 0) return { attacked: false, revenueLoss: 0, ransom: 0 };
  if (gangIds.every((id) => gangProtection[id])) return { attacked: false, revenueLoss: 0, ransom: 0 };

  const modeVulnerability = TRANSPORT_MODES[route.transportMode].dangerMultiplier;
  const guardFactor = route.hasGuards ? 0.35 : 1;
  const chance = route.dangerosity * 0.02 * modeVulnerability * guardFactor;

  if (Math.random() > chance) return { attacked: false, revenueLoss: 0, ransom: 0 };

  const unprotectedGangId = gangIds.find((id) => !gangProtection[id]);
  const gangName = GANGS.find((g) => g.id === unprotectedGangId)?.name;
  const lossFraction = 0.5 + Math.random() * 0.4;
  const revenueLoss = tickRevenue * lossFraction;
  const ransom = Math.random() < 0.15 ? Math.round(20 + Math.random() * 60) : 0;

  return { attacked: true, gangName, revenueLoss, ransom };
}
