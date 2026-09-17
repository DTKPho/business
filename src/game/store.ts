import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createInitialMarkets, tickMarkets, priceFor } from './simulation';
import { tickRoute, distanceBetween, baseDangerosity, routeConstructionCost, TRANSPORT_MODES } from './routes';
import { CITIES_BY_ID } from '../data/cities';
import { GOODS } from '../data/goods';
import type { GameState, Route, TransportMode, EventLogEntry } from './types';

const STARTING_CAPITAL = 2500;
const TICKS_PER_DAY = 40;
const PRICE_HISTORY_LENGTH = 60;
const MAX_LOG_ENTRIES = 40;

interface GameActions {
  tick: () => void;
  setRunning: (running: boolean) => void;
  selectCity: (cityId: string | null) => void;
  selectRoute: (routeId: string | null) => void;
  beginRouteDraft: (cityId: string) => void;
  cancelRouteDraft: () => void;
  createRoute: (toCityId: string, mode: TransportMode) => void;
  setCommissionRate: (routeId: string, rate: number) => void;
  resetGame: () => void;
  exportSave: () => string;
  importSave: (json: string) => boolean;
}

let logCounter = 0;
function makeLogEntry(day: number, message: string, kind: EventLogEntry['kind']): EventLogEntry {
  logCounter += 1;
  return { id: `log-${Date.now()}-${logCounter}`, day, message, kind };
}

function initialState(): GameState {
  return {
    capital: STARTING_CAPITAL,
    day: 1,
    dayProgress: 0.3,
    isNight: false,
    running: true,
    cityMarkets: createInitialMarkets(),
    priceHistory: {},
    routes: [],
    selectedCityId: null,
    selectedRouteId: null,
    routeDraftFromCityId: null,
    log: [makeLogEntry(1, 'Vous arrivez avec 2 500 $ et l’ambition de bâtir un empire commercial.', 'info')],
    tickCount: 0,
  };
}

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...initialState(),

      tick: () => {
        const state = get();
        if (!state.running) return;

        let markets = tickMarkets(state.cityMarkets);
        let capitalGain = 0;
        const routes: Route[] = [];
        for (const route of state.routes) {
          const result = tickRoute(route, markets);
          markets = result.markets;
          capitalGain += result.revenue;
          routes.push(result.route);
        }

        const priceHistory: GameState['priceHistory'] = { ...state.priceHistory };
        for (const cityId of Object.keys(markets)) {
          const cityHistory = { ...(priceHistory[cityId] ?? {}) };
          for (const good of GOODS) {
            const price = priceFor(cityId, good.id, markets);
            const series = cityHistory[good.id] ?? [];
            const nextSeries = series.length >= PRICE_HISTORY_LENGTH ? series.slice(series.length - PRICE_HISTORY_LENGTH + 1) : series.slice();
            nextSeries.push(price);
            cityHistory[good.id] = nextSeries;
          }
          priceHistory[cityId] = cityHistory;
        }

        let dayProgress = state.dayProgress + 1 / TICKS_PER_DAY;
        let day = state.day;
        let log = state.log;
        if (dayProgress >= 1) {
          dayProgress -= 1;
          day += 1;
          log = [makeLogEntry(day, `Un nouveau jour se lève (jour ${day}).`, 'info'), ...log].slice(0, MAX_LOG_ENTRIES);
        }
        const isNight = dayProgress < 0.2 || dayProgress > 0.8;

        set({
          cityMarkets: markets,
          priceHistory,
          routes,
          capital: state.capital + capitalGain,
          dayProgress,
          day,
          isNight,
          log,
          tickCount: state.tickCount + 1,
        });
      },

      setRunning: (running) => set({ running }),

      selectCity: (cityId) => set({ selectedCityId: cityId, selectedRouteId: null }),

      selectRoute: (routeId) => set({ selectedRouteId: routeId, selectedCityId: null }),

      beginRouteDraft: (cityId) => set({ routeDraftFromCityId: cityId, selectedCityId: cityId }),

      cancelRouteDraft: () => set({ routeDraftFromCityId: null }),

      createRoute: (toCityId, mode) => {
        const state = get();
        const fromCityId = state.routeDraftFromCityId;
        if (!fromCityId || fromCityId === toCityId) return;
        if (state.routes.some((r) => (r.fromCityId === fromCityId && r.toCityId === toCityId) || (r.fromCityId === toCityId && r.toCityId === fromCityId))) {
          return;
        }
        const cost = routeConstructionCost(fromCityId, toCityId);
        if (state.capital < cost) {
          set({
            log: [makeLogEntry(state.day, `Capital insuffisant pour ouvrir une route ${CITIES_BY_ID[fromCityId].name} → ${CITIES_BY_ID[toCityId].name} (coût ${cost} $).`, 'warning'), ...state.log].slice(0, MAX_LOG_ENTRIES),
          });
          return;
        }
        const newRoute: Route = {
          id: `route-${fromCityId}-${toCityId}-${Date.now()}`,
          fromCityId,
          toCityId,
          distance: Math.round(distanceBetween(fromCityId, toCityId)),
          dangerosity: baseDangerosity(fromCityId, toCityId),
          infrastructure: 'piste',
          transportMode: mode,
          commissionRate: 0.08,
          createdAtDay: state.day,
          totalRevenue: 0,
          lastTickRevenue: 0,
          lastTickVolume: 0,
        };
        set({
          capital: state.capital - cost,
          routes: [...state.routes, newRoute],
          routeDraftFromCityId: null,
          selectedRouteId: newRoute.id,
          selectedCityId: null,
          log: [makeLogEntry(state.day, `Nouvelle route ouverte : ${CITIES_BY_ID[fromCityId].name} → ${CITIES_BY_ID[toCityId].name} (${TRANSPORT_MODES[mode].label}, coût ${cost} $).`, 'success'), ...state.log].slice(0, MAX_LOG_ENTRIES),
        });
      },

      setCommissionRate: (routeId, rate) => {
        const clamped = Math.min(0.15, Math.max(0.02, rate));
        set({ routes: get().routes.map((r) => (r.id === routeId ? { ...r, commissionRate: clamped } : r)) });
      },

      resetGame: () => set(initialState()),

      exportSave: () => JSON.stringify(get()),

      importSave: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (!parsed || typeof parsed !== 'object' || !parsed.cityMarkets) return false;
          set({ ...initialState(), ...parsed });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'rdr-commerce-save',
      partialize: (state) => ({
        capital: state.capital,
        day: state.day,
        dayProgress: state.dayProgress,
        isNight: state.isNight,
        running: state.running,
        cityMarkets: state.cityMarkets,
        priceHistory: state.priceHistory,
        routes: state.routes,
        log: state.log,
        tickCount: state.tickCount,
      }),
    },
  ),
);
