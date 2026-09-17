export interface GangDef {
  id: string;
  name: string;
  territoryStateIds: string[];
  protectionCost: number; // recurring $ per tick to buy immunity from this gang
}

export const GANGS: GangDef[] = [
  { id: 'copperhead_gang', name: 'La Bande de Copperhead', territoryStateIds: ['MT', 'WY'], protectionCost: 4 },
  { id: 'colorado_hounds', name: 'Les Chiens du Colorado', territoryStateIds: ['CO', 'KS'], protectionCost: 5 },
  { id: 'tumbleweed_horde', name: 'La Horde de Tumbleweed', territoryStateIds: ['TX'], protectionCost: 6 },
  { id: 'bayou_pirates', name: 'Les Pirates du Bayou', territoryStateIds: ['LA', 'KY', 'MO'], protectionCost: 7 },
  { id: 'east_syndicate', name: "Le Syndicat de l'Est", territoryStateIds: ['IL', 'PA', 'NY'], protectionCost: 9 },
  { id: 'pacific_drifters', name: 'Les Rôdeurs du Pacifique', territoryStateIds: ['CA'], protectionCost: 6 },
];

export const GANGS_BY_ID: Record<string, GangDef> = Object.fromEntries(GANGS.map((g) => [g.id, g]));

export function gangForStateId(stateId: string): GangDef | undefined {
  return GANGS.find((g) => g.territoryStateIds.includes(stateId));
}
