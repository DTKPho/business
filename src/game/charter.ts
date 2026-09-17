import type { CharterTier } from './types';

export interface CharterTierDef {
  tier: CharterTier;
  name: string;
  capitalRequired: number;
  reputationRequired: number; // average reputation across states with activity
  description: string;
}

export const CHARTER_TIERS: CharterTierDef[] = [
  { tier: 1, name: 'Marchand indépendant', capitalRequired: 0, reputationRequired: 0, description: 'Vous débutez seul, avec vos économies.' },
  { tier: 2, name: 'Compagnie enregistrée', capitalRequired: 8000, reputationRequired: 55, description: 'Accès aux licences manufacturé et luxe.' },
  { tier: 3, name: "Charte d'État", capitalRequired: 30000, reputationRequired: 65, description: 'Concessions exclusives, rachat de rivaux, train.' },
  { tier: 4, name: 'Charte fédérale', capitalRequired: 100000, reputationRequired: 75, description: 'Licences fédérales automatiques, immunité partielle aux audits.' },
];

export function averageReputation(reputation: Record<string, number>): number {
  const values = Object.values(reputation);
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeCharterTier(capital: number, reputation: Record<string, number>): CharterTier {
  const avgRep = averageReputation(reputation);
  let tier: CharterTier = 1;
  for (const def of CHARTER_TIERS) {
    if (capital >= def.capitalRequired && avgRep >= def.reputationRequired) {
      tier = def.tier;
    }
  }
  return tier;
}

export function charterTierDef(tier: CharterTier): CharterTierDef {
  return CHARTER_TIERS[tier - 1];
}
