import { useState } from 'react';
import { CALENDAR } from '../../data/calendar';
import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { PLAYER_ID } from '../../game/types';
import { driverStandings, teamStandings } from '../../game/standings';
import { teamOf } from '../../game/people';
import { DriverName, DriverPhoto, Flag, TeamLogo } from '../ui/media';

export function Standings() {
  const g = useGame((s) => s.game!);
  const [tab, setTab] = useState<'drivers' | 'teams' | 'history'>('drivers');
  const ds = driverStandings(g);
  const ts = teamStandings(g, g.results);
  return (
    <div className="page">
      <div className="row between">
        <h1>🏆 Classements {g.season}</h1>
        <div className="tabs">
          <button className={tab === 'drivers' ? 'on' : ''} onClick={() => setTab('drivers')}>
            Pilotes
          </button>
          <button className={tab === 'teams' ? 'on' : ''} onClick={() => setTab('teams')}>
            Constructeurs
          </button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
            Palmarès
          </button>
        </div>
      </div>
      {tab === 'drivers' && (
        <div className="card scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Pilote</th>
                <th>Écurie</th>
                {g.results.map((r) => (
                  <th key={r.raceId} title={r.raceId}>
                    <Flag code={CALENDAR.find((c) => c.id === r.raceId)!.country} size={12} />
                  </th>
                ))}
                <th>V</th>
                <th>Pod.</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((d, i) => (
                <tr key={d.driverId} className={d.driverId === PLAYER_ID ? 'me' : ''}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    <div className="row">
                      <DriverPhoto id={d.driverId} size={26} />
                      <DriverName id={d.driverId} />
                    </div>
                  </td>
                  <td>
                    <TeamLogo id={teamOf(g, d.driverId)} size={18} />
                  </td>
                  {d.results.map((r, j) => (
                    <td key={j} className={`res-cell ${r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : r === 'DNF' ? 'dnf' : typeof r === 'number' && r <= 10 ? 'pts' : ''}`}>
                      {r === null ? '' : r === 'DNF' ? 'AB' : r}
                    </td>
                  ))}
                  <td className="num">{d.wins}</td>
                  <td className="num">{d.podiums}</td>
                  <td className="num">
                    <b>{d.points}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'teams' && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Écurie</th>
                <th>Moteur</th>
                <th>Victoires</th>
                <th>Podiums</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {ts.map((t, i) => (
                <tr key={t.teamId} className={t.teamId === teamOf(g, PLAYER_ID) ? 'me' : ''}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    <TeamLogo id={t.teamId} size={24} withName />
                  </td>
                  <td className="small muted">{TEAMS_BY_ID[t.teamId].engine}</td>
                  <td className="num">{t.wins}</td>
                  <td className="num">{t.podiums}</td>
                  <td className="num">
                    <b>{t.points}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'history' && (
        <div className="card">
          <h3>Ta carrière saison par saison</h3>
          {!g.player.seasonHistory.length && <p className="muted">Ta première saison est en cours.</p>}
          <table className="table">
            <tbody>
              {g.player.seasonHistory.map((h) => (
                <tr key={h.season}>
                  <td>{h.season}</td>
                  <td>
                    <TeamLogo id={h.teamId} withName size={18} />
                  </td>
                  <td>
                    P{h.position} · {h.points} pts · {h.wins} V · {h.podiums} podiums
                  </td>
                  <td>
                    Champion : <DriverName id={h.champion} short /> · Constructeurs : {TEAMS_BY_ID[h.constructorsChampion].name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
