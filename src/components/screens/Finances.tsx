import { useMemo, useState } from 'react';
import { BRANDS_BY_ID, BUSINESSES, BUSINESSES_BY_ID, INVESTMENTS, INVESTMENTS_BY_ID, RESIDENCES_BY_ID } from '../../data/lifestyle';
import { useGame } from '../../game/store';
import { money } from '../../game/format';
import { seasonlyCosts } from '../../game/career/season';

export function Finances() {
  const g = useGame((s) => s.game!);
  const invest = useGame((s) => s.invest);
  const withdraw = useGame((s) => s.withdraw);
  const buyBusiness = useGame((s) => s.buyBusiness);
  const upgrade = useGame((s) => s.upgradeBusiness);
  const createFoundation = useGame((s) => s.createFoundation);
  const donate = useGame((s) => s.donate);
  const toast = useGame((s) => s.toast);
  const p = g.player;
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [fname, setFname] = useState('');
  const costs = seasonlyCosts(g);
  const fin = useMemo(() => {
    try {
      return JSON.parse(String(g.flags['lastFinance'] ?? '[]')) as { label: string; amount: number }[];
    } catch {
      return [];
    }
  }, [g.flags]);
  const portfolio = p.investments.reduce((a, i) => a + i.value, 0);
  const assets = p.assets.reduce((a, x) => a + x.price, 0);
  const income = (p.contract?.salary ?? 0) + p.sponsors.reduce((a, s) => a + s.perSeason, 0);
  const tax = RESIDENCES_BY_ID[p.residence].taxRate;
  return (
    <div className="page">
      <h1>💶 Finances</h1>
      <div className="grid3">
        <section className="card">
          <h2>Patrimoine</h2>
          <div className="big-num">{money(p.money + portfolio + assets)}</div>
          <div className="fin-line"><span>Liquidités</span><b>{money(p.money)}</b></div>
          <div className="fin-line"><span>Placements</span><b>{money(portfolio)}</b></div>
          <div className="fin-line"><span>Biens (prix d’achat)</span><b>{money(assets)}</b></div>
          {p.foundation && <div className="fin-line"><span>Fondation « {p.foundation.name} »</span><b>{money(p.foundation.funds)}</b></div>}
        </section>
        <section className="card">
          <h2>Revenus annuels bruts</h2>
          <div className="fin-line"><span>Salaire</span><b className="pos">{money(p.contract?.salary ?? 0)}</b></div>
          {p.sponsors.map((s) => (
            <div key={s.id} className="fin-line">
              <span>
                {BRANDS_BY_ID[s.brandId].emoji} {BRANDS_BY_ID[s.brandId].name} <small className="muted">({s.done}/{s.obligations} activations, fin {s.endSeason})</small>
              </span>
              <b className="pos">{money(s.perSeason)}</b>
            </div>
          ))}
          <div className="fin-line total"><span>Total</span><b>{money(income)}</b></div>
          <p className="small muted">Impôt ({RESIDENCES_BY_ID[p.residence].name}) : {Math.round(tax * 100)} % · Les primes (points, podiums, victoires) s’ajoutent course par course.</p>
        </section>
        <section className="card">
          <h2>Dépenses annuelles</h2>
          {costs.map((c, i) => (
            <div key={i} className="fin-line"><span>{c.label}</span><b className="neg">{money(c.amount)}</b></div>
          ))}
          <div className="fin-line total"><span>Total</span><b>{money(costs.reduce((a, c) => a + c.amount, 0))}</b></div>
        </section>
      </div>
      {fin.length > 0 && (
        <section className="card">
          <h2>Dernier week-end</h2>
          <div className="grid2">
            <div>
              {fin.map((l, i) => (
                <div key={i} className="fin-line"><span>{l.label}</span><b className={l.amount >= 0 ? 'pos' : 'neg'}>{money(l.amount)}</b></div>
              ))}
            </div>
          </div>
        </section>
      )}
      <div className="grid2">
        <section className="card">
          <h2>💹 Placements</h2>
          {INVESTMENTS.map((i) => {
            const own = p.investments.find((x) => x.id === i.id);
            return (
              <div key={i.id} className="invest">
                <div>
                  <b>{i.emoji} {i.name}</b>
                  <div className="small muted">{i.desc}</div>
                  {own && (
                    <div className="small">
                      Investi {money(own.amount)} → <b className={own.value >= own.amount ? 'pos' : 'neg'}>{money(own.value)}</b>
                    </div>
                  )}
                </div>
                <div className="row">
                  <select value={amounts[i.id] ?? 100000} onChange={(e) => setAmounts({ ...amounts, [i.id]: Number(e.target.value) })}>
                    {[50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000].map((v) => (
                      <option key={v} value={v}>{money(v)}</option>
                    ))}
                  </select>
                  <button className="primary sm" disabled={p.money < (amounts[i.id] ?? 100000)} onClick={() => invest(i.id, amounts[i.id] ?? 100000)}>Investir</button>
                  {own && <button className="ghost sm" onClick={() => withdraw(i.id)}>Retirer</button>}
                </div>
              </div>
            );
          })}
          <p className="small muted">Les placements évoluent après chaque Grand Prix.</p>
        </section>
        <section className="card">
          <h2>🏢 Entreprises</h2>
          {BUSINESSES.map((b) => {
            const own = p.businesses.find((x) => x.id === b.id);
            return (
              <div key={b.id} className="invest">
                <div>
                  <b>{b.emoji} {b.name}</b> {own && <span className="chip pos">Niveau {own.level}</span>}
                  <div className="small muted">{b.desc}</div>
                  <div className="small">Revenu estimé : ~{money(b.income * (own?.level ?? 1))}/saison · risque {Math.round(b.risk * 100)} %</div>
                </div>
                {own ? (
                  <button className="ghost sm" disabled={own.level >= 5 || p.money < BUSINESSES_BY_ID[b.id].upgradeCost * own.level} onClick={() => upgrade(b.id)}>
                    Développer ({money(b.upgradeCost * own.level)})
                  </button>
                ) : (
                  <button className="primary sm" disabled={p.money < b.cost} onClick={() => buyBusiness(b.id)}>
                    Lancer ({money(b.cost)})
                  </button>
                )}
              </div>
            );
          })}
          <h3>🎗️ Fondation caritative</h3>
          {p.foundation ? (
            <div className="row">
              <span>« {p.foundation.name} » · {money(p.foundation.funds)}</span>
              <button className="ghost sm" disabled={p.money < 250_000} onClick={() => { donate(250_000); toast('Don de 250 k€ effectué 🙏', 'good'); }}>
                Donner 250 k€
              </button>
            </div>
          ) : (
            <div className="row">
              <input value={fname} onChange={(e) => setFname(e.target.value)} placeholder="Nom de ta fondation" />
              <button className="primary sm" disabled={!fname.trim() || p.money < 500_000} onClick={() => createFoundation(fname.trim())}>
                Créer (500 k€)
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export { INVESTMENTS_BY_ID };
