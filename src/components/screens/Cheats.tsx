import { useGame } from '../../game/store';
import { PLAYER_ID } from '../../game/types';
import { gridIds, overall, statsOf, teamOf } from '../../game/people';
import { DriverName, DriverPhoto, TeamLogo } from '../ui/media';

export function Cheats() {
  const g = useGame((s) => s.game!);
  const update = useGame((s) => s.updateCheats);
  const action = useGame((s) => s.cheatAction);
  const toast = useGame((s) => s.toast);
  const c = g.cheats ?? { enabled: false, persistent: false, quali: {}, race: {}, pace: {} };
  const ids = gridIds(g).sort((a, b) => (teamOf(g, a) ?? '').localeCompare(teamOf(g, b) ?? ''));
  const n = ids.length;
  const forcedCount = Object.keys(c.quali).length + Object.keys(c.race).length + Object.values(c.pace).filter(Boolean).length;
  return (
    <div className="page">
      <h1>🎭 Mode triche</h1>
      <section className="card">
        <div className="row wrap between">
          <label className="row">
            <input type="checkbox" checked={c.enabled} onChange={(e) => update((x) => void (x.enabled = e.target.checked))} /> <b>Activer la triche</b>
          </label>
          <label className="row">
            <input type="checkbox" checked={c.persistent} onChange={(e) => update((x) => void (x.persistent = e.target.checked))} /> Garder les résultats imposés pour tous les GP (sinon : uniquement le prochain)
          </label>
          <button className="ghost sm" onClick={() => update((x) => { x.quali = {}; x.race = {}; x.pace = {}; })}>
            Tout effacer ({forcedCount})
          </button>
        </div>
        <p className="small muted">
          Impose la position de qualif, la position à l’arrivée (ou un abandon) et le rythme de n’importe quel pilote, toi compris. En course, les pilotes concernés accélèrent ou ralentissent progressivement pour atteindre la position voulue, et le classement final est ajusté à l’arrivée.
        </p>
        <div className="row wrap">
          <button className="ghost sm" onClick={() => { action('money'); toast('+10 M€'); }}>💶 +10 M€</button>
          <button className="ghost sm" onClick={() => { action('stats'); toast('+3 à tous tes attributs'); }}>📈 +3 attributs</button>
          <button className="ghost sm" onClick={() => { action('energy'); toast('Énergie et moral au max'); }}>⚡ Forme max</button>
          <button className="ghost sm" onClick={() => { action('trust'); toast('Confiance de l’équipe : 100'); }}>🤝 Confiance équipe 100</button>
          <button className="ghost sm" onClick={() => { action('friends'); toast('Tout le paddock t’apprécie davantage'); }}>💛 +20 amitié avec tous</button>
          <button className="ghost sm" onClick={() => { action('followers'); toast('+1 M d’abonnés'); }}>📸 +1 M abonnés</button>
          <button className="ghost sm" onClick={() => { action('car'); toast('Voiture améliorée'); }}>🏎️ +2 à ta voiture</button>
        </div>
      </section>
      <section className="card" style={{ opacity: c.enabled ? 1 : 0.5 }}>
        <div className="cheat-row small muted">
          <span>Pilote</span>
          <span>Qualif imposée</span>
          <span>Arrivée imposée</span>
          <span>Rythme</span>
        </div>
        {ids.map((id) => (
          <div key={id} className={`cheat-row ${id === PLAYER_ID ? 'me' : ''}`}>
            <span className="row">
              <DriverPhoto id={id} size={26} />
              <DriverName id={id} short />
              <TeamLogo id={teamOf(g, id)} size={16} />
              <span className="small muted">{overall(statsOf(g, id))}</span>
            </span>
            <select disabled={!c.enabled} value={c.quali[id] ?? ''} onChange={(e) => update((x) => { if (e.target.value) x.quali[id] = Number(e.target.value); else delete x.quali[id]; })}>
              <option value="">— libre —</option>
              {Array.from({ length: n }, (_, i) => (
                <option key={i} value={i + 1}>
                  P{i + 1}
                </option>
              ))}
            </select>
            <select disabled={!c.enabled} value={c.race[id] ?? ''} onChange={(e) => update((x) => { const v = e.target.value; if (!v) delete x.race[id]; else x.race[id] = v === 'DNF' ? 'DNF' : Number(v); })}>
              <option value="">— libre —</option>
              <option value="DNF">❌ Abandon</option>
              {Array.from({ length: n }, (_, i) => (
                <option key={i} value={i + 1}>
                  P{i + 1}
                </option>
              ))}
            </select>
            <span className="row">
              <input type="range" min={-3} max={3} step={0.5} disabled={!c.enabled} value={c.pace[id] ?? 0} onChange={(e) => update((x) => { const v = Number(e.target.value); if (v) x.pace[id] = v; else delete x.pace[id]; })} />
              <span className="num small">{(c.pace[id] ?? 0) > 0 ? '+' : ''}{c.pace[id] ?? 0}%</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
