import { CALENDAR, raceDate } from '../../data/calendar';
import { useGame } from '../../game/store';
import { PLAYER_ID } from '../../game/types';
import { dateFr } from '../../game/format';
import { DriverName, Flag } from '../ui/media';

export function Calendar() {
  const g = useGame((s) => s.game!);
  return (
    <div className="page">
      <h1>🗓️ Calendrier {g.season}</h1>
      <div className="cal-grid">
        {CALENDAR.map((c, i) => {
          const res = g.results.find((r) => r.raceId === c.id);
          const me = res?.race.find((e) => e.driverId === PLAYER_ID);
          const winner = res?.race.find((e) => e.position === 1);
          const status = res ? 'done' : i === g.round ? 'next' : '';
          return (
            <div key={c.id} className={`cal card ${status}`}>
              <div className="row between">
                <span className="eyebrow">
                  R{i + 1} · {dateFr(raceDate(g.season, i))}
                </span>
                <span>
                  {c.sprint && <span className="chip warn">Sprint</span>}
                  {c.night && <span className="chip">🌙</span>}
                </span>
              </div>
              <h3>
                <Flag code={c.country} size={20} /> {c.short}
              </h3>
              <div className="small muted">
                {c.circuit} · {c.laps} tours
              </div>
              {res && (
                <div className="cal-res">
                  <div>
                    🏆 {winner && <DriverName id={winner.driverId} short />}
                  </div>
                  <div>
                    Moi : <b className={me?.dnf ? 'neg' : me && me.position <= 3 ? 'accent' : ''}>{me ? (me.dnf ? 'AB' : `P${me.position}`) : '—'}</b> · note {res.playerRating}
                  </div>
                </div>
              )}
              {status === 'next' && <div className="chip pos">Prochaine course</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
