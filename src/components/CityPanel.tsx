import { useMemo } from 'react';
import { CITIES_BY_ID, DEV_LEVEL_LABELS, SPECIALTY_LABELS } from '../data/cities';
import { US_STATE_PATHS } from '../data/usStatePaths';
import { GOODS, GOODS_BY_ID, GOOD_CATEGORY_LABELS } from '../data/goods';
import { gangForStateId } from '../data/gangs';
import { useGameStore } from '../game/store';
import { priceFor } from '../game/simulation';
import { WAREHOUSE_BASE_COST, WAREHOUSE_UPGRADE_COST, WAREHOUSE_BONUS } from '../game/warehouses';
import { formatMoney, formatMoneyPrecise, formatUnits } from '../game/format';

const stateNameById = Object.fromEntries(US_STATE_PATHS.map((s) => [s.id, s.name]));

export function CityPanel({ cityId }: { cityId: string }) {
  const city = CITIES_BY_ID[cityId];
  const cityMarkets = useGameStore((s) => s.cityMarkets);
  const allRoutes = useGameStore((s) => s.routes);
  const routes = useMemo(
    () => allRoutes.filter((r) => r.fromCityId === cityId || r.toCityId === cityId),
    [allRoutes, cityId],
  );
  const beginRouteDraft = useGameStore((s) => s.beginRouteDraft);
  const routeDraftFromCityId = useGameStore((s) => s.routeDraftFromCityId);
  const selectRoute = useGameStore((s) => s.selectRoute);
  const warehouses = useGameStore((s) => s.warehouses);
  const buildWarehouse = useGameStore((s) => s.buildWarehouse);
  const reputation = useGameStore((s) => s.reputation);
  const capital = useGameStore((s) => s.capital);

  if (!city) return null;

  const playerWarehouse = warehouses.find((w) => w.cityId === cityId && w.ownerId === 'player');
  const rivalWarehouses = warehouses.filter((w) => w.cityId === cityId && w.ownerId !== 'player');
  const gang = gangForStateId(city.stateId);
  const rep = Math.round(reputation[city.stateId] ?? 50);

  return (
    <div className="panel">
      <h2>{city.name}</h2>
      <p className="panel-subtitle">
        {stateNameById[city.stateId] ?? city.stateId} · {DEV_LEVEL_LABELS[city.dev]} · {SPECIALTY_LABELS[city.specialty]}
      </p>

      <dl className="stat-grid">
        <dt>Population</dt>
        <dd>{formatUnits(city.population)}</dd>
        <dt>Accès</dt>
        <dd>{[city.isPort && 'Port', city.isRiver && 'Fluvial'].filter(Boolean).join(', ') || 'Intérieur des terres'}</dd>
        <dt>Produit localement</dt>
        <dd>{city.produces.map((g) => GOODS_BY_ID[g].name).join(', ')}</dd>
        <dt>Réputation d'État</dt>
        <dd>{rep}/100</dd>
        <dt>Territoire de gang</dt>
        <dd>{gang?.name ?? '—'}</dd>
      </dl>

      <button
        type="button"
        className="primary"
        disabled={routeDraftFromCityId === cityId}
        onClick={() => beginRouteDraft(cityId)}
      >
        {routeDraftFromCityId === cityId ? 'Choisissez la destination sur la carte…' : 'Tracer une route depuis cette ville'}
      </button>

      <h3>Entrepôt (nœud stratégique)</h3>
      {playerWarehouse ? (
        <div className="license-row">
          <span>
            Niveau {playerWarehouse.level} · bonus +{Math.round(WAREHOUSE_BONUS[playerWarehouse.level] * 100)}% sur les routes reliées
          </span>
          {playerWarehouse.level < 3 && (
            <button type="button" disabled={capital < WAREHOUSE_UPGRADE_COST[(playerWarehouse.level + 1) as 2 | 3]} onClick={() => buildWarehouse(cityId)}>
              Agrandir ({formatMoney(WAREHOUSE_UPGRADE_COST[(playerWarehouse.level + 1) as 2 | 3])})
            </button>
          )}
        </div>
      ) : (
        <div className="license-row">
          <span>Aucun entrepôt ici</span>
          <button type="button" disabled={capital < WAREHOUSE_BASE_COST} onClick={() => buildWarehouse(cityId)}>
            Construire ({formatMoney(WAREHOUSE_BASE_COST)})
          </button>
        </div>
      )}
      {rivalWarehouses.length > 0 && (
        <p className="hint">Un rival possède déjà un entrepôt ici : la concurrence dilue le bonus de chacun.</p>
      )}

      <h3>Marché local</h3>
      <table className="market-table">
        <thead>
          <tr>
            <th>Bien</th>
            <th>Catégorie</th>
            <th>Stock</th>
            <th>Prix</th>
          </tr>
        </thead>
        <tbody>
          {GOODS.map((good) => {
            const stock = cityMarkets[cityId]?.stock[good.id] ?? 0;
            const price = priceFor(cityId, good.id, cityMarkets);
            const isSurplus = city.produces.includes(good.id);
            return (
              <tr key={good.id} className={isSurplus ? 'surplus' : undefined}>
                <td>{good.name}</td>
                <td className="muted">{GOOD_CATEGORY_LABELS[good.category]}</td>
                <td>{formatUnits(stock)}</td>
                <td>{formatMoneyPrecise(price)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {routes.length > 0 && (
        <>
          <h3>Routes reliées</h3>
          <ul className="route-list">
            {routes.map((route) => {
              const other = CITIES_BY_ID[route.fromCityId === cityId ? route.toCityId : route.fromCityId];
              return (
                <li key={route.id}>
                  <button type="button" onClick={() => selectRoute(route.id)}>
                    → {other.name} · {formatMoneyPrecise(route.lastTickRevenue)}/tick
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
