import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { PLAYER_ID } from '../../game/types';
import { driverStandings, teamStandings } from '../../game/standings';
import { money } from '../../game/format';
import { teamOf } from '../../game/people';
import { DriverName, DriverPhoto, TeamLogo } from '../ui/media';

export function SeasonEnd() {
  const g = useGame((s) => s.game!);
  const next = useGame((s) => s.nextSeason);
  const setScreen = useGame((s) => s.setScreen);
  const ds = driverStandings(g, g.results);
  const ts = teamStandings(g, g.results);
  const me = ds.findIndex((d) => d.driverId === PLAYER_ID) + 1;
  const champ = ds[0];
  const signed = g.offers.find((o) => o.state === 'accepted' && o.fromSeason === g.season + 1);
  const hasSeat = signed || (g.player.contract && g.player.contract.endSeason > g.season);
  const open = g.offers.filter((o) => o.state === 'open' || o.state === 'negotiating');
  return (
    <div className="page">
      <section className="card season-end">
        <div className="eyebrow">Fin de la saison {g.season}</div>
        <h1>{champ?.driverId === PLAYER_ID ? '👑 CHAMPION DU MONDE !' : `Tu termines P${me} du championnat`}</h1>
        <div className="podium">
          {[1, 0, 2].map((i) =>
            ds[i] ? (
              <div key={i} className={`podium-step p${i + 1}`}>
                <DriverPhoto id={ds[i].driverId} size={i === 0 ? 96 : 72} />
                <DriverName id={ds[i].driverId} short />
                <b>{ds[i].points} pts</b>
                <div className="step">{i + 1}</div>
              </div>
            ) : null,
          )}
        </div>
        <p>
          Champion constructeurs : <TeamLogo id={ts[0].teamId} withName size={22} /> ({ts[0].points} pts)
        </p>
      </section>
      <div className="grid2">
        <section className="card">
          <h2>Ton avenir</h2>
          {hasSeat ? (
            <p>
              ✅ Tu as un baquet pour {g.season + 1} : <TeamLogo id={signed?.teamId ?? teamOf(g, PLAYER_ID)} withName size={22} />
            </p>
          ) : (
            <>
              <p className="neg">⚠️ Tu n’as pas encore de contrat pour {g.season + 1} !</p>
              {open.map((o) => (
                <div key={o.id} className="row">
                  <TeamLogo id={o.teamId} withName size={22} /> {money(o.salary)}/an
                </div>
              ))}
              <button className="primary" onClick={() => setScreen('career')}>
                Voir les offres
              </button>
            </>
          )}
          <button className="primary big" onClick={next}>
            🗓️ Passer à la saison {g.season + 1}
          </button>
          {!hasSeat && <p className="small muted">Sans contrat signé, tu seras sans volant et devras attendre une opportunité.</p>}
        </section>
        <section className="card">
          <h2>Classement final</h2>
          <table className="table compact">
            <tbody>
              {ds.slice(0, 12).map((d, i) => (
                <tr key={d.driverId} className={d.driverId === PLAYER_ID ? 'me' : ''}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    <DriverName id={d.driverId} />
                  </td>
                  <td>{d.teamId && <TeamLogo id={d.teamId} size={16} />}</td>
                  <td className="num">{d.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">{TEAMS_BY_ID[ts[0].teamId].principal} soulève le trophée constructeurs.</p>
        </section>
      </div>
    </div>
  );
}
