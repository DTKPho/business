import { useState } from 'react';
import { ASSETS, ASSETS_BY_ID, RESIDENCES, STAFF_ROLES, type AssetDef } from '../../data/lifestyle';
import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { money } from '../../game/format';
import { Flag } from '../ui/media';
import { ImageUpload, Scene, Thumb } from '../ui/scene';
import { Gallery } from '../ui/gallery';

const CATS: { id: AssetDef['category']; label: string }[] = [
  { id: 'immobilier', label: '🏠 Immobilier' },
  { id: 'voiture', label: '🏎️ Voitures' },
  { id: 'montre', label: '⌚ Montres' },
  { id: 'transport', label: '🛩️ Jets & yachts' },
  { id: 'luxe', label: '🕹️ Équipement' },
  { id: 'art', label: '🖼️ Art' },
];

export function Lifestyle() {
  const g = useGame((s) => s.game!);
  const buy = useGame((s) => s.buyAsset);
  const sell = useGame((s) => s.sellAsset);
  const setRes = useGame((s) => s.setResidence);
  const hire = useGame((s) => s.hireStaff);
  const fire = useGame((s) => s.fireStaff);
  const toast = useGame((s) => s.toast);
  const [tab, setTab] = useState<'shop' | 'owned' | 'staff' | 'home'>('shop');
  const p = g.player;
  return (
    <div className="page">
      <div className="row between">
        <h1>🛥️ Style de vie</h1>
        <div className="tabs">
          <button className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>Boutique</button>
          <button className={tab === 'owned' ? 'on' : ''} onClick={() => setTab('owned')}>Mes biens ({p.assets.length})</button>
          <button className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>Staff ({p.staff.length})</button>
          <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}>Résidence</button>
        </div>
      </div>
      {tab === 'shop' &&
        CATS.map((c) => (
          <section key={c.id}>
            <h2 className="section-title">{c.label}</h2>
            <div className="shop-grid">
              {ASSETS.filter((a) => a.category === c.id).map((a) => {
                const owned = p.assets.filter((x) => x.id === a.id).length;
                return (
                  <div key={a.id} className="card shop-item">
                    <Thumb imageKey={`shop:${a.id}`} fallback={a.emoji} alt={a.name} />
                    <ImageUpload imageKey={`shop:${a.id}`} label="Mettre ma photo" />
                    <b>{a.name}</b>
                    <p className="small muted">{a.desc}</p>
                    <div className="small">
                      {money(a.price)} · entretien {money(a.upkeep)}/an · prestige {a.prestige}
                    </div>
                    {a.brandConflict && <div className="small warn">Marque liée à {TEAMS_BY_ID[a.brandConflict as keyof typeof TEAMS_BY_ID]?.name}</div>}
                    <button className="primary sm" disabled={p.money < a.price} onClick={() => { buy(a.id); toast(`${a.emoji} ${a.name} acheté !`, 'good'); }}>
                      {owned ? `Acheter (déjà ${owned})` : 'Acheter'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      {tab === 'owned' && (
        <div className="shop-grid owned">
          {!p.assets.length && <div className="card muted">Tu ne possèdes encore rien. La boutique t’attend…</div>}
          {p.assets.map((a, i) => {
            const def = ASSETS_BY_ID[a.id];
            const owner = a.uid ?? `${a.id}-${i}`;
            return (
              <div key={owner} className="card shop-item">
                <Thumb imageKey={`shop:${a.id}`} fallback={def.emoji} alt={def.name} />
                <b>
                  {def.emoji} {def.name}
                </b>
                <div className="small muted">
                  Acheté {money(a.price)} · entretien {money(def.upkeep)}/an · revente ~{money(a.price * def.resale)}
                </div>
                {(def.category === 'immobilier' || def.category === 'transport' || def.category === 'voiture') && <Gallery owner={owner} title={def.category === 'immobilier' ? 'Photos de la maison' : 'Photos'} />}
                <button className="ghost sm" onClick={() => sell(i)}>
                  Vendre
                </button>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'staff' && (
        <div className="shop-grid">
          {STAFF_ROLES.map((r) => {
            const cur = p.staff.find((s) => s.role === r.role);
            return (
              <div key={r.role} className="card shop-item">
                <div className="shop-emoji">{r.emoji}</div>
                <b>{r.name}</b>
                <p className="small muted">{r.desc}</p>
                {cur ? (
                  <>
                    <div className="small">
                      <b>{cur.name}</b> · niveau {'★'.repeat(cur.level)} · {money(cur.salary)}/an
                    </div>
                    <button className="ghost sm" onClick={() => fire(cur.id)}>Licencier</button>
                  </>
                ) : null}
                <div className="row wrap">
                  {[1, 3, 5].map((lvl) => (
                    <button key={lvl} className="ghost sm" onClick={() => hire(r.role, lvl)}>
                      {'★'.repeat(lvl)} {money(Math.round(r.baseSalary * (0.6 + lvl * 0.4)))}/an
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'home' && (
        <>
        <Scene imageKey={`residence:${p.residence}`} fallback="linear-gradient(120deg, #3d300f, #0e0c08 70%)" upload="Photo de ma résidence" overlay={0.35} className="residence-hero">
          <div className="eyebrow">Résidence principale</div>
          <h1>
            <Flag code={RESIDENCES.find((r) => r.id === p.residence)!.flag} size={26} /> {RESIDENCES.find((r) => r.id === p.residence)!.name}
          </h1>
          <p className="small">{RESIDENCES.find((r) => r.id === p.residence)!.desc}</p>
        </Scene>
        <section className="card">
          <Gallery owner={`residence-${p.residence}`} title="Photos de chez moi" />
        </section>
        <section className="card">
          <h2>Résidence fiscale</h2>
          <p className="muted small">Déménager coûte 50 k€. Le taux d’imposition s’applique à ton salaire, tes primes et tes sponsors.</p>
          <div className="cards small">
            {RESIDENCES.map((r) => (
              <button key={r.id} className={`pick ${p.residence === r.id ? 'on' : ''}`} onClick={() => setRes(r.id)}>
                <b>
                  <Flag code={r.flag} /> {r.name}
                </b>
                <div className="small">{r.desc}</div>
                <div className="small muted">Impôt {Math.round(r.taxRate * 100)} % · vie {money(r.livingCost)}/an</div>
              </button>
            ))}
          </div>
        </section>
        </>
      )}
    </div>
  );
}
