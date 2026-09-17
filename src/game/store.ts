import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createInitialMarkets, tickMarkets, priceFor } from './simulation';
import {
  tickRoute,
  distanceBetween,
  baseDangerosity,
  routeConstructionCost,
  railwayConstructionCost,
  availableTransportModes,
  TRANSPORT_MODES,
  RAILWAY_MAINTENANCE_PER_TICK,
  GUARD_COST_PER_TICK,
} from './routes';
import {
  hasLicense,
  licenseCost,
  licenseRenewalCost,
  categoryCommissionFactor,
  CATEGORY_MIN_TIER,
  LICENSE_RENEWAL_INTERVAL_DAYS,
  MIN_REPUTATION_TO_LICENSE,
  REPUTATION_REVOCATION_THRESHOLD,
} from './licenses';
import { WAREHOUSE_BASE_COST, WAREHOUSE_UPGRADE_COST, WAREHOUSE_MAINTENANCE, bestWarehouseBonus } from './warehouses';
import { resolveGangAttack } from './gangs';
import { GANGS_BY_ID } from '../data/gangs';
import { createInitialRivals, tickRival, isRivalWeakened, partialStakeCost, fullBuyoutCost } from './rivals';
import {
  concessionBribeCost,
  concessionRecurringCost,
  hasConcession,
  rollConcessionLoss,
  CONCESSION_MIN_TIER,
  CONCESSION_RENEWAL_INTERVAL_DAYS,
} from './concessions';
import { corruptionTaxFactor, corruptionUpkeepCost, rollAudit, auditFine } from './corruption';
import { computeCharterTier, charterTierDef } from './charter';
import { tickAgents, AGENT_MIN_ROUTES, AGENT_SALARY_PER_TICK } from './agents';
import { CITIES_BY_ID, PLAYABLE_STATE_IDS } from '../data/cities';
import { GOODS, GOODS_BY_ID, type GoodCategory } from '../data/goods';
import type {
  GameState,
  Route,
  TransportMode,
  EventLogEntry,
  License,
  Concession,
  Warehouse,
  Rival,
  RegionalAgent,
  AgentRule,
  ActiveScreen,
  InfrastructureLevel,
} from './types';

const STARTING_CAPITAL = 2500;
const TICKS_PER_DAY = 40;
const PRICE_HISTORY_LENGTH = 60;
const MAX_LOG_ENTRIES = 60;

interface GameActions {
  tick: () => void;
  setRunning: (running: boolean) => void;
  selectCity: (cityId: string | null) => void;
  selectRoute: (routeId: string | null) => void;
  beginRouteDraft: (cityId: string) => void;
  cancelRouteDraft: () => void;
  createRoute: (toCityId: string, mode: TransportMode) => void;
  setCommissionRate: (routeId: string, rate: number) => void;
  setActiveScreen: (screen: ActiveScreen) => void;
  toggleGuards: (routeId: string) => void;
  setRouteTransportMode: (routeId: string, mode: TransportMode) => void;
  buildRailway: (routeId: string) => void;
  buildWarehouse: (cityId: string) => void;
  buyLicense: (stateId: string, category: GoodCategory) => void;
  negotiateConcession: (stateId: string, category: GoodCategory) => void;
  setCorruption: (stateId: string, level: number) => void;
  toggleGangProtection: (gangId: string) => void;
  buyPartialStake: (rivalId: string, fraction: number) => void;
  buyFullRival: (rivalId: string, amicable: boolean) => void;
  hireAgent: (stateId: string, rule: AgentRule) => void;
  fireAgent: (agentId: string) => void;
  resetGame: () => void;
  exportSave: () => string;
  importSave: (json: string) => boolean;
}

let logCounter = 0;
function makeLogEntry(day: number, message: string, kind: EventLogEntry['kind']): EventLogEntry {
  logCounter += 1;
  return { id: `log-${Date.now()}-${logCounter}`, day, message, kind };
}

function pushLog(log: EventLogEntry[], entry: EventLogEntry): EventLogEntry[] {
  return [entry, ...log].slice(0, MAX_LOG_ENTRIES);
}

function cityLabel(cityId: string): string {
  return CITIES_BY_ID[cityId]?.name ?? cityId;
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
    licenses: [],
    concessions: [],
    warehouses: [],
    rivals: createInitialRivals(),
    agents: [],
    reputation: Object.fromEntries(PLAYABLE_STATE_IDS.map((id) => [id, 50])),
    corruption: Object.fromEntries(PLAYABLE_STATE_IDS.map((id) => [id, 0])),
    gangProtection: Object.fromEntries(Object.keys(GANGS_BY_ID).map((id) => [id, false])),
    charterTier: 1,
    selectedCityId: null,
    selectedRouteId: null,
    routeDraftFromCityId: null,
    activeScreen: 'map',
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
        let capital = state.capital;
        let log = state.log;
        const reputation = { ...state.reputation };
        let licenses = state.licenses;
        let concessions = state.concessions;

        // --- player routes: base trade + licenses + warehouse bonus + corruption tax + gangs ---
        const nextRoutes: Route[] = [];
        for (const route of state.routes) {
          const fromStateId = CITIES_BY_ID[route.fromCityId].stateId;
          const toStateId = CITIES_BY_ID[route.toCityId].stateId;
          const categoryFactor = (goodId: string) =>
            categoryCommissionFactor(GOODS_BY_ID[goodId].category, fromStateId, toStateId, licenses, state.charterTier);

          const base = tickRoute(route, markets, categoryFactor);
          markets = base.markets;

          const warehouseMult = bestWarehouseBonus(state.warehouses, [route.fromCityId, route.toCityId], 'player');
          const taxFactor = (corruptionTaxFactor(state.corruption[fromStateId] ?? 0) + corruptionTaxFactor(state.corruption[toStateId] ?? 0)) / 2;
          let tickRevenue = base.revenue * warehouseMult * taxFactor;

          const gangResult = resolveGangAttack(route, tickRevenue, state.gangProtection);
          if (gangResult.attacked) {
            tickRevenue = Math.max(0, tickRevenue - gangResult.revenueLoss);
            capital -= gangResult.ransom;
            const ransomMsg = gangResult.ransom > 0 ? ` Une rançon de ${gangResult.ransom} $ a été exigée.` : '';
            log = pushLog(log, makeLogEntry(state.day, `${gangResult.gangName} attaque votre route ${cityLabel(route.fromCityId)} → ${cityLabel(route.toCityId)} !${ransomMsg}`, 'danger'));
          }

          if (route.hasGuards) capital -= GUARD_COST_PER_TICK;
          if (route.infrastructure === 'voie_ferree') capital -= RAILWAY_MAINTENANCE_PER_TICK;

          capital += tickRevenue;
          reputation[fromStateId] = Math.min(100, (reputation[fromStateId] ?? 50) + 0.008);
          reputation[toStateId] = Math.min(100, (reputation[toStateId] ?? 50) + 0.008);

          nextRoutes.push({ ...base.route, lastTickRevenue: tickRevenue, totalRevenue: route.totalRevenue + tickRevenue });
        }

        // --- warehouse maintenance ---
        for (const w of state.warehouses) {
          if (w.ownerId === 'player') capital -= WAREHOUSE_MAINTENANCE[w.level];
        }

        // --- gang protection payments ---
        for (const [gangId, paying] of Object.entries(state.gangProtection)) {
          if (paying) capital -= GANGS_BY_ID[gangId]?.protectionCost ?? 0;
        }

        // --- concessions: recurring upkeep + random loss risk ---
        const survivingConcessions: Concession[] = [];
        for (const c of concessions) {
          capital -= c.recurringCost / TICKS_PER_DAY;
          if (rollConcessionLoss()) {
            log = pushLog(log, makeLogEntry(state.day, `Un rival a fait tomber votre concession exclusive (${c.category}) en ${c.stateId}.`, 'warning'));
          } else {
            survivingConcessions.push(c);
          }
        }
        concessions = survivingConcessions;

        // --- corruption upkeep + federal audits ---
        for (const stateId of PLAYABLE_STATE_IDS) {
          const level = state.corruption[stateId] ?? 0;
          if (level <= 0) continue;
          capital -= corruptionUpkeepCost(stateId, level);
          if (rollAudit(level, state.charterTier)) {
            const fine = auditFine(capital);
            capital -= fine;
            reputation[stateId] = Math.max(0, (reputation[stateId] ?? 50) - 20);
            const stateLicenses = licenses.filter((l) => l.stateId === stateId);
            if (stateLicenses.length > 0) {
              const revoked = stateLicenses[Math.floor(Math.random() * stateLicenses.length)];
              licenses = licenses.filter((l) => l.id !== revoked.id);
              log = pushLog(log, makeLogEntry(state.day, `Audit fédéral en ${stateId} : licence ${revoked.category} révoquée, amende de ${fine} $.`, 'danger'));
            } else {
              log = pushLog(log, makeLogEntry(state.day, `Audit fédéral en ${stateId} : amende de ${fine} $ pour irrégularités.`, 'danger'));
            }
          }
        }

        // --- rivals: their own trade, sharing the same markets, plus periodic expansion ---
        const playerStakeGain = { value: 0 };
        const nextRivals: Rival[] = [];
        for (const rival of state.rivals) {
          const result = tickRival(rival, markets, state.day, state.tickCount, playerStakeGain);
          markets = result.markets;
          nextRivals.push(result.rival);
        }
        capital += playerStakeGain.value;

        // --- regional agents: salary + automated rate adjustments ---
        let routesAfterAgents = nextRoutes;
        if (state.agents.length > 0) {
          routesAfterAgents = tickAgents(nextRoutes, state.agents, nextRivals);
          for (const agent of state.agents) capital -= agent.salaryPerTick;
        }

        // --- price history snapshot ---
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

        // --- charter tier progression ---
        const newTier = computeCharterTier(capital, reputation);
        if (newTier !== state.charterTier) {
          log = pushLog(log, makeLogEntry(state.day, `Votre charte progresse : ${charterTierDef(newTier).name} !`, 'success'));
        }

        // --- day / night cycle, daily renewals ---
        let dayProgress = state.dayProgress + 1 / TICKS_PER_DAY;
        let day = state.day;
        if (dayProgress >= 1) {
          dayProgress -= 1;
          day += 1;
          log = pushLog(log, makeLogEntry(day, `Un nouveau jour se lève (jour ${day}).`, 'info'));

          const renewedLicenses: License[] = [];
          for (const lic of licenses) {
            if (day >= lic.nextRenewalDay) {
              const cost = licenseRenewalCost(lic.stateId, lic.category);
              if (capital >= cost) {
                capital -= cost;
                renewedLicenses.push({ ...lic, nextRenewalDay: day + LICENSE_RENEWAL_INTERVAL_DAYS });
              } else {
                log = pushLog(log, makeLogEntry(day, `Licence ${lic.category} en ${lic.stateId} non renouvelée (capital insuffisant) : révoquée.`, 'warning'));
              }
            } else {
              renewedLicenses.push(lic);
            }
          }
          licenses = renewedLicenses.filter((lic) => {
            if ((reputation[lic.stateId] ?? 50) < REPUTATION_REVOCATION_THRESHOLD && Math.random() < 0.3) {
              log = pushLog(log, makeLogEntry(day, `Licence ${lic.category} en ${lic.stateId} révoquée : réputation trop basse.`, 'warning'));
              return false;
            }
            return true;
          });

          concessions = concessions.map((c) => (day >= c.nextRenewalDay ? { ...c, nextRenewalDay: day + CONCESSION_RENEWAL_INTERVAL_DAYS } : c));
        }
        const isNight = dayProgress < 0.2 || dayProgress > 0.8;

        set({
          cityMarkets: markets,
          priceHistory,
          routes: routesAfterAgents,
          licenses,
          concessions,
          rivals: nextRivals,
          reputation,
          capital,
          dayProgress,
          day,
          isNight,
          log,
          charterTier: newTier,
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
        const available = availableTransportModes(fromCityId, toCityId, state.capital, state.charterTier, 'piste');
        const actualMode: TransportMode = available.includes(mode) ? mode : 'chariot';
        const cost = routeConstructionCost(fromCityId, toCityId) + TRANSPORT_MODES[actualMode].baseCost;
        if (state.capital < cost) {
          set({
            log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour ouvrir une route ${cityLabel(fromCityId)} → ${cityLabel(toCityId)} (coût ${cost} $).`, 'warning')),
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
          transportMode: actualMode,
          commissionRate: 0.08,
          createdAtDay: state.day,
          totalRevenue: 0,
          lastTickRevenue: 0,
          lastTickVolume: 0,
          hasGuards: false,
        };
        set({
          capital: state.capital - cost,
          routes: [...state.routes, newRoute],
          routeDraftFromCityId: null,
          selectedRouteId: newRoute.id,
          selectedCityId: null,
          log: pushLog(state.log, makeLogEntry(state.day, `Nouvelle route ouverte : ${cityLabel(fromCityId)} → ${cityLabel(toCityId)} (${TRANSPORT_MODES[actualMode].label}, coût ${cost} $).`, 'success')),
        });
      },

      setCommissionRate: (routeId, rate) => {
        const clamped = Math.min(0.15, Math.max(0.02, rate));
        set({ routes: get().routes.map((r) => (r.id === routeId ? { ...r, commissionRate: clamped } : r)) });
      },

      setActiveScreen: (screen) => set({ activeScreen: screen }),

      toggleGuards: (routeId) => {
        set({ routes: get().routes.map((r) => (r.id === routeId ? { ...r, hasGuards: !r.hasGuards } : r)) });
      },

      setRouteTransportMode: (routeId, mode) => {
        const state = get();
        const route = state.routes.find((r) => r.id === routeId);
        if (!route) return;
        const available = availableTransportModes(route.fromCityId, route.toCityId, state.capital, state.charterTier, route.infrastructure);
        if (!available.includes(mode)) return;
        set({ routes: state.routes.map((r) => (r.id === routeId ? { ...r, transportMode: mode } : r)) });
      },

      buildRailway: (routeId) => {
        const state = get();
        const route = state.routes.find((r) => r.id === routeId);
        if (!route || route.infrastructure === ('voie_ferree' as InfrastructureLevel)) return;
        const cost = railwayConstructionCost(route.fromCityId, route.toCityId);
        if (state.capital < cost) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour construire une voie ferrée (${cost} $).`, 'warning')) });
          return;
        }
        set({
          capital: state.capital - cost,
          routes: state.routes.map((r) => (r.id === routeId ? { ...r, infrastructure: 'voie_ferree' } : r)),
          log: pushLog(state.log, makeLogEntry(state.day, `Voie ferrée achevée entre ${cityLabel(route.fromCityId)} et ${cityLabel(route.toCityId)}.`, 'success')),
        });
      },

      buildWarehouse: (cityId) => {
        const state = get();
        const existing = state.warehouses.find((w) => w.cityId === cityId && w.ownerId === 'player');
        if (existing) {
          if (existing.level >= 3) return;
          const nextLevel = (existing.level + 1) as 1 | 2 | 3;
          const cost = WAREHOUSE_UPGRADE_COST[nextLevel];
          if (state.capital < cost) {
            set({ log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour agrandir l'entrepôt (${cost} $).`, 'warning')) });
            return;
          }
          set({
            capital: state.capital - cost,
            warehouses: state.warehouses.map((w) => (w.id === existing.id ? { ...w, level: nextLevel } : w)),
            log: pushLog(state.log, makeLogEntry(state.day, `Entrepôt de ${cityLabel(cityId)} agrandi au niveau ${nextLevel}.`, 'success')),
          });
        } else {
          if (state.capital < WAREHOUSE_BASE_COST) {
            set({ log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour bâtir un entrepôt (${WAREHOUSE_BASE_COST} $).`, 'warning')) });
            return;
          }
          const wh: Warehouse = { id: `wh-${cityId}-player`, cityId, ownerId: 'player', level: 1 };
          set({
            capital: state.capital - WAREHOUSE_BASE_COST,
            warehouses: [...state.warehouses, wh],
            log: pushLog(state.log, makeLogEntry(state.day, `Entrepôt construit à ${cityLabel(cityId)}.`, 'success')),
          });
        }
      },

      buyLicense: (stateId, category) => {
        const state = get();
        if (category === 'alcool') return;
        if (state.charterTier < CATEGORY_MIN_TIER[category]) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Votre charte actuelle ne permet pas encore la licence ${category}.`, 'warning')) });
          return;
        }
        if ((state.reputation[stateId] ?? 50) < MIN_REPUTATION_TO_LICENSE) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Réputation trop basse en ${stateId} pour obtenir cette licence.`, 'warning')) });
          return;
        }
        if (hasLicense(state.licenses, stateId, category)) return;
        const cost = licenseCost(stateId, category);
        if (state.capital < cost) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour la licence ${category} en ${stateId} (${cost} $).`, 'warning')) });
          return;
        }
        const license: License = { id: `lic-${stateId}-${category}-${Date.now()}`, stateId, category, acquiredDay: state.day, nextRenewalDay: state.day + LICENSE_RENEWAL_INTERVAL_DAYS };
        set({
          capital: state.capital - cost,
          licenses: [...state.licenses, license],
          log: pushLog(state.log, makeLogEntry(state.day, `Licence ${category} obtenue en ${stateId} (${cost} $).`, 'success')),
        });
      },

      negotiateConcession: (stateId, category) => {
        const state = get();
        if (state.charterTier < CONCESSION_MIN_TIER) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Une charte d'État est requise pour négocier une concession exclusive.`, 'warning')) });
          return;
        }
        if (hasConcession(state.concessions, stateId, category)) return;
        const cost = concessionBribeCost(stateId, category);
        if (state.capital < cost) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour cette concession exclusive (${cost} $).`, 'warning')) });
          return;
        }
        const concession: Concession = {
          id: `conc-${stateId}-${category}-${Date.now()}`,
          stateId,
          category,
          acquiredDay: state.day,
          nextRenewalDay: state.day + CONCESSION_RENEWAL_INTERVAL_DAYS,
          recurringCost: concessionRecurringCost(stateId, category),
        };
        set({
          capital: state.capital - cost,
          concessions: [...state.concessions, concession],
          log: pushLog(state.log, makeLogEntry(state.day, `Concession exclusive obtenue : ${category} en ${stateId}.`, 'success')),
        });
      },

      setCorruption: (stateId, level) => {
        const clamped = Math.min(100, Math.max(0, Math.round(level)));
        set({ corruption: { ...get().corruption, [stateId]: clamped } });
      },

      toggleGangProtection: (gangId) => {
        const state = get();
        const paying = !state.gangProtection[gangId];
        set({
          gangProtection: { ...state.gangProtection, [gangId]: paying },
          log: pushLog(state.log, makeLogEntry(state.day, `${paying ? 'Protection régulière versée à' : 'Protection annulée pour'} ${GANGS_BY_ID[gangId]?.name ?? gangId}.`, paying ? 'info' : 'warning')),
        });
      },

      buyPartialStake: (rivalId, fraction) => {
        const state = get();
        const rival = state.rivals.find((r) => r.id === rivalId);
        if (!rival || rival.defeated) return;
        if (state.charterTier < 3) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Une charte d'État est requise pour racheter des parts.`, 'warning')) });
          return;
        }
        const cost = partialStakeCost(rival, fraction);
        if (state.capital < cost) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour racheter ${Math.round(fraction * 100)}% de ${rival.name} (${cost} $).`, 'warning')) });
          return;
        }
        set({
          capital: state.capital - cost,
          rivals: state.rivals.map((r) => (r.id === rivalId ? { ...r, playerStake: Math.min(1, r.playerStake + fraction) } : r)),
          log: pushLog(state.log, makeLogEntry(state.day, `${Math.round(fraction * 100)}% de parts rachetées dans ${rival.name}.`, 'success')),
        });
      },

      buyFullRival: (rivalId, amicable) => {
        const state = get();
        const rival = state.rivals.find((r) => r.id === rivalId);
        if (!rival || rival.defeated) return;
        if (state.charterTier < 3) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Une charte d'État est requise pour absorber un rival.`, 'warning')) });
          return;
        }
        if (!amicable && !isRivalWeakened(rival)) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `${rival.name} est encore trop solide pour un rachat forcé.`, 'warning')) });
          return;
        }
        const cost = fullBuyoutCost(rival, amicable);
        if (state.capital < cost) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Capital insuffisant pour absorber ${rival.name} (${cost} $).`, 'warning')) });
          return;
        }
        const absorbedRoutes = rival.routes.map((r) => ({ ...r, id: `absorbed-${r.id}` }));
        set({
          capital: state.capital - cost,
          routes: [...state.routes, ...absorbedRoutes],
          rivals: state.rivals.map((r) => (r.id === rivalId ? { ...r, defeated: true, routes: [], capital: 0 } : r)),
          log: pushLog(state.log, makeLogEntry(state.day, `${rival.name} absorbé ! ${absorbedRoutes.length} route(s) intégrée(s) à votre empire.`, 'success')),
        });
      },

      hireAgent: (stateId, rule) => {
        const state = get();
        if (state.routes.length < AGENT_MIN_ROUTES) {
          set({ log: pushLog(state.log, makeLogEntry(state.day, `Il faut au moins ${AGENT_MIN_ROUTES} routes actives pour engager un agent régional.`, 'warning')) });
          return;
        }
        if (state.agents.some((a) => a.stateId === stateId)) return;
        const agent: RegionalAgent = { id: `agent-${stateId}-${Date.now()}`, stateId, rule, salaryPerTick: AGENT_SALARY_PER_TICK, hiredDay: state.day };
        set({
          agents: [...state.agents, agent],
          log: pushLog(state.log, makeLogEntry(state.day, `Agent régional engagé en ${stateId}.`, 'success')),
        });
      },

      fireAgent: (agentId) => {
        set({ agents: get().agents.filter((a) => a.id !== agentId) });
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
        licenses: state.licenses,
        concessions: state.concessions,
        warehouses: state.warehouses,
        rivals: state.rivals,
        agents: state.agents,
        reputation: state.reputation,
        corruption: state.corruption,
        gangProtection: state.gangProtection,
        charterTier: state.charterTier,
        log: state.log,
        tickCount: state.tickCount,
      }),
    },
  ),
);
