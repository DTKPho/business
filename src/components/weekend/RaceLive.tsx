import { useEffect, useState } from 'react';
import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { PLAYER_ID, type PaceMode, type TyreCompound } from '../../game/types';
import { identity, lastNameOf } from '../../game/people';
import { lapTime } from '../../game/format';
import { TYRE_INFO } from '../../game/sim/pace';
import { TyreDot } from '../ui/media';
import { Battles, Commentary, HighlightBanner, IntensityMeter, PositionChart } from './Broadcast';

const SPEEDS = [
  { label: '⏸', ms: 0 },
  { label: '▶ x1', ms: 1600 },
  { label: '▶▶ x3', ms: 550 },
  { label: '▶▶▶ x8', ms: 200 },
];

export function RaceLive() {
  const g = useGame((s) => s.game!);
  const tick = useGame((s) => s.raceTick);
  const toEnd = useGame((s) => s.raceToEnd);
  const setMode = useGame((s) => s.setPaceMode);
  const setBoost = useGame((s) => s.setBoost);
  const pit = useGame((s) => s.requestPit);
  const answer = useGame((s) => s.answerTeamOrder);
  const complete = useGame((s) => s.completeRaceSession);
  const auto = g.weekend!.auto;
  const setAuto = useGame((s) => s.setAuto);
  const [speed, setSpeed] = useState(auto?.on ? 2 : 1);
  const r = g.weekend!.race!;

  // Minuterie adaptative : en mode TV, ça accélère quand c'est calme et ralentit sur les moments chauds
  useEffect(() => {
    const base = SPEEDS[speed].ms;
    if (!base || r.finished || r.decision) return;
    let delay = base;
    if (auto?.on) {
      const i = r.intensity ?? 0;
      const left = r.totalLaps - r.lap;
      const factor = i >= 7 || left <= 2 ? 2.6 : i >= 4 ? 1.5 : i >= 2 ? 0.9 : 0.4;
      delay = Math.max(120, base * factor);
    }
    const id = setTimeout(tick, delay);
    return () => clearTimeout(id);
  }, [speed, r.finished, r.decision, r.lap, r.intensity, r.totalLaps, auto?.on, tick]);

  const order = [...r.cars].sort((a, b) => a.pos - b.pos);
  const leader = order.find((c) => c.status !== 'out');
  const me = r.cars.find((c) => c.driverId === PLAYER_ID);
  const ahead = me ? order.find((c) => c.pos === me.pos - 1 && c.status !== 'out') : null;
  const behind = me ? order.find((c) => c.pos === me.pos + 1 && c.status !== 'out') : null;
  const order2 = r.teamOrder && !r.teamOrder.answered ? r.teamOrder : null;

  return (
    <div className="race">
      <div className="race-bar card">
        <div className="lap">
          TOUR <b>{Math.min(r.lap, r.totalLaps)}</b>/{r.totalLaps}
        </div>
        <div className={`flag-state ${r.safetyCar}`}>{r.safetyCar === 'sc' ? '🟨 SAFETY CAR' : r.safetyCar === 'vsc' ? '🟨 VSC' : r.finished ? '🏁 ARRIVÉE' : '🟩 PISTE LIBRE'}</div>
        <div className="small">
          {r.weather.rain > 0.6 ? '🌧️ Forte pluie' : r.weather.rain > 0.2 ? '🌦️ Piste humide' : '☀️ Sec'} · piste {r.weather.trackTemp}°C
        </div>
        <div className="row">
          {SPEEDS.map((s, i) => (
            <button key={s.label} className={speed === i ? 'primary sm' : 'ghost sm'} disabled={r.finished} onClick={() => setSpeed(i)}>
              {s.label}
            </button>
          ))}
          <button className="ghost sm" disabled={r.finished} onClick={tick}>
            +1 tour
          </button>
          <button className="ghost sm" disabled={r.finished} onClick={toEnd} title="Résultat immédiat (l’IA gère tes arrêts) — s’arrête aux décisions">
            ⏭ Fin
          </button>
          <button className={auto?.on ? 'primary sm' : 'ghost sm'} disabled={r.finished} onClick={() => setAuto({ on: !auto?.on })} title="Le pilote automatique gère ta course, la réalisation TV ralentit sur les moments forts">
            {auto?.on ? '🎬 Mode TV (auto)' : '🎮 Je pilote'}
          </button>
          <IntensityMeter r={r} />
        </div>
      </div>

      <HighlightBanner r={r} />
      <Battles r={r} />
      <div className="race-grid">
        <div className="card tower">
          <table className="table tower-table">
            <thead>
              <tr>
                <th>P</th>
                <th>Pilote</th>
                <th>Écart</th>
                <th>Int.</th>
                <th>Pneu</th>
                <th>Dernier</th>
              </tr>
            </thead>
            <tbody>
              {order.map((c) => {
                const team = TEAMS_BY_ID[c.teamId];
                const idn = identity(g, c.driverId);
                const gap = leader && c.status !== 'out' ? c.totalTime - leader.totalTime : 0;
                return (
                  <tr key={c.driverId} className={`${c.driverId === PLAYER_ID ? 'me' : ''} ${c.status === 'out' ? 'out' : ''}`}>
                    <td className="pos">{c.status === 'out' ? 'AB' : c.pos}</td>
                    <td>
                      <span className="stripe" style={{ background: team.color }} />
                      <b>{idn.code}</b>
                      {c.status === 'pit' && <span className="chip warn">PIT</span>}
                      {c.penalties > 0 && <span className="chip neg">+{c.penalties}s</span>}
                      {r.fastestLap?.driverId === c.driverId && <span className="chip purple">⏱</span>}
                    </td>
                    <td className="num small">{c.status === 'out' ? <span className="neg">{c.dnf}</span> : c.pos === 1 ? 'Leader' : `+${gap.toFixed(1)}`}</td>
                    <td className="num small">{c.status === 'out' || c.pos === 1 ? '' : `+${c.gapAhead.toFixed(1)}`}</td>
                    <td>
                      {c.status !== 'out' && (
                        <span className="row">
                          <TyreDot c={c.tyre} size={16} /> <small>{c.tyreAge}</small>
                        </span>
                      )}
                    </td>
                    <td className={`num small ${r.fastestLap?.driverId === c.driverId && r.fastestLap.time === c.lastLap ? 'purple' : ''}`}>{c.lastLap ? lapTime(c.lastLap) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="race-side">
          {me && (
            <div className="card cockpit">
              {me.status === 'out' ? (
                <h2 className="neg">Abandon : {me.dnf}</h2>
              ) : (
                <>
                  <div className="cockpit-top">
                    <div className="big-num">P{me.pos}</div>
                    <div className="small">
                      {ahead && (
                        <div>
                          ⬆️ {lastNameOf(g, ahead.driverId)} à <b>{me.gapAhead.toFixed(2)} s</b>
                        </div>
                      )}
                      {behind && (
                        <div>
                          ⬇️ {lastNameOf(g, behind.driverId)} à <b>{behind.gapAhead.toFixed(2)} s</b>
                        </div>
                      )}
                      <div>
                        Arrêts : {me.pits} · Composés : {me.usedCompounds.map((t) => t).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="gauges">
                    <div>
                      <span>
                        <TyreDot c={me.tyre} size={16} /> Usure {Math.round(me.tyreWear)} %
                      </span>
                      <div className="bar">
                        <div className="bar-fill" style={{ width: `${me.tyreWear}%`, background: me.tyreWear > 75 ? 'var(--bad)' : me.tyreWear > 50 ? 'var(--warn)' : 'var(--good)' }} />
                      </div>
                    </div>
                    <div>
                      <span>🔋 Batterie {Math.round(me.battery)} %</span>
                      <div className="bar">
                        <div className="bar-fill" style={{ width: `${me.battery}%`, background: '#3fa9ff' }} />
                      </div>
                    </div>
                    {me.damage > 0 && <div className="neg small">🔧 Dégâts : −{Math.round(me.damage * 100)} % de performance</div>}
                  </div>
                  <div className="modes">
                    {(
                      [
                        ['save', '🐢 Économie'],
                        ['normal', '⚖️ Normal'],
                        ['push', '🔥 Push'],
                        ['attack', '⚔️ Attaque'],
                      ] as [PaceMode, string][]
                    ).map(([m, l]) => (
                      <button key={m} className={r.playerMode === m ? 'primary sm' : 'ghost sm'} onClick={() => setMode(m)}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <button className={r.playerBoost ? 'primary' : 'ghost'} onClick={() => setBoost(!r.playerBoost)} title="Règlement 2026 : surplus d’énergie électrique pour attaquer ou défendre">
                    ⚡ Overtake mode {r.playerBoost ? 'ACTIVÉ' : 'désactivé'}
                  </button>
                  <div className="pit">
                    <b>Stand :</b>
                    {r.pendingPit ? (
                      <>
                        <span className="chip warn">
                          BOX BOX → {TYRE_INFO[r.pendingPit].name}
                        </span>
                        <button className="ghost sm" onClick={() => pit(null)}>
                          Annuler
                        </button>
                      </>
                    ) : (
                      (['S', 'M', 'H', 'I', 'W'] as TyreCompound[]).map((t) => (
                        <button key={t} className="ghost sm" onClick={() => pit(t)} title={TYRE_INFO[t].name}>
                          <TyreDot c={t} size={16} />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
              {order2 && (
                <div className="team-order">
                  <b>📻 Consigne d’équipe :</b> laisser passer {lastNameOf(g, order2.target)}.
                  <div className="row">
                    <button className="primary sm" onClick={() => answer(true)}>
                      Obéir
                    </button>
                    <button className="danger sm" onClick={() => answer(false)}>
                      Refuser
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {r.finished && (
            <div className="card">
              <button className="primary big" onClick={complete}>
                📊 Voir les résultats
              </button>
            </div>
          )}
          <Commentary r={r} />
          {me && (
            <div className="card">
              <h3>📈 Ta course</h3>
              <PositionChart positions={r.posHistory?.[PLAYER_ID] ?? []} total={r.totalLaps} startPos={me.startPos} height={100} />
            </div>
          )}
          <div className="card radio">
            <h3>📻 Radio</h3>
            {[...r.radio].reverse().slice(0, 6).map((m, i) => (
              <div key={i} className="small">
                {m}
              </div>
            ))}
            {!r.radio.length && <div className="muted small">…</div>}
          </div>
          <div className="card feed">
            <h3>Direction de course</h3>
            {[...r.events].reverse().slice(0, 14).map((e, i) => (
              <div key={i} className={`small ev ${e.involvesPlayer ? 'me' : ''} ${e.kind}`}>
                <span className="muted">T{e.lap}</span> {e.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
