import { useState } from 'react';
import { ACTIVITIES, type ActivityDef } from '../../data/lifestyle';
import { CALENDAR } from '../../data/calendar';
import { DRIVERS_BY_ID } from '../../data/drivers';
import { useGame } from '../../game/store';
import { money } from '../../game/format';
import { inviteAcceptance } from '../../game/social/voice';
import { DriverName, DriverPhoto, Flag } from '../ui/media';
import { STAT_LABELS } from '../../game/init';

const CATS: { id: ActivityDef['category']; label: string }[] = [
  { id: 'training', label: '🏋️ Entraînement & travail' },
  { id: 'business', label: '🤝 Équipe & sponsors' },
  { id: 'media', label: '📣 Médias & image' },
  { id: 'social', label: '🥂 Vie sociale' },
  { id: 'loisir', label: '⛳ Loisirs' },
  { id: 'repos', label: '🛌 Repos & récupération' },
];

export function Planner() {
  const g = useGame((s) => s.game!);
  const doActivity = useGame((s) => s.doActivity);
  const restDay = useGame((s) => s.restDay);
  const skip = useGame((s) => s.skipToWeekend);
  const startWeekend = useGame((s) => s.startWeekend);
  const setScreen = useGame((s) => s.setScreen);
  const toast = useGame((s) => s.toast);
  const [guests, setGuests] = useState<Record<string, string>>({});
  const next = g.round < 24 ? CALENDAR[g.round] : null;
  const invites = Object.entries(g.flags)
    .filter(([k]) => k.startsWith('invite:'))
    .map(([k, v]) => ({ driver: k.slice(7), activity: String(v).split('|')[0], day: Number(String(v).split('|')[1]) }))
    .filter((i) => g.day - i.day < 10 && g.drivers[i.driver]);
  const drivers = Object.values(g.drivers).filter((d) => d.teamId && DRIVERS_BY_ID[d.id]);

  if (g.weekend) {
    return (
      <div className="page">
        <div className="card">
          <h2>Tu es en plein week-end de course.</h2>
          <button className="primary" onClick={() => setScreen('weekend')}>
            Retour au week-end
          </button>
        </div>
      </div>
    );
  }
  if (!next) {
    return (
      <div className="page">
        <div className="card">
          <h2>Intersaison</h2>
          <p>La saison est terminée. Rendez-vous à l’accueil pour le bilan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="card planner-head">
        <div>
          <h1>
            📅 {g.actionsLeft} jour{g.actionsLeft > 1 ? 's' : ''} avant <Flag code={next.country} size={22} /> {next.short}
          </h1>
          <p className="muted">Chaque activité occupe une journée. Gère ton énergie, ton moral et ton stress : ils influencent directement ton rythme en piste. Invite des pilotes pour construire de vraies amitiés.</p>
        </div>
        <div className="row wrap">
          <button className="ghost" disabled={g.actionsLeft <= 0} onClick={restDay}>
            🛌 Journée off
          </button>
          <button className="ghost" disabled={g.actionsLeft <= 0} onClick={skip}>
            ⏩ Se reposer jusqu’au GP
          </button>
          <button
            className="primary"
            disabled={g.actionsLeft > 0}
            onClick={() => {
              startWeekend();
              setScreen('weekend');
            }}
          >
            ✈️ Partir pour {next.city}
          </button>
        </div>
      </section>

      {invites.length > 0 && (
        <section className="card">
          <h2>💌 Invitations reçues</h2>
          <div className="row wrap">
            {invites.map((i) => {
              const act = ACTIVITIES.find((a) => a.id === i.activity);
              if (!act) return null;
              return (
                <div key={i.driver} className="invite">
                  <DriverPhoto id={i.driver} size={34} />
                  <div>
                    <DriverName id={i.driver} short /> te propose : <b>{act.emoji} {act.name}</b>
                  </div>
                  <button className="primary sm" disabled={g.actionsLeft <= 0} onClick={() => toast(doActivity(act.id, i.driver), 'good')}>
                    Accepter
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {CATS.map((cat) => (
        <section key={cat.id}>
          <h2 className="section-title">{cat.label}</h2>
          <div className="activity-grid">
            {ACTIVITIES.filter((a) => a.category === cat.id).map((a) => {
              const owns = a.requiresAsset && g.player.assets.some((x) => x.id === a.requiresAsset);
              const cost = owns ? Math.round(a.cost * 0.2) : a.cost;
              const lovers = drivers.filter((d) => DRIVERS_BY_ID[d.id].persona.likes.includes(a.id)).sort((x, y) => y.rel.friendship - x.rel.friendship);
              const guest = guests[a.id] ?? '';
              return (
                <div key={a.id} className="activity card">
                  <div className="act-head">
                    <span className="act-emoji">{a.emoji}</span>
                    <div>
                      <b>{a.name}</b>
                      <div className="small muted">{a.desc}</div>
                    </div>
                  </div>
                  <div className="effects">
                    {cost > 0 && <span className="chip">💶 {money(cost)}{owns ? ' (ton yacht)' : ''}</span>}
                    <span className={`chip ${a.energy >= 0 ? 'pos' : 'neg'}`}>⚡ {a.energy > 0 ? '+' : ''}{a.energy}</span>
                    {a.morale !== 0 && <span className={`chip ${a.morale > 0 ? 'pos' : 'neg'}`}>😊 {a.morale > 0 ? '+' : ''}{a.morale}</span>}
                    {a.stress !== 0 && <span className={`chip ${a.stress < 0 ? 'pos' : 'neg'}`}>😰 {a.stress > 0 ? '+' : ''}{a.stress}</span>}
                    {Object.keys(a.stats ?? {}).map((k) => (
                      <span key={k} className="chip pos">📈 {STAT_LABELS[k as keyof typeof STAT_LABELS]}</span>
                    ))}
                    {a.followers && <span className="chip pos">📸 abonnés</span>}
                  </div>
                  {a.invite && (
                    <select value={guest} onChange={(e) => setGuests({ ...guests, [a.id]: e.target.value })}>
                      <option value="">Seul(e)</option>
                      {lovers.length > 0 && (
                        <optgroup label="Adorent cette activité">
                          {lovers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {DRIVERS_BY_ID[d.id].firstName} {DRIVERS_BY_ID[d.id].lastName} ({Math.round(inviteAcceptance(g, d.id, a.id) * 100)} %)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Autres pilotes">
                        {drivers
                          .filter((d) => !lovers.includes(d))
                          .sort((x, y) => y.rel.friendship - x.rel.friendship)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {DRIVERS_BY_ID[d.id].firstName} {DRIVERS_BY_ID[d.id].lastName} ({Math.round(inviteAcceptance(g, d.id, a.id) * 100)} %)
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  )}
                  <button className="primary sm" disabled={g.actionsLeft <= 0 || g.player.money < cost} onClick={() => toast(doActivity(a.id, guest || null), 'info')}>
                    Faire aujourd’hui
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
