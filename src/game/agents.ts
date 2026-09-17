import { CITIES_BY_ID } from '../data/cities';
import type { AgentRule, Rival, RegionalAgent, Route } from './types';

export const AGENT_MIN_ROUTES = 8;
export const AGENT_SALARY_PER_TICK = 6;

export const AGENT_RULE_LABELS: Record<AgentRule, string> = {
  taux_bas: 'Maximiser le volume (taux ~5%)',
  taux_standard: 'Équilibre standard (taux ~8%)',
  aligner_rival: "S'aligner sous le meilleur rival local",
};

function routeTouchesState(route: Route, stateId: string): boolean {
  return CITIES_BY_ID[route.fromCityId].stateId === stateId || CITIES_BY_ID[route.toCityId].stateId === stateId;
}

function targetRateFor(rule: AgentRule, stateId: string, rivals: Rival[]): number {
  if (rule === 'taux_bas') return 0.05;
  if (rule === 'taux_standard') return 0.08;
  const localRivalRates = rivals
    .filter((r) => !r.defeated)
    .flatMap((r) => r.routes)
    .filter((r) => routeTouchesState(r, stateId))
    .map((r) => r.commissionRate);
  if (localRivalRates.length === 0) return 0.08;
  const bestRivalRate = Math.min(...localRivalRates);
  return Math.max(0.02, bestRivalRate - 0.01);
}

export function tickAgents(routes: Route[], agents: RegionalAgent[], rivals: Rival[]): Route[] {
  if (agents.length === 0) return routes;
  return routes.map((route) => {
    const agent = agents.find((a) => routeTouchesState(route, a.stateId));
    if (!agent) return route;
    const target = targetRateFor(agent.rule, agent.stateId, rivals);
    const nextRate = route.commissionRate + (target - route.commissionRate) * 0.2;
    return { ...route, commissionRate: Math.min(0.15, Math.max(0.02, nextRate)) };
  });
}
