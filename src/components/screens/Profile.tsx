import { useState } from 'react';
import { COUNTRY_NAMES } from '../../data/drivers';
import { useGame } from '../../game/store';
import { PLAYER_ID } from '../../game/types';
import { compact } from '../../game/format';
import { overall } from '../../game/people';
import { STAT_KEYS, STAT_LABELS, BACKGROUNDS } from '../../game/init';
import { Bar, DriverPhoto, Flag, Helmet } from '../ui/media';
import { resizeImage } from '../ui/image';

export function Profile() {
  const g = useGame((s) => s.game!);
  const p = g.player;
  const [partner, setPartner] = useState('');
  const mutate = useGame.setState;
  const update = (fn: (pl: typeof p) => void) => {
    const game = structuredClone(useGame.getState().game!);
    fn(game.player);
    mutate({ game });
  };
  return (
    <div className="page">
      <div className="grid2">
        <section className="card profile-card" style={{ borderColor: p.helmet.primary }}>
          <div className="row">
            <DriverPhoto id={PLAYER_ID} size={140} />
            <div>
              <h1>
                {p.firstName} {p.lastName}
              </h1>
              <div className="muted">
                <Flag code={p.nationality} /> {COUNTRY_NAMES[p.nationality]} · {g.season - p.birthYear} ans · #{p.number} · {p.code}
              </div>
              <div className="muted small">{BACKGROUNDS[p.background].name}</div>
              <div className="big-num">{overall(p.stats)}</div>
              <div className="row wrap">
                <label className="btn sm">
                  📷 Changer de photo
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const url = await resizeImage(f); update((pl) => { pl.photo = url; }); } }} />
                </label>
                {p.photo && <button className="ghost sm" onClick={() => update((pl) => { pl.photo = null; })}>Utiliser le casque</button>}
              </div>
            </div>
          </div>
          <div className="row">
            <Helmet primary={p.helmet.primary} secondary={p.helmet.secondary} size={110} number={p.number} />
            <div className="form">
              <label>Casque — couleur 1<input type="color" value={p.helmet.primary} onChange={(e) => update((pl) => { pl.helmet.primary = e.target.value; })} /></label>
              <label>Casque — couleur 2<input type="color" value={p.helmet.secondary} onChange={(e) => update((pl) => { pl.helmet.secondary = e.target.value; })} /></label>
            </div>
          </div>
        </section>
        <section className="card">
          <h2>État physique & mental</h2>
          <Bar label="⚡ Énergie" value={p.energy} right={Math.round(p.energy)} color="var(--good)" />
          <Bar label="😊 Moral" value={p.morale} right={Math.round(p.morale)} color="#ffd400" />
          <Bar label="😰 Stress" value={p.stress} right={Math.round(p.stress)} color="var(--bad)" />
          <p className="small muted">L’énergie, le moral et le stress modifient ta forme en piste (rythme et risque d’erreur).</p>
          <h2>Image publique</h2>
          <Bar label="Sympathie" value={p.image.likeability} right={Math.round(p.image.likeability)} color="var(--good)" />
          <Bar label="Professionnalisme" value={p.image.professionalism} right={Math.round(p.image.professionalism)} />
          <Bar label="Polémique" value={p.image.controversy} right={Math.round(p.image.controversy)} color="var(--bad)" />
          <p>📸 {compact(p.followers)} abonnés</p>
          <h2>Vie privée</h2>
          {p.partner ? (
            <>
              <Bar label={`❤️ ${p.partner.name}`} value={p.partner.affection} right={Math.round(p.partner.affection)} color="#ff5c8a" />
              <p className="small muted">Le temps en famille, les vacances et les cadeaux entretiennent la relation. Une relation négligée pèse sur ton moral.</p>
              <div className="row wrap">
                <button className="ghost sm" disabled={p.money < 50_000} onClick={() => update((pl) => { pl.money -= 50_000; pl.partner!.affection = Math.min(100, pl.partner!.affection + 15); pl.morale = Math.min(100, pl.morale + 4); })}>
                  🎁 Offrir un cadeau (50 k€)
                </button>
                <button className="ghost sm" onClick={() => update((pl) => { pl.partner = null; pl.morale = Math.max(0, pl.morale - 15); })}>
                  💔 Rompre
                </button>
              </div>
            </>
          ) : (
            <div className="row">
              <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Prénom de ton/ta partenaire" />
              <button className="ghost sm" disabled={!partner.trim()} onClick={() => update((pl) => { pl.partner = { name: partner.trim(), affection: 70 }; pl.morale = Math.min(100, pl.morale + 6); })}>
                En couple
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="card">
        <h2>Attributs de pilotage</h2>
        <div className="stats-2col">
          {STAT_KEYS.map((k) => (
            <div key={k}>
              <Bar label={STAT_LABELS[k]} value={p.stats[k]} right={p.stats[k]} />
              <div className="xp">
                <div style={{ width: `${Math.round((p.xp[k] ?? 0) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="small muted">Les attributs progressent avec l’expérience en course, les essais, l’entraînement, le simulateur et ton staff (coach, préparateur). La progression ralentit avec l’âge et le niveau.</p>
      </section>
    </div>
  );
}
