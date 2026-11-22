import { useState } from 'react';
import { COUNTRY_NAMES, DRIVERS_BY_ID } from '../../data/drivers';
import { ACTIVITIES_BY_ID } from '../../data/lifestyle';
import { useGame } from '../../game/store';
import { ageOf, identity, overall, teamOf } from '../../game/people';
import { money } from '../../game/format';
import { STAT_KEYS, STAT_LABELS } from '../../game/init';
import { Bar, DriverPhoto, Flag, RelBadge, TeamLogo } from '../ui/media';

export function Paddock() {
  const g = useGame((s) => s.game!);
  const setPhone = useGame((s) => s.setPhoneApp);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'grid' | 'free' | 'all'>('grid');
  const list = Object.values(g.drivers)
    .filter((d) => !d.retired && (filter === 'all' || (filter === 'grid' ? d.teamId : !d.teamId)))
    .sort((a, b) => (a.teamId ?? 'zz').localeCompare(b.teamId ?? 'zz') || overall(b.stats) - overall(a.stats));
  const d = sel ? g.drivers[sel] : null;
  const def = sel ? DRIVERS_BY_ID[sel] : null;
  const idn = sel ? identity(g, sel) : null;
  return (
    <div className="page">
      <div className="row between">
        <h1>👥 Paddock</h1>
        <div className="tabs">
          <button className={filter === 'grid' ? 'on' : ''} onClick={() => setFilter('grid')}>Titulaires</button>
          <button className={filter === 'free' ? 'on' : ''} onClick={() => setFilter('free')}>Sans volant</button>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tous</button>
        </div>
      </div>
      <div className="paddock">
        <div className="driver-cards">
          {list.map((x) => {
            const i = identity(g, x.id);
            return (
              <button key={x.id} className={`driver-card ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
                <DriverPhoto id={x.id} size={56} />
                <div className="dc-body">
                  <b>
                    <Flag code={i.nationality} /> {i.firstName} {i.lastName}
                  </b>
                  <div className="row small">
                    <TeamLogo id={x.teamId} size={16} /> <span className="muted">#{i.number} · note {overall(x.stats)}</span>
                  </div>
                  <RelBadge value={x.rel.friendship} />
                </div>
              </button>
            );
          })}
        </div>
        {d && idn && (
          <aside className="card driver-detail">
            <div className="row">
              <DriverPhoto id={d.id} size={110} />
              <div>
                <h2>
                  {idn.firstName} {idn.lastName}
                </h2>
                <div className="muted">
                  <Flag code={idn.nationality} /> {COUNTRY_NAMES[idn.nationality] ?? idn.nationality} · {ageOf(g, d.id)} ans · #{idn.number}
                </div>
                <div className="row">
                  <TeamLogo id={teamOf(g, d.id)} size={22} withName />
                </div>
                {d.contract && (
                  <div className="small muted">
                    Contrat jusqu’en {d.contract.endSeason} · ~{money(d.contract.salary)}/an
                  </div>
                )}
              </div>
            </div>
            {def && <p className="bio">{def.persona.bio}</p>}
            {def && (
              <>
                <div className="row wrap">
                  {def.persona.interests.map((x) => (
                    <span key={x} className="chip">
                      {x}
                    </span>
                  ))}
                </div>
                <p className="small">
                  Aime : {def.persona.likes.map((a) => ACTIVITIES_BY_ID[a]?.emoji + ' ' + (ACTIVITIES_BY_ID[a]?.name ?? a)).join(' · ')}
                </p>
                <p className="small muted">
                  « {def.persona.catchphrases.join(' » · « ')} »
                </p>
                <div className="traits">
                  <Bar label="Humour" value={def.persona.traits.humor} />
                  <Bar label="Agressivité" value={def.persona.traits.aggression} />
                  <Bar label="Ego" value={def.persona.traits.ego} />
                  <Bar label="Chaleur" value={def.persona.traits.warmth} />
                  <Bar label="Tempérament" value={def.persona.traits.temper} />
                </div>
              </>
            )}
            <h3>Ta relation</h3>
            <Bar label="Amitié" value={(d.rel.friendship + 100) / 2} color={d.rel.friendship >= 0 ? 'var(--good)' : 'var(--bad)'} right={Math.round(d.rel.friendship)} />
            <Bar label="Respect" value={d.rel.respect} right={Math.round(d.rel.respect)} />
            <Bar label="Rivalité" value={d.rel.rivalry} color="var(--bad)" right={Math.round(d.rel.rivalry)} />
            <h3>Attributs (note {overall(d.stats)})</h3>
            {STAT_KEYS.map((k) => (
              <Bar key={k} label={STAT_LABELS[k]} value={d.stats[k]} right={Math.round(d.stats[k])} />
            ))}
            {def && (
              <button className="primary" onClick={() => setPhone('messages', d.id)}>
                💬 Envoyer un message
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
