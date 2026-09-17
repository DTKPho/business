import type { RivalBehavior } from '../game/types';

export interface RivalDef {
  id: string;
  name: string;
  color: string;
  behavior: RivalBehavior;
  startingCapital: number;
}

export const RIVAL_DEFS: RivalDef[] = [
  { id: 'rival_pemberton', name: 'Pemberton & Fils', color: '#7a1f2b', behavior: 'agressif', startingCapital: 3200 },
  { id: 'rival_calloway', name: 'Maison Calloway', color: '#2b5b3f', behavior: 'opportuniste', startingCapital: 2800 },
  { id: 'rival_holt', name: 'Compagnie Holt', color: '#2f4a7a', behavior: 'defensif', startingCapital: 4000 },
  { id: 'rival_dunmore', name: 'Frères Dunmore', color: '#6a4a1f', behavior: 'opportuniste', startingCapital: 2500 },
];
