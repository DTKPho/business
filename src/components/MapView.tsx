import { useMemo, useState } from 'react';
import { MAP_VIEWBOX, US_STATE_PATHS } from '../data/usStatePaths';
import { CITIES, PLAYABLE_STATE_IDS } from '../data/cities';
import { useGameStore } from '../game/store';
import { TRANSPORT_MODES } from '../game/routes';

const SPECIALTY_COLOR: Record<string, string> = {
  ranching: '#c98a4b',
  mining: '#9a7bb0',
  agricultural: '#7fa856',
  industrial: '#8590a1',
  port: '#4f9bc9',
  distillery: '#c9584f',
};

const MODE_COLOR: Record<string, string> = {
  chariot: '#c9a24b',
  diligence: '#d97b3f',
  train: '#5f6d8c',
  bateau: '#3f8fd9',
};

const DEV_RADIUS: Record<number, number> = { 1: 3.4, 2: 5, 3: 7 };

const playableSet = new Set(PLAYABLE_STATE_IDS);

export function MapView() {
  const routes = useGameStore((s) => s.routes);
  const rivals = useGameStore((s) => s.rivals);
  const warehouses = useGameStore((s) => s.warehouses);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);
  const routeDraftFromCityId = useGameStore((s) => s.routeDraftFromCityId);
  const selectCity = useGameStore((s) => s.selectCity);
  const selectRoute = useGameStore((s) => s.selectRoute);
  const cancelRouteDraft = useGameStore((s) => s.cancelRouteDraft);
  const createRoute = useGameStore((s) => s.createRoute);
  const isNight = useGameStore((s) => s.isNight);

  const [hoverCityId, setHoverCityId] = useState<string | null>(null);

  const cityById = useMemo(() => Object.fromEntries(CITIES.map((c) => [c.id, c])), []);

  function handleCityClick(cityId: string) {
    if (routeDraftFromCityId) {
      if (routeDraftFromCityId === cityId) {
        cancelRouteDraft();
        return;
      }
      createRoute(cityId, 'chariot');
      return;
    }
    selectCity(cityId);
  }

  return (
    <div className={`map-wrap${isNight ? ' is-night' : ''}`}>
      <svg viewBox={MAP_VIEWBOX} className="us-map" role="img" aria-label="Carte des États-Unis, 1899">
        <rect x="-50" y="-50" width="1100" height="700" className="map-bg" />
        {US_STATE_PATHS.map((state) => (
          <path
            key={state.id}
            d={state.d}
            className={playableSet.has(state.id) ? 'state playable' : 'state'}
          >
            <title>{state.name}</title>
          </path>
        ))}

        {rivals.map((rival) =>
          rival.defeated
            ? null
            : rival.routes.map((route) => {
                const from = cityById[route.fromCityId];
                const to = cityById[route.toCityId];
                if (!from || !to) return null;
                return (
                  <line
                    key={route.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="rival-route-line"
                    stroke={rival.color}
                    pointerEvents="none"
                  >
                    <title>{rival.name}</title>
                  </line>
                );
              }),
        )}

        {routes.map((route) => {
          const from = cityById[route.fromCityId];
          const to = cityById[route.toCityId];
          if (!from || !to) return null;
          const selected = route.id === selectedRouteId;
          return (
            <g key={route.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="route-hitbox"
                onClick={() => selectRoute(route.id)}
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={`route-line${selected ? ' selected' : ''}`}
                stroke={MODE_COLOR[route.transportMode]}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {routeDraftFromCityId && (
          <circle
            cx={cityById[routeDraftFromCityId].x}
            cy={cityById[routeDraftFromCityId].y}
            r={DEV_RADIUS[cityById[routeDraftFromCityId].dev] + 6}
            className="draft-halo"
          />
        )}

        {warehouses.map((w) => {
          const city = cityById[w.cityId];
          if (!city) return null;
          const rival = w.ownerId !== 'player' ? rivals.find((r) => r.id === w.ownerId) : undefined;
          const color = w.ownerId === 'player' ? '#8c1f1f' : rival?.color ?? '#555';
          const size = 3 + w.level * 1.4;
          const offset = DEV_RADIUS[city.dev] + 3;
          return (
            <rect
              key={w.id}
              x={city.x + offset - size / 2}
              y={city.y - offset - size / 2}
              width={size}
              height={size}
              fill={color}
              stroke="#1c1508"
              strokeWidth={0.5}
              pointerEvents="none"
            >
              <title>
                Entrepôt {w.ownerId === 'player' ? 'du joueur' : rival?.name} niveau {w.level} à {city.name}
              </title>
            </rect>
          );
        })}

        {CITIES.map((city) => {
          const isSelected = city.id === selectedCityId;
          const isHover = city.id === hoverCityId;
          const isDraftOrigin = city.id === routeDraftFromCityId;
          return (
            <g
              key={city.id}
              className="city-marker"
              onClick={() => handleCityClick(city.id)}
              onMouseEnter={() => setHoverCityId(city.id)}
              onMouseLeave={() => setHoverCityId((id) => (id === city.id ? null : id))}
            >
              <circle
                cx={city.x}
                cy={city.y}
                r={DEV_RADIUS[city.dev] + (isSelected || isDraftOrigin ? 1.5 : 0)}
                fill={SPECIALTY_COLOR[city.specialty]}
                className={`city-dot${isSelected ? ' selected' : ''}`}
              />
              {(isHover || isSelected) && (
                <text x={city.x + 8} y={city.y + 3} className="city-label">
                  {city.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {routeDraftFromCityId && (
        <div className="draft-banner">
          Choisissez une ville de destination pour prolonger la route depuis{' '}
          <strong>{cityById[routeDraftFromCityId].name}</strong> ({TRANSPORT_MODES.chariot.label}).{' '}
          <button type="button" onClick={cancelRouteDraft}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
