import { TEAMS, TEAMS_BY_ID } from '../../data/teams';
import { CALENDAR } from '../../data/calendar';
import { useGame } from '../../game/store';
import { PLAYER_ID, type TeamState } from '../../game/types';
import { overall, statsOf, teamDrivers, teamOf, teammateOf } from '../../game/people';
import { carScore } from '../../game/sim/pace';
import { driverStandings } from '../../game/standings';
import { Bar, DriverName, DriverPhoto, Flag, TeamCar, TeamLogo } from '../ui/media';
import { STAT_KEYS, STAT_LABELS } from '../../game/init';
import { Scene } from '../ui/scene';
import { teamFallback } from '../ui/backgrounds';

export function Team() {
  const g = useGame((s) => s.game!);
  const setFocus = useGame((s) => s.setDevFocus);
  const meeting = useGame((s) => s.requestTeamMeeting);
  const setPhone = useGame((s) => s.setPhoneApp);
  const toast = useGame((s) => s.toast);
  const tid = teamOf(g, PLAYER_ID);
  if (!tid) return <div className="page card">Sans écurie actuellement.</div>;
  const t = TEAMS_BY_ID[tid];
  const ts = g.teams[tid];
  const mate = teammateOf(g, PLAYER_ID);
  const st = driverStandings(g);
  const pos = (id: string) => st.findIndex((d) => d.driverId === id) + 1;
  const pts = (id: string) => st.find((d) => d.driverId === id)?.points ?? 0;
  const c = CALENDAR[Math.min(23, g.round)];
  const ranking = TEAMS.map((x) => ({ id: x.id, v: carScore(g.teams[x.id], c) })).sort((a, b) => b.v - a.v);
  // Duel en qualif / course
  let qWins = 0;
  let rWins = 0;
  for (const r of g.results) {
    if (!mate) break;
    const mq = r.quali.find((e) => e.driverId === PLAYER_ID)?.position ?? 99;
    const tq = r.quali.find((e) => e.driverId === mate)?.position ?? 99;
    if (mq < tq) qWins++;
    const mr = r.race.find((e) => e.driverId === PLAYER_ID);
    const tr = r.race.find((e) => e.driverId === mate);
    if (mr && tr && (mr.position || 99) < (tr.position || 99)) rWins++;
  }
  const focusOpts: [TeamState['devFocus'], string][] = [
    ['balanced', '⚖️ Équilibré'],
    ['aero', '🌀 Aérodynamique'],
    ['power', '⚡ Unité de puissance'],
    ['chassis', '🔩 Châssis & méca'],
    ['reliability', '🛡️ Fiabilité'],
  ];
  return (
    <div className="page">
      <Scene imageKey={`team:${tid}`} fallback={teamFallback(tid)} className="team-hero" style={{ borderColor: t.color }} upload="Image de l’équipe" overlay={0.45}>
        <div className="row">
          <TeamLogo id={tid} size={64} />
          <div>
            <h1>{t.fullName}</h1>
            <div className="muted">
              {t.principalTitle} : <b>{t.principal}</b> · Moteur {t.engine} · {t.base} · Titres : {t.titles.drivers} pilotes / {t.titles.constructors} constructeurs
            </div>
            <p className="small">{t.personality}</p>
          </div>
        </div>
        <TeamCar id={tid} height={110} />
      </Scene>
      <div className="grid3">
        <section className="card">
          <h2>🏎️ Voiture</h2>
          <Bar label="Aéro" value={ts.car.aero} right={ts.car.aero.toFixed(1)} />
          <Bar label="Moteur" value={ts.car.power} right={ts.car.power.toFixed(1)} />
          <Bar label="Châssis" value={ts.car.chassis} right={ts.car.chassis.toFixed(1)} />
          <Bar label="Fiabilité" value={ts.car.reliability} right={ts.car.reliability.toFixed(1)} />
          <p className="small muted">
            Hiérarchie estimée à <Flag code={c.country} size={12} /> {c.short} : {ranking.findIndex((x) => x.id === tid) + 1}e force sur 11.
          </p>
          <h3>Priorité de développement</h3>
          <div className="row wrap">
            {focusOpts.map(([f, l]) => (
              <button key={f} className={ts.devFocus === f ? 'primary sm' : 'ghost sm'} onClick={() => setFocus(f)}>
                {l}
              </button>
            ))}
          </div>
          <p className="small muted">Ton retour technique influence la vitesse de développement. Le simulateur et les réunions ingénieurs aident aussi.</p>
        </section>
        <section className="card">
          <h2>🤝 Relation avec l’équipe</h2>
          <Bar label="Confiance" value={ts.trust} color={ts.trust > 60 ? 'var(--good)' : ts.trust < 35 ? 'var(--bad)' : 'var(--warn)'} right={Math.round(ts.trust)} />
          <p className="small muted">La confiance monte avec les résultats au-dessus des attentes, le travail à l’usine et le respect des consignes. Elle chute si tu critiques l’équipe publiquement ou désobéis.</p>
          <div className="col">
            <button className="ghost" onClick={() => { meeting('status'); toast(`Réunion demandée avec ${t.principal}.`); }}>
              🗣️ Demander un meilleur statut
            </button>
            <button className="ghost" onClick={() => { meeting('car'); toast('Point technique demandé.'); }}>
              🔧 Faire un point technique
            </button>
            <button className="ghost" onClick={() => { meeting('contract'); toast('Discussion contrat demandée.'); }}>
              ✍️ Parler de mon contrat
            </button>
            <button className="primary" onClick={() => setPhone('messages', `tp:${tid}`)}>
              💬 Écrire à {t.principal}
            </button>
          </div>
        </section>
        <section className="card">
          <h2>⚔️ Duel interne</h2>
          {mate ? (
            <>
              <div className="duel">
                <div>
                  <DriverPhoto id={PLAYER_ID} size={64} />
                  <DriverName id={PLAYER_ID} short />
                  <div className="big-num">{pts(PLAYER_ID)}</div>
                  <div className="small muted">P{pos(PLAYER_ID)} au général</div>
                </div>
                <div className="vs">VS</div>
                <div>
                  <DriverPhoto id={mate} size={64} />
                  <DriverName id={mate} short />
                  <div className="big-num">{pts(mate)}</div>
                  <div className="small muted">P{pos(mate)} au général</div>
                </div>
              </div>
              <p>
                Qualifs : <b>{qWins}</b> – {g.results.length - qWins} · Courses : <b>{rWins}</b> – {g.results.length - rWins}
              </p>
              {STAT_KEYS.slice(0, 6).map((k) => (
                <div key={k} className="cmp">
                  <span className="num">{g.player.stats[k]}</span>
                  <span className="small muted">{STAT_LABELS[k]}</span>
                  <span className="num">{Math.round(statsOf(g, mate)[k])}</span>
                </div>
              ))}
              <p className="small">
                Note : {overall(g.player.stats)} vs {overall(statsOf(g, mate))}
              </p>
            </>
          ) : (
            <p className="muted">Pas de coéquipier.</p>
          )}
        </section>
      </div>
      <section className="card">
        <h2>🏁 Toutes les écuries</h2>
        <div className="teams-overview">
          {TEAMS.map((x) => (
            <div key={x.id} className="team-row" style={{ borderLeftColor: x.color }}>
              <TeamLogo id={x.id} size={28} withName />
              <span className="small muted">{x.principal}</span>
              <span className="row small">
                {teamDrivers(g, x.id).map((d) => (
                  <span key={d} className="row">
                    <DriverPhoto id={d} size={22} /> <DriverName id={d} short />
                  </span>
                ))}
              </span>
              <span className="num small">{carScore(g.teams[x.id], c).toFixed(1)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
