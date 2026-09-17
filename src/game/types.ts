import type { GoodCategory } from '../data/goods';

export type TransportMode = 'chariot' | 'diligence' | 'train' | 'bateau';

export type InfrastructureLevel = 'piste' | 'route' | 'voie_ferree';

export interface CityMarketState {
  /** stock[goodId] = current virtual stock units */
  stock: Record<string, number>;
}

export interface Route {
  id: string;
  fromCityId: string;
  toCityId: string;
  distance: number;
  dangerosity: number; // 0-1 base risk
  infrastructure: InfrastructureLevel;
  transportMode: TransportMode;
  commissionRate: number; // 0.02 - 0.15
  createdAtDay: number;
  totalRevenue: number;
  lastTickRevenue: number;
  lastTickVolume: number;
  hasGuards: boolean;
}

export interface EventLogEntry {
  id: string;
  day: number;
  message: string;
  kind: 'info' | 'warning' | 'success' | 'danger';
}

export interface License {
  id: string;
  stateId: string;
  category: GoodCategory;
  acquiredDay: number;
  nextRenewalDay: number;
}

export interface Concession {
  id: string;
  stateId: string;
  category: GoodCategory;
  acquiredDay: number;
  nextRenewalDay: number;
  recurringCost: number;
}

export interface Warehouse {
  id: string;
  cityId: string;
  ownerId: string; // 'player' or a rival id
  level: 1 | 2 | 3;
}

export type RivalBehavior = 'agressif' | 'opportuniste' | 'defensif';

export interface Rival {
  id: string;
  name: string;
  color: string;
  behavior: RivalBehavior;
  capital: number;
  routes: Route[];
  defeated: boolean;
  playerStake: number; // 0..1, fraction of this rival's revenue the player skims
}

export type AgentRule = 'taux_bas' | 'taux_standard' | 'aligner_rival';

export interface RegionalAgent {
  id: string;
  stateId: string;
  rule: AgentRule;
  salaryPerTick: number;
  hiredDay: number;
}

export type CharterTier = 1 | 2 | 3 | 4;

export type ActiveScreen = 'map' | 'licenses' | 'rivals' | 'holding';

export interface GameState {
  capital: number;
  day: number;
  dayProgress: number; // 0..1 within the current day
  isNight: boolean;
  running: boolean;

  cityMarkets: Record<string, CityMarketState>;
  priceHistory: Record<string, Record<string, number[]>>; // cityId -> goodId -> last N prices

  routes: Route[];
  licenses: License[];
  concessions: Concession[];
  warehouses: Warehouse[];
  rivals: Rival[];
  agents: RegionalAgent[];

  reputation: Record<string, number>; // stateId -> 0..100
  corruption: Record<string, number>; // stateId -> 0..100 (player-set slider)
  gangProtection: Record<string, boolean>; // gangId -> paying regular protection

  charterTier: CharterTier;

  selectedCityId: string | null;
  selectedRouteId: string | null;
  routeDraftFromCityId: string | null;
  activeScreen: ActiveScreen;

  log: EventLogEntry[];

  tickCount: number;
}
