import { stateEconomicSize } from './licenses';
import type { CharterTier } from './types';

export const BASE_STATE_TAX = 0.05;

export function corruptionTaxFactor(corruptionLevel: number): number {
  const clamped = Math.min(100, Math.max(0, corruptionLevel));
  return 1 - BASE_STATE_TAX * (1 - clamped / 100);
}

export function corruptionUpkeepCost(stateId: string, corruptionLevel: number): number {
  const clamped = Math.min(100, Math.max(0, corruptionLevel));
  const size = stateEconomicSize(stateId);
  return (clamped / 100) * (size / 9000);
}

export function auditProbability(corruptionLevel: number, charterTier: CharterTier): number {
  const clamped = Math.min(100, Math.max(0, corruptionLevel)) / 100;
  const base = clamped * clamped * 0.004;
  return charterTier >= 4 ? base * 0.5 : base;
}

export function rollAudit(corruptionLevel: number, charterTier: CharterTier): boolean {
  if (corruptionLevel <= 0) return false;
  return Math.random() < auditProbability(corruptionLevel, charterTier);
}

export function auditFine(capital: number): number {
  return Math.round(capital * (0.05 + Math.random() * 0.1));
}
