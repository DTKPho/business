import { CALENDAR, raceDate } from '../../data/calendar';
import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { PLAYER_ID } from '../../game/types';
import { dateFr, money } from '../../game/format';
import { driverStandings } from '../../game/standings';
import { teamOf, teammateOf } from '../../game/people';
import { Bar, DriverName, DriverPhoto, Flag, TeamCar, TeamLogo } from '../ui/media';
import { statusLabel } from '../../game/career/contracts';
import { Scene } from '../ui/scene';
import { circuitFallback, teamFallback } from '../ui/backgrounds';

export function CircuitProfile({ id }: { id: string }) {
  const c = CALENDAR.find((x) => x.id === id)!;
  return (
    <div className="circuit-profile">
      <Bar label="Moteur" value={c.powerSens * 100} color="#ff8a00" />
      <Bar label="Appui aéro" value={c.aeroSens * 100} color="#3fa9ff" />
      <Bar label="Dépassement" value={c.overtaking * 100} color="#2fd17a" />
      <Bar label="Usure pneus" value={c.tyreStress * 100} color="#ff4d4d" />
      <Bar label="Risque pluie" value={c.rainChance * 100} color="#7aa2ff" />
      <Bar label="Safety car" value={c.scChance * 100} color="#ffd400" />
    </div>
  );
}

export function Home() {
  const g = useGame((s) => s.game!);
  const setScreen = useGame((s) => s.setScreen);
  const setPhone = useGame((s) => s.setPhoneApp);
  const startWeekend = useGame((s) => s.startWeekend);
  const p = g.player;
  const next = g.round < 24 ? CALENDAR[g.round] : null;
  const team = teamOf(g, PLAYER_ID);
  const st = driverStandings(g);
  const myPos = st.findIndex((d) => d.driverId === PLAYER_ID) + 1;
  const mate = teammateOf(g, PLAYER_ID);
  const pendingItw = g.interviews.filter((i) => !i.done);
  const offers = g.offers.filter((o) => o.state === 'open' || o.state === 'negotiating');
  const unread = Object.values(g.conversations).filter((c) => c.unread > 0);
  const report = useGame((s) => s.ui.seasonReport);
  const clearReport = useGame((s) => s.clearSeasonReport);

  return (
    <div className="page home">
      {report && (
        <section className="card">
          <h2>🔁 Mercato de l’intersaison</h2>
          <div className="report">
            {report.map((r, i) => (
              <div key={i} className="small">
                • {r}
              </div>
            ))}
          </div>
          <button className="ghost sm" onClick={clearReport}>
            Fermer
          </button>
        </section>
      )}
      {next && (
        <Scene imageKey={team ? `team:${team}` : null} fallback={team ? teamFallback(team) : circuitFallback(next.id)} className="hero-gp" style={{ borderColor: team ? TEAMS_BY_ID[team].color : undefined }} upload="Image de fond de l’équipe" overlay={0.5}>
          <div className="hero-left">
            <div className="eyebrow">
              Manche {g.round + 1}/24 {next.sprint && <span className="chip warn">SPRINT</span>} {next.night && <span className="chip">🌙 De nuit</span>} {next.street && <span className="chip">🏙️ Urbain</span>}
            </div>
            <h1>
              <Flag code={next.country} size={30} /> {next.name}
            </h1>
            <div className="muted">
              {next.circuit} · {next.laps} tours · {next.lengthKm} km · course le {dateFr(raceDate(g.season, g.round))}
            </div>
            <p>{next.description}</p>
            <p className="small muted">🌃 {next.nightlife}</p>
            <div className="row wrap">
              {g.weekend ? (
                <button className="primary big" onClick={() => setScreen('weekend')}>
                  🏁 Reprendre le week-end
                </button>
              ) : g.actionsLeft > 0 ? (
                <>
                  <button className="primary big" onClick={() => setScreen('planner')}>
                    📅 Organiser mes {g.actionsLeft} jours libres
                  </button>
                </>
              ) : (
                <button
                  className="primary big"
                  onClick={() => {
                    startWeekend();
                    setScreen('weekend');
                  }}
                >
                  ✈️ Partir pour {next.city}
                </button>
              )}
            </div>
          </div>
          <div className="hero-right">
            {team && <TeamCar id={team} height={90} />}
            <CircuitProfile id={next.id} />
          </div>
        </Scene>
      )}

      <div className="grid3">
        <section className="card">
          <h2>🏆 Championnat</h2>
          <table className="table compact">
            <tbody>
              {st.slice(0, 6).map((d, i) => (
                <tr key={d.driverId} className={d.driverId === PLAYER_ID ? 'me' : ''}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    <DriverName id={d.driverId} />
                  </td>
                  <td>
                    <TeamLogo id={teamOf(g, d.driverId)} size={18} />
                  </td>
                  <td className="num">{d.points}</td>
                </tr>
              ))}
              {myPos > 6 && (
                <tr className="me">
                  <td className="pos">{myPos}</td>
                  <td>
                    <DriverName id={PLAYER_ID} />
                  </td>
                  <td>
                    <TeamLogo id={team} size={18} />
                  </td>
                  <td className="num">{st[myPos - 1]?.points ?? 0}</td>
                </tr>
              )}
            </tbody>
          </table>
          <button className="ghost sm" onClick={() => setScreen('standings')}>
            Voir tout →
          </button>
        </section>

        <section className="card">
          <h2>🛠️ Mon équipe</h2>
          {team ? (
            <>
              <div className="row">
                <TeamLogo id={team} size={40} />
                <div>
                  <b>{TEAMS_BY_ID[team].fullName}</b>
                  <div className="small muted">{TEAMS_BY_ID[team].principal}</div>
                </div>
              </div>
              <Bar label="Confiance" value={g.teams[team].trust} color={g.teams[team].trust > 60 ? 'var(--good)' : g.teams[team].trust < 35 ? 'var(--bad)' : 'var(--warn)'} right={Math.round(g.teams[team].trust)} />
              {p.contract && (
                <p className="small">
                  Contrat : <b>{money(p.contract.salary)}</b>/an jusqu’en <b>{p.contract.endSeason}</b> · {statusLabel(p.contract.status)}
                </p>
              )}
              {mate && (
                <div className="row small">
                  Coéquipier : <DriverPhoto id={mate} size={26} /> <DriverName id={mate} />
                </div>
              )}
            </>
          ) : (
            <p>Sans volant. Consulte l’onglet Carrière.</p>
          )}
        </section>

        <section className="card">
          <h2>🔔 À faire</h2>
          <ul className="todo">
            {pendingItw.map((i) => (
              <li key={i.id}>
                <button className="link" onClick={() => setScreen('news')}>
                  🎙️ Interview en attente — {i.outlet}
                </button>
              </li>
            ))}
            {offers.map((o) => (
              <li key={o.id}>
                <button className="link" onClick={() => setScreen('career')}>
                  ✍️ Offre de {TEAMS_BY_ID[o.teamId].name} ({money(o.salary)}/an)
                </button>
              </li>
            ))}
            {unread.slice(0, 4).map((c) => (
              <li key={c.id}>
                <button className="link" onClick={() => setPhone('messages', c.id)}>
                  💬 {c.unread} message(s) de {c.id.startsWith('tp:') ? TEAMS_BY_ID[c.id.slice(3) as keyof typeof TEAMS_BY_ID].principal : <DriverName id={c.id} short />}
                </button>
              </li>
            ))}
            {g.group.unread > 0 && (
              <li>
                <button className="link" onClick={() => setPhone('whatsapp')}>
                  🟢 {g.group.unread} message(s) dans le groupe des pilotes
                </button>
              </li>
            )}
            {g.mail.filter((m) => !m.read).length > 0 && (
              <li>
                <button className="link" onClick={() => setPhone('mail')}>
                  ✉️ {g.mail.filter((m) => !m.read).length} e-mail(s) non lu(s)
                </button>
              </li>
            )}
            {!pendingItw.length && !offers.length && !unread.length && !g.group.unread && <li className="muted">Rien d’urgent. Profite !</li>}
          </ul>
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>📰 Dernières nouvelles</h2>
          {g.news.slice(0, 5).map((n) => (
            <div key={n.id} className="news-line">
              <span className={`chip tag-${n.tag}`}>{n.outlet}</span> <b>{n.title}</b>
            </div>
          ))}
          {!g.news.length && <p className="muted">Le paddock est calme… pour l’instant.</p>}
        </section>
        <section className="card">
          <h2>📓 Journal</h2>
          <div className="log">
            {g.log.slice(0, 12).map((l) => (
              <div key={l.id} className={`log-line ${l.tone}`}>
                {l.text}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
