import { CITIES_BY_ID } from '../data/cities';
import { useGameStore } from '../game/store';
import { TRANSPORT_MODES } from '../game/routes';
import { formatMoney, formatMoneyPrecise, formatUnits } from '../game/format';

export function RoutePanel({ routeId }: { routeId: string }) {
  const route = useGameStore((s) => s.routes.find((r) => r.id === routeId));
  const setCommissionRate = useGameStore((s) => s.setCommissionRate);

  if (!route) return null;

  const from = CITIES_BY_ID[route.fromCityId];
  const to = CITIES_BY_ID[route.toCityId];
  const mode = TRANSPORT_MODES[route.transportMode];

  return (
    <div className="panel">
      <h2>
        {from.name} ↔ {to.name}
      </h2>
      <p className="panel-subtitle">
        {mode.label} · {route.distance} mi · ouverte jour {route.createdAtDay}
      </p>

      <dl className="stat-grid">
        <dt>Dangerosité</dt>
        <dd>{Math.round(route.dangerosity * 100)}%</dd>
        <dt>Infrastructure</dt>
        <dd>Piste</dd>
        <dt>Volume (dernier tick)</dt>
        <dd>{formatUnits(route.lastTickVolume)} unités</dd>
        <dt>Revenu (dernier tick)</dt>
        <dd>{formatMoneyPrecise(route.lastTickRevenue)}</dd>
        <dt>Revenu cumulé</dt>
        <dd>{formatMoney(route.totalRevenue)}</dd>
      </dl>

      <label className="slider-label" htmlFor="commission-rate">
        Taux de commission : {Math.round(route.commissionRate * 100)}%
      </label>
      <input
        id="commission-rate"
        type="range"
        min={2}
        max={15}
        step={1}
        value={Math.round(route.commissionRate * 100)}
        onChange={(e) => setCommissionRate(route.id, Number(e.target.value) / 100)}
      />
      <p className="hint">
        Un taux trop élevé pousse les marchands à réduire le volume qui transite par votre route.
      </p>
    </div>
  );
}
