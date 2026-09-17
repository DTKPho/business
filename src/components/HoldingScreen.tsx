import { useState } from 'react';
import { PLAYABLE_STATE_IDS, CITIES_BY_ID } from '../data/cities';
import { US_STATE_PATHS } from '../data/usStatePaths';
import { useGameStore } from '../game/store';
import { AGENT_MIN_ROUTES, AGENT_RULE_LABELS } from '../game/agents';
import type { AgentRule } from '../game/types';
import { formatMoneyPrecise } from '../game/format';

const stateNameById = Object.fromEntries(US_STATE_PATHS.map((s) => [s.id, s.name]));
const RULE_OPTIONS: AgentRule[] = ['taux_bas', 'taux_standard', 'aligner_rival'];

export function HoldingScreen() {
  const routes = useGameStore((s) => s.routes);
  const agents = useGameStore((s) => s.agents);
  const hireAgent = useGameStore((s) => s.hireAgent);
  const fireAgent = useGameStore((s) => s.fireAgent);
  const [ruleChoice, setRuleChoice] = useState<Record<string, AgentRule>>({});

  const eligible = routes.length >= AGENT_MIN_ROUTES;

  const zones = PLAYABLE_STATE_IDS.map((stateId) => {
    const zoneRoutes = routes.filter((r) => CITIES_BY_ID[r.fromCityId].stateId === stateId || CITIES_BY_ID[r.toCityId].stateId === stateId);
    const revenue = zoneRoutes.reduce((sum, r) => sum + r.lastTickRevenue, 0);
    const agent = agents.find((a) => a.stateId === stateId);
    return { stateId, routeCount: zoneRoutes.length, revenue, agent };
  }).filter((z) => z.routeCount > 0 || z.agent);

  return (
    <div className="screen">
      <p className="screen-intro">
        Passé {AGENT_MIN_ROUTES} routes actives, engagez des agents régionaux qui appliquent automatiquement une
        règle de gestion par État — libérant votre attention pour la stratégie d'ensemble. Vue d'un empire
        commercial qui grandit vers une véritable société holding.
      </p>
      {!eligible && (
        <p className="screen-intro">
          {routes.length}/{AGENT_MIN_ROUTES} routes actives — continuez à développer votre réseau pour débloquer les agents.
        </p>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Routes</th>
            <th>Revenu / tick</th>
            <th>Agent</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {zones.length === 0 && (
            <tr>
              <td colSpan={5}>Aucune zone active pour le moment — ouvrez des routes depuis la carte.</td>
            </tr>
          )}
          {zones.map((zone) => (
            <tr key={zone.stateId}>
              <td>{stateNameById[zone.stateId] ?? zone.stateId}</td>
              <td>{zone.routeCount}</td>
              <td>{formatMoneyPrecise(zone.revenue)}</td>
              <td>{zone.agent ? AGENT_RULE_LABELS[zone.agent.rule] : '—'}</td>
              <td>
                {zone.agent ? (
                  <button type="button" onClick={() => fireAgent(zone.agent!.id)}>
                    Renvoyer
                  </button>
                ) : eligible ? (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <select
                      value={ruleChoice[zone.stateId] ?? 'taux_standard'}
                      onChange={(e) => setRuleChoice((prev) => ({ ...prev, [zone.stateId]: e.target.value as AgentRule }))}
                    >
                      {RULE_OPTIONS.map((rule) => (
                        <option key={rule} value={rule}>
                          {AGENT_RULE_LABELS[rule]}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => hireAgent(zone.stateId, ruleChoice[zone.stateId] ?? 'taux_standard')}>
                      Engager
                    </button>
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
