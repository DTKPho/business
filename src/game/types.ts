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
}

export interface EventLogEntry {
  id: string;
  day: number;
  message: string;
  kind: 'info' | 'warning' | 'success' | 'danger';
}

export interface GameState {
  capital: number;
  day: number;
  dayProgress: number; // 0..1 within the current day
  isNight: boolean;
  running: boolean;

  cityMarkets: Record<string, CityMarketState>;
  priceHistory: Record<string, Record<string, number[]>>; // cityId -> goodId -> last N prices

  routes: Route[];

  selectedCityId: string | null;
  selectedRouteId: string | null;
  routeDraftFromCityId: string | null;

  log: EventLogEntry[];

  tickCount: number;
}
