import { useState } from 'react';
import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { PLAYER_ID, type ContractOffer, type Contract } from '../../game/types';
import { money } from '../../game/format';
import { describeTeamSituation, statusLabel } from '../../game/career/contracts';
import { marketValue, overall } from '../../game/people';
import { TeamCar, TeamLogo } from '../ui/media';

const ACHIEVEMENTS: Record<string, string> = { 'first-win': '🏆 Première victoire', 'first-podium': '🍾 Premier podium' };

export function Career() {
  const g = useGame((s) => s.game!);
  const p = g.player;
  const c = p.contract;
  const active = g.offers.filter((o) => o.state === 'open' || o.state === 'negotiating');
  const past = g.offers.filter((o) => !(o.state === 'open' || o.state === 'negotiating')).slice(-8).reverse();
  const pp = p.penaltyPoints.filter((x) => x.season >= g.season - 1).reduce((a, x) => a + x.points, 0);
  return (
    <div className="page">
      <h1>✍️ Carrière & contrats</h1>
      <div className="grid3">
        <section className="card">
          <h2>Contrat actuel</h2>
          {c ? (
            <>
              <TeamLogo id={c.teamId} size={36} withName />
              <table className="table compact">
                <tbody>
                  <tr><td>Salaire</td><td className="num"><b>{money(c.salary)}</b> / saison</td></tr>
                  <tr><td>Fin</td><td className="num">{c.endSeason}</td></tr>
                  <tr><td>Statut</td><td className="num">{statusLabel(c.status)}</td></tr>
                  <tr><td>Prime victoire</td><td className="num">{money(c.winBonus)}</td></tr>
                  <tr><td>Prime podium</td><td className="num">{money(c.podiumBonus)}</td></tr>
                  <tr><td>Prime / point</td><td className="num">{money(c.pointBonus)}</td></tr>
                  <tr><td>Prime titre</td><td className="num">{money(c.titleBonus)}</td></tr>
                  <tr><td>Clause de sortie</td><td className="num">{c.releaseClause ? `si hors top ${c.releaseClause}` : '—'}</td></tr>
                </tbody>
              </table>
            </>
          ) : (
            <p>Aucun contrat. Attends des offres ou fais jouer ton réseau.</p>
          )}
        </section>
        <section className="card">
          <h2>Valeur sur le marché</h2>
          <div className="big-num">{money(marketValue(g, PLAYER_ID))}</div>
          <p className="small muted">Estimation de ton agent selon ta note ({overall(p.stats)}), tes résultats, ton âge et ta notoriété.</p>
          <p className="small">
            {p.staff.some((s) => s.role === 'manager') ? '💼 Ton manager négocie pour toi (meilleures offres, plus de patience des équipes).' : '💡 Engage un manager (Style de vie → Staff) pour de meilleures négociations.'}
          </p>
          <h3>Super-licence</h3>
          <p>
            Points de pénalité : <b className={pp >= 8 ? 'neg' : ''}>{pp}</b> / 12
          </p>
        </section>
        <section className="card">
          <h2>Statistiques en carrière</h2>
          <div className="stat-grid">
            {(
              [
                ['Départs', p.career.starts],
                ['Victoires', p.career.wins],
                ['Podiums', p.career.podiums],
                ['Poles', p.career.poles],
                ['Points', p.career.points],
                ['Meilleurs tours', p.career.fastestLaps],
                ['Victoires sprint', p.career.sprintWins],
                ['Abandons', p.career.dnfs],
                ['Titres', p.career.titles],
              ] as [string, number][]
            ).map(([l, v]) => (
              <div key={l} className="stat-box">
                <b>{v}</b>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div className="row wrap">
            {p.achievements.map((a) => (
              <span key={a} className="chip pos">
                {ACHIEVEMENTS[a] ?? (a.startsWith('champion') ? `👑 Champion ${a.slice(9)}` : a)}
              </span>
            ))}
          </div>
        </section>
      </div>
      <h2 className="section-title">📨 Offres en cours</h2>
      {!active.length && <div className="card muted">Aucune offre. Le mercato s’anime à partir de la 8e manche, ou si tu demandes une prolongation à ton équipe.</div>}
      {active.map((o) => (
        <OfferCard key={o.id} offer={o} />
      ))}
      {past.length > 0 && (
        <details className="card">
          <summary>Historique des offres</summary>
          {past.map((o) => (
            <div key={o.id} className="small">
              {TEAMS_BY_ID[o.teamId].name} — {money(o.salary)} × {o.years} an(s) — <b>{{ accepted: 'signée', rejected: 'refusée', expired: 'expirée', withdrawn: 'retirée', open: '', negotiating: '' }[o.state]}</b>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function OfferCard({ offer }: { offer: ContractOffer }) {
  const g = useGame((s) => s.game!);
  const negotiate = useGame((s) => s.negotiate);
  const accept = useGame((s) => s.acceptOffer);
  const reject = useGame((s) => s.rejectOffer);
  const toast = useGame((s) => s.toast);
  const t = TEAMS_BY_ID[offer.teamId];
  const [salary, setSalary] = useState(Math.round(offer.salary * 1.15));
  const [years, setYears] = useState(offer.years);
  const [status, setStatus] = useState<Contract['status']>(offer.status);
  const [winBonus, setWin] = useState(offer.winBonus);
  const [clause, setClause] = useState<number | null>(offer.releaseClause);
  const [pitch, setPitch] = useState('');
  return (
    <section className="card offer" style={{ borderColor: t.color }}>
      <div className="offer-head">
        <TeamLogo id={t.id} size={44} />
        <div>
          <h3>{t.fullName}</h3>
          <div className="small muted">
            À partir de {offer.fromSeason} · pilotes actuels : {describeTeamSituation(g, t.id)} · expire dans {Math.max(0, offer.expiresDay - g.day)} j
          </div>
        </div>
        <TeamCar id={t.id} height={50} />
      </div>
      <div className="grid2">
        <div>
          <h4>Proposition de l’équipe</h4>
          <table className="table compact">
            <tbody>
              <tr><td>Salaire</td><td className="num"><b>{money(offer.salary)}</b>/an</td></tr>
              <tr><td>Durée</td><td className="num">{offer.years} an(s)</td></tr>
              <tr><td>Statut</td><td className="num">{statusLabel(offer.status)}</td></tr>
              <tr><td>Prime victoire</td><td className="num">{money(offer.winBonus)}</td></tr>
              <tr><td>Clause de sortie</td><td className="num">{offer.releaseClause ? `hors top ${offer.releaseClause}` : '—'}</td></tr>
            </tbody>
          </table>
          <div className="patience">
            Patience de l’équipe
            <div className="bar">
              <div className="bar-fill" style={{ width: `${offer.patience}%`, background: offer.patience > 50 ? 'var(--good)' : offer.patience > 25 ? 'var(--warn)' : 'var(--bad)' }} />
            </div>
          </div>
          <div className="nego-log">
            {offer.history.map((h, i) => (
              <div key={i} className={`bubble ${h.by}`}>
                {h.text}
              </div>
            ))}
          </div>
        </div>
        <div className="form">
          <h4>Ta contre-proposition</h4>
          <label>
            Salaire annuel : <b>{money(salary)}</b>
            <input type="range" min={Math.round(offer.salary * 0.8)} max={Math.round(offer.salary * 2.2)} step={50000} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
          </label>
          <label>
            Durée
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  {y} an{y > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Statut
            <select value={status} onChange={(e) => setStatus(e.target.value as Contract['status'])}>
              <option value="first">Premier pilote</option>
              <option value="equal">Égalité de traitement</option>
              <option value="second">Second pilote</option>
            </select>
          </label>
          <label>
            Prime de victoire : <b>{money(winBonus)}</b>
            <input type="range" min={0} max={Math.max(500_000, offer.winBonus * 3)} step={10000} value={winBonus} onChange={(e) => setWin(Number(e.target.value))} />
          </label>
          <label>
            Clause de sortie
            <select value={clause ?? ''} onChange={(e) => setClause(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Aucune</option>
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  Si l’équipe est hors du top {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ton argumentaire (libre)
            <textarea rows={2} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Ex : Je crois au projet sur le long terme, mais j’ai d’autres offres…" />
          </label>
          <div className="row wrap">
            <button className="ghost" onClick={() => toast(negotiate(offer.id, { salary, years, status, winBonus, releaseClause: clause }, pitch), 'info')}>
              🤝 Négocier
            </button>
            <button className="primary" onClick={() => { accept(offer.id); toast(`Contrat signé avec ${t.name} !`, 'good'); }}>
              ✍️ Signer l’offre actuelle
            </button>
            <button className="danger" onClick={() => reject(offer.id)}>
              Refuser
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
