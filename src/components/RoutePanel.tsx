import { CITIES_BY_ID } from '../data/cities';
import { GANGS_BY_ID } from '../data/gangs';
import { useGameStore } from '../game/store';
import { TRANSPORT_MODES, availableTransportModes, railwayConstructionCost, GUARD_COST_PER_TICK } from '../game/routes';
import { routeGangIds } from '../game/gangs';
import type { TransportMode } from '../game/types';
import { formatMoney, formatMoneyPrecise, formatUnits } from '../game/format';

const INFRA_LABELS: Record<string, string> = { piste: 'Piste', route: 'Route', voie_ferree: 'Voie ferrée' };

export function RoutePanel({ routeId }: { routeId: string }) {
  const route = useGameStore((s) => s.routes.find((r) => r.id === routeId));
  const setCommissionRate = useGameStore((s) => s.setCommissionRate);
  const toggleGuards = useGameStore((s) => s.toggleGuards);
  const setRouteTransportMode = useGameStore((s) => s.setRouteTransportMode);
  const buildRailway = useGameStore((s) => s.buildRailway);
  const capital = useGameStore((s) => s.capital);
  const charterTier = useGameStore((s) => s.charterTier);
  const gangProtection = useGameStore((s) => s.gangProtection);

  if (!route) return null;

  const from = CITIES_BY_ID[route.fromCityId];
  const to = CITIES_BY_ID[route.toCityId];
  const mode = TRANSPORT_MODES[route.transportMode];
  const modes = availableTransportModes(route.fromCityId, route.toCityId, capital, charterTier, route.infrastructure);
  const gangIds = routeGangIds(route);
  const protectedFromAll = gangIds.length > 0 && gangIds.every((id) => gangProtection[id]);
  const railwayCost = railwayConstructionCost(route.fromCityId, route.toCityId);

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
        <dd>{INFRA_LABELS[route.infrastructure]}</dd>
        <dt>Protection gangs</dt>
        <dd>{gangIds.length === 0 ? '—' : protectedFromAll ? 'Assurée' : 'Non protégée'}</dd>
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
      <p className="hint">Un taux trop élevé pousse les marchands à réduire le volume qui transite par votre route.</p>

      <h3>Mode de transport</h3>
      <select value={route.transportMode} onChange={(e) => setRouteTransportMode(route.id, e.target.value as TransportMode)}>
        {(['chariot', 'diligence', 'train', 'bateau'] as TransportMode[]).map((m) => (
          <option key={m} value={m} disabled={!modes.includes(m)}>
            {TRANSPORT_MODES[m].label}
            {!modes.includes(m) ? ' (indisponible)' : ''}
          </option>
        ))}
      </select>

      {route.infrastructure !== 'voie_ferree' && (
        <button type="button" style={{ marginTop: 8, width: '100%' }} disabled={capital < railwayCost} onClick={() => buildRailway(route.id)}>
          Construire une voie ferrée ({formatMoney(railwayCost)})
        </button>
      )}

      <h3>Sécurité</h3>
      <div className="license-row">
        <span>Gardes armés ({formatMoney(GUARD_COST_PER_TICK)}/tick, réduit le risque d'attaque)</span>
        <button type="button" onClick={() => toggleGuards(route.id)}>
          {route.hasGuards ? 'Renvoyer' : 'Engager'}
        </button>
      </div>
      {gangIds.length > 0 && !protectedFromAll && (
        <p className="hint">
          {gangIds.map((id) => GANGS_BY_ID[id]?.name).join(', ')} opère sur ce territoire — payez une protection régulière depuis
          l'onglet États &amp; gouvernance pour éliminer son risque.
        </p>
      )}
    </div>
  );
}
